#!/usr/bin/env node
/**
 * Codex Reset — HTTP runtime.
 *
 * Dependency-free HTTP server that
 *   1. serves the static client from ./public,
 *   2. answers `/api/*` from the release's own dataset (no upstream proxy),
 *   3. renders every crawlable route server-side (head, first paint, JSON-LD),
 *   4. stores the vigil wall in $STATE_DIR, the one writable surface,
 *   5. answers robots.txt, sitemap.xml and llms.txt from the same snapshot.
 *
 * Usage:  node server.js [--port 4173]
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(readArg('--port', process.env.PORT || 4173));
const PUBLIC_DIR = path.join(__dirname, 'public');
const releasePath = path.join(__dirname, 'RELEASE.json');
const release = fs.existsSync(releasePath) ? JSON.parse(fs.readFileSync(releasePath, 'utf8')) : null;

const seo = require('./seo/render');
const data = require('./lib/data');
const vigil = require('./lib/vigil');

const startedAt = Date.now();
vigil.bind(data.ledger.events);

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
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  // nginx already sets X-Content-Type-Options and Referrer-Policy for the site.
  'x-frame-options': 'SAMEORIGIN',
};

/**
 * The shell around `#main` is static HTML; English routes get their chrome
 * translated and their links localised before the app boots.
 */
const SHELL_EN = [
  ['<html lang="zh-Hans">', '<html lang="en">'],
  ['href="/" aria-label="Codex 重置 — 概况"', 'href="/en/" aria-label="Codex Reset — overview"'],
  ['>跳到主要内容<', '>Skip to main content<'],
  ['id="wordmark-sub">自有台账的重置记录<', 'id="wordmark-sub">A reset ledger we keep ourselves<'],
  ['id="primary-nav" aria-label="版块"', 'id="primary-nav" aria-label="Sections"'],
  ['aria-label="显示时区"', 'aria-label="Display time zone"'],
  ['data-i18n="timezone.hint">用于具体时间；窗口按 UTC 计算<', 'data-i18n="timezone.hint">Exact times only; windows are computed in UTC<'],
  ['aria-label="语言"', 'aria-label="Language"'],
  ['aria-label="数据状态"', 'aria-label="Data status"'],
  ['rel="noopener">源码<', 'rel="noopener">Source code<'],
  ['id="locale-label">中文<', 'id="locale-label">English<'],
  ['aria-label="提醒" title="提醒"', 'aria-label="Alerts" title="Alerts"'],
  ['aria-label="提醒方式"', 'aria-label="Alert methods"'],
  ['aria-label="页脚"', 'aria-label="Footer"'],
  ['href="/rhythm" data-i18n="nav.rhythm">重置节奏<', 'href="/en/rhythm" data-i18n="nav.rhythm">Reset rhythm<'],
  ['href="/timeline" data-i18n="nav.timeline">重置记录<', 'href="/en/timeline" data-i18n="nav.timeline">Reset history<'],
  ['href="/plan" data-seo-link="plan">28 天复盘<', 'href="/en/plan" data-seo-link="plan">28-day retrospective<'],
  ['href="/about" data-seo-link="about">关于<', 'href="/en/about" data-seo-link="about">About<'],
  ['href="/status" data-i18n="nav.status">数据状态<', 'href="/en/status" data-i18n="nav.status">Data status<'],
  ['href="/vigil" data-i18n="nav.vigil">一起等重置<', 'href="/en/vigil" data-i18n="nav.vigil">The vigil<'],
  ['href="/guide/codex-reset" data-seo-link="guide-reset">重置说明<', 'href="/en/guide/codex-reset" data-seo-link="guide-reset">Reset guide<'],
  ['href="/guide/codex-5-hour-limit" data-seo-link="guide-limit">5 小时限额<', 'href="/en/guide/codex-5-hour-limit" data-seo-link="guide-limit">5-hour limit<'],
  ['href="/guide/codex-banked-reset" data-seo-link="guide-banked">备用额度<', 'href="/en/guide/codex-banked-reset" data-seo-link="guide-banked">Banked resets<'],
  ['href="/status" data-tone="dim"', 'href="/en/status" data-tone="dim"'],
  ['id="colophon-note">非官方项目，与 OpenAI 无关。数值仅供参考。<', 'id="colophon-note">Unofficial project, not affiliated with OpenAI. Figures are estimates.<'],
  ['data-i18n="footer.data">数据来源：本站公开台账（X 原帖可追溯）<', 'data-i18n="footer.data">Source: this site’s own ledger, every row traceable to a public post<'],
];

/**
 * Fills the two shell slots that would otherwise be an em dash for a crawler:
 * the data-status chip and the ledger timestamp in the footer. The client
 * keeps them live once it boots.
 */
function decorateShell(html, lang) {
  const en = lang === 'en';
  const status = data.status();
  const level = status.freshness?.level || 'unknown';
  const chipText = level === 'fresh' ? (en ? 'Data fresh' : '数据新鲜') : level === 'stale' ? (en ? 'Data stale' : '数据过期') : en ? 'Unknown' : '未知';
  const tone = level === 'fresh' ? 'ok' : level === 'stale' ? 'warn' : 'dim';
  const updated = status.updated_at ? `${status.updated_at.slice(0, 16).replace('T', ' ')} UTC` : en ? 'unknown' : '未知';
  return html
    .replace(
      '<a class="status-chip" id="status-chip" href="/status" data-tone="dim" aria-label="数据状态">',
      `<a class="status-chip" id="status-chip" href="/status" data-tone="${tone}" aria-label="${en ? 'Data status' : '数据状态'}">`,
    )
    .replace('<span class="status-chip-text">—</span>', `<span class="status-chip-text">${chipText}</span>`)
    .replace('<span id="colophon-updated">—</span>', `<span id="colophon-updated">${updated}</span>`);
}

function localizeShell(html, locale) {
  if (locale !== 'en') return html;
  return SHELL_EN.reduce((output, [from, to]) => output.split(from).join(to), html);
}

/** The page shell, read once. `<!--seo-head-->` and `<!--seo-body-->` are the injection points. */
const template = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

/* --------------------------------------------------------------------- API */

const API = {
  '/api/forecast': () => data.forecast(),
  '/api/timeline': () => data.timeline(),
  '/api/rhythm': () => data.rhythm(),
  '/api/status': () => data.status(),
  '/api/pray': () => vigil.payload(),
  '/api/health': () => ({
    ok: true,
    generated_at: new Date().toISOString(),
    dataset: data.dataset(),
    model: data.forecast().model,
  }),
};

function json(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
    'content-length': body.length,
    ...extraHeaders,
  });
  res.end(body);
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function parseJsonBody(req) {
  const text = await readBody(req);
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch {
    throw Object.assign(new Error('invalid_json'), { status: 400 });
  }
}

/** A write is only accepted from our own origin; cross-site form posts are not. */
function sameOrigin(req) {
  const source = req.headers.origin;
  if (!source) return true; // same-origin fetch may omit it; no cookies are used
  try {
    const origin = new URL(source);
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return origin.host === host;
  } catch {
    return false;
  }
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (pathname === '/api/pray') {
    if (req.method === 'GET' || req.method === 'HEAD') {
      json(res, 200, vigil.payload());
      return;
    }
    if (req.method === 'POST') {
      if (!sameOrigin(req)) {
        json(res, 403, { error: 'cross_origin_write' });
        return;
      }
      try {
        const body = await parseJsonBody(req);
        const result = vigil.join(body);
        json(res, 201, { ok: true, ...result });
      } catch (error) {
        json(res, error.status || 500, { error: error.message, detail: error.detail });
      }
      return;
    }
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, HEAD, POST' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  if (pathname === '/api/pray/amen') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'POST' });
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    if (!sameOrigin(req)) {
      json(res, 403, { error: 'cross_origin_write' });
      return;
    }
    try {
      const body = await parseJsonBody(req);
      const result = vigil.amen(body.id);
      json(res, 200, { ok: true, count: result.count });
    } catch (error) {
      json(res, error.status || 500, { error: error.message, detail: error.detail });
    }
    return;
  }

  const builder = API[pathname];
  if (!builder) {
    json(res, 404, { error: 'not_found' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, HEAD' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  try {
    json(res, 200, builder());
  } catch (error) {
    json(res, 500, { error: 'build_failed', detail: String(error && error.message ? error.message : error) });
  }
}

/* --------------------------------------------------------------- documents */

function sendStatic(res, filePath, req) {
  fs.readFile(filePath, (error, bytes) => {
    if (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  });
}

/** Absolute origin as the visitor reached us, so canonicals match the live host. */
function requestOrigin(req) {
  const forwarded = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwarded === 'string' && forwarded
      ? forwarded.split(',')[0].trim()
      : req.socket && req.socket.encrypted
        ? 'https'
        : 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'codex-reset.opentunnel.asia';
  return `${proto}://${host}`;
}

function sendDocument(res, req, document) {
  const standalone = Boolean(document.standalone);
  const html = standalone
    ? [
        '<!doctype html>',
        `<html lang="${document.lang}">`,
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        document.head,
        document.headExtra || '',
        '</head>',
        '<body>',
        document.body,
        '</body>',
        '</html>',
      ].join('\n')
    : localizeShell(
        decorateShell(
          template.replace('<!--seo-head-->', document.head).replace('<!--seo-body-->', document.body),
          document.lang === 'en' ? 'en' : 'zh',
        ),
        document.lang === 'en' ? 'en' : 'zh',
      );

  res.writeHead(document.status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache',
    'x-robots-tag': document.status === 404 ? 'noindex' : 'all',
    ...SECURITY_HEADERS,
  });
  res.end(req.method === 'HEAD' ? undefined : html);
}

function redirect(res, location, status = 301) {
  res.writeHead(status, { location, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600', ...SECURITY_HEADERS });
  res.end(`Moved to ${location}`);
}

function sendText(res, req, status, type, body) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'public, max-age=300', ...SECURITY_HEADERS });
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* ------------------------------------------------------------------ server */

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

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD, POST' });
    res.end('Method not allowed');
    return;
  }

  if (url.pathname === '/__health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({
      ok: true,
      generated_at: new Date().toISOString(),
      uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
      dataset: data.dataset(),
      release: release ? { id: release.id, commit: release.commit, dirty: release.dirty, sha256: release.sha256 } : null,
    }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    void handleApi(req, res, url);
    return;
  }

  if (req.method === 'POST') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD, POST' });
    res.end('Method not allowed');
    return;
  }

  const origin = requestOrigin(req);

  if (url.pathname === '/robots.txt') {
    sendText(res, req, 200, 'text/plain; charset=utf-8', seo.robotsTxt(origin));
    return;
  }
  if (url.pathname === '/sitemap.xml') {
    sendText(res, req, 200, 'application/xml; charset=utf-8', seo.sitemapXml(origin));
    return;
  }
  if (url.pathname === '/llms.txt') {
    sendText(res, req, 200, 'text/plain; charset=utf-8', seo.llmsTxt(origin));
    return;
  }

  // One canonical spelling per URL: a trailing slash or /index.html must not
  // become a second indexable copy of the same page.
  if (url.pathname === '/index.html') {
    redirect(res, '/');
    return;
  }
  if (url.pathname === '/en') {
    redirect(res, '/en/');
    return;
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/') && url.pathname !== '/en/') {
    redirect(res, url.pathname.replace(/\/+$/, ''));
    return;
  }

  if (decoded === '/about' || decoded === '/en/about') {
    sendDocument(res, req, seo.aboutDocument({ origin, pathname: decoded }));
    return;
  }
  if (decoded === '/plan' || decoded === '/en/plan') {
    sendDocument(res, req, seo.planDocument({ origin, pathname: decoded }));
    return;
  }
  if (decoded === '/archive' || decoded === '/en/archive') {
    sendDocument(res, req, seo.archiveIndexDocument({ origin, pathname: decoded }));
    return;
  }
  if (/^(?:\/en)?\/archive\/\d{4}-\d{2}\/?$/.test(decoded)) {
    const monthPage = seo.archiveMonthDocument({ origin, pathname: decoded });
    if (monthPage) {
      sendDocument(res, req, monthPage);
      return;
    }
  }

  const article = seo.articleDocument({ origin, pathname: decoded });
  if (article) {
    sendDocument(res, req, article);
    return;
  }

  const document = seo.documentFor({ origin, pathname: decoded });
  if (document) {
    sendDocument(res, req, document);
    return;
  }

  const candidate = path.join(PUBLIC_DIR, path.normalize(decoded).replace(/^(\.\.[/\\])+/, ''));
  const hasExtension = Boolean(path.extname(candidate));
  if (candidate.startsWith(PUBLIC_DIR) && hasExtension && fs.existsSync(candidate)) {
    sendStatic(res, candidate, req);
    return;
  }

  if (!hasExtension) {
    sendDocument(res, req, seo.notFoundDocument({ origin, pathname: decoded }));
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end('Not found');
});

async function main() {
  await seo.init();
  server.listen(PORT, () => {
    process.stdout.write(`Codex Reset running at http://localhost:${server.address().port}  (dataset: ${data.dataset().events} events)\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`Boot failed: ${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
