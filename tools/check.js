#!/usr/bin/env node
/**
 * Dependency-free checks for the self-hosted dataset and the model built on it.
 *
 * Two jobs: prove the release does not reach a third party, and prove the
 * numbers the site publishes are computed from the ledger in a way that holds
 * up to boundary cases (duplicate waves, missing rows, empty samples).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

/* ------------------------------------------------------------------ syntax */

function checkCommonJs(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'state') continue;
      checkCommonJs(file);
    } else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${path.relative(root, file)}: ${result.stderr}`);
    }
  }
}

function checkModules(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkModules(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
        input: fs.readFileSync(file),
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `${path.relative(root, file)}: ${result.stderr}`);
    }
  }
}

/* ------------------------------------------------------------ no upstream */

function noThirdPartyRuntime() {
  const runtime = ['server.js', 'lib', 'seo', 'data', 'public/js', 'public/index.html'];
  const forbidden = [
    /codex-reset\.com/i,
    /\/api\/feed/i,
    /\/api\/status-history/i,
    /\/api\/usage-reference/i,
    /\/api\/reset-poll/i,
  ];
  const offenders = [];
  const walk = (relative) => {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute)) walk(path.join(relative, name));
      return;
    }
    if (!/\.(js|html|json)$/.test(relative)) return;
    const text = fs.readFileSync(absolute, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(text)) offenders.push(`${relative}: ${pattern}`);
    }
  };
  for (const entry of runtime) walk(entry);
  assert.deepEqual(offenders, [], `runtime files still reference an upstream surface:\n${offenders.join('\n')}`);
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.ok(!/require\(['"]node:https['"]\)/.test(server), 'server.js must not make HTTPS requests');

  // Linking out is fine (guides cite OpenAI Status); calling out is not.
  const callers = [];
  for (const relative of ['public/js', 'lib', 'seo']) {
    const walk = (entry) => {
      const absolute = path.join(root, entry);
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) {
        for (const name of fs.readdirSync(absolute)) walk(path.join(entry, name));
        return;
      }
      if (!relative.endsWith('.js') && !entry.endsWith('.js')) return;
      const text = fs.readFileSync(absolute, 'utf8');
      if (/fetch\(\s*['"`]https?:\/\//.test(text) || /https\.(get|request)\(/.test(text) || /require\(['"]node:https['"]\)/.test(text)) {
        callers.push(entry);
      }
    };
    walk(relative);
  }
  assert.deepEqual(callers, [], `runtime files still call a remote host:\n${callers.join('\n')}`);
}

/* --------------------------------------------------------------- the model */

async function main() {
  checkCommonJs(path.join(root, 'lib'));
  checkCommonJs(path.join(root, 'seo'));
  checkCommonJs(path.join(root, 'tools'));
  checkModules(path.join(root, 'public/js'));
  noThirdPartyRuntime();

  const model = require('../lib/model');
  const data = require('../lib/data');

  /* numbers that must be right before any probability is published */
  assert.ok(Math.abs(model.gamma(1) - 1) < 1e-9, 'gamma(1) = 1');
  assert.ok(Math.abs(model.gamma(5) - 24) < 1e-6, 'gamma(5) = 24');
  assert.ok(Math.abs(model.gamma(0.5) - Math.sqrt(Math.PI)) < 1e-6, 'gamma(1/2) = sqrt(pi)');
  assert.ok(Math.abs(model.normalCdf(0) - 0.5) < 1e-9, 'normalCdf(0) = 0.5');
  assert.equal(model.median([3, 1, 2]), 2);
  assert.equal(model.quantile([1, 2, 3, 4], 0.5), 2.5);

  /* ledger validation drops bad rows instead of guessing */
  const now = Date.parse('2026-11-04T06:00:00Z');
  const parsed = model.readLedger(
    {
      updated_at: '2026-11-01T00:00:00Z',
      events: [
        { id: 'a', kind: 'reset', at: '2026-10-01T00:00:00Z', state: 'confirmed', quote: 'x', source_url: 'https://x.com/1' },
        { id: 'a', kind: 'reset', at: '2026-10-02T00:00:00Z' },
        { id: 'b', kind: 'nonsense', at: '2026-10-03T00:00:00Z' },
        { id: 'c', kind: 'reset', at: 'not-a-date' },
        { id: 'd', kind: 'banked', at: '2026-10-04T00:00:00Z', state: 'confirmed' },
      ],
    },
    now,
  );
  assert.equal(parsed.events.length, 2, 'two valid rows survive');
  assert.ok(parsed.errors.length >= 3, 'every bad row is reported');

  /* intervals: propagation waves collapse, ordinary gaps survive */
  const resets = [
    { at: Date.parse('2026-01-01T00:00:00Z'), atIso: '2026-01-01T00:00:00Z', date: '2026-01-01', kind: 'reset', state: 'confirmed' },
    { at: Date.parse('2026-01-01T03:00:00Z'), atIso: '2026-01-01T03:00:00Z', date: '2026-01-01', kind: 'reset', state: 'confirmed' },
    { at: Date.parse('2026-01-04T00:00:00Z'), atIso: '2026-01-04T00:00:00Z', date: '2026-01-04', kind: 'reset', state: 'confirmed' },
    { at: Date.parse('2026-01-05T00:00:00Z'), atIso: '2026-01-05T00:00:00Z', date: '2026-01-05', kind: 'reset', state: 'confirmed' },
  ];
  const built = model.buildIntervals(resets);
  assert.equal(built.resets.length, 3, 'a 3-hour propagation wave is one reset');
  assert.equal(built.intervals.length, 2);
  assert.ok(Math.abs(built.intervals[0].days - 3) < 1e-9);
  assert.ok(Math.abs(built.intervals[1].days - 1) < 1e-9);

  const fit = model.fitWeibull([1, 2, 3, 4, 5], [1, 1, 1, 1, 1]);
  assert.ok(fit.k > 0 && fit.scale > 0 && fit.ess > 0, 'Weibull fit is finite');

  const toy = { intervals: [1, 2, 3, 4, 5, 6], weights: [1, 1, 1, 1, 1, 1], fit, k: fit.k, scale: fit.scale };
  for (const age of [0, 0.5, 2, 7, 20]) {
    const p24 = model.probability(toy, age, 24);
    const p48 = model.probability(toy, age, 48);
    assert.ok(p24 >= 0 && p24 <= 1, 'p24 in range');
    assert.ok(p48 >= 0 && p48 <= 1, 'p48 in range');
    assert.ok(p48 >= p24 - 1e-9, 'a 48h horizon cannot be less likely than 24h');
  }
  assert.equal(model.probability(null, 1, 24), null, 'no sample, no number');

  /* an announced-but-unlanded reset flips the mode and never enters the sample */
  const pendingLedger = model.readLedger({
    updated_at: '2026-11-04T00:00:00Z',
    events: [
      { id: 'p1', kind: 'reset', at: '2026-10-20T00:00:00Z', state: 'confirmed', quote: 'a', source_url: 'https://x.com/1' },
      { id: 'p2', kind: 'reset', at: '2026-10-24T00:00:00Z', state: 'confirmed', quote: 'b', source_url: 'https://x.com/2' },
      { id: 'p3', kind: 'reset', at: '2026-10-26T00:00:00Z', state: 'announced', quote: 'lands tonight', source_url: 'https://x.com/3' },
    ],
  }, now);
  const pendingForecast = model.forecast(pendingLedger, { now });
  assert.equal(pendingForecast.mode, 'pending');
  assert.equal(pendingForecast.pending.id, 'p3');
  assert.equal(pendingForecast.model.interval_sample, 1, 'the announcement is not in the interval sample');

  /* no data means no number, not a zero */
  const emptyForecast = model.forecast(model.readLedger({ updated_at: '2026-11-04T00:00:00Z', events: [] }, now), { now });
  assert.equal(emptyForecast.probabilities.rounded_24h, null);
  assert.equal(emptyForecast.mode, 'model');
  assert.equal(emptyForecast.confidence, 'low');

  /* the real release */
  const forecast = data.forecast();
  assert.ok(forecast.probabilities.rounded_24h >= 0 && forecast.probabilities.rounded_24h <= 100);
  assert.ok(forecast.probabilities.rounded_48h >= forecast.probabilities.rounded_24h, '48h >= 24h');
  for (const range of [forecast.probabilities.range_24h, forecast.probabilities.range_48h]) {
    if (!range) continue;
    assert.ok(range.lower <= range.upper, 'range ordered');
    assert.ok(range.lower >= 0 && range.upper <= 1, 'range in [0,1]');
  }
  assert.ok(['high', 'medium', 'low'].includes(forecast.confidence));
  assert.ok(forecast.model.interval_sample > 0, 'model sample exists');
  assert.ok(forecast.backtest.method === 'walk-forward');
  assert.ok(forecast.evidence.length >= 3, 'every number ships its evidence');
  assert.ok(forecast.windows.length > 0);
  assert.ok(forecast.windows[0].count >= forecast.windows[forecast.windows.length - 1].count, 'windows are ranked');

  const timeline = data.timeline();
  assert.ok(timeline.events.length >= 60, 'ledger has history');
  assert.ok(timeline.stats.reset >= 50 && timeline.stats.banked >= 5);
  assert.ok(timeline.events.every((event, index, list) => index === 0 || event.at >= list[index - 1].at), 'events are chronological');
  assert.ok(
    timeline.events.filter((event) => event.kind === 'reset').every((event) => event.source_url),
    'every reset is traceable to a public post',
  );

  const rhythm = data.rhythm();
  const heatTotal = rhythm.heatmap.flat().reduce((sum, value) => sum + value, 0);
  assert.equal(heatTotal, rhythm.stats.resets, 'heatmap covers every reset once');
  assert.equal(rhythm.heatmap.length, 7);
  assert.equal(rhythm.heatmap[0].length, 24);
  assert.equal(rhythm.hour.reduce((sum, value) => sum + value, 0), rhythm.stats.resets);
  assert.equal(rhythm.weekday.reduce((sum, value) => sum + value, 0), rhythm.stats.resets);
  assert.ok(rhythm.intervals.every((row) => row.days > 0), 'intervals are positive');
  assert.ok(rhythm.windows.length === 5);
  assert.ok(rhythm.windows[0].share >= rhythm.windows[4].share);

  const status = data.status();
  assert.ok(['fresh', 'stale', 'unknown'].includes(status.freshness.level));
  assert.ok(status.checks.every((check) => typeof check.ok === 'boolean'));
  assert.ok(status.checks.some((check) => check.name === 'ledger' && check.ok), 'ledger check passes');
  assert.equal(status.dataset.total, timeline.events.length);
  assert.ok(status.dataset.span_days > 300);

  const posts = data.posts();
  assert.equal(posts.ended, true, 'the 28-day run is closed');
  assert.equal(posts.days, 28);
  assert.ok(posts.posts.length >= 20, 'the retrospective keeps the recorded days');
  assert.ok(posts.posts.every((post) => post.at && post.url));

  /* the vigil store writes nowhere near the release */
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-reset-state-'));
  process.env.STATE_DIR = stateDir;
  delete require.cache[require.resolve('../lib/vigil')];
  const vigil = require('../lib/vigil');
  vigil.bind(data.ledger.events);
  assert.equal(vigil.payload().believers, 0);
  const joined = vigil.join({ name: '  阿力  ', days: 3, country: 'cn' });
  assert.equal(joined.entry.name, '阿力', 'name is trimmed');
  assert.equal(joined.entry.country, 'CN');
  assert.equal(vigil.payload().believers, 1);
  vigil.join({ name: '阿力', days: 4 });
  assert.equal(vigil.payload().believers, 1, 'one name per epoch, not duplicates');
  assert.equal(vigil.payload().wall[0].days, 4, 're-submitting updates the entry');
  assert.equal(vigil.amen(joined.entry.id).count, 1);
  assert.throws(() => vigil.join({ name: '' }), /invalid_name/);
  assert.throws(() => vigil.amen('not-an-id'), /invalid_id/);
  assert.ok(fs.existsSync(path.join(stateDir, 'vigil.json')), 'state lives in STATE_DIR');
  fs.rmSync(stateDir, { recursive: true, force: true });

  /* the browser's pure-data modules still load and agree with the server */
  const moduleUrls = new Map();
  function moduleUrl(file) {
    if (moduleUrls.has(file)) return moduleUrls.get(file);
    const source = fs.readFileSync(file, 'utf8').replace(/from (['"])(\.[^'"]+)\1/g,
      (_, quote, relative) => `from ${quote}${moduleUrl(path.resolve(path.dirname(file), relative))}${quote}`);
    const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    moduleUrls.set(file, url);
    return url;
  }
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  const load = (file) => import(moduleUrl(path.join(root, 'public/js', file)));
  const { translator } = await load('i18n.js');
  assert.equal(typeof translator('zh'), 'function');
  assert.ok(translator('zh')('nav.home').length > 0);
  assert.ok(translator('en')('nav.home').length > 0);

  console.log('PASS: no upstream references; ledger, model, forecast, rhythm, status, posts and vigil store');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
