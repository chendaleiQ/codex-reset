#!/usr/bin/env node
// Fixture test for the public release verifier: every failure mode it must reject.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { verifyDeployment } = require('./verify-deployment');

const shell = '<!doctype html><html><head><!--seo-head--><title>Codex Reset</title></head><body><main id="main"><!--seo-body--></main></body></html>';
const page = '<!doctype html><html lang="zh-Hans"><head><title>Codex 重置追踪：今天会重置吗？</title><link rel="canonical" href="/"></head><body><main><h1>Codex 今天会重置吗？</h1></main></body></html>';
const script = 'console.log("release fixture");';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = {
  id: '20261019T100000Z-123456789abc', commit: 'a'.repeat(40), sha256: 'b'.repeat(64), dirty: false,
  files: { 'public/index.html': hash(shell), 'public/js/main.js': hash(script) },
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
  if (req.url === '/robots.txt') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('User-agent: *\nAllow: /\n\nSitemap: http://127.0.0.1/sitemap.xml\n');
  }
  if (req.url === '/sitemap.xml') {
    res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' });
    return res.end('<?xml version="1.0"?><urlset></urlset>');
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page);
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
