#!/usr/bin/env node
// Verify the exact release through the public TLS entry after the server switches slots.
//
// Static assets must be byte-identical to the release. Page URLs are rendered
// server-side, so they are checked for the markers that matter — status, a real
// title and one h1 — instead of a byte comparison with the shell template.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');

const PAGE_ROUTES = [
  '/',
  '/timeline',
  '/status',
  '/vigil',
  '/en/',
  '/en/timeline',
  '/plan',
  '/en/plan',
  '/guide/codex-reset',
  '/en/guide/codex-reset',
];

async function verifyDeployment(manifest, base = 'https://codex-reset.opentunnel.asia') {
  async function get(route) {
    const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
    return response;
  }

  const health = await (await get('/__health')).json();
  assert.equal(health.ok, true);
  for (const key of ['id', 'commit', 'sha256', 'dirty']) {
    assert.equal(health.release?.[key], manifest[key], `Public release ${key} mismatch`);
  }

  for (const [file, expected] of Object.entries(manifest.files)) {
    if (!file.startsWith('public/') || file === 'public/index.html') continue;
    const route = file.slice('public'.length);
    const body = Buffer.from(await (await get(route)).arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(body).digest('hex'), expected, `${route}: content mismatch`);
  }

  // Page URLs are rendered, so assert the crawlable surface rather than bytes.
  for (const route of PAGE_ROUTES) {
    const html = await (await get(route)).text();
    assert.match(html, /^<!doctype html>/i, `${route}: doctype`);
    assert.match(html, /<title>[^<]{8,}<\/title>/, `${route}: title`);
    assert.match(html, /<h1[ >]/, `${route}: h1`);
    assert.match(html, /rel="canonical"/, `${route}: canonical`);
    assert.ok(!html.includes('<!--seo-head-->') && !html.includes('<!--seo-body-->'), `${route}: template placeholders replaced`);
  }

  const robots = await get('/robots.txt');
  assert.match(robots.headers.get('content-type') || '', /text\/plain/);
  assert.match(await robots.text(), /Sitemap: https?:\/\/[^/\s]+\/sitemap\.xml/);
  const sitemap = await get('/sitemap.xml');
  assert.match(sitemap.headers.get('content-type') || '', /xml/);
  assert.match(await sitemap.text(), /<urlset/);

  const feed = await (await get('/api/feed?locale=zh')).json();
  assert.ok(Array.isArray(feed.tweets) && feed.tweets.length > 0, 'Public feed has no records');
  return health.release;
}

if (require.main === module) {
  (async () => {
    const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    if (process.env.GITHUB_ACTIONS === 'true') {
      assert.equal(manifest.commit, process.env.GITHUB_SHA, 'Release must match the triggering commit');
      assert.equal(manifest.dirty, false, 'Actions must deploy a clean checkout');
    }
    // Nginx reload is graceful; a short retry covers requests reaching the old worker.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const release = await verifyDeployment(manifest, process.env.PUBLIC_URL);
        console.log(`PASS: public TLS release ${release.id}; commit ${release.commit}; static assets, rendered pages, sitemap and feed`);
        return;
      } catch (error) {
        if (attempt === 3) throw error;
        console.error(`Public verification attempt ${attempt} failed: ${error.message}`);
        await delay(3000);
      }
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { verifyDeployment };
