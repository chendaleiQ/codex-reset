#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { verifyDeployment } = require('./verify-deployment');

const html = '<!doctype html><title>Deployment fixture</title>';
const script = 'console.log("release fixture");';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = {
  id: '20261019T100000Z-123456789abc', commit: 'a'.repeat(40), sha256: 'b'.repeat(64), dirty: false,
  files: { 'public/index.html': hash(html), 'public/js/main.js': hash(script) },
};
let fault;
const server = http.createServer((req, res) => {
  if (req.url === '/__health') {
    const release = { ...manifest };
    if (fault === 'old-commit') release.commit = 'c'.repeat(40);
    if (fault === 'dirty') release.dirty = true;
    if (fault === 'wrong-release') release.id = 'previous-release';
    return res.end(JSON.stringify({ ok: true, release }));
  }
  if (req.url === '/api/feed?locale=zh') return res.end(JSON.stringify({ tweets: fault === 'empty-feed' ? [] : [{ id: '1' }] }));
  if (fault === 'http-error' && req.url === '/status') { res.writeHead(502); return res.end('Bad Gateway'); }
  if (req.url === '/js/main.js') return res.end(fault === 'stale-asset' ? 'old script' : script);
  res.end(html);
});

server.listen(0, '127.0.0.1', async () => {
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await verifyDeployment(manifest, base)).id, manifest.id);
    for (const [scenario, message] of [
      ['old-commit', /commit mismatch/], ['dirty', /dirty mismatch/], ['wrong-release', /id mismatch/],
      ['stale-asset', /content mismatch/], ['empty-feed', /no records/], ['http-error', /HTTP 502/],
    ]) {
      fault = scenario;
      await assert.rejects(verifyDeployment(manifest, base), message, scenario);
    }
    console.log('PASS: public deployment verification rejects wrong releases, stale assets, empty feed and HTTP errors');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
    server.closeAllConnections();
  }
});
