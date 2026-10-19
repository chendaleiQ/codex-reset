# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: zero-build static ES-module frontend (plain HTML/CSS/JS) served by a small dependency-free Node HTTP server that also reverse-proxies the upstream public JSON API. Chosen because the source product is server-rendered HTML with ES-module scripts, the deliverable must run locally with `node server.js` and no install step, and the redesign is entirely in the client.

## Users

Paid Codex / ChatGPT users (Plus, Pro, Business) who run the agent hard enough to exhaust the weekly usage window, plus the wider Tibo-watching developer crowd on X, Discord and Telegram. They are mid-task, often blocked, and they check this on a phone at night or in a second tab while waiting for quota to come back. The job: *know whether waiting is worth it right now, and know the moment it changes.*

## Product Purpose

Answer one question — "will Codex reset today, and when?" — with evidence instead of vibes. The product records every verified quota reset, models the 24h and 48h probability of the next one from the historical rhythm, watches Thibault Sottiaux's ("Tibo", the OpenAI Codex lead) public posts for reset signals in real time, and folds in OpenAI's own service status. Success is a visitor deciding in under five seconds whether to keep waiting or go do something else, and trusting the number they based it on.

## Positioning

Independent verification, not announcement-watching. The tracker polls real ChatGPT Pro accounts and treats a reset as real only when quota actually moves, then reconciles that against the X post that claimed it. Public numbers therefore carry an explicit evidence state (verified / observed / announced-only / pending) and an explicit confidence, and the model ships with its backtest record — including when it has not beaten its baselines. A neighboring site can copy the feed; it cannot truthfully copy a verified-observation ledger it does not run.

## Operating Context

- Consulted repeatedly during a blocked work session and around the edges of the night, in a browser tab or a phone, always in a hurry.
- Languages: English and Simplified Chinese are the two the user actually reads; Japanese and Spanish exist upstream.
- Adjacent surfaces the product points at rather than replaces: OpenAI Status, the X account `@thsottiaux`, the ChatGPT usage analytics page, Telegram and Discord alert channels.
- Alerting is a real part of the workflow: web push plus chat channels, because the answer changes while the user is not looking.
- All personal data (the user's own usage percentage, their vigil entry) stays in that browser; the public API is anonymous.

## Capabilities and Constraints

Confirmed upstream functionality that must survive the redesign:

1. **Forecast console** — last verified global reset (relative + absolute, with the "did it reset today?" verdict), 24h and 48h reset probability with the model's uncertainty range, the historical high-frequency window, model confidence, a plain-language wait comparison ("you have waited 1.2 days; 0% of the last 8 intervals were shorter"), and the evidence list behind the number.
2. **Signal resolution ladder** — an official/committed signal (Tibo stated a window) overrides the model; a "tease" (👀, no commitment) is labelled as a tease and never shown as a probability; a pending claim gets a countdown to the stated deadline; otherwise the number is labelled as a historical baseline.
3. **Personal tracker** — enter your own `/status` usage percentage and the tracker compares your progress against the historical reference curve to tell you whether you outlast the reset.
4. **Feed / radar** — every @thsottiaux post classified into signal, boost, banked, limits, or context, filterable, with engagement counts, machine translation of non-English posts with the original one tap away.
5. **Timeline** — a filterable, sortable archive of every recorded reset and banked-reset grant, per-event evidence state, reason tags, announcement-vs-verification time, a rhythm chart of days-between-resets, and a timezone selector.
6. **Banked resets** — grants that are stored rather than consumed, tracked separately because they are not resets and must not contaminate the forecast sample.
7. **Status** — current OpenAI component state for each Codex surface (Web, API, CLI, VS Code, Desktop), the active incident, and an incident ledger with recovery durations and whether a reset followed.
8. **Crowd poll** — "when will the next reset land?" bucketed by window, with the tally and a published crowd accuracy against resolved polls.
9. **Tibo vigil (/tibo)** — the community ritual: a believer counter for the current cycle, a wall of named entries with country flags, "amen" endorsements, a flame that must be tended daily, answered-prayer archive, and a sleep clock histogram of which hour of the day resets actually land.
10. **Alerts** — web-push subscription for reset events, plus external channels.

Constraints:
- Read-only against upstream public JSON; no writes except the vigil/poll rituals, which are optional and never required to read anything.
- Must degrade honestly: every panel that cannot load says so; the forecast never shows a number without its label and confidence.
- Live data is the point — the readout refreshes on a 30s forecast / 60s feed cadence while visible.
- zh-Hans and en are first-class; every string is localized, and a non-English source post always keeps its original text reachable.

## Brand Commitments

- Name: **Codex Reset**. The subject is Codex; the product is the reset clock.
- Voice: dry, technical, exact. It says "I do not know yet" before it guesses. Never hyped, never cute about the stakes, and never pretends an announcement is a verified observation.
- Real facts that must not be softened or invented: the tibometer's confidence states, the backtest record, incident data, and the reset ledger.
- `@thsottiaux` / "Tibo" and the opossum-adjacent community culture around him are real subjects of the product, not mascots to invent.

## Evidence on Hand

- Live public JSON API (upstream `https://codex-reset.com/api/...`) — forecast, timeline, feed, status, status-history, health, pray, reset-poll, usage-reference. Proxied locally.
- 63 recorded resets in the upstream ledger, 10 banked grants, and the hourly distribution of reset times.
- Real Tibo post text and URLs from the live feed; real OpenAI incident names, ids and durations.
- No owned photography, logos, or illustration; the only upstream raster is a portrait of Tibo, which is third-party material and is not treated as an owned asset.
- No analytics, no testimonials, no pricing.

## Product Principles

1. **Evidence before verdict.** Every number travels with what backs it. A missing or degraded input is displayed, never interpolated away.
2. **The bound is the message.** "19% in 24h, low confidence" is more useful to a blocked user than a confident wrong answer; the uncertainty is shown at the same weight as the value.
3. **One question per screen.** The visitor arrived with "should I wait?" — the answer, the moment of the last reset, and the next signal own the first viewport; everything else is depth behind it.
4. **Signals have a temperature.** Announcement, tease, observation and model output are four different things and must look like four different things, at a glance.
5. **The clock never stops.** Time is the primary datum; anything that ages is rendered as a live, self-updating readout, not a static string.

## Accessibility & Inclusion

- Body text ≥4.5:1, large text ≥3:1 on every surface, in both themes.
- Every live region announces its updates; no information is conveyed by colour alone (states carry a text label or a shape).
- Full keyboard operation with visible focus; the tracker and vigil are operable without a pointer.
- `prefers-reduced-motion` disables the intro and the pulsing readouts.
- All times are rendered in the visitor's timezone with the zone named, and the original UTC instant is always reachable.
