/**
 * Timeline — the record itself. Every confirmed reset, every banked grant, the
 * rhythm they add up to, and the public post attached to each one.
 */

import { el, icon, link, safeXUrl } from '../dom.js';
import { isConfirmedReset, resetRhythm, timelineView } from '../model.js';
import { getState, loadTimeline, subscribe } from '../store.js';
import { formatDateTime, formatNumber, relativeTime } from '../format.js';
import { getTimeZone, subscribeTimeZone } from '../time-zone.js';
import { fact, factGrid, leaf, rhythmChart } from './_parts.js';

const SORTS = {
  date: (a, b) => Date.parse(b.at ?? 0) - Date.parse(a.at ?? 0),
  kind: (a, b) => a.kind.localeCompare(b.kind) || Date.parse(b.at ?? 0) - Date.parse(a.at ?? 0),
};

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];
  let chartCleanup = null;
  cleanups.push(() => chartCleanup?.());

  host.append(
    el(
      'header',
      { class: 'page-head' },
      el('h1', {}, t('timeline.h1')),
      el('p', { class: 'lead' }, t('timeline.lede')),
    ),
  );

  const statsHost = el('div');
  const rhythmHost = el('div');
  const logHost = el('div');
  const filterHost = el('div', { class: 'filters' });

  const filter = { kind: 'all', sort: 'date' };
  let limit = 40;

  host.append(
    leaf(t, { title: t('timeline.statEvents') }, statsHost),
    leaf(t, { title: t('timeline.rhythmTitle'), note: t('timeline.rhythmNote') }, rhythmHost),
    leaf(t, { title: t('timeline.logTitle'), note: t('timeline.logNote'), tools: filterHost }, logHost),
  );

  function paintStats() {
    const timeline = timelineView(state.timeline);
    statsHost.replaceChildren();
    if (!timeline) return;
    const facts = factGrid([
      fact(t('timeline.statResets'), formatNumber(timeline.counts.reset, locale)),
      fact(t('timeline.statBanked'), formatNumber(timeline.counts.banked, locale)),
      fact(t('timeline.statEvents'), formatNumber(timeline.counts.total, locale)),
    ], 'factgrid timeline-stats');
    statsHost.append(facts);
  }

  function paintRhythm() {
    chartCleanup?.();
    chartCleanup = null;
    const timeline = timelineView(state.timeline);
    rhythmHost.replaceChildren();
    if (!timeline) {
      rhythmHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const { gaps } = resetRhythm(timeline.events);
    const readout = el('p', { class: 'pair-readout' }, t('timeline.chartHint'));
    const chart = rhythmChart(gaps, { locale, t, readout });
    rhythmHost.append(readout, chart);
    chartCleanup = chart.cleanup;
  }

  function paintFilters() {
    filterHost.replaceChildren();
    const groups = [
      ['all', t('timeline.filterAll')],
      ['reset', t('timeline.filterReset')],
      ['banked', t('timeline.filterBanked')],
    ];
    for (const [id, label] of groups) {
      filterHost.append(
        el(
          'button',
          {
            type: 'button',
            class: 'filter',
            'aria-pressed': String(filter.kind === id),
            onclick: () => {
              filter.kind = id;
              limit = 40;
              paintFilters();
              paintLog();
            },
          },
          label,
        ),
      );
    }
  }

  function paintLog() {
    const timeline = timelineView(state.timeline);
    logHost.replaceChildren();
    if (!timeline) {
      logHost.append(el('p', { class: 'empty' }, state.timelineError ? t('common.readError') : t('common.loading')));
      return;
    }
    const rows = timeline.events
      .filter((event) => filter.kind === 'all' || event.kind === filter.kind)
      .sort(SORTS[filter.sort]);

    if (!rows.length) {
      logHost.append(el('p', { class: 'ledger-empty' }, t('timeline.empty')));
      return;
    }

    const shown = rows.slice(0, limit);
    const table = el('table', { class: 'data-table ledger' });
    const head = el('thead');
    const headRow = el('tr');
    for (const [key, label] of [
      ['date', t('timeline.col.date')],
      ['kind', t('timeline.col.event')],
      [null, t('timeline.col.state')],
      [null, t('timeline.col.source')],
    ]) {
      const th = el('th', { ...(key && filter.sort === key ? { 'aria-sort': 'descending' } : {}) });
      if (key) {
        th.append(
          el(
            'button',
            {
              type: 'button',
              onclick: () => {
                filter.sort = key;
                paintFilters();
                paintLog();
              },
            },
            label,
            icon('sortable', { size: 12 }),
          ),
        );
      } else {
        th.append(document.createTextNode(label));
      }
      headRow.append(th);
    }
    head.append(headRow);

    const body = el('tbody');
    let currentMonth = null;
    for (const event of shown) {
      const stamp = event.at;
      const month = stamp ? monthLabel(stamp, locale, getTimeZone()) : null;
      if (month && month !== currentMonth) {
        currentMonth = month;
        body.append(
          el(
            'tr',
            { class: 'ledger-month' },
            el('th', { colspan: '4', scope: 'colgroup' }, month),
          ),
        );
      }
      const when = formatDateTime(stamp, locale, getTimeZone());
      const url = safeXUrl(event.sourceUrl);
      body.append(
        el(
          'tr',
          {},
          el(
            'td',
            { class: 'ledger-time' },
            el('span', { class: 'ledger-main' }, when ?? t('common.unavailable')),
            el('span', { class: 'ledger-sub' }, relativeTime(stamp, Date.now(), locale)),
          ),
          el(
            'td',
            {},
            el(
              'span',
              { class: 'chit', dataset: { tone: event.kind === 'banked' ? 'line' : 'ok' } },
              event.kind === 'banked' ? t('home.kindBanked') : t('home.kindReset'),
            ),
          ),
          el(
            'td',
            {},
            el(
              'span',
              {
                class: 'level-text',
                dataset: {
                  tone: event.kind === 'banked' ? 'plain' : isConfirmedReset(event) ? 'ok' : 'warn',
                },
              },
              event.kind === 'banked'
                ? t('timeline.recorded')
                : isConfirmedReset(event)
                  ? t('timeline.verified')
                  : t('timeline.announced'),
            ),
          ),
          el(
            'td',
            {},
            url
              ? link(url, `${t('home.sourcePost')} ↗`, { external: true, className: 'table-link' })
              : el('span', { class: 'muted' }, t('home.sourceLedger')),
          ),
        ),
      );
    }
    table.append(head, body);
    logHost.append(el('div', { class: 'table-wrap' }, table));
    if (rows.length > shown.length) {
      logHost.append(
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--quiet',
            style: 'margin-top:24px',
            onclick: () => {
              limit = rows.length;
              paintLog();
            },
          },
          `${t('timeline.showMore')} · ${formatNumber(rows.length - shown.length, locale)}`,
        ),
      );
    }
  }

  function paintAll() {
    paintStats();
    paintRhythm();
    paintLog();
  }

  paintFilters();
  if (state.timeline) paintAll();
  else {
    statsHost.append(el('p', { class: 'empty' }, t('common.loading')));
    await loadTimeline();
    paintAll();
  }

  const unsubscribe = subscribe((slice) => {
    if (slice === 'timeline') paintAll();
  });
  cleanups.push(unsubscribe);
  cleanups.push(subscribeTimeZone(() => {
    paintRhythm();
    paintLog();
  }));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

function monthLabel(iso, locale, timeZone) {
  const at = Date.parse(iso ?? '');
  if (!Number.isFinite(at)) return null;
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    timeZone,
  }).format(new Date(at));
}
