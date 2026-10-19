#!/usr/bin/env node
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const server = spawn(process.execPath, ['server.js', '--port', '0'], {
  cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'inherit'],
});
async function main() {
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Early server exit: ${code}`)); });
    server.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
  });
  assert.equal((await fetch(`${base}/__health`).then(r => r.json())).ok, true);
  for (const route of ['/', '/timeline', '/status', '/vigil']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<!doctype html>/i);
  }
  assert.equal((await fetch(base + '/%')).status, 400);
  assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(base + '/__health')).status, 200, 'Malformed URLs must not crash the process');
  assert.equal((await fetch(base + '/api/feed', { method: 'POST' })).status, 405);
  const js = await fetch(base + '/js/series.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  console.log('PASS: health, static routes, JS MIME, read-only API and malformed URL isolation');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.kill());
