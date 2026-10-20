/**
 * View models. The upstream payloads are rich and occasionally partial; every
 * builder here returns a total, self-describing shape so no view has to guess
 * whether a field exists, and no view can render a value without its label.
 */

import { bounds, daysBetween, parseTime } from './format.js';
import { getTimeZone, hourInZone } from './time-zone.js';

/* ------------------------------------------------------------------ forecast */

/**
 * The signal ladder, in priority order. What kind of claim is available is the
 * product's central distinction, so it is resolved once, here.
 *
 *   commitment — an official statement that names a window and has not landed
 *   pending    — an official claim whose deadline has not passed yet
 *   tease      — a hint with no commitment; never rendered as a probability
 *   model      — no signal; the figure is a historical baseline
 */
export function signalLadder(forecast, now = Date.now()) {
  const official = forecast?.official_signal ?? null;
  const tease = forecast?.tease_signal ?? null;
  const alert = forecast?.latest_alert ?? null;
  const lastReset = parseTime(forecast?.last_reset_at);
  const officialAt = parseTime(official?.at);
  const landed = lastReset !== null && officialAt !== null && lastReset > officialAt;

  const commitment = Boolean(official?.window) && !landed;
  const pending =
    !commitment && alert?.kind === 'watch' && alert?.state === 'active' && ['done', 'on_its_way'].includes(alert?.pending)
      ? alert.pending
      : null;

  if (commitment) return { kind: 'commitment', official, tease, alert };
  if (official && !landed) return { kind: 'official', official, tease, alert };
  if (pending) return { kind: 'pending', pending, official, tease, alert };
  if (tease) return { kind: 'tease', tease, official: null, alert };
  return { kind: 'model', official: null, tease: null, alert };
}

export function forecastView(forecast, locale, now = Date.now()) {
  if (!forecast) return null;
  const probabilities = forecast.probabilities ?? {};
  const ladder = signalLadder(forecast, now);
  const wait = forecast.wait_comparison ?? null;
  const cadence = forecast.cadence ?? null;
  const scoreBand = forecast.signal_score?.band ?? null;
  const scoreValue = Number.isFinite(forecast.signal_score?.value) ? forecast.signal_score.value : null;

  const localize = (bag) => (bag ? bag[locale] ?? bag.en ?? null : null);

  return {
    ladder,
    updatedAt: forecast.updated_at ?? null,
    lastResetAt: forecast.last_reset_at ?? null,
    ageDays: daysBetween(forecast.last_reset_at, now),
    chance24: Number.isFinite(probabilities.rounded_24h) ? probabilities.rounded_24h : null,
    chance48: Number.isFinite(probabilities.rounded_48h) ? probabilities.rounded_48h : null,
    range24: bounds(probabilities.range_24h?.lower, probabilities.range_24h?.upper, locale),
    range48: bounds(probabilities.range_48h?.lower, probabilities.range_48h?.upper, locale),
    commitmentFloor: Number.isFinite(probabilities.commitment_floor_percent)
      ? probabilities.commitment_floor_percent
      : null,
    rangeAria: forecast.range_aria?.[locale] ?? null,
    confidence: typeof forecast.confidence === 'string' ? forecast.confidence : null,
    confidenceNote: forecast.confidence_note ?? null,
    confidenceToken: localize(forecast.model_token) ?? localize(forecast.wait_token),
    wait,
    waitCopy: localize(forecast.wait_copy),
    contextCopy: localize(forecast.context_copy),
    hintCopy: localize(forecast.hint_copy),
    window: forecast.official_signal?.window ?? forecast.time_window ?? null,
    windowIsOfficial: Boolean(forecast.official_signal?.window),
    timezone: forecast.time_window?.timezone ?? 'UTC',
    endAt: forecast.official_signal?.window?.end_at ?? null,
    cadence,
    tease: ladder.tease,
    teaseNote: localize(forecast.tease_card_note),
    teaseAge: localize(forecast.tease_post_age),
    official: ladder.official,
    evidence: Array.isArray(forecast.evidence) ? forecast.evidence : [],
    scoreBand,
    scoreValue,
    context: forecast.context ?? null,
  };
}

/** A short, plain sentence stating what the figure above it actually is. */
export function forecastRubric(view, t) {
  if (!view) return { key: 'rubric.unavailable', tone: 'unavailable' };
  switch (view.ladder.kind) {
    case 'commitment':
      return { key: 'rubric.commitment', tone: 'commitment' };
    case 'official':
      return { key: 'rubric.official', tone: 'official' };
    case 'pending':
      return { key: view.ladder.pending === 'done' ? 'rubric.pendingDone' : 'rubric.pendingOnItsWay', tone: 'commitment' };
    case 'tease':
      return { key: 'rubric.tease', tone: 'tease' };
    default:
      return { key: 'rubric.model', tone: 'model' };
  }
}

/* ---------------------------------------------------------------------- feed */

export const FEED_KINDS = ['signal', 'reset', 'banked', 'limits', 'boost', 'codex', 'candidate', 'other'];

export function feedKind(post) {
  const kind = String(post?.kind ?? '');
  if (FEED_KINDS.includes(kind)) return kind;
  return 'context';
}

function feedPost(post) {
  return {
    id: String(post.id ?? ''),
    kind: feedKind(post),
    at: post.at ?? null,
    text: post.text ?? '',
    localizedText: post.localized_text ?? null,
    translationStatus: post.translation_status ?? null,
    url: post.url ?? null,
    isReply: Boolean(post.is_reply),
    replyingTo: post.replying_to ?? null,
    replies: Number(post.replies) || 0,
    reposts: Number(post.reposts) || 0,
    likes: Number(post.likes) || 0,
    lane: post.tibo_lane ?? null,
    explicit: Boolean(post.explicit_reset_claim),
  };
}

/** All visible posts share one display projection; reset evidence keeps its own source lane. */
function latestFeedPosts(posts, context) {
  const unique = new Map();
  // Prefer the classified source when both lanes contain the same post.
  for (const post of [...posts, ...context]) {
    const key = post.id || post.url || `${post.at}\n${post.text}`;
    const existing = unique.get(key);
    if (existing) {
      // The context copy may carry a translation absent from the signal copy.
      unique.set(key, { ...existing,
        localizedText: existing.localizedText || post.localizedText,
        translationStatus: existing.translationStatus || post.translationStatus,
        url: existing.url || post.url,
      });
    } else unique.set(key, post);
  }
  return [...unique.values()]
    .map(post => post.kind === 'context' ? { ...post, kind: 'other' } : post)
    .sort((a, b) => (parseTime(b.at) ?? -Infinity) - (parseTime(a.at) ?? -Infinity) || 0);
}

export function feedView(feed) {
  if (!feed) return null;
  const posts = (Array.isArray(feed.tweets) ? feed.tweets : []).map(feedPost);
  const radarContext = (Array.isArray(feed.radar_context) ? feed.radar_context : []).map(feedPost);
  return {
    fetchedAt: feed.fetched_at ?? null,
    stale: Boolean(feed.stale),
    contentAgeDays: Number(feed.content_age_days ?? 0),
    newestPostAt: feed.newest_post_at ?? null,
    signalNewestAt: feed.signal_newest_post_at ?? null,
    profile: feed.profile ?? null,
    signal: feed.signal ?? null,
    posts,
    radarContext,
    latestPosts: latestFeedPosts(posts, radarContext),
    banked: Array.isArray(feed.banked_observations) ? feed.banked_observations : [],
    events: Array.isArray(feed.events) ? feed.events : [],
  };
}

/* ------------------------------------------------------------------ timeline */

export const TIMELINE_GROUPS = ['reset', 'banked', 'signal', 'incident', 'milestone'];

/** Effective time is authoritative; announcement time is the fallback. */
export const eventTime = (event) => event.effectiveAt ?? event.announcedAt;
export const isConfirmedReset = (event) => event.group === 'reset' && !event.bankedGrant &&
  (event.confirmed === true || ['verified', 'confirmed'].includes(String(event.verification ?? '').toLowerCase()));

export function timelineView(payload) {
  if (!payload) return null;
  const events = (Array.isArray(payload.events) ? payload.events : []).map((event) => ({
    id: String(event.id ?? ''),
    date: event.date ?? null,
    type: event.type ?? 'reset',
    rawGroup: event.group ?? event.type ?? 'reset',
    // Upstream files banked grants under `credits`; the product's own
    // vocabulary calls them banked, and nothing else may claim that word.
    group: event.banked_grant ? 'banked' : (event.group ?? event.type ?? 'reset'),
    summary: event.summary ?? '',
    localizedSummary: event.localized_summary ?? null,
    translationStatus: event.translation_status ?? null,
    url: event.url ?? null,
    announcedAt: event.announced_at ?? null,
    effectiveAt: event.effective_at ?? null,
    window: event.official_window ?? null,
    scope: event.scope ?? null,
    confidence: event.confidence ?? null,
    source: event.source_label ?? event.source ?? null,
    resetKind: event.reset_kind ?? null,
    audience: Array.isArray(event.audience) ? event.audience : [],
    reasonTags: Array.isArray(event.reason_tags) ? event.reason_tags : [],
    bankedGrant: Boolean(event.banked_grant),
    confirmed: Boolean(event.confirmed),
    verification: event.reset_verification_status ?? null,
    observation: event.observation_result ?? null,
    observationSources: Array.isArray(event.observation_sources) ? event.observation_sources : [],
    isReply: Boolean(event.is_reply),
    replyingTo: event.replying_to ?? null,
    timeKind: event.time_kind ?? null,
  }));
  const counts = events.reduce((acc, event) => {
    acc.total += 1;
    if (isConfirmedReset(event)) acc.reset += 1;
    if (event.group === 'banked' || event.bankedGrant) acc.banked += 1;
    return acc;
  }, { total: 0, reset: 0, banked: 0 });
  return { updatedAt: payload.updated_at ?? null, events, counts };
}

/** Days between consecutive verified resets, oldest first. */
export function resetRhythm(events) {
  const resets = events
    .filter(isConfirmedReset)
    .map((event) => ({ at: parseTime(eventTime(event)), event }))
    .filter((row) => row.at !== null)
    .sort((a, b) => a.at - b.at);
  const gaps = [];
  for (let i = 1; i < resets.length; i += 1) {
    gaps.push({ days: (resets[i].at - resets[i - 1].at) / 86_400_000, at: resets[i].at, event: resets[i].event });
  }
  return { resets, gaps };
}

export function hourHistogram(events, timeZone = getTimeZone()) {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const event of events) {
    if (!isConfirmedReset(event) && event.group !== 'banked' && !event.bankedGrant) continue;
    const hour = hourInZone(eventTime(event), timeZone);
    if (hour === null) continue;
    buckets[hour] += 1;
  }
  return buckets;
}

/* -------------------------------------------------------------------- status */

export const SURFACE_STATE = {
  operational: 'ok',
  degraded_performance: 'warn',
  partial_outage: 'bad',
  major_outage: 'bad',
  under_maintenance: 'warn',
};

export function surfaceTone(status) {
  return SURFACE_STATE[status] ?? 'dim';
}

export function statusView(payload) {
  if (!payload) return null;
  return {
    indicator: payload.indicator ?? null,
    description: payload.description ?? null,
    codex: payload.codex ?? null,
    tone: surfaceTone(payload.codex ?? payload.indicator),
    surfaces: Array.isArray(payload.surfaces) ? payload.surfaces : [],
    degraded: Boolean(payload.degraded),
    incident: payload.active_incident ?? null,
    incidentCount: Number(payload.incident_count) || 0,
    checkedAt: payload.checked_at ?? null,
    history: Array.isArray(payload.history) ? payload.history : [],
  };
}

/* ---------------------------------------------------------------- crowd poll */

export function pollView(payload) {
  if (!payload || payload.open !== true) return null;
  const tally = payload.tally ?? {};
  return {
    pollId: payload.poll_id ?? null,
    openedAt: payload.opened_at ?? null,
    anchor: payload.anchor ?? null,
    expiresAt: payload.expires_at ?? null,
    windows: Array.isArray(payload.windows) ? payload.windows : [],
    openBuckets: Array.isArray(payload.open_buckets) ? payload.open_buckets : [],
    buckets: Array.isArray(tally.buckets) ? tally.buckets : [],
    totalVotes: Number(tally.total_votes) || 0,
    minVotes: Number(tally.min_votes) || 0,
    unlocked: Boolean(tally.unlocked),
    accuracy: payload.accuracy ?? null,
    model: payload.model ?? null,
  };
}

/* --------------------------------------------------------------------- vigil */

const VIGIL_KEY = 'codex-reset.vigil.v1';

export function readVigil() {
  try {
    const value = JSON.parse(localStorage.getItem(VIGIL_KEY) || 'null');
    if (!value || typeof value !== 'object') return { epochId: '', n: 0, name: '', days: 0, at: '', tendedAt: '', amens: [] };
    return {
      epochId: String(value.epochId || ''),
      n: Number(value.n) || 0,
      name: String(value.name || ''),
      days: Number(value.days) || 0,
      at: String(value.at || ''),
      tendedAt: String(value.tendedAt || ''),
      amens: Array.isArray(value.amens) ? value.amens.map(Number).filter(Number.isFinite) : [],
    };
  } catch {
    return { epochId: '', n: 0, name: '', days: 0, at: '', tendedAt: '', amens: [] };
  }
}

export function writeVigil(entry) {
  try {
    localStorage.setItem(VIGIL_KEY, JSON.stringify(entry));
  } catch {
    /* storage disabled — the vigil simply does not persist */
  }
}

export function vigilView(payload) {
  if (!payload) return null;
  const epoch = payload.epoch ?? {};
  return {
    epochId: String(epoch.id ?? ''),
    startedAt: epoch.started_at ?? null,
    cycle: Number(epoch.cycle) || 0,
    kind: epoch.kind ?? null,
    believers: Number(payload.believers ?? payload.total) || 0,
    wall: Array.isArray(payload.wall) ? payload.wall : [],
    amens: payload.amens && typeof payload.amens === 'object' ? payload.amens : {},
    archive: Array.isArray(payload.archive) ? payload.archive : [],
    complete: payload.complete === true,
  };
}

/** Active crowd size for the vigil illustration, capped so the markup stays sane. */
export const crowdSize = (believers) => Math.min(12, Math.max(0, Math.floor(believers || 0)));

export function flameDue(entry, now = Date.now()) {
  const last = String(entry?.tendedAt || entry?.at || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) return false;
  return last < new Date(now).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------- health */

export function healthView(payload) {
  if (!payload) return null;
  return {
    ok: Boolean(payload.ok),
    overall: payload.overall_status ?? 'unknown',
    stale: Boolean(payload.stale),
    contentAgeDays: Number(payload.content_age_days ?? 0),
    feedSource: payload.feed_source ?? null,
    components: payload.components ?? {},
    redundancy: payload.redundancy ?? null,
  };
}
