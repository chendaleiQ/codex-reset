/**
 * Read-only client for the public Codex Reset JSON API (mirrored through the
 * local server at /api/*). Every call is anonymous, cached in memory for a
 * short window, and de-duplicated while in flight.
 */

const inflight = new Map();
const cache = new Map();

export const DEFAULT_TTL = 20_000;

/** @typedef {'zh'|'en'} Locale */

export function apiPath(pathname, { locale, params = {}, fresh = false } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  if (locale && locale !== 'en') search.set('locale', locale);
  if (fresh) search.set('_fresh', String(Date.now()));
  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function readJson(pathname, { ttl = DEFAULT_TTL, fresh = false, signal, locale, params } = {}) {
  const url = apiPath(pathname, { locale, fresh, params });
  const key = url;
  const now = Date.now();
  const hit = cache.get(key);
  if (!fresh && hit && now - hit.at < ttl) return Promise.resolve(hit.value);
  if (inflight.has(key)) return inflight.get(key);

  const request = fetch(url, { headers: { accept: 'application/json' }, signal })
    .then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(body?.error || `http_${response.status}`);
        error.status = response.status;
        error.body = body;
        throw error;
      }
      cache.set(key, { at: Date.now(), value: body });
      return body;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

/** Drops every cached payload, optionally limited to one path prefix. */
export function invalidate(prefix = '') {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

export const endpoints = {
  forecast: (opts) => readJson('/api/forecast', opts),
  timeline: (opts) => readJson('/api/timeline', opts),
  feed: (opts) => readJson('/api/feed', opts),
  status: (opts) => readJson('/api/status', opts),
  statusHistory: (range, opts) => readJson('/api/status-history', { ...opts, params: { range } }),
  health: (opts) => readJson('/api/health', { ttl: 60_000, ...opts }),
  resetPoll: (opts) => readJson('/api/reset-poll', { ...opts, params: { ...opts?.params } }),
  vigil: (opts) => readJson('/api/pray', { ttl: 15_000, ...opts }),
  usageReference: (opts) => readJson('/api/usage-reference', { ttl: 300_000, ...opts }),
};

/** Human-readable failure text for a rejected request. */
export function describeError(error) {
  if (!error) return 'unknown';
  if (error.name === 'AbortError') return 'aborted';
  if (error.status === 429) return 'rate_limited';
  if (error.status) return `http_${error.status}`;
  return error.message || 'network';
}
