#!/usr/bin/env node
/**
 * Ingest — the only part of the project that talks to the outside world.
 *
 * The site itself never calls a third party: it serves whatever is inside
 * `data/`. This script is the pipeline that keeps that data current, and it runs
 * outside the request path (locally, or on a scheduled GitHub Actions runner).
 *
 * It reads Tibo's public profile page, which embeds his recent posts as JSON in
 * the server-rendered HTML, extracts reset / banked-reset posts, and appends
 * events that the ledger does not have yet.
 *
 *   node tools/ingest.js            # dry run: print what would change
 *   node tools/ingest.js --apply    # write data/ledger.json
 *   node tools/ingest.js --apply --profile https://x.com/thsottiaux
 *
 * Classification is deliberately conservative:
 *   - a post must actually be about a reset or a banked grant;
 *   - promises ("tomorrow", "will", "next two days") are ignored, not turned
 *     into fake pending events;
 *   - a reset is recorded as `confirmed` only when the wording is past tense or
 *     a bare "Day N/ Reset", and the quote + post URL are stored with it.
 *
 * If X changes its page shape the parser fails loudly and writes nothing.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'ledger.json');
const DEFAULT_PROFILE = 'https://x.com/thsottiaux';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const PROFILE = readArg('--profile', DEFAULT_PROFILE);
const APPLY = has('--apply');
const LIMIT = Number(readArg('--limit', '40'));

/* ------------------------------------------------------------------ fetch */

async function fetchProfile(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`profile fetch failed: HTTP ${response.status}`);
  const html = await response.text();
  if (html.length < 10_000) throw new Error(`profile fetch returned only ${html.length} bytes`);
  return html;
}

/* ------------------------------------------------------------------ parse */

/** The page embeds the timeline as a doubly-escaped JSON blob. */
function decodePayload(html) {
  return html.replace(/\\\\"/g, '"').replace(/\\"/g, '"');
}

function extractTweets(html) {
  const text = decodePayload(html);
  const chunks = text.split('"TimelineTweet"').slice(1);
  const tweets = [];
  const seen = new Set();
  for (const chunk of chunks) {
    const id = /"rest_id":"(\d+)"/.exec(chunk)?.[1];
    const created = /"created_at_ms":(\d+)/.exec(chunk)?.[1];
    const raw = /"full_text":"((?:[^"\\]|\\.)*)"/.exec(chunk)?.[1];
    if (!id || !created || !raw || seen.has(id)) continue;
    let body = raw;
    try {
      body = JSON.parse(`"${raw}"`);
    } catch {
      /* keep the raw text */
    }
    const screen = /"screen_name":"([^"]+)"/.exec(chunk)?.[1] ?? null;
    seen.add(id);
    tweets.push({
      id,
      at: new Date(Number(created)).toISOString(),
      text: body.replace(/https?:\/\/t\.co\/\S+/g, '').replace(/\s+/g, ' ').trim(),
      author: screen,
      url: `https://x.com/thsottiaux/status/${id}`,
    });
  }
  tweets.sort((a, b) => b.at.localeCompare(a.at));
  return tweets.slice(0, LIMIT);
}

/* ----------------------------------------------------------- classify */

const FUTURE = /(will|coming|tomorrow|tonight|by eod|later today|within the next|next two days|heads up|soon\b|stay tuned)/i;
const PAST = /(we (?:have )?reset|has been reset|have been reset|reset is live|resets? (?:has|have) landed|landed|just reset|is out now|is live|reset everyone|reset all)/i;
const RESET_WORD = /\breset(s|ting)?\b|limit reset|reset day/i;
const BANKED_WORD = /banked|stored reset/i;

/**
 * Returns `{ kind, state, reason }` for a post that describes a real event, or
 * null for everything else (promises included).
 */
function classify(tweet) {
  const text = tweet.text;
  if (!text) return null;
  const banked = BANKED_WORD.test(text);
  const reset = RESET_WORD.test(text);
  if (!banked && !reset) return null;

  // A bare "Day N/ Reset" or "Le limit reset" is Tibo saying it happened.
  const bare = /^(?:roundup of )?day \d+\s*\/\s*(?:reset|le limit reset)\b/i.test(text) || /^le limit reset$/i.test(text);
  const future = FUTURE.test(text);
  const past = PAST.test(text) || bare;
  if (future && !past) return null; // a promise, not an event

  if (banked && !reset) return { kind: 'banked', state: 'confirmed', reason: 'banked grant' };
  if (banked && reset) {
    // "Banked 2/2" style wins when the post is explicitly about banked grants.
    return { kind: 'banked', state: 'confirmed', reason: 'banked grant' };
  }
  return { kind: 'reset', state: past ? 'confirmed' : 'announced', reason: past ? 'reset announced as landed' : 'reset claim' };
}

/* --------------------------------------------------------------- ledger */

function loadLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

function nextId(events, kind) {
  const prefix = kind === 'banked' ? 'b' : 'r';
  const numbers = events
    .filter((event) => event.kind === kind)
    .map((event) => Number(String(event.id).replace(/\D/g, '')))
    .filter(Number.isFinite);
  return `${prefix}${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`;
}

function ptDate(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function sameEvent(events, candidate) {
  const at = Date.parse(candidate.at);
  return events.find((event) => {
    if (event.kind !== candidate.kind) return false;
    const existing = Date.parse(event.at);
    if (!Number.isFinite(existing)) return false;
    // One event per ~18h window: Tibo often posts an announcement and then the
    // landing; the ledger keeps one row for that reset.
    return Math.abs(existing - at) <= 18 * 3_600_000;
  });
}

function plan(ledger, tweets) {
  const additions = [];
  const touched = [];
  for (const tweet of tweets) {
    const verdict = classify(tweet);
    if (!verdict) continue;
    const candidate = {
      kind: verdict.kind,
      at: tweet.at,
      announced_at: tweet.at,
      effective_at: null,
      state: verdict.state,
      quote: tweet.text.slice(0, 400),
      source_url: tweet.url,
      evidence: 'public',
      date: ptDate(tweet.at),
    };
    const existing = sameEvent(ledger.events, candidate);
    if (existing) {
      // Fill in a missing quote/source rather than adding a duplicate row.
      if ((!existing.source_url || !existing.quote) && tweet.url) {
        touched.push({ event: existing, tweet, verdict });
      }
      continue;
    }
    additions.push({ ...candidate, id: nextId([...ledger.events, ...additions], candidate.kind) });
  }
  return { additions, touched };
}

/* ------------------------------------------------------------------- main */

async function main() {
  const html = await fetchProfile(PROFILE);
  const tweets = extractTweets(html);
  if (!tweets.length) throw new Error('no tweets parsed — X page shape may have changed');

  const ledger = loadLedger();
  const { additions, touched } = plan(ledger, tweets);

  const summary = {
    profile: PROFILE,
    tweets: tweets.length,
    newest: tweets[0]?.at ?? null,
    additions: additions.length,
    touched: touched.length,
    apply: APPLY,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  for (const addition of additions) {
    process.stdout.write(`+ ${addition.kind} ${addition.at} ${addition.state} ${addition.quote.slice(0, 90)}\n`);
  }

  if (!APPLY) {
    process.stdout.write('dry run: pass --apply to write data/ledger.json\n');
    return;
  }
  if (!additions.length && !touched.length) {
    process.stdout.write('ledger already current; nothing written\n');
    return;
  }

  const next = {
    ...ledger,
    updated_at: new Date().toISOString(),
    events: [...ledger.events, ...additions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  };
  for (const change of touched) {
    const event = next.events.find((row) => row.id === change.event.id);
    if (!event) continue;
    if (!event.quote) event.quote = change.tweet.text.slice(0, 400);
    if (!event.source_url) event.source_url = change.tweet.url;
  }
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(next, null, 1)}\n`);
  process.stdout.write(`wrote ${LEDGER_PATH} (${next.events.length} events)\n`);
}

main().catch((error) => {
  process.stderr.write(`ingest failed: ${error && error.stack ? error.stack : error}\n`);
  process.exitCode = 1;
});
