#!/usr/bin/env node
/**
 * Codex Reset — HTTP runtime.
 *
 * Dependency-free HTTP server that
 *   1. serves the static client from ./public,
 *   2. reverse-proxies the public upstream JSON API under /api/*,
 *   3. renders every crawlable route server-side (head, first paint, JSON-LD)
 *      and hands the client shell to the router for anything else it owns,
 *   4. answers robots.txt, sitemap.xml and llms.txt from the live snapshot.
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

const seo = require('./seo/render');
const seoData = require('./seo/data');

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
  ['id="wordmark-sub">已验证的重置记录<', 'id="wordmark-sub">Verified reset records<'],
  ['id="primary-nav" aria-label="版块"', 'id="primary-nav" aria-label="Sections"'],
  ['aria-label="显示时区"', 'aria-label="Display time zone"'],
  ['data-i18n="timezone.hint">用于具体时间；活动日按 Tibo 的日序排列<', 'data-i18n="timezone.hint">Used for exact times; activity days follow Tibo’s numbering<'],
  ['aria-label="语言"', 'aria-label="Language"'],
  ['aria-label="提醒" title="提醒"', 'aria-label="Alerts" title="Alerts"'],
  ['aria-label="提醒方式"', 'aria-label="Alert methods"'],
  ['aria-label="页脚"', 'aria-label="Footer"'],
  ['href="/timeline" data-i18n="nav.timeline">重置记录<', 'href="/en/timeline" data-i18n="nav.timeline">Reset history<'],
  ['href="/status" data-i18n="nav.status">服务状态<', 'href="/en/status" data-i18n="nav.status">Service status<'],
  ['href="/vigil" data-i18n="nav.vigil">一起等重置<', 'href="/en/vigil" data-i18n="nav.vigil">The vigil<'],
  ['href="/plan" data-seo-link="plan">28 天计划<', 'href="/en/plan" data-seo-link="plan">28-day plan<'],
  ['href="/guide/codex-reset" data-seo-link="guide-reset">重置说明<', 'href="/en/guide/codex-reset" data-seo-link="guide-reset">Reset guide<'],
  ['href="/guide/codex-5-hour-limit" data-seo-link="guide-limit">5 小时限额<', 'href="/en/guide/codex-5-hour-limit" data-seo-link="guide-limit">5-hour limit<'],
  ['href="/guide/codex-banked-reset" data-seo-link="guide-banked">备用额度<', 'href="/en/guide/codex-banked-reset" data-seo-link="guide-banked">Banked resets<'],
  ['href="/status" data-tone="dim"', 'href="/en/status" data-tone="dim"'],
  ['id="colophon-note">非官方项目，与 OpenAI 无关。数值仅供参考。<', 'id="colophon-note">Unofficial project, not affiliated with OpenAI. Figures are estimates.<'],
  ['data-i18n="footer.data">数据来源：Codex Reset 公开记录<', 'data-i18n="footer.data">Source: public Codex Reset records<'],
];

function localizeShell(html, locale) {
  if (locale !== 'en') return html;
  return SHELL_EN.reduce((output, [from, to]) => output.split(from).join(to), html);
}

/** @type {Map<string, { at: number, status: number, body: Buffer, headers: Record<string,string> }>} */
const cache = new Map();

/** The page shell, read once. `<!--seo-head-->` and `<!--seo-body-->` are the injection points. */
const template = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');

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
      'x-robots-tag': 'noindex',
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
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
    res.end(body);
  }
}

function sendStatic(res, filePath, req) {
  fs.readFile(filePath, (error, data) => {
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
    res.end(req.method === 'HEAD' ? undefined : data);
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
        template.replace('<!--seo-head-->', document.head).replace('<!--seo-body-->', document.body),
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

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  if (url.pathname === '/__health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, origin: ORIGIN, cached: cache.size, seo: seoData.stats(),
      release: release ? { id: release.id, commit: release.commit, dirty: release.dirty, sha256: release.sha256 } : null }));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    void proxyApi(req, res, url);
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
  // Boot must not wait on the network: the container health check runs within
  // seconds of start, and the upstream can take a moment. Pages render the
  // parts they have and fill in as soon as the snapshot lands.
  await seo.init();
  server.listen(PORT, () => {
    process.stdout.write(`Codex Reset running at http://localhost:${server.address().port}  (upstream: ${ORIGIN})\n`);
  });
  void seoData.start({ upstream: ORIGIN });
}

main().catch((error) => {
  process.stderr.write(`Boot failed: ${error && error.stack ? error.stack : error}\n`);
  process.exit(1);
});
