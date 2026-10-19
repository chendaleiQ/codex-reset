#!/usr/bin/env node
/**
 * Codex Reset — HTTP runtime.
 *
 * Dependency-free HTTP server that
 *   1. serves the static client from ./public,
 *   2. reverse-proxies the public upstream JSON API under /api/*,
 *   3. answers every unknown path with the client shell so the router owns URLs.
 *
 * Usage:  node server.js [--port 4173] [--origin https://codex-reset.com]
 */

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(readArg('--port', process.env.PORT || 4173));
const ORIGIN = readArg('--origin', process.env.CODEX_RESET_ORIGIN || 'https://codex-reset.com');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_TTL_MS = 15_000;
const releasePath = path.join(__dirname, 'RELEASE.json');
const release = fs.existsSync(releasePath) ? JSON.parse(fs.readFileSync(releasePath, 'utf8')) : null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** @type {Map<string, { at: number, status: number, body: Buffer, headers: Record<string,string> }>} */
const cache = new Map();

function upstreamGet(target, headers) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      target,
      { headers: { accept: 'application/json', 'user-agent': 'codex-reset-local/1.0', ...headers } },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode || 502, headers: response.headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    request.setTimeout(15_000, () => request.destroy(new Error('upstream_timeout')));
    request.on('error', reject);
  });
}

async function proxyApi(req, res, url) {
  const key = url.pathname + url.search;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    res.writeHead(hit.status, { ...hit.headers, 'x-local-cache': 'hit' });
    res.end(hit.body);
    return;
  }

  const target = new URL(url.pathname + url.search, ORIGIN);
  // Upstream default is English; the client appends ?locale=xx when it is not.
  const headers = {};
  if (req.headers['accept-language']) headers['accept-language'] = req.headers['accept-language'];

  try {
    const upstream = await upstreamGet(target, headers);
    const pass = {
      'content-type': upstream.headers['content-type'] || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-local-cache': 'miss',
    };
    cache.set(key, { at: Date.now(), status: upstream.status, body: upstream.body, headers: pass });
    res.writeHead(upstream.status, pass);
    res.end(req.method === 'HEAD' ? undefined : upstream.body);
  } catch (error) {
    const body = Buffer.from(
      JSON.stringify({
        error: 'upstream_unavailable',
        detail: String(error && error.message ? error.message : error),
        retry_after_ms: 5000,
      }),
    );
    const stale = hit ? { ...hit, headers: { ...hit.headers, 'x-local-cache': 'stale' } } : null;
    if (stale && stale.status === 200) {
      res.writeHead(200, stale.headers);
      res.end(stale.body);
      return;
    }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  }
}

function sendStatic(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  let decoded;
  try {
    url = new URL(req.url || '/', 'http://localhost');
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  if (url.pathname === '/__health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, origin: ORIGIN, cached: cache.size,
      release: release ? { id: release.id, commit: release.commit, dirty: release.dirty, sha256: release.sha256 } : null }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, HEAD' });
      res.end(JSON.stringify({ error: 'read_only_mirror' }));
      return;
    }
    void proxyApi(req, res, url);
    return;
  }

  const candidate = path.join(PUBLIC_DIR, path.normalize(decoded).replace(/^(\.\.[/\\])+/, ''));
  if (candidate.startsWith(PUBLIC_DIR) && path.extname(candidate) && fs.existsSync(candidate)) {
    sendStatic(res, candidate);
    return;
  }
  sendStatic(res, path.join(PUBLIC_DIR, 'index.html'));
});

server.listen(PORT, () => {
  process.stdout.write(`Codex Reset running at http://localhost:${server.address().port}  (upstream: ${ORIGIN})\n`);
});
