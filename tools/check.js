#!/usr/bin/env node
/** Dependency-free checks for calendar date boundaries and evidence states. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function checkSyntax(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkSyntax(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(file), encoding: 'utf8' });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  }
}

async function main() {
  checkSyntax(path.join(root, 'public/js'));
  // Load browser ES modules without adding a build step or changing package type.
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
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  const load = (file) => import(moduleUrl(path.join(root, 'public/js', file)));
  const { buildSeries, calendarDays, seriesDay } = await load('series.js');
  const { activityMidnight, dateKey, hourInZone, zoneOffset, setTimeZone, getTimeZone, subscribeTimeZone } = await load('time-zone.js');
  const { formatClock, formatDateTime } = await load('format.js');
  const { eventTime, resetRhythm, hourHistogram, timelineView } = await load('model.js');
  const { translator } = await load('i18n.js');
  assert.equal(seriesDay('2026-10-05T06:59:59Z'), 0);
  assert.equal(seriesDay('2026-10-05T07:00:00Z'), 1);
  assert.equal(seriesDay('2026-10-13T01:03:25Z'), 8);
  assert.equal(seriesDay('invalid'), null);
  assert.equal(seriesDay('2026-11-02T07:59:59Z'), 28);
  assert.equal(seriesDay('2026-11-02T08:00:00Z'), 29);
  assert.equal(activityMidnight('2026-11-02') - activityMidnight('2026-11-01'), 25 * 3600000);
  assert.equal(zoneOffset('America/Los_Angeles', Date.parse('2026-10-19T00:00Z')), 'UTC-07:00');
  assert.equal(zoneOffset('America/Los_Angeles', Date.parse('2026-11-02T12:00Z')), 'UTC-08:00');

  // It is already the 19th in Beijing while the activity is still on the 18th.
  const now = Date.parse('2026-10-19T00:30:00Z');
  const project = (series, timeZone = 'Asia/Shanghai') => calendarDays(series, { now, timeZone });
  const row = (series, date) => series.rows.find((row) => row.date === date);
  const empty = buildSeries({ now });
  const local = project(empty);
  assert.equal(local.rows.length, 29, 'The Pacific activity spans 29 Beijing calendar dates');
  assert.equal(local.startDate, '2026-10-05');
  assert.equal(local.endDate, '2026-11-02');
  assert.equal(row(local, '2026-10-18').kind, 'empty');
  assert.equal(row(local, '2026-10-19').kind, 'waiting');
  assert.equal(row(local, '2026-10-20').kind, 'future');
  const pacific = project(empty, 'America/Los_Angeles');
  assert.equal(pacific.rows.length, 28);
  assert.equal(pacific.todayDate, '2026-10-18');
  assert.equal(row(pacific, '2026-10-18').kind, 'waiting');
  assert.equal(row(pacific, '2026-10-19').kind, 'future');
  assert.equal(empty.today, 14, 'Activity day is independent of display timezone');
  assert.equal(buildSeries({ now: Date.parse('2026-10-04T12:00:00Z') }).phase, 'upcoming');
  assert.equal(buildSeries({ now: Date.parse('2026-11-03T12:00:00Z') }).phase, 'ended');

  const seed = { posts: [{ id: '1', at: '2026-10-17T16:20:57Z', en: 'Day 13/ Reset', zh: '重置' }] };
  const pending = buildSeries({ seed, now });
  assert.equal(row(project(pending), '2026-10-18').kind, 'announced');
  assert.equal(pending.counts.reset, 0, 'An announcement is not a confirmed reset');
  const reset = { id: 'reset', group: 'reset', confirmed: true, announcedAt: '2026-10-17T16:20:57Z', effectiveAt: '2026-10-17T20:41:01Z', summary: 'Day 13 of the 28-day activity: reset confirmed' };
  const verified = buildSeries({ seed, now, timeline: { events: [reset] } });
  const pendingEvent = { ...reset, id: '1', confirmed: false, verification: 'pending', effectiveAt: null };
  const duplicate = buildSeries({ seed, now, timeline: { events: [reset, pendingEvent] } });
  assert.equal(duplicate.entries.length, 1, 'Pending live record must not duplicate confirmed archive');
  const onlyPending = buildSeries({ now, timeline: { events: [pendingEvent] } });
  assert.equal(onlyPending.counts.reset, 0);
  assert.equal(onlyPending.counts.announced, 1);
  const bankedAndPending = buildSeries({ seed, now, timeline: { events: [{ ...reset, id: 'banked', group: 'banked', bankedGrant: true }] } });
  assert.equal(bankedAndPending.counts.announced, 1, 'A banked grant must not confirm a reset announcement');
  assert.equal(timelineView({ events: [{ group: 'reset', confirmed: false, reset_verification_status: 'pending' }, { group: 'reset', confirmed: true }] }).counts.reset, 1);
  assert.equal(hourHistogram([reset, pendingEvent], 'Asia/Shanghai')[4], 1);
  assert.equal(hourHistogram([reset, pendingEvent], 'UTC')[20], 1);
  assert.equal(hourHistogram([reset, pendingEvent], 'Asia/Shanghai').reduce((a, b) => a + b, 0), 1);
  assert.equal(verified.entries.length, 1, 'Do not duplicate a confirmed announcement');
  assert.equal(row(project(verified), '2026-10-18').kind, 'reset');
  assert.equal(row(project(verified, 'America/Los_Angeles'), '2026-10-17').kind, 'reset');
  assert.equal(row(project(verified, 'UTC'), '2026-10-17').kind, 'reset');
  assert.equal(verified.entries[0].at, reset.effectiveAt);
  assert.equal(formatClock(verified.entries[0].at, 'zh', 'Asia/Shanghai'), '04:41');
  assert.equal(verified.entries[0].day, 13);
  assert.equal(verified.counts.reset, 1);
  assert.equal(eventTime(reset), reset.effectiveAt);
  const crossMidnight = { ...reset, announcedAt: '2026-10-17T15:59:00Z', effectiveAt: '2026-10-17T16:01:00Z' };
  const cross = project(buildSeries({ now, timeline: { events: [crossMidnight] } }));
  assert.equal(row(cross, '2026-10-17').entries.length, 0);
  assert.equal(row(cross, '2026-10-18').kind, 'reset', 'Group by effective time, even across local midnight');
  const gaps = resetRhythm([reset, { ...reset, effectiveAt: '2026-10-18T20:41:01Z' }]).gaps;
  assert.equal(gaps[0].days, 1, 'History rhythm also uses effective time');

  const combined = buildSeries({ seed, now, timeline: { events: [reset] }, feed: { posts: [
    { id: '2', at: '2026-10-18T00:00:00Z', text: 'Day 13/ Product improvements' },
    { id: '3', at: '2026-10-18T12:00:00Z', text: 'A nice Sunday', kind: 'other' },
  ] } });
  assert.equal(row(project(combined), '2026-10-18').entries.length, 2, 'Keep distinct events on the same civil date');
  assert.equal(combined.recordedDays, 1, 'Multiple events on one activity day count as one recorded day');
  assert.equal(combined.entries.length, 2, 'Exclude unrelated chatter');
  const named = buildSeries({ now, feed: { posts: [{ at: '2026-10-13T23:00:00Z', text: 'Day 8/ Reset', localizedText: '重置' }] } });
  assert.equal(named.entries[0].day, 8);
  assert.equal(row(project(named), '2026-10-14').kind, 'announced', 'An activity day number must not override the actual date');
  assert.equal(dateKey('2026-10-17T18:30:00Z', 'Asia/Kathmandu'), '2026-10-18');
  assert.equal(hourInZone('2026-10-17T18:30:00Z', 'Asia/Kathmandu'), 0);
  assert.equal(dateKey('invalid'), null);

  let notifications = 0;
  const stop = subscribeTimeZone(() => notifications++);
  setTimeZone('Asia/Shanghai');
  assert.equal(formatClock(reset.effectiveAt), '04:41');
  setTimeZone('UTC');
  assert.equal(getTimeZone(), 'UTC');
  assert.equal(storage.get('codex-reset.timeZone'), 'UTC');
  assert.equal(formatClock(reset.effectiveAt), '20:41');
  assert.match(formatDateTime(reset.effectiveAt), /17/);
  assert.equal(setTimeZone('bad/zone'), false);
  assert.equal(getTimeZone(), 'UTC');
  stop();
  const before = notifications;
  setTimeZone('local');
  assert.equal(notifications, before);
  for (const locale of ['zh', 'en']) {
    const t = translator(locale);
    for (const key of ['timezone.label', 'calendar.todayEmpty', 'calendar.pastEmpty', 'calendar.activityRef', 'series.kind.empty', 'calendar.short.empty']) assert.notEqual(t(key), key);
  }
  console.log('PASS: module syntax; timezone dates, local today and DST; effective-time grouping; multiple events; announcement confirmation; shared timezone formatting and subscriptions; bilingual states.');

}

main().catch((error) => { console.error(error); process.exitCode = 1; });
