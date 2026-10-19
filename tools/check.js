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
  const source = fs.readFileSync(path.join(root, 'public/js/series.js'), 'utf8');
  const { buildSeries, seriesDay } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(seriesDay('2026-10-05T06:59:59Z'), 0);
  assert.equal(seriesDay('2026-10-05T07:00:00Z'), 1);
  assert.equal(seriesDay('2026-10-13T01:03:25Z'), 8);
  assert.equal(seriesDay('invalid'), null);
  // Pacific changes to standard time during the final day.
  assert.equal(seriesDay('2026-11-02T07:59:59Z'), 28);
  assert.equal(seriesDay('2026-11-02T08:00:00Z'), 29);
  const now = Date.parse('2026-10-19T12:00:00Z');
  const empty = buildSeries({ now });
  assert.equal(empty.rows.length, 28);
  assert.equal(empty.rows[0].date, '2026-10-05');
  assert.equal(empty.rows.at(-1).date, '2026-11-01');
  assert.equal(empty.rows[14].kind, 'waiting');
  assert.equal(empty.rows[15].kind, 'future');
  assert.equal(empty.today, 15);
  assert.equal(buildSeries({ now: Date.parse('2026-10-04T12:00:00Z') }).phase, 'upcoming');
  assert.equal(buildSeries({ now: Date.parse('2026-11-03T12:00:00Z') }).phase, 'ended');
  const seed = { posts: [{ id: '1', at: '2026-10-10T22:00:00Z', en: 'Day 6/ Reset', zh: '重置' }] };
  const pending = buildSeries({ seed, now });
  assert.equal(pending.rows[5].kind, 'announced');
  assert.equal(pending.counts.reset, 0, 'An announcement is not a confirmed reset');
  const verified = buildSeries({ seed, now, timeline: { events: [{ group: 'reset', announcedAt: '2026-10-10T22:00:00Z', summary: 'Reset confirmed' }] } });
  assert.equal(verified.rows[5].kind, 'reset');
  assert.equal(verified.counts.reset, 1);
  const chatter = buildSeries({ now, feed: { posts: [{ at: '2026-10-18T12:00:00Z', text: 'A nice Sunday', kind: 'other' }] } });
  assert.equal(chatter.rows[13].kind, 'waiting', 'Unrelated posts must not count as daily updates');
  const named = buildSeries({ now, feed: { posts: [{ at: '2026-10-13T23:00:00Z', text: 'Day 8/ Reset', localizedText: '重置' }] } });
  assert.equal(named.rows[7].kind, 'announced', 'Explicit challenge day takes precedence over posting date');
  console.log('PASS: browser module syntax, Pacific midnight and DST, calendar range, future/missing states, announcement confirmation and daily-entry classification.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
