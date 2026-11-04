/**
 * Read/write client for this site's own JSON API (same origin, `/api/*`).
 *
 * Everything except the vigil wall is read-only. Reads are cached in memory for
 * a short window and de-duplicated while in flight; the one write helper
 * (`postJson`) always goes to the network.
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

/**
 * The only write path: JSON in, JSON out. Same-origin by construction, so the
 * server's origin check passes without us sending credentials.
 */
export function postJson(pathname, body, { signal } = {}) {
  return fetch(pathname, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error || `http_${response.status}`);
      error.status = response.status;
      error.body = payload;
      throw error;
    }
    return payload;
  });
}

/** Drops every cached payload, optionally limited to one path prefix. */
export function invalidate(prefix = '') {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

export const endpoints = {
  forecast: (opts) => readJson('/api/forecast', opts),
  timeline: (opts) => readJson('/api/timeline', { ttl: 300_000, ...opts }),
  rhythm: (opts) => readJson('/api/rhythm', { ttl: 300_000, ...opts }),
  status: (opts) => readJson('/api/status', opts),
  health: (opts) => readJson('/api/health', { ttl: 60_000, ...opts }),
  vigil: (opts) => readJson('/api/pray', { ttl: 15_000, ...opts }),
  joinVigil: (entry) => postJson('/api/pray', entry),
  amen: (id) => postJson('/api/pray/amen', { id }),
};

/** Human-readable failure text for a rejected request. */
export function describeError(error) {
  if (!error) return 'unknown';
  if (error.name === 'AbortError') return 'aborted';
  if (error.status === 429) return 'rate_limited';
  if (error.status) return `http_${error.status}`;
  return error.message || 'network';
}
