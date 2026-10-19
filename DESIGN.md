# Design

<!-- impeccable:design-schema 1 -->

The visual world for Codex Reset. Written from the built interface, not before
it. Product truth lives in PRODUCT.md; surface strategy in
`.impeccable/surfaces/index-html.md`.

## World

A metropolitan rail diagram, built the way signage is actually built. The
product's whole job is to say *where you are on a wait and when the next stop
arrives*, and a transit diagram is the one graphic language that already says
exactly that to everyone, without a legend.

The world is allowed four contributions and no more: **type, palette, density
and one signature move.** Navigation, controls, tables and forms stay the
platform's own — a button is a button, a sortable header is a sortable header,
a filter chip is a filter chip. The diagram never becomes a costume of a
station.

**Two materials, one system.** Real signage ships as a printed panel and as a
backlit panel, and so does this. The printed panel (light) is the default; the
backlit panel (dark) is a choice, persisted, with a toggle in the masthead and
a `?theme=dark` deep link. Everything below is shared; only the ground,
surface, ink and line-lightness differ, and they differ only in
`public/css/tokens.css`.

An earlier revision ran a saturated midnight-navy ground and it was a failure
worth recording: the cobalt line sat in the same hue family as the ground, so
every line colour sank into the background and the page read as one dirty blue
wash. Signage is high contrast by trade. Keep it that way.

## Palette

Colour is the network here, not decoration. Every value carries a meaning, and
there is no neutral grey in the ink ramp — the ink is a cool near-black.

### Printed panel (default)

| Token | Value | Job |
| --- | --- | --- |
| `--ground` | `#eef1f5` | the page: a cool signage grey |
| `--ground-sunk` | `#e3e7ee` | the footer |
| `--surface` | `#ffffff` | the board |
| `--surface-raised` | `#ffffff` | menus and toasts |
| `--ink` | `#12161f` | type, station ticks, the line itself |
| `--ink-2/3/4` | 86 / 72 / 62% | secondary, tertiary and quiet ink |
| `--hair` / `--hair-strong` | 13% / 28% | rules, and rules that separate sections |

### Backlit panel

| Token | Value | Job |
| --- | --- | --- |
| `--ground` | `#101114` | neutral graphite, deliberately not navy |
| `--surface` | `#191b20` | the board |
| `--ink` | `#f4f5f7` | type and ticks |
| `--ink-2/3/4` | 84 / 70 / 58% | the same three quiet steps |

### Line identity — never state

| Token | Printed | Backlit | Carries |
| --- | --- | --- | --- |
| `--line-cobalt` | `#1b5fd9` | `#5b93ff` | the reset line, links, the primary action |
| `--line-green` | `#1c8650` | `#45b877` | service line 2 |
| `--line-amber` | `#c07d0a` | `#e8a33b` | service line 3 |
| `--line-violet` | `#6f42c9` | `#a184ea` | service line 4 |
| `--line-teal` | `#0a726d` | `#35bdb4` | service line 5 |
| `--line-magenta` | `#c02a7d` | `#e5629f` | banked grants — never a reset, never in the sample |

### State — never identity

| Token | Printed | Backlit | Means |
| --- | --- | --- | --- |
| `--ok` / `--ok-text` | `#1c8650` / `#146b3d` | `#45b877` / `#63ca93` | operational, verified |
| `--warn` / `--warn-text` | `#c07d0a` / `#8a5900` | `#e8a33b` / `#eab965` | degraded, claim pending |
| `--bad` / `--bad-text` | `#d92d20` / `#b42318` | `#ef4a3d` / `#f48075` | outage, tease |

Outcome fills are a separate trio, because a filled shape needs a tone that
reads *behind* ink rather than as ink: `--fill-reset` `#146b3d` / `#45b877`,
`--fill-banked` `#a01f62` / `#e5629f`, `--fill-improve` `#1857c9` / `#5b93ff`,
each paired with `--on-fill` (`#ffffff` printed, `#0a0b0d` backlit) so the day
number on top clears 4.5:1 in both materials.

The rule that keeps it honest: **identity colours never carry state and state
colours never carry identity.** A service line keeps its colour when it
degrades; the stroke becomes a hazard hatch (`--hatch` is the gap struck
through the line) and a named state appears beside it. A reader who learns the
palette once can read every page, and a reader who is colour-blind still gets
the name.

`--ok-text` / `--warn-text` / `--bad-text` are the type-safe variants; the base
values are for strokes, swatches and bars only. Every text node on every route,
in both materials, clears 4.5:1.

## Type

**Hanken Grotesk** — one workhorse signage grotesque, self-hosted from
`public/fonts`, over a CJK stack (`PingFang SC`, `Hiragino Sans GB`,
`Noto Sans SC`, `Microsoft YaHei`) so Chinese and Latin sit at the same weight.

Seven roles, and nothing may pick a size outside them:

| Token | Size | Role |
| --- | --- | --- |
| `--t-meta` | 12px / 600 / `0.1em` / uppercase | labels, table heads, timestamps, state names |
| `--t-ui` | 14px / 400–600 | controls, table cells, list rows, feed meta |
| `--t-body` | 16px / 400 | every sentence meant to be read, capped at `--measure: 62ch` |
| `--t-lead` | 18px / 400 | the one intro paragraph per page |
| `--t-title` | 24px / 700 | a section heading, sentence case |
| `--t-num` | 20px / 700 | a fact value, a subordinate figure |
| `--t-figure` | 28px / 800 | the headline number |
| `--t-display` | 38px / 800 | the page `<h1>`, once |

Rank below `--t-title` is carried by **rule, weight and case, not size** — the
discipline a timetable lends. But size must carry the tiers: an earlier
revision made `h2` a 12px uppercase label, typographically identical to a
table label and a state chip, and the page lost its reading order. Section
headings are 24px sentence case; labels are 12px uppercase; those are the two
ends and they never swap.

## The signature move — the route

`public/js/route.js` draws a reset interval the way a diagram draws a journey:

- the last verified reset is the **terminus you left** — an interchange bloom
  with the date beneath it;
- **now** is the vehicle: a pulsing dot with a needle and a cobalt pill reading
  the elapsed wait;
- **24h and 48h** are the next stations, open rings carrying their percentages —
  the future is drawn dashed, because a planned extension is exactly
  "announced, scheduled, not yet running";
- the **typical interval** is a dashed benchmark rule you can see yourself
  walking toward;
- **banked grants** are magenta diamonds between the stations — a spare ticket,
  never a stop;
- an **official committed window**, when one exists, is a scarlet dashed segment
  ending in a red bloom at the deadline.

At under 680px the same data is drawn **vertically**, with the line pushed
right of centre so the "you are here" callout owns the left margin and no label
ever crosses another.

A second instance runs across the top of the overview: **the 28-day run**. Tibo
announced a 28-day ship-or-reset series on 2026-10-05, so the challenge is drawn
as a 28-station route — travelled solid, the rest dashed, today ringed, and each
station filled by its outcome: `--fill-reset`, `--fill-banked`,
`--fill-improve`, or hollow for a day that has not resolved. Below 720px it
becomes a 7×4 calendar grid, because 28 stations across a phone is a comb.

The move appears once more on `/status` as the five service lines.

## Scope

Four routes exist; two are in the masthead. The question this product answers is
"did Tibo post", so the record is the only thing that belongs beside the
overview — service status and the vigil stay reachable from the colophon, and
the old `/radar` was removed when the overview absorbed it. A tracker that
answers one question well beats a dashboard that answers six badly.

## Motion

One authored moment, used once: when a reset actually lands while a page is
open, the travelled track **draws itself** along the line and the new station
blooms into place (`--travel: 700ms`, `cubic-bezier(0.2, 0.9, 0.15, 1)`). The
"now" ring has a slow 2.8s pulse; the placeholder shimmer runs only while data
is missing. Everything is disabled under `prefers-reduced-motion`.

## Components

Everything is a ruled thing on a sheet; nothing is a floating card.

- **`.board`** — the readout, and not a card: a full-width band ruled top and
  bottom, no radius and no lift. Signage is a band, not a panel floating over a
  page, and the step between ground and band carries the whole depth system.
- **`.route`** — the signature. See above.
- **`.verdict`** — the answer in words, at `--t-title`, above the diagram: a
  rubric line naming *what kind of claim* this is, the sentence, and the exact
  last-reset instant. The number never appears without it.
- **`.departures`** — the timetable entry for each horizon: label, figure, range
  meter and the range as text. The figure is never shown without its range.
- **`.meter`** — a hairline track with a quieter uncertainty band and a
  porcelain tick at the estimate. The only progress-shaped thing in the system.
- **`.leaf`** — a section: a 24px heading, an optional note and tool row, over a
  2px rule. No shadows, no radii, no nesting.
- **`.factgrid`** — label over figure, separated by rules, never boxed.
- **`.ledger`** — the record. Ruled rows, sortable headers, month dividers with
  a count, an evidence mark per row, inline provenance links.
- **`.lines` / `.surface`** — the service lines: an identity swatch, a name, a
  track, a named state. Degraded and outage strokes become hazard hatches.
- **`.mark`** — the one state vocabulary: a filled rule for verified, a ring for
  observed, a hollow ring for claimed, in `ok` / `warn` / `bad` / `plain`.
- **`.chit`**, **`.filter`**, **`.btn`** — platform controls, 3px radii, hairline
  borders, a reversed fill for the primary.
- **`.feed`** — a 7.5rem meta gutter carrying kind and age, then the post, its
  translation disclosure and its engagement counts.

## Browser surfaces

The parts the design did not draw are themed anyway: `::selection` in a cobalt
tint, an ink caret, themed scrollbars, `:focus-visible` as a two-ring cobalt
halo, `text-underline-offset` at `0.22em`, and `tabular-nums lining-nums` on
every figure, time and table so nothing jitters while it ticks.

## Layout and density

One column. The masthead, the page and the colophon share a single left edge —
they are one `--page-max: 1360px` track with matching padding, and the earlier
40px disagreement between the wordmark and the `h1` was visible and wrong.

One 4→96 rhythm, with more space above a heading than below it, and the ledger
alternates row rhythm against month dividers so a long record still breathes.
Sidebar columns collapse at 1150px; the board's aside folds under the diagram
and the band keeps its bleed; every table degrades to a two-column stack at
700px. The hour chart shows every third label below 760px — twenty-four labels
is a comb, not a timetable.

## Explicitly not in this world

No cards with shadows or radii. No gradient text. No glow. No glass. No
illustration or photography: there is no owned imagery and none was invented.
No emoji standing in for an icon — every glyph is an authored 24px stroke path
in `public/js/dom.js`. No third-party font or asset is fetched at runtime.
