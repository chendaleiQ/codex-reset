/**
 * The route — this product's signature move.
 *
 * A reset interval is drawn the way a transit diagram draws a journey: the last
 * verified reset is the terminus you left, "now" is the vehicle on the line,
 * the 24h and 48h forecast horizons are the next stations, and the historical
 * typical interval is a benchmark rule you can see yourself approaching. The
 * future is drawn dashed, because that is exactly what a planned extension is:
 * announced, scheduled, not yet running.
 */

import { svgEl } from './dom.js';
import { formatDay, formatDays } from './format.js';

const H_HORIZONTAL = 180;
const H_VERTICAL = 452;
const BREAKPOINT = 680;
const LINE_Y = 110;

const HORIZONS = [
  { days: 1, key: 'route.within24' },
  { days: 2, key: 'route.within48' },
];

function spanFor({ ageDays, typicalDays, officialDays }) {
  return Math.max(6, (ageDays ?? 0) + 2.5, (typicalDays ?? 6) * 1.5, (officialDays ?? 0) + 1.5);
}

export function renderRoute(host, options) {
  const { locale, t } = options;
  const width = Math.max(280, Math.round(host.clientWidth || 900));
  const horizontal = width >= BREAKPOINT;
  const lastResetAt = options.lastResetAt ?? null;
  const ageDays = Number.isFinite(options.ageDays) ? options.ageDays : null;
  const typicalDays = Number.isFinite(options.typicalDays) ? options.typicalDays : null;
  const officialDays = Number.isFinite(options.officialDays) ? options.officialDays : null;
  const span = spanFor({ ageDays, typicalDays, officialDays });
  const banked = Array.isArray(options.banked) ? options.banked : [];
  const context = { span, ageDays, typicalDays, officialDays, banked, lastResetAt, locale, t, options };

  const svg = horizontal ? horizontalRoute(width, context) : verticalRoute(width, context);

  svg.setAttribute('role', 'img');
  svg.prepend(svgEl('desc', {}, describe(context)));
  svg.prepend(svgEl('title', {}, t('route.title')));

  host.replaceChildren(svg);
  if (options.arrived) {
    for (const node of svg.querySelectorAll('.track--done')) node.classList.add('track--arriving');
    for (const node of svg.querySelectorAll('.station--arriving')) node.classList.add('station--arriving');
  }
  return svg;
}

function describe({ options, t, locale, ageDays, typicalDays }) {
  const parts = [t('route.descLastReset', { time: formatDay(options.lastResetAt, locale) ?? t('common.unavailable') })];
  if (Number.isFinite(ageDays)) parts.push(t('route.descElapsed', { days: formatDays(ageDays, locale) }));
  if (Number.isFinite(options.chance24)) parts.push(t('route.desc24', { value: options.chance24 }));
  if (Number.isFinite(options.chance48)) parts.push(t('route.desc48', { value: options.chance48 }));
  if (Number.isFinite(typicalDays)) parts.push(t('route.descTypical', { days: formatDays(typicalDays, locale) }));
  return parts.join(' · ');
}

const baseSvg = (width, height) =>
  svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    class: 'route-svg',
    preserveAspectRatio: 'xMidYMid meet',
  });

/** A pill carrying the elapsed wait, clamped so it never leaves the frame. */
function nowPill(cx, width) {
  const text = width.text;
  const pillW = Math.max(88, Math.round(text.length * 7.8) + 26);
  const pillH = 30;
  const left = Math.min(Math.max(cx - pillW / 2, 2), width.frame - pillW - 2);
  return svgEl('g', {}, [
    svgEl('rect', { class: 'now-pill', x: left, y: 8, width: pillW, height: pillH, rx: 5 }),
    svgEl(
      'text',
      { class: 'now-pill-text', x: left + pillW / 2, y: 28, 'text-anchor': 'middle' },
      text,
    ),
  ]);
}

/* ------------------------------------------------------------------ horizontal */

function horizontalRoute(width, ctx) {
  const { span, ageDays, typicalDays, officialDays, banked, lastResetAt, locale, t, options } = ctx;
  const svg = baseSvg(width, H_HORIZONTAL);
  const padL = 26;
  const padR = 26;
  const y = LINE_Y;
  const usable = width - padL - padR;
  const x = (days) => padL + (Math.min(days, span) / span) * usable;
  const travelled = ageDays ?? 0;

  const grid = svgEl('g', {});
  const tracks = svgEl('g', {});

  grid.append(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, stroke: 'var(--hair)', 'stroke-width': 1 }));

  tracks.append(
    svgEl('line', {
      class: 'track track--done',
      x1: x(0),
      x2: x(travelled),
      y1: y,
      y2: y,
      style: '--track: var(--line-cobalt)',
    }),
    svgEl('line', {
      class: 'track track--planned',
      x1: x(travelled),
      x2: width - padR,
      y1: y,
      y2: y,
      style: '--track: var(--line-cobalt)',
    }),
  );

  // Terminus: the reset you left.
  svg.append(
    svgEl('g', { class: 'station station--arriving' }, [
      bloom(x(0), y, 'var(--ink)'),
      svgEl('text', { class: 'station-label', x: x(0), y: y + 40, 'text-anchor': 'start' }, t('route.lastReset')),
      svgEl('text', { class: 'station-sub', x: x(0), y: y + 60, 'text-anchor': 'start' }, formatDay(lastResetAt, locale) ?? '—'),
    ]),
  );

  // Banked grants inside the interval: a spare ticket, not a reset.
  for (const at of banked) {
    const days = (at - Date.parse(lastResetAt ?? '')) / 86_400_000;
    if (!Number.isFinite(days) || days < 0 || days > travelled) continue;
    svg.append(
      svgEl('rect', {
        x: x(days) - 6,
        y: y + 16,
        width: 12,
        height: 12,
        rx: 2,
        transform: `rotate(45 ${x(days)} ${y + 22})`,
        fill: 'var(--line-magenta)',
      }),
    );
  }

  // Forecast horizons.
  for (const horizon of HORIZONS) {
    const chance = horizon.days === 1 ? options.chance24 : options.chance48;
    const available = Number.isFinite(chance);
    const hx = x(horizon.days);
    svg.append(
      svgEl('circle', { class: 'station-ring--planned', cx: hx, cy: y, r: 9 }),
      svgEl('circle', { class: 'station-tick', cx: hx, cy: y, r: 3 }),
      svgEl(
        'text',
        { class: 'station-figure', x: hx, y: 74, 'text-anchor': 'middle', fill: available ? 'var(--ink)' : 'var(--ink-4)' },
        available ? `${chance}%` : '—',
      ),
      svgEl('text', { class: 'station-sub', x: hx, y: 94, 'text-anchor': 'middle' }, t(horizon.key)),
    );
  }

  // Typical interval: the benchmark you are walking toward.
  if (Number.isFinite(typicalDays) && typicalDays <= span) {
    const tx = x(typicalDays);
    grid.append(
      svgEl('line', { class: 'typical-rule', x1: tx, x2: tx, y1: 50, y2: 150 }),
      svgEl('text', { class: 'typical-label', x: tx, y: 168, 'text-anchor': 'middle' }, t('route.typical', { days: formatDays(typicalDays, locale) })),
    );
  }

  // An official committed window, when the claim names a deadline.
  if (Number.isFinite(officialDays) && officialDays > travelled) {
    tracks.append(
      svgEl('line', { class: 'track track--official', x1: x(travelled), x2: x(officialDays), y1: y, y2: y }),
      bloom(x(officialDays), y, 'var(--bad)'),
    );
    svg.append(
      svgEl('text', { class: 'station-label', x: x(officialDays), y: 74, 'text-anchor': 'middle', fill: 'var(--bad-text)' }, t('route.officialWindow')),
    );
  }

  // Now.
  if (Number.isFinite(ageDays)) {
    const nx = x(ageDays);
    svg.append(
      nowPill(nx, { text: `${t('route.now')} · ${t('route.elapsedShort', { days: formatDays(ageDays, locale) })}`, frame: width }),
      svgEl('line', { class: 'now-needle', x1: nx, x2: nx, y1: 38, y2: y - 13 }),
      svgEl('circle', { class: 'now-ring', cx: nx, cy: y, r: 10 }),
      svgEl('circle', { class: 'now-dot', cx: nx, cy: y, r: 9 }),
    );
  }

  // Beyond the diagram: unknown.
  svg.append(
    svgEl('circle', { class: 'station-ring--planned', cx: width - padR, cy: y, r: 10 }),
    svgEl('text', { class: 'typical-label', x: width - padR, y: 168, 'text-anchor': 'end' }, t('route.unknown')),
  );

  svg.append(grid, tracks);
  return svg;
}

/* -------------------------------------------------------------------- vertical */

function verticalRoute(width, ctx) {
  const { span, ageDays, typicalDays, officialDays, banked, lastResetAt, locale, t, options } = ctx;
  const svg = baseSvg(width, H_VERTICAL);
  /* The line moves right of centre so the "you are here" callout can live in
     the left margin, clear of every station label. */
  const x = Math.round(Math.min(152, Math.max(96, width * 0.36)));
  const top = 40;
  const bottom = H_VERTICAL - 40;
  const usable = bottom - top;
  const y = (days) => top + (Math.min(days, span) / span) * usable;
  const travelled = ageDays ?? 0;
  const stack = x + 22;

  svg.append(
    svgEl('line', { x1: x, x2: x, y1: top, y2: bottom, stroke: 'var(--hair)', 'stroke-width': 1 }),
    svgEl('line', { class: 'track track--done', x1: x, x2: x, y1: y(0), y2: y(travelled), style: '--track: var(--line-cobalt)' }),
    svgEl('line', { class: 'track track--planned', x1: x, x2: x, y1: y(travelled), y2: bottom, style: '--track: var(--line-cobalt)' }),
  );

  svg.append(
    svgEl('g', { class: 'station station--arriving' }, [
      bloom(x, y(0), 'var(--ink)'),
      svgEl('text', { class: 'station-label', x: stack, y: y(0) + 5 }, t('route.lastReset')),
      svgEl('text', { class: 'station-sub', x: stack, y: y(0) + 26 }, formatDay(lastResetAt, locale) ?? '—'),
    ]),
  );

  for (const horizon of HORIZONS) {
    const chance = horizon.days === 1 ? options.chance24 : options.chance48;
    const hy = y(horizon.days);
    svg.append(
      svgEl('circle', { class: 'station-ring--planned', cx: x, cy: hy, r: 9 }),
      svgEl('circle', { class: 'station-tick', cx: x, cy: hy, r: 3 }),
      svgEl('text', { class: 'station-sub', x: stack, y: hy - 3 }, t(horizon.key)),
      svgEl(
        'text',
        { class: 'station-figure', x: stack, y: hy + 33, fill: Number.isFinite(chance) ? 'var(--ink)' : 'var(--ink-4)' },
        Number.isFinite(chance) ? `${chance}%` : '—',
      ),
    );
  }

  if (Number.isFinite(typicalDays) && typicalDays <= span) {
    svg.append(
      svgEl('line', { class: 'typical-rule', x1: x - 20, x2: x + 14, y1: y(typicalDays), y2: y(typicalDays) }),
      svgEl('text', { class: 'typical-label', x: stack, y: y(typicalDays) + 24 }, t('route.typical', { days: formatDays(typicalDays, locale) })),
    );
  }

  if (Number.isFinite(ageDays)) {
    const ny = y(ageDays);
    svg.append(
      svgEl('line', { class: 'now-needle', x1: x - 26, x2: x + 20, y1: ny, y2: ny }),
      svgEl('circle', { class: 'now-ring', cx: x, cy: ny, r: 10 }),
      svgEl('circle', { class: 'now-dot', cx: x, cy: ny, r: 9 }),
      svgEl('text', { class: 'station-label', x: x - 20, y: ny - 2, 'text-anchor': 'end' }, t('route.now')),
      svgEl('text', { class: 'station-sub', x: x - 20, y: ny + 18, 'text-anchor': 'end' }, t('route.elapsed', { days: formatDays(ageDays, locale) })),
    );
  }

  if (Number.isFinite(officialDays) && officialDays > travelled && officialDays <= span) {
    svg.append(
      bloom(x, y(officialDays), 'var(--bad)'),
      svgEl('text', { class: 'station-label', x: stack, y: y(officialDays) + 5, fill: 'var(--bad-text)' }, t('route.officialWindow')),
    );
  }

  for (const at of banked) {
    const days = (at - Date.parse(lastResetAt ?? '')) / 86_400_000;
    if (!Number.isFinite(days) || days < 0 || days > travelled) continue;
    svg.append(
      svgEl('rect', {
        x: x - 6,
        y: y(days) - 6,
        width: 12,
        height: 12,
        rx: 2,
        transform: `rotate(45 ${x} ${y(days)})`,
        fill: 'var(--line-magenta)',
      }),
    );
  }

  svg.append(svgEl('circle', { class: 'station-ring--planned', cx: x, cy: bottom, r: 10 }));
  return svg;
}

function bloom(cx, cy, colour) {
  return svgEl('g', {}, [
    svgEl('circle', { class: 'interchange', cx, cy, r: 13, stroke: colour }),
    svgEl('circle', { class: 'interchange-dot', cx, cy, r: 5, fill: colour }),
  ]);
}
