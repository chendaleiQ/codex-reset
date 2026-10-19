#!/usr/bin/env node
// Verify the exact release through the public TLS entry after the server switches slots.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

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
    if (!file.startsWith('public/')) continue;
    const route = file === 'public/index.html' ? '/' : file.slice('public'.length);
    const body = Buffer.from(await (await get(route)).arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(body).digest('hex'), expected, `${route}: content mismatch`);
  }
  for (const route of ['/timeline', '/status', '/vigil']) {
    const body = Buffer.from(await (await get(route)).arrayBuffer());
    assert.equal(crypto.createHash('sha256').update(body).digest('hex'), manifest.files['public/index.html'], `${route}: HTML mismatch`);
  }
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
        console.log(`PASS: public TLS release ${release.id}; commit ${release.commit}; static assets, routes and feed`);
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
