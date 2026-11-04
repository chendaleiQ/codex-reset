'use strict';
/**
 * Snapshot for the server renderer.
 *
 * This used to be a background poller over the public upstream API. It is now a
 * straight read of the release's own dataset (`lib/data.js`), which is what
 * makes the site self-contained: a crawler receives real numbers in the first
 * byte, and nothing in the request path can reach a third party.
 */

const data = require('../lib/data');
const model = require('../lib/model');

const zh = { en: false };

/**
 * Everything the renderer needs, in one object. The `payload` blocks are the
 * same shapes `/api/*` returns, so a page and its hydrated client cannot drift.
 */
function snapshot(locale = 'zh') {
  const payload = data.snapshot();
  const { forecast, timeline, rhythm, status, posts, meta } = payload;

  const records = timeline.events
    .filter((event) => event.kind === 'reset')
    .slice()
    .reverse()
    .map((event) => ({
      at: event.at,
      date: event.date,
      type: 'reset',
      pending: event.state !== 'confirmed',
      summary: event.quote,
      url: event.source_url,
      effective_at: event.effective_at,
    }));

  const events = timeline.events
    .slice()
    .reverse()
    .map((event) => ({
      at: event.at,
      date: event.date,
      type: event.kind === 'banked' ? 'credits' : 'reset',
      kind: event.kind,
      pending: event.state !== 'confirmed',
      summary: event.quote,
      url: event.source_url,
    }));

  const resets = records.filter((record) => !record.pending);

  return {
    locale,
    at: payload.at,
    updatedAt: timeline.updated_at,
    stale: status.freshness.level === 'stale',
    forecast,
    timeline,
    rhythm,
    status,
    posts,
    meta,
    lastResetAt: forecast.last_reset_at,
    ageDays: forecast.age_days,
    chance24: forecast.probabilities.rounded_24h,
    chance48: forecast.probabilities.rounded_48h,
    confidence: forecast.confidence,
    model: forecast.model,
    backtest: forecast.backtest,
    cadence: forecast.cadence,
    wait: forecast.wait,
    window: forecast.window,
    windows: forecast.windows,
    records,
    events,
    resets,
    counts: timeline.stats,
    typicalDays: forecast.cadence?.overall_median_days ?? null,
  };
}

function stats() {
  const dataset = data.dataset();
  return {
    at: Date.now(),
    events: dataset.events,
    reset: dataset.reset,
    banked: dataset.banked,
    updated_at: dataset.updated_at,
    errors: dataset.errors,
    locales: ['zh', 'en'],
    source: 'local-dataset',
    model: model.PARAMS.version,
  };
}

/**
 * Kept for the server's boot sequence; there is nothing to prefetch any more,
 * and boot must not wait on a network it no longer uses.
 */
function start() {
  return Promise.resolve();
}

module.exports = { start, snapshot, stats };
