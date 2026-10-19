/**
 * The 28-day ship-or-reset series, rebuilt from live data.
 *
 * Calendar dates use the challenge's Pacific timezone, independent of the
 * visitor's timezone. Announcement claims remain distinct from observed resets.
 *
 * A day's outcome is resolved from three sources, in order of authority:
 *   1. a verified observation that day — a global reset, or a banked grant;
 *   2. a post or archive event that names the day;
 *   3. the local mirror of the hand-written translations, for days that have
 *      already rolled out of the live feed window.
 */

const DAY_MS = 86_400_000;
const SERIES_DAYS = 28;
const PACIFIC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const FIRST_DAY_INDEX = Date.UTC(2026, 9, 5) / DAY_MS; // Day 1 = 5 Oct 2026, Pacific

export const SERIES_LENGTH = SERIES_DAYS;

/** Which day of the challenge a Pacific calendar date falls on, or null. */
export function seriesDay(value) {
  const at = typeof value === 'number' ? value : Date.parse(value ?? '');
  if (!Number.isFinite(at)) return null;
  const part = Object.fromEntries(PACIFIC.formatToParts(at).map(({ type, value: v }) => [type, v]));
  const index = Date.UTC(Number(part.year), Number(part.month) - 1, Number(part.day)) / DAY_MS - FIRST_DAY_INDEX + 1;
  return Number.isFinite(index) ? index : null;
}

export const inSeries = (day) => Number.isInteger(day) && day >= 1 && day <= SERIES_DAYS;

/** Day numbers with a real observation behind them, from the reset ledger. */
function observedOutcomes(events) {
  const outcomes = new Map();
  for (const event of events ?? []) {
    const day = seriesDay(event.announcedAt ?? event.effectiveAt);
    if (!inSeries(day)) continue;
    const kind = event.bankedGrant || event.group === 'banked' ? 'banked' : event.group === 'reset' ? 'reset' : null;
    if (!kind) continue;
    const held = outcomes.get(day);
    // The verification detail is the archive's editorial entry, or failing
    // that a post that actually says what happened; anything else on the day
    // is chatter.
    const note = /Day \d+ of the 28-day/i.test(event.summary ?? '')
      ? event.localizedSummary ?? event.summary
      : /reset|limit|quota|credit|限|额度/i.test(event.summary ?? '')
        ? event.localizedSummary ?? event.summary
        : null;
    // A real reset outranks a banked grant on the same day; a real note
    // outranks none; otherwise newest wins.
    const better =
      !held ||
      (kind === 'reset' && held.kind !== 'reset') ||
      (kind === held.kind && Boolean(note) && !held.note) ||
      (kind === held.kind && Boolean(note) === Boolean(held.note) && (event.announcedAt ?? '') > (held.at ?? ''));
    if (!better) continue;
    outcomes.set(day, {
      kind,
      at: event.announcedAt ?? event.effectiveAt ?? null,
      note,
      noteEn: note ? event.summary : null,
      url: event.url ?? null,
      source: event.source ?? null,
    });
  }
  return outcomes;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const DAY_PREFIX = /(?:(?:Roundup of )?Day\s*\d{1,2}(?:\.\d+)?(?:\s*\([^)]{1,40}\))?|第\s*\d{1,2}\s*天[^\/\n]{0,4})\s*\/\s*/gi;

/** The day number has its own column, so it never leads the sentence. */
function clean(text) {
  return String(text ?? '')
    .replace(DAY_PREFIX, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim();
}

const DAY_IN_TEXT = /(?:Day|第)\s*(\d{1,2})(?:\s*\/|\s*天)/i;
const PROSE_DAY = /Day (\d{1,2}) of the 28-day/i;

/** The day a post explicitly names, if it names one. */
function explicitDay(text) {
  const match = PROSE_DAY.exec(text ?? '') ?? DAY_IN_TEXT.exec(text ?? '');
  if (!match) return null;
  const day = Number(match[1]);
  return inSeries(day) ? day : null;
}

/**
 * @param {{ feed?: object|null, timeline?: object|null, seed?: object|null, now?: number }} sources
 */
/**
 * A day forges two things independently: what happened (kind), and what Tibo
 * actually said (text). Tibo's own words always beat the archive's editorial
 * summary; the archive only supplies a day we have no post for, and its
 * verification line rides along as a note when both exist.
 */
export function buildSeries({ feed, timeline, seed, now = Date.now() } = {}) {
  const days = new Map();
  const put = (day, patch) => {
    if (!inSeries(day)) return;
    const held = days.get(day) ?? { day, kind: null, zh: null, en: null, note: null, url: null, at: null, source: null, textRank: 0 };
    const kindRank = { reset: 4, banked: 3, announced: 2, improvement: 1, waiting: 0 };
    const textRank = { 'feed-named': 4, feed: 3, seed: 2, ledger: 1 };
    const patchText = textRank[patch.source] ?? 0;
    const winsText = Boolean(patch.zh) && patchText > (held.textRank ?? 0);
    days.set(day, {
      ...held,
      ...(patch.kind && (kindRank[patch.kind] ?? 0) >= (kindRank[held.kind] ?? -1) ? { kind: patch.kind } : {}),
      ...(winsText ? { zh: patch.zh, en: patch.en ?? null, url: patch.url || held.url, at: patch.at, source: patch.source, textRank: patchText } : {}),
      ...(patch.note && patch.note !== (winsText ? patch.zh : held.zh) ? { note: patch.note, noteEn: patch.noteEn ?? null } : {}),
    });
  };

  // 3. the local mirror of the hand-written translations
  for (const post of seed?.posts ?? []) {
    put(explicitDay(post.en) ?? seriesDay(post.at), {
      kind: /\breset\b/i.test(clean(post.en)) ? 'announced' : 'improvement',
      zh: clean(post.zh),
      en: clean(post.en),
      url: `https://x.com/thsottiaux/status/${post.id}`,
      at: post.at,
      // The mirror is hand-translated and complete, so it outranks anything
      // the live feed renders for the same day.
      source: 'feed-named',
    });
  }

  // 2. Only posts naming a challenge day are daily entries. An unrelated
  //    top-level post must not turn an unrecorded day into a product update.
  for (const post of feed?.posts ?? []) {
    const named = explicitDay(post.text);
    const day = named;
    if (!inSeries(day)) continue;
    const chosenReset = /\breset\b/i.test(clean(post.text));
    put(day, {
      kind: chosenReset ? 'announced' : 'improvement',
      zh: clean(post.localizedText ?? post.text),
      en: clean(post.text),
      url: post.url,
      at: post.at,
      source: named ? 'feed-named' : 'feed',
    });
  }

  // 1. what was actually observed
  for (const [day, outcome] of observedOutcomes(timeline?.events)) {
    put(day, {
      kind: outcome.kind,
      zh: clean(outcome.note),
      en: clean(outcome.noteEn),
      note: clean(outcome.note),
      noteEn: clean(outcome.noteEn),
      url: outcome.url,
      at: outcome.at,
      source: 'ledger',
    });
  }

  const currentDay = seriesDay(now) ?? 1;
  const today = Math.min(SERIES_DAYS, Math.max(1, currentDay));
  const rows = [];
  for (let day = 1; day <= SERIES_DAYS; day += 1) {
    rows.push({
      ...(days.get(day) ?? { day, kind: day > currentDay ? 'future' : 'waiting', zh: null, en: null, note: null, url: null, at: null }),
      date: new Date((FIRST_DAY_INDEX + day - 1) * DAY_MS).toISOString().slice(0, 10),
    });
  }

  const counts = { reset: 0, banked: 0, improvement: 0, announced: 0, waiting: 0 };
  for (const row of rows) if (row.kind in counts) counts[row.kind] += 1;

  return {
    today,
    currentDay,
    phase: currentDay < 1 ? 'upcoming' : currentDay > SERIES_DAYS ? 'ended' : 'active',
    startDate: rows[0].date,
    endDate: rows.at(-1).date,
    length: SERIES_DAYS,
    rows,
    counts,
    announcedUrl: seed?.source ?? 'https://x.com/thsottiaux',
    // Number of days with an observed reset or banked grant.
    observedDays: rows.filter((row) => ['reset', 'banked'].includes(row.kind)).length,
  };
}

export const SERIES_KIND = {
  reset: { label: 'series.kind.reset', tone: 'var(--fill-reset)' },
  banked: { label: 'series.kind.banked', tone: 'var(--fill-banked)' },
  improvement: { label: 'series.kind.improvement', tone: 'var(--fill-improve)' },
  announced: { label: 'series.kind.announced', tone: 'var(--warn-text)' },
  waiting: { label: 'series.kind.waiting', tone: 'var(--ink-4)' },
  future: { label: 'series.kind.future', tone: 'var(--ink-4)' },
};
