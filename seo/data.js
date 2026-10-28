'use strict';
/**
 * Upstream snapshot for server-side rendering.
 *
 * The client polls the same public JSON API through `/api/*`. The server keeps
 * its own copy so a crawler receives real numbers in the first byte instead of
 * an empty shell that only fills in once JavaScript runs.
 *
 * Refresh is cheap and polite: one round of four endpoints per locale every
 * couple of minutes, in the background. A failed round keeps the previous
 * snapshot and marks it stale.
 */

const https = require('node:https');
const { URL } = require('node:url');

const REFRESH_MS = Number(process.env.SEO_REFRESH_MS || 120_000);
const REQUEST_TIMEOUT_MS = 12_000;
const ENDPOINTS = ['forecast', 'timeline', 'status', 'feed'];
const LOCALES = ['zh', 'en'];

/** @type {{ at: number, data: Record<string, any>, errors: string[], timer: NodeJS.Timeout|null, ready: Promise<void>|null }} */
const state = { at: 0, data: {}, errors: [], timer: null, ready: null };

let origin = 'https://codex-reset.com';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { accept: 'application/json', 'user-agent': 'codex-reset-seo/1.0 (+https://codex-reset.opentunnel.asia/)' } },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`${url} -> HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(new Error(`${url} -> invalid JSON`));
          }
        });
      },
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('upstream_timeout')));
    request.on('error', reject);
  });
}

async function refresh() {
  const errors = [];
  const next = { ...state.data };
  const tasks = [];
  for (const locale of LOCALES) {
    const slot = { ...(next[locale] || {}) };
    next[locale] = slot;
    for (const endpoint of ENDPOINTS) {
      const query = locale === 'zh' ? '' : `?locale=${locale}`;
      tasks.push(
        fetchJson(new URL(`/api/${endpoint}${query}`, origin).toString())
          .then((payload) => {
            slot[endpoint] = payload;
          })
          .catch((error) => {
            errors.push(`${locale}/${endpoint}: ${error.message}`);
          }),
      );
    }
  }
  await Promise.all(tasks);
  state.data = next;
  state.errors = errors;
  if (tasks.length) state.at = Date.now();
}

/** Start (or reuse) the background refresh loop. */
function start({ upstream } = {}) {
  if (upstream) origin = upstream;
  if (state.ready) return state.ready;
  state.ready = refresh()
    .catch(() => {})
    .then(() => {
      if (!state.timer) {
        state.timer = setInterval(() => {
          refresh().catch(() => {});
        }, REFRESH_MS);
        state.timer.unref?.();
      }
    });
  return state.ready;
}

function stamp(value) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
}

const KIND_BY_TYPE = { reset: 'reset', boost: 'banked', unlock: 'banked', credits: 'banked', other: 'other' };

/**
 * Fold the four upstream payloads into the handful of facts the first paint
 * shows. Everything is optional: a missing source simply drops its block.
 */
function snapshot(locale) {
  const slot = state.data[locale] || state.data.zh || {};
  const forecast = slot.forecast || {};
  const timeline = slot.timeline || {};
  const status = slot.status || {};
  const feed = slot.feed || {};

  const events = Array.isArray(timeline.events) ? timeline.events : Array.isArray(feed.events) ? feed.events : [];
  const records = events
    .map((event) => ({
      date: event.date || null,
      at: event.effective_at || event.announced_at || null,
      type: event.type || 'other',
      pending: event.reset_verification_status === 'pending',
      summary: typeof event.summary === 'string' ? event.summary : '',
      url: event.url || null,
    }))
    .sort((a, b) => (stamp(b.at) ?? 0) - (stamp(a.at) ?? 0));
  const resets = events
    .filter((event) => event && (event.type === 'reset' || event.group === 'reset'))
    .map((event) => ({
      at: event.effective_at || event.announced_at || null,
      date: event.date || null,
      summary: typeof event.summary === 'string' ? event.summary : '',
      url: event.url || null,
      verified: event.reset_verification_status && event.reset_verification_status !== 'pending',
    }))
    .sort((a, b) => (stamp(b.at) ?? 0) - (stamp(a.at) ?? 0));

  const lastResetAt = forecast.last_reset_at || resets.find((reset) => stamp(reset.at))?.at || null;
  const probabilities = forecast.probabilities || {};
  const chance24 = Number.isFinite(probabilities.rounded_24h) ? probabilities.rounded_24h : null;
  const chance48 = Number.isFinite(probabilities.rounded_48h) ? probabilities.rounded_48h : null;
  const cadence = forecast.cadence || {};

  const tweets = Array.isArray(feed.tweets) ? feed.tweets : [];
  const posts = tweets
    .slice()
    .sort((a, b) => (stamp(b.at) ?? 0) - (stamp(a.at) ?? 0))
    .slice(0, 6)
    .map((tweet) => ({
      at: tweet.at || null,
      text: (locale === 'zh' ? tweet.localized_text || tweet.text : tweet.text) || '',
      url: tweet.url || null,
    }))
    .filter((post) => post.text);

  const surfaces = Array.isArray(status.surfaces)
    ? status.surfaces.map((surface) => ({ label: surface.label || surface.id, status: surface.status || 'unknown' }))
    : [];

  const stats = timeline.stats || {};

  return {
    locale,
    at: state.at,
    stale: state.errors.length > 0 || Boolean(feed.stale),
    lastResetAt,
    ageDays: Number.isFinite(forecast.age_days) ? forecast.age_days : null,
    chance24,
    chance48,
    forecastMode: forecast.mode || null,
    officialSignal: forecast.official_signal
      ? {
          summary: forecast.official_signal.localized_summary || forecast.official_signal.summary || '',
          url: forecast.official_signal.url || null,
          at: forecast.official_signal.at || null,
          window: forecast.official_signal.window?.localized_label || forecast.official_signal.window?.label || null,
        }
      : null,
    typicalDays: Number.isFinite(cadence.recent_median_days)
      ? cadence.recent_median_days
      : Number.isFinite(cadence.weighted_mean_days)
        ? cadence.weighted_mean_days
        : null,
    records,
    events: events.map((event) => ({
      date: event.date || null,
      at: event.effective_at || event.announced_at || null,
      type: event.type || 'other',
      kind: KIND_BY_TYPE[event.type] || 'other',
      summary: typeof event.summary === 'string' ? event.summary : '',
      url: event.url || null,
    })),
    resets,
    counts: {
      resets: Number.isFinite(stats.reset) ? stats.reset : resets.length,
      banked: (Number.isFinite(stats.boost) ? stats.boost : 0) + (Number.isFinite(stats.credits) ? stats.credits : 0),
      events: events.length,
    },
    posts,
    status: {
      indicator: status.indicator || null,
      description: status.localized_description || status.description || '',
      surfaces,
    },
  };
}

function stats() {
  return { at: state.at, errors: state.errors.slice(0, 6), locales: Object.keys(state.data) };
}

module.exports = { start, refresh, snapshot, stats, REFRESH_MS };
