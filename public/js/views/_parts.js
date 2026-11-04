/** Shared view parts: the leaf, the fact grid, the heatmap, the charts, the FAQ. */

import { el, icon, link, safeHref, svgEl } from '../dom.js';
import { formatCompact, formatDay, formatDateTime, formatDays, formatNumber } from '../format.js';

/* -------------------------------------------------------------------- leaf */

export function leaf(t, { title, note, tools, id }, ...children) {
  const head = el('div', { class: 'leaf-head' }, el('h2', {}, title));
  if (note) head.append(el('p', { class: 'leaf-note' }, note));
  if (tools) head.append(el('div', { class: 'leaf-tools' }, tools));
  return el('section', { class: 'leaf', ...(id ? { id } : {}) }, head, ...children);
}

/* -------------------------------------------------------------------- facts */

/** One labelled figure: term, value, an optional note under it, an optional unit. */
export function fact(term, value, sub, { unit } = {}) {
  const dd = el('dd', {}, value);
  if (unit) dd.append(el('span', { class: 'unit' }, unit));
  if (sub) dd.append(el('p', {}, sub));
  return el('div', { class: 'fact' }, el('dt', {}, term), dd);
}

export function factGrid(facts, className = 'factgrid') {
  return el('dl', { class: className }, ...facts.filter(Boolean));
}

/** A labelled figure, or the honest "no data" placeholder. */
export const valueOr = (text, fallback) => (text === null || text === undefined || text === '' ? fallback : text);

/* --------------------------------------------------------------- the heatmap */

export const padHour = (hour) => `${String(Math.max(0, Math.min(23, Number(hour) || 0))).padStart(2, '0')}:00`;

/**
 * Weekday × hour grid. Monday is row 0, columns are UTC hours, exactly as the
 * server renderer writes it, so one stylesheet shades both.
 */
export function heatmapBlock({ heatmap, weekdayLabels, t, total, locale = 'zh' }) {
  const rows = Array.isArray(heatmap) ? heatmap : [];
  const max = rows.flat().reduce((peak, value) => Math.max(peak, Number(value) || 0), 0);
  const dayLabels = Array.isArray(weekdayLabels) && weekdayLabels.length === 7 ? weekdayLabels : [];

  const grid = el('div', { class: 'heatmap-grid' }, el('span', { class: 'heatmap-corner', 'aria-hidden': 'true' }));
  for (let hour = 0; hour < 24; hour += 1) {
    grid.append(el('span', { class: 'heatmap-hour', 'aria-hidden': 'true' }, String(hour).padStart(2, '0')));
  }
  for (let day = 0; day < 7; day += 1) {
    const label = dayLabels[day] ?? String(day);
    grid.append(el('span', { class: 'heatmap-day' }, label));
    for (let hour = 0; hour < 24; hour += 1) {
      const count = Number(rows[day]?.[hour]) || 0;
      const level = count === 0 || max === 0 ? 0 : count / max <= 0.25 ? 1 : count / max <= 0.5 ? 2 : count / max <= 0.75 ? 3 : 4;
      grid.append(
        el('span', {
          class: 'heatmap-cell',
          dataset: { level: String(level) },
          title: t('heatmap.cellTitle', { day: label, hour: String(hour).padStart(2, '0'), count }),
        }),
      );
    }
  }

  return el(
    'div',
    { class: 'heatmap', role: 'img', 'aria-label': t('heatmap.aria', { n: formatNumber(total ?? rows.flat().reduce((sum, value) => sum + (Number(value) || 0), 0), locale) }) },
    grid,
    el('p', { class: 'heatmap-legend' }, t('heatmap.legend')),
  );
}

/* ------------------------------------------------------------ window list */

export function windowList(windows, t) {
  const rows = Array.isArray(windows) ? windows : [];
  if (!rows.length) return el('p', { class: 'empty' }, t('verdict.windowNone'));
  const list = el('ol', { class: 'window-list' });
  for (const window of rows) {
    const range = `${padHour(window.startHour)}–${padHour(window.endHour)}`;
    list.append(
      el(
        'li',
        { class: 'window-row' },
        el('span', { class: 'window-index', 'aria-hidden': 'true' }, String(rows.indexOf(window) + 1)),
        el(
          'span',
          { class: 'window-main' },
          el('span', { class: 'window-range' }, `UTC ${range}`),
          el(
            'span',
            { class: 'window-bar', 'aria-hidden': 'true' },
            el('span', { style: `--w:${Math.max(0, Math.min(100, Number(window.share) || 0))}%` }),
          ),
        ),
        el(
          'span',
          { class: 'window-meta' },
          `${formatCompact(window.count)} · ${window.share === null ? '—' : `${window.share}%`}`,
        ),
      ),
    );
  }
  return list;
}

/* ---------------------------------------------------------------- rhythm chart */

const RHYTHM_H = 228;

/**
 * One bar per completed interval, oldest on the left. `rows` need `{ days, at }`
 * and may carry `{ event }` for the source link; an optional readout node gets
 * the hovered pair in words.
 */
export function rhythmChart(rows, { locale, t, readout }) {
  const wrap = el('div', { class: 'rhythm-chart' });
  const plot = el('div', { class: 'plot' });
  const caption = el('p', { class: 'rhythm-legend' }, t('rhythm.distributionNote'));
  wrap.append(plot, caption);
  if (!rows.length) {
    plot.append(el('p', { class: 'empty' }, t('common.unavailable')));
    return wrap;
  }

  const draw = () => {
    const width = Math.max(320, Math.round(plot.clientWidth || 900));
    const padL = 34;
    const padR = 16;
    const padT = 22;
    const padB = 34;
    const innerW = width - padL - padR;
    const innerH = RHYTHM_H - padT - padB;
    const maxDays = Math.ceil(Math.max(...rows.map((row) => row.days)) + 1);
    const mean = rows.reduce((sum, row) => sum + row.days, 0) / rows.length;
    const step = innerW / rows.length;
    const barW = Math.max(3, Math.min(28, step - Math.max(3, step * 0.28)));
    const scaleY = (days) => padT + innerH - (days / maxDays) * innerH;
    const ticks = [0, Math.round(maxDays / 2), maxDays];

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${RHYTHM_H}`, width, height: RHYTHM_H, role: 'img' });

    const grid = svgEl('g', { class: 'plot-grid' });
    for (const tick of ticks) {
      grid.append(svgEl('line', { x1: padL, x2: width - padR, y1: scaleY(tick), y2: scaleY(tick) }));
    }
    const axis = svgEl('g', { class: 'plot-axis' });
    for (const tick of ticks) {
      axis.append(svgEl('text', { x: padL - 8, y: scaleY(tick) + 4, 'text-anchor': 'end' }, String(tick)));
    }

    const bars = svgEl('g', { class: 'plot-bars' });
    rows.forEach((row, index) => {
      const x = padL + index * step + (step - barW) / 2;
      const y = scaleY(row.days);
      const group = svgEl('g', { tabindex: '0', role: 'listitem' });
      const hot = row.days >= mean;
      group.append(
        svgEl('rect', {
          x,
          y,
          width: barW,
          height: Math.max(2, padT + innerH - y),
          'data-hot': String(hot),
          rx: 1,
        }),
        svgEl('title', {}, `${formatDay(row.at, locale) ?? ''} · ${formatDays(row.days, locale)} ${locale === 'zh' ? '天' : 'days'}`),
      );
      const describe = () => {
        if (!readout) return;
        readout.replaceChildren(
          el('strong', {}, `${formatDays(row.days, locale)} ${locale === 'zh' ? '天' : 'days'}`),
          document.createTextNode(
            ` — ${formatDay(row.at, locale) ?? ''} ${locale === 'zh' ? '重置，距上一次' : 'reset, after'} ${formatDays(row.days, locale)} ${locale === 'zh' ? '天' : 'days'}`,
          ),
        );
      };
      group.addEventListener('mouseenter', describe);
      group.addEventListener('focus', describe);
      const url = safeHref(row.event?.sourceUrl ?? row.event?.url ?? '');
      if (url) group.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
      bars.append(group);
    });

    const meanY = scaleY(mean);
    svg.append(
      grid,
      svgEl('line', { class: 'plot-mean', x1: padL, x2: width - padR, y1: meanY, y2: meanY }),
      svgEl(
        'text',
        { class: 'plot-mean-label', x: width - padR, y: meanY - 6, 'text-anchor': 'end' },
        `${t('timeline.gap')} ${locale === 'zh' ? '均值' : 'mean'} ${formatDays(mean, locale)}`,
      ),
      axis,
      bars,
    );
    plot.replaceChildren(svg);
  };

  draw();
  const observer = new ResizeObserver(() => draw());
  observer.observe(plot);
  wrap.cleanup = () => observer.disconnect();
  return wrap;
}

/* ---------------------------------------------------------------------- FAQ */

export function faqBlock(t, keys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) {
  const list = el('div', { class: 'faq' });
  for (const key of keys) {
    list.append(
      el(
        'details',
        {},
        el('summary', {}, t(`faq.${key}`)),
        el('p', {}, t(`faq.a${key.slice(1)}`)),
      ),
    );
  }
  return list;
}

/* -------------------------------------------------------------------- errors */

export function errorBlock(t, { onRetry } = {}) {
  const wrap = el('div', { class: 'stack' });
  wrap.append(
    el('p', {}, t('error.body')),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', onclick: () => onRetry?.() }, t('common.retry'))),
  );
  return wrap;
}

export function sourceLink(t, href, label) {
  const safe = safeHref(href);
  if (!safe) return null;
  return link(safe, label ?? (safe.startsWith('/') ? t('common.details') : t('common.viewOnX')), {
    external: !safe.startsWith('/'),
    className: 'chit',
  });
}

export { formatDateTime, formatCompact, formatDays, formatDay, icon };
