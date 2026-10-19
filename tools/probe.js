#!/usr/bin/env node
/**
 * Headless probe: loads a local route in Chrome and reports what the page
 * actually rendered — console errors, measured geometry, computed styles and
 * any layout overflow. Used for the build's own verification passes.
 *
 *   node tools/probe.js <url> [--width 1440] [--height 1000] [--eval "expr"] [--shot out.png]
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const url = args[0];
const readArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const width = Number(readArg('--width', 1440));
const height = Number(readArg('--height', 1000));
const evalExpr = readArg('--eval', null);
const shot = readArg('--shot', null);
const waitMs = Number(readArg('--wait', 2500));
const full = args.includes('--full');
const port = Number(readArg('--port', 9333));

if (!url) {
  console.error('usage: node tools/probe.js <url> [--width W] [--height H] [--eval expr] [--shot file]');
  process.exit(2);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-probe-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--window-size=${width},${height}`,
    url,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function endpoint(pathname) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}${pathname}`);
      if (response.ok) return response.json();
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error('chrome did not expose a debugging endpoint');
}

async function main() {
  const targets = await endpoint('/json/list');
  const target = targets.find((entry) => entry.type === 'page' && !entry.url.startsWith('chrome://'));
  if (!target) throw new Error('no page target available');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const consoleLines = [];

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Log.entryAdded') {
      const entry = message.params.entry;
      if (entry.level === 'error' || entry.level === 'warning') consoleLines.push(`${entry.level}: ${entry.text}`);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      consoleLines.push(`exception: ${message.params.exceptionDetails.text} ${message.params.exceptionDetails.exception?.description ?? ''}`);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await sleep(waitMs);

  const probe = `(() => {
    const box = (sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), font: cs.fontFamily.split(',')[0], size: cs.fontSize, color: cs.color, bg: cs.backgroundColor };
    };
    const overflow = [...document.querySelectorAll('body *')]
      .filter((n) => n.scrollWidth - n.clientWidth > 2 && getComputedStyle(n).overflowX === 'visible')
      .slice(0, 12)
      .map((n) => n.className || n.tagName);
    return {
      title: document.title,
      lang: document.documentElement.lang,
      bodyW: document.body.scrollWidth,
      docW: document.documentElement.clientWidth,
      sections: [...document.querySelectorAll('h1, h2')].map((n) => n.textContent.trim()).slice(0, 20),
      boxes: {
        rail: box('.hourrail'),
        masthead: box('.masthead'),
        route: box('.route'),
        svg: box('.route-svg'),
        departure: box('.departure'),
        verdict: box('.verdict-word'),
      },
      overflow,
    };
  })()`;

  const result = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
  let extra = null;
  if (evalExpr) {
    const value = await send('Runtime.evaluate', { expression: evalExpr, returnByValue: true, awaitPromise: true });
    extra = value.result?.value;
  }

  if (shot) {
    const metrics = full ? await send('Page.getLayoutMetrics') : null;
    const png = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: full,
      ...(full
        ? {
            clip: {
              x: 0,
              y: 0,
              width: width,
              height: Math.min(20000, Math.ceil(metrics.cssContentSize.height)),
              scale: 1,
            },
          }
        : {}),
    });
    fs.writeFileSync(shot, Buffer.from(png.data, 'base64'));
  }

  console.log(
    JSON.stringify(
      { url, viewport: { width, height }, console: consoleLines, probe: result.result?.value, eval: extra },
      null,
      2,
    ),
  );

  socket.close();
  chrome.kill('SIGKILL');
  fs.rmSync(profile, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error.stack || String(error));
  chrome.kill('SIGKILL');
  process.exit(1);
});
