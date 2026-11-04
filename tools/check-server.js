#!/usr/bin/env node
/**
 * HTTP contract checks: the server answers every route, every API, the one
 * writable endpoint, and isolates malformed input — with no network access.
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-reset-http-'));
const server = spawn(process.execPath, ['server.js', '--port', '0'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, STATE_DIR: stateDir, http_proxy: '', https_proxy: '', HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', all_proxy: '' },
});

async function main() {
  const base = await new Promise((resolve, reject) => {
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

  /* health */
  const health = await fetch(`${base}/__health`).then((response) => response.json());
  assert.equal(health.ok, true);
  assert.ok(health.dataset.events >= 60, 'dataset is packaged with the release');
  assert.equal(health.dataset.errors.length, 0, 'ledger has no validation errors');

  /* crawlable routes */
  for (const route of ['/', '/rhythm', '/timeline', '/status', '/vigil', '/plan', '/about', '/archive']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `${route}: status`);
    assert.match(await response.text(), /<!doctype html>/i, `${route}: document`);
  }

  /* the API is our own and complete */
  for (const [route, check] of [
    ['/api/forecast', (body) => assert.ok(body.probabilities && body.model && body.evidence.length)],
    ['/api/timeline', (body) => assert.ok(body.events.length >= 60 && body.stats.reset >= 50)],
    ['/api/rhythm', (body) => assert.equal(body.heatmap.length, 7)],
    ['/api/status', (body) => assert.ok(body.freshness && body.checks.length)],
    ['/api/health', (body) => assert.equal(body.ok, true)],
    ['/api/pray', (body) => assert.equal(body.believers, 0)],
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, `${route}: status`);
    assert.match(response.headers.get('content-type') || '', /application\/json/, `${route}: json`);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex', `${route}: noindex`);
    check(await response.json());
  }

  /* the only write: join the wall, then amen it */
  const joined = await fetch(base + '/api/pray', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '阿力', days: 3, country: 'cn' }),
  });
  assert.equal(joined.status, 201);
  const entry = (await joined.json()).entry;
  assert.equal(entry.name, '阿力');
  assert.equal((await fetch(base + '/api/pray').then((response) => response.json())).believers, 1);
  const amen = await fetch(base + '/api/pray/amen', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: entry.id }),
  });
  assert.equal(amen.status, 200);
  assert.equal((await amen.json()).count, 1);

  /* bad input is rejected, not stored */
  assert.equal((await fetch(base + '/api/pray', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '' }),
  })).status, 400);
  assert.equal((await fetch(base + '/api/pray', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  })).status, 400);
  assert.equal((await fetch(base + '/api/pray', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ name: 'x' }),
  })).status, 403);
  assert.equal((await fetch(base + '/api/pray/amen', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'zzz' }),
  })).status, 400);

  /* read-only everywhere else */
  assert.equal((await fetch(base + '/api/forecast', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/api/feed')).status, 404);
  assert.equal((await fetch(base + '/api/nope')).status, 404);
  assert.equal((await fetch(base + '/api/pray/amen')).status, 405);

  /* malformed URLs cannot crash the process */
  assert.equal((await fetch(base + '/%')).status, 400);
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(base + '/__health')).status, 200);

  /* static assets keep their MIME type */
  const js = await fetch(base + '/js/main.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  const css = await fetch(base + '/css/tokens.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);

  /* the state file lives in STATE_DIR, not in the release */
  assert.ok(fs.existsSync(path.join(stateDir, 'vigil.json')));
  console.log('PASS: health, routes, own API, vigil writes, read-only isolation, malformed URL handling');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
    fs.rmSync(stateDir, { recursive: true, force: true });
  });
