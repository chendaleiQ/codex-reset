# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

zero-build static ES-module frontend (plain HTML/CSS/JS) served by a small dependency-free Node HTTP server. The server also renders every crawlable route, serves the site's own `/api/*` from a dataset that ships inside the release, and stores the vigil wall in a mounted state directory. No third-party API is called at runtime, at boot or in tests; a release is self-contained, so the site behaves the same on a laptop with wifi off as on the server.

## Users

Paid Codex / ChatGPT users (Plus, Pro, Business) who run the agent hard enough to exhaust the weekly usage window, plus the wider Tibo-watching developer crowd on X, Discord and Telegram. They are mid-task, often blocked, and they check this on a phone at night or in a second tab while waiting for quota to come back. The job: *know whether waiting is worth it right now, and know the moment it changes.*

## Product Purpose

Answer one question — "will Codex reset today, and when?" — with evidence instead of vibes. The product keeps its own public ledger of every confirmed global reset, models the 24h and 48h probability of the next one from that ledger, and shows the rhythm underneath the number: how long intervals usually run, which hours of the week resets land in, and what the model's own backtest says. The 28-day shipping run that the site originally tracked is over; its calendar is now a frozen retrospective, and the product's live job is the ongoing rhythm.

Success is a visitor deciding in under five seconds whether to keep waiting or go do something else, and trusting the number they based it on.

## Positioning

A ledger we keep, and a model we can show the work for — not an announcement mirror. Every row is traceable to a public post; announced-but-unlanded claims never enter the prediction sample; the probability is a conditional survival estimate on our own intervals, with a bootstrap range, an explicit confidence, and a walk-forward backtest that is published even when it fails to beat its baseline. A neighbouring site can copy a feed; it cannot copy a ledger and a method it does not maintain.

## Operating Context

- Consulted repeatedly during a blocked work session and around the edges of the night, in a browser tab or a phone, always in a hurry.
- Languages: English and Simplified Chinese are the two the user actually reads.
- Adjacent surfaces the product points at rather than replaces: the X account `@thsottiaux`, the ChatGPT usage analytics page.
- The 28-day run ended on 1 November 2026. The retrospective stays at `/plan`; the live product moved to `/rhythm`.
- All personal data (the user's vigil entry) is either local to the browser or, for the shared wall, a name and a day count in a JSON file on this server. The public API is anonymous.

## Capabilities and Constraints

1. **Verdict console** — one answer sentence: probability for 24h and 48h with its range and confidence, the last confirmed reset and how long the current wait is, and how that wait compares with the historical interval sample.
2. **Rhythm** (`/rhythm`) — interval distribution, weekday × hour heatmap, top three-hour windows, monthly counts, and the method behind them (Weibull renewal fit blended with the empirical survival curve, recency half-life, bootstrap range, walk-forward Brier vs baseline).
3. **Timeline** — every confirmed reset and banked grant, per-event evidence state, announcement-vs-verification time, a chart of days between resets, filterable and timezone-switchable.
4. **Data status** (`/status`) — the honest mirror: when the ledger was last updated, how much it covers, where the gaps are, self-checks, model parameters and backtest, and the source list. No third-party status page, no claim to monitor accounts we do not run.
5. **Vigil** (`/vigil`) — the community ritual, now stored on this server: who is waiting in the current epoch, a wall of named entries, amens, and the hour-of-day histogram of when resets actually land.
6. **28-day retrospective** (`/plan`) — the frozen Day 1–28 table, explicitly marked as ended, kept because it is the record of why the rhythm changed.
7. **Alerts** — web-push subscription for reset events, plus external channels.

Constraints:
- Read-only against the world: no scraping, no upstream proxy, no login. The only write is the vigil entry, which is optional.
- Must degrade honestly: an empty sample says "not enough data"; a stale ledger says "stale"; the forecast never shows a number without its label, range or confidence.
- A release carries its own data, so publishing an event means editing `data/ledger.json` and redeploying — by design, not by accident.

## Brand Commitments

- Name: **Codex Reset**. The subject is Codex; the product is the reset clock.
- Voice: dry, technical, exact. It says "I do not know yet" before it guesses. Never hyped, never cute about the stakes, and never pretends an announcement is a verified observation.
- Real facts that must not be softened or invented: the evidence states, the interval sample, the backtest record, the ledger.
- `@thsottiaux` / "Tibo" and the opossum-adjacent community culture around him are real subjects of the product, not mascots to invent.

## Evidence on Hand

- `data/ledger.json` — 61 confirmed resets and 11 publicly sourced banked grants, each with its X post URL.
- `data/posts.json` — the frozen 28-day archive (21 recorded days with bilingual text).
- Derived: interval sample (60 intervals), UTC weekday × hour heatmap, top windows, monthly counts, gaps over 30 days.
- No owned photography, logos, or illustration. The only raster of a person is a portrait of Tibo, third-party material, never treated as an owned asset.
- No analytics, no testimonials, no pricing.

## Product Principles

1. **Evidence before verdict.** Every number travels with what backs it. A missing or degraded input is displayed, never interpolated away.
2. **The bound is the message.** "19% in 24h, range 16–32%, low confidence" is more useful to a blocked user than a confident wrong answer.
3. **One question per screen.** The visitor arrived with "should I wait?" — the answer, the moment of the last reset, and the next high-frequency window own the first viewport; everything else is depth behind it.
4. **Signals have a temperature.** Announced, confirmed, banked and modelled are four different things and must look like four different things, at a glance.
5. **The clock never stops.** Time is the primary datum; anything that ages is rendered as a live, self-updating readout, not a static string.
6. **Own the method.** If the site cannot explain how a number was produced from its own files, it does not publish the number.

## Accessibility & Inclusion

- Body text ≥4.5:1, large text ≥3:1 on every surface, in both themes.
- Every live region announces its updates; no information is conveyed by colour alone (states carry a text label or a shape; heatmap cells carry `title` text and an aria summary).
- Full keyboard operation with visible focus; the vigil form is operable without a pointer.
- `prefers-reduced-motion` disables the intro and the pulsing readouts.
- All times are rendered in the visitor's timezone with the zone named; model windows are labelled UTC and the original instant is always reachable.
