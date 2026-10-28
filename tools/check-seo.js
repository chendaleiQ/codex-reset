#!/usr/bin/env node
/**
 * Crawlable-surface checks.
 *
 * The point of the server renderer is that a crawler with JavaScript disabled
 * still gets a complete, unique, indexable page. These checks assert exactly
 * that: status codes, one h1, a unique title, a canonical, hreflang pairs,
 * structured data, robots and sitemap. Everything runs against a real server
 * process, no mocks.
 */

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROUTES = [
  ['/', 'zh-Hans', '/'],
  ['/timeline', 'zh-Hans', '/timeline'],
  ['/status', 'zh-Hans', '/status'],
  ['/vigil', 'zh-Hans', '/vigil'],
  ['/en/', 'en', '/en/'],
  ['/en/timeline', 'en', '/en/timeline'],
  ['/en/status', 'en', '/en/status'],
  ['/en/vigil', 'en', '/en/vigil'],
  ['/guide/codex-reset', 'zh-Hans', '/guide/codex-reset'],
  ['/guide/codex-5-hour-limit', 'zh-Hans', '/guide/codex-5-hour-limit'],
  ['/guide/codex-banked-reset', 'zh-Hans', '/guide/codex-banked-reset'],
  ['/en/guide/codex-reset', 'en', '/en/guide/codex-reset'],
  ['/en/guide/codex-5-hour-limit', 'en', '/en/guide/codex-5-hour-limit'],
  ['/en/guide/codex-banked-reset', 'en', '/en/guide/codex-banked-reset'],
  ['/plan', 'zh-Hans', '/plan'],
  ['/en/plan', 'en', '/en/plan'],
  ['/archive', 'zh-Hans', '/archive'],
  ['/en/archive', 'en', '/en/archive'],
];

const server = spawn(process.execPath, ['server.js', '--port', '0'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'inherit'],
});

function start() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 8000);
    server.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Early server exit: ${code}`));
    });
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}`);
      }
    });
  });
}

const count = (haystack, needle) => haystack.split(needle).length - 1;

function attr(html, pattern) {
  const match = pattern.exec(html);
  return match ? match[1] : null;
}

async function waitForSnapshot(base) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = await fetch(`${base}/__health`).then((response) => response.json()).catch(() => null);
    if (health?.seo?.at) return health.seo;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function main() {
  const base = await start();
  const snapshot = await waitForSnapshot(base);
  assert.ok(snapshot, 'upstream snapshot must load for the rendered-text checks');
  const titles = new Map();

  for (const [route, lang, canonicalPath] of ROUTES) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `${route}: status`);
    assert.match(response.headers.get('content-type') || '', /text\/html/, `${route}: content type`);
    const html = await response.text();

    assert.match(html, new RegExp(`<html lang="${lang}"`), `${route}: html lang`);
    assert.equal(count(html, '<h1'), 1, `${route}: exactly one h1`);
    assert.ok(!html.includes('<!--seo-head-->'), `${route}: head placeholder replaced`);
    assert.ok(!html.includes('<!--seo-body-->'), `${route}: body placeholder replaced`);

    const title = attr(html, /<title>([^<]+)<\/title>/);
    assert.ok(title && title.length > 8, `${route}: title`);
    assert.ok(title.length <= 75, `${route}: title length ${title.length}`);
    assert.ok(!titles.has(title), `${route}: duplicate title with ${titles.get(title)}`);
    titles.set(title, route);

    const description = attr(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(description && description.length >= 50, `${route}: description`);
    assert.ok(description.length <= 200, `${route}: description length ${description.length}`);

    const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/);
    assert.ok(canonical && canonical.endsWith(canonicalPath), `${route}: canonical ${canonical}`);

    for (const alternate of ['zh-Hans', 'en', 'x-default']) {
      assert.ok(
        new RegExp(`<link rel="alternate" hreflang="${alternate}" href="https?://[^"]+"`).test(html),
        `${route}: hreflang ${alternate}`,
      );
    }

    assert.match(html, /<script type="application\/ld\+json">/, `${route}: structured data`);
    assert.match(html, /name="robots" content="index, follow/, `${route}: robots`);

    // Server-rendered text, not just a shell: the page's own copy must be there.
    const bodyStart = html.indexOf('<main');
    const body = html.slice(bodyStart);
    // A shell with no JavaScript renders to a few dozen characters; anything
    // past 300 means the page really carries its own copy.
    assert.ok(body.replace(/<[^>]+>/g, '').trim().length > 300, `${route}: rendered text`);
  }

  // English pages must not ship Chinese chrome.
  const en = await fetch(`${base}/en/`).then((response) => response.text());
  assert.ok(!en.includes('跳到主要内容'), 'en: shell translated');
  assert.match(en, /href="\/en\/timeline"/, 'en: footer links localised');

  // robots.txt
  const robots = await fetch(`${base}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get('content-type') || '', /text\/plain/);
  const robotsBody = await robots.text();
  assert.match(robotsBody, /Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
  assert.match(robotsBody, /Disallow: \/api\//);

  // sitemap.xml
  const sitemap = await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get('content-type') || '', /xml/);
  const sitemapBody = await sitemap.text();
  for (const [, , canonicalPath] of ROUTES) {
    assert.ok(sitemapBody.includes(`<loc>http://127.0.0.1:`) && sitemapBody.includes(canonicalPath), `sitemap: ${canonicalPath}`);
  }
  assert.ok(count(sitemapBody, '<url>') >= ROUTES.length + 20, 'sitemap: routes plus monthly archive');

  // Monthly archive: discovered from the index, rendered with its own head.
  const archiveIndex = await fetch(`${base}/archive`).then((response) => response.text());
  const monthPath = attr(archiveIndex, /href="(\/archive\/\d{4}-\d{2})"/);
  assert.ok(monthPath, 'archive: month link');
  const monthPage = await fetch(base + monthPath);
  assert.equal(monthPage.status, 200, 'archive: month page status');
  const monthHtml = await monthPage.text();
  assert.match(monthHtml, /<h1[ >]/, 'archive: month h1');
  assert.ok(monthHtml.includes(`rel="canonical" href="http://127.0.0.1:`), 'archive: month canonical');
  assert.match(monthHtml, /<title>/, 'archive: month title');

  // llms.txt
  const llms = await fetch(`${base}/llms.txt`);
  assert.equal(llms.status, 200);
  assert.match(await llms.text(), /# Codex Reset/);

  // A real 404 with noindex, not an SPA soft 404.
  const missing = await fetch(`${base}/no-such-page`);
  assert.equal(missing.status, 404);
  const missingBody = await missing.text();
  assert.match(missingBody, /name="robots" content="noindex/);
  assert.equal((await fetch(`${base}/en/no-such-page`)).status, 404);
  assert.equal((await fetch(`${base}/api/feed`, { headers: { accept: 'application/json' } })).status === 200, true);
  const apiHeaders = await fetch(`${base}/api/feed`);
  assert.equal(apiHeaders.headers.get('x-robots-tag'), 'noindex', 'api: noindex header');

  // One canonical spelling per URL.
  for (const [from, to] of [['/index.html', '/'], ['/en', '/en/'], ['/timeline/', '/timeline']]) {
    const response = await fetch(base + from, { redirect: 'manual' });
    assert.ok([301, 302, 308].includes(response.status), `${from}: redirect status`);
    assert.equal(response.headers.get('location'), to, `${from}: redirect target`);
  }

  console.log(`PASS: ${ROUTES.length} crawlable pages, robots, sitemap, structured data, 404 and canonical redirects`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server.kill());
