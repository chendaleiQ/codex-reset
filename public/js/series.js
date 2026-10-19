/** Activity-day identity and event instants are separate from calendar dates. */
import { eventTime, isConfirmedReset } from './model.js';
import { ACTIVITY_ZONE, activityMidnight, dateKey, getTimeZone } from './time-zone.js';

const DAY_MS = 86_400_000;
export const SERIES_LENGTH = 28;
const FIRST_DATE = '2026-10-05';
const FIRST_INDEX = Date.parse(`${FIRST_DATE}T00:00:00Z`) / DAY_MS;
export const inSeries = (day) => Number.isInteger(day) && day >= 1 && day <= SERIES_LENGTH;

export function seriesDay(value) {
  const date = dateKey(value, ACTIVITY_ZONE);
  return date ? Date.parse(`${date}T00:00:00Z`) / DAY_MS - FIRST_INDEX + 1 : null;
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

/** Preserve each event's own instant; never borrow the time from another post. */
export function buildSeries({ feed, timeline, seed, now = Date.now() } = {}) {
  const posts = new Map();
  function addPost(post, fromSeed = false, kind) {
    const day = explicitDay(post.text) ?? (fromSeed ? seriesDay(post.at) : null);
    if (!inSeries(day) || !Number.isFinite(Date.parse(post.at))) return;
    const id = String(post.id || post.url || `${day}:${post.at}`);
    if (posts.has(id)) return;
    posts.set(id, {
      id: `post:${id}`, day, at: post.at,
      kind: kind ?? (/\breset\b/i.test(clean(post.text)) ? 'announced' : 'improvement'),
      zh: clean(post.localizedText || post.text), en: clean(post.text), url: post.url,
      source: 'post',
    });
  }
  for (const post of seed?.posts ?? []) addPost({ id: post.id, at: post.at, text: post.en, localizedText: post.zh, url: `https://x.com/thsottiaux/status/${post.id}` }, true);
  for (const post of feed?.posts ?? []) addPost(post);

  const observations = new Map();
  for (const event of timeline?.events ?? []) {
    if (event.group === 'reset' && !isConfirmedReset(event) && !event.bankedGrant) {
      addPost({ id: event.id, at: eventTime(event), text: event.summary, localizedText: event.localizedSummary, url: event.url }, true, 'announced');
      continue;
    }
    const kind = event.bankedGrant || event.group === 'banked' ? 'banked' : event.group === 'reset' ? 'reset' : null;
    if (!kind) continue;
    const at = eventTime(event);
    const day = explicitDay(event.summary) ?? seriesDay(event.announcedAt ?? at);
    if (!inSeries(day) || !Number.isFinite(Date.parse(at))) continue;
    const id = `event:${event.id || event.url || `${kind}:${at}`}`;
    observations.set(id, { id, day, kind, at, effectiveAt: event.effectiveAt, announcedAt: event.announcedAt, zh: clean(event.localizedSummary || event.summary), en: clean(event.summary), url: event.url, source: 'ledger' });
  }
  const confirmedResetDays = new Set([...observations.values()].filter((event) => event.kind === 'reset').map((event) => event.day));
  const entries = [...observations.values(), ...[...posts.values()].filter((post) => post.kind !== 'announced' || !confirmedResetDays.has(post.day))]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const counts = { reset: 0, banked: 0, improvement: 0, announced: 0 };
  entries.forEach((entry) => counts[entry.kind]++);
  const currentDay = seriesDay(now) ?? 1;
  return {
    currentDay, today: Math.min(SERIES_LENGTH, Math.max(1, currentDay)), length: SERIES_LENGTH,
    phase: currentDay < 1 ? 'upcoming' : currentDay > SERIES_LENGTH ? 'ended' : 'active',
    startAt: activityMidnight(FIRST_DATE), endAt: activityMidnight('2026-11-02'),
    entries, counts, recordedDays: new Set(entries.map((entry) => entry.day)).size,
  };
}

/** Group actual events in the reader's timezone. One date may hold several events. */
export function calendarDays(series, { timeZone = getTimeZone(), now = Date.now() } = {}) {
  const todayDate = dateKey(now, timeZone);
  const byDate = new Map();
  for (const entry of series.entries) {
    const date = dateKey(entry.at, timeZone);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(entry);
  }
  const dates = [...byDate.keys(), dateKey(series.startAt, timeZone), dateKey(series.endAt - 1, timeZone)].sort();
  const startDate = dates[0];
  const endDate = dates.at(-1);
  const rows = [];
  const priority = { reset: 4, banked: 3, announced: 2, improvement: 1 };
  for (let at = Date.parse(`${startDate}T00:00:00Z`); at <= Date.parse(`${endDate}T00:00:00Z`); at += DAY_MS) {
    const date = new Date(at).toISOString().slice(0, 10);
    const entries = byDate.get(date) ?? [];
    const primary = [...entries].sort((a, b) => priority[b.kind] - priority[a.kind])[0];
    rows.push({ date, entries, kind: primary?.kind ?? (date > todayDate ? 'future' : date === todayDate ? 'waiting' : 'empty') });
  }
  return { ...series, rows, startDate, endDate, todayDate, timeZone };
}

export const SERIES_KIND = {
  reset: { label: 'series.kind.reset' },
  banked: { label: 'series.kind.banked' },
  improvement: { label: 'series.kind.improvement' },
  announced: { label: 'series.kind.announced' },
  waiting: { label: 'series.kind.waiting' },
  empty: { label: 'series.kind.empty' },
  future: { label: 'series.kind.future' },
};
