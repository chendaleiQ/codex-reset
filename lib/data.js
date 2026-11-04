'use strict';
/**
 * The site's own data layer.
 *
 * Everything is read from `data/*.json` inside the release. There is no
 * upstream request, no background poller and no network at boot — a release is
 * self-contained, so the site behaves identically on a laptop with wifi off and
 * on the server.
 *
 * Derived payloads are memoised for a minute because the only thing that moves
 * between calls is the current age of the wait.
 */

const fs = require('node:fs');
const path = require('node:path');
const model = require('./model');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TTL_MS = 60_000;

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch (error) {
    return fallback;
  }
}

const rawLedger = readJson('ledger.json', null);
const rawPosts = readJson('posts.json', { startDate: null, days: 28, posts: [] });
const rawMeta = readJson('meta.json', {});

const ledger = model.readLedger(rawLedger || { events: [], updated_at: null });
if (rawLedger === null) ledger.errors.push('ledger.json is missing or unreadable');

/** @type {Map<string, { at: number, value: any }>} */
const memo = new Map();

function cached(key, build) {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const value = build(now);
  memo.set(key, { at: now, value });
  return value;
}

/* ------------------------------------------------------------------- shape */

function timelinePayload(now = Date.now()) {
  const events = ledger.events.map((event) => ({
    id: event.id,
    kind: event.kind,
    date: event.date,
    at: event.atIso,
    announced_at: event.announcedAtIso,
    effective_at: event.effectiveAt === null ? null : new Date(event.effectiveAt).toISOString(),
    state: event.state,
    quote: event.quote,
    source_url: event.sourceUrl,
  }));
  const resets = ledger.events.filter((event) => event.kind === 'reset' && event.state === 'confirmed');
  const banked = ledger.events.filter((event) => event.kind === 'banked');
  return {
    updated_at: ledger.updatedAt === null ? null : new Date(ledger.updatedAt).toISOString(),
    generated_at: new Date(now).toISOString(),
    events,
    stats: { reset: resets.length, banked: banked.length, total: events.length },
    first_at: ledger.events[0]?.atIso ?? null,
    last_reset_at: resets.length ? resets[resets.length - 1].atIso : null,
  };
}

function rhythmPayload(now = Date.now()) {
  const resets = model.resetEvents(ledger.events);
  const banked = ledger.events.filter((event) => event.kind === 'banked');
  const { intervals } = model.buildIntervals(resets);
  const base = model.buildRhythm(resets, banked, now);
  const values = intervals.map((row) => row.days);
  return {
    updated_at: ledger.updatedAt === null ? null : new Date(ledger.updatedAt).toISOString(),
    intervals: intervals.map((row) => ({ at: row.atIso, days: model.round3(row.days) })),
    heatmap: base.heatmap,
    hour: base.hour,
    weekday: base.weekday,
    windows: base.windows,
    months: base.months,
    weekday_labels: base.weekday_labels,
    stats: {
      ...base.stats,
      median_interval_days: model.round1(model.median(values)),
      mean_interval_days: model.round1(model.mean(values)),
      longest_interval_days: values.length ? model.round1(Math.max(...values)) : null,
      shortest_interval_days: values.length ? model.round1(Math.min(...values)) : null,
    },
  };
}

/* ------------------------------------------------------------------ public */

function forecast({ now = Date.now() } = {}) {
  return model.forecast(ledger, { now });
}

function timeline() {
  return cached('timeline', (now) => timelinePayload(now));
}

function rhythm() {
  return cached('rhythm', (now) => rhythmPayload(now));
}

function status() {
  return cached('status', (now) =>
    model.freshStatus(ledger, forecast({ now }), {
      now,
      sources: Array.isArray(rawMeta.sources) ? rawMeta.sources : [],
    }),
  );
}

/** Snapshot for SSR: every payload the renderer needs, built once per render. */
function snapshot({ now = Date.now() } = {}) {
  return {
    ledger,
    posts: rawPosts,
    meta: rawMeta,
    forecast: forecast({ now }),
    timeline: timeline(),
    rhythm: rhythm(),
    status: status(),
    at: now,
  };
}

function dataset() {
  const resets = model.resetEvents(ledger.events);
  return {
    events: ledger.events.length,
    reset: resets.length,
    banked: ledger.events.filter((event) => event.kind === 'banked').length,
    updated_at: ledger.updatedAt === null ? null : new Date(ledger.updatedAt).toISOString(),
    errors: ledger.errors.slice(0, 5),
  };
}

function posts() {
  return rawPosts;
}

module.exports = {
  DATA_DIR,
  ledger,
  posts,
  meta: rawMeta,
  forecast,
  timeline,
  rhythm,
  status,
  snapshot,
  dataset,
  errors: () => ledger.errors,
};
