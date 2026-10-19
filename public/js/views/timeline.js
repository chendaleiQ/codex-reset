/**
 * Timeline — the record itself. Every verified reset, every banked grant, the
 * rhythm they add up to, and the evidence attached to each one.
 */

import { el, icon, link, safeXUrl } from '../dom.js';
import {
  resetRhythm,
  timelineView,
} from '../model.js';
import { getState, loadTimeline, subscribe } from '../store.js';
import { formatDateTime, formatDay, formatDays, formatNumber, relativeTime } from '../format.js';
import { leaf, rhythmChart } from './_parts.js';

const SORTS = {
  date: (a, b) => Date.parse(b.announcedAt ?? b.effectiveAt ?? 0) - Date.parse(a.announcedAt ?? a.effectiveAt ?? 0),
  event: (a, b) => a.group.localeCompare(b.group),
};

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];

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

  const filter = { group: 'all', sort: 'date', direction: -1, timeZone: null };
  let limit = 40;

  function paintStats() {
    const timeline = state.timeline ? timelineView(state.timeline) : null;
    statsHost.replaceChildren();
    if (!timeline) return;
    const facts = el('dl', { class: 'factgrid timeline-stats' });
    facts.append(
      fact(t('timeline.statResets'), formatNumber(timeline.counts.reset, locale)),
      fact(t('timeline.statBanked'), formatNumber(timeline.counts.banked, locale)),
      fact(t('timeline.statEvents'), formatNumber(timeline.counts.total, locale)),
    );
    statsHost.append(facts);
  }

  function paintRhythm() {
    const timeline = state.timeline ? timelineView(state.timeline) : null;
    rhythmHost.replaceChildren();
    if (!timeline) {
      rhythmHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const { gaps } = resetRhythm(timeline.events);
    const readout = el('p', { class: 'pair-readout' }, t('timeline.rhythmNote'));
    const chart = rhythmChart(gaps, { locale, t, readout });
    rhythmHost.append(readout, chart);
    if (typeof chart.cleanup === 'function') cleanups.push(chart.cleanup);
  }

  function paintFilters() {
    filterHost.replaceChildren();
    const groups = [
      ['all', t('timeline.filterAll')],
      ['reset', t('timeline.filterReset')],
      ['banked', t('timeline.filterBanked')],
      ['signal', t('timeline.filterSignal')],
    ];
    for (const [id, label] of groups) {
      filterHost.append(
        el(
          'button',
          {
            type: 'button',
            class: 'filter',
            'aria-pressed': String(filter.group === id),
            onclick: () => {
              filter.group = id;
              limit = 40;
              paintFilters();
              paintLog();
            },
          },
          label,
        ),
      );
    }
    filterHost.append(
      el(
        'button',
        {
          type: 'button',
          class: 'filter',
          'aria-pressed': String(Boolean(filter.timeZone)),
          title: t('timeline.filterZone'),
          onclick: () => {
            filter.timeZone = filter.timeZone ? null : Intl.DateTimeFormat().resolvedOptions().timeZone;
            paintFilters();
            paintLog();
          },
        },
        filter.timeZone ? t('timeline.filterZoneLocal') : t('common.utc'),
      ),
    );
  }

  function paintLog() {
    const timeline = state.timeline ? timelineView(state.timeline) : null;
    logHost.replaceChildren();
    if (!timeline) {
      logHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const rows = timeline.events
      .filter((event) => filter.group === 'all' || event.group === filter.group)
      .sort(SORTS[filter.sort])
      .map((event, index, all) => ({ event, index, all }));

    if (!rows.length) {
      logHost.append(el('p', { class: 'ledger-empty' }, t('timeline.empty')));
      return;
    }

    const shown = rows.slice(0, limit);
    const table = el('table', { class: 'ledger' });
    const head = el('thead');
    const headRow = el('tr');
    for (const [key, label] of [
      ['date', t('timeline.col.date')],
      ['event', t('timeline.col.event')],
      [null, t('timeline.col.evidence')],
      [null, t('timeline.col.reason')],
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
    const monthCounts = new Map();
    for (const { event } of shown) {
      const stamp = event.announcedAt ?? event.effectiveAt;
      const month = stamp ? monthLabel(stamp, locale, filter.timeZone ?? undefined) : null;
      if (month) monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    }
    let currentMonth = null;
    for (const { event } of shown) {
      const stamp = event.announcedAt ?? event.effectiveAt;
      const month = stamp ? monthLabel(stamp, locale, filter.timeZone ?? undefined) : null;
      if (month && month !== currentMonth) {
        currentMonth = month;
        body.append(
          el(
            'tr',
            { class: 'ledger-month' },
            el(
              'th',
              { colspan: '5', scope: 'colgroup' },
              month,
              el('span', { class: 'ledger-month-count' }, `${monthCounts.get(month)} ${locale === 'zh' ? '条' : 'events'}`),
            ),
          ),
        );
      }
      const when = formatDateTime(stamp, locale, filter.timeZone ?? undefined);
      const evidence = evidenceMark(event, t);
      const reason = event.reasonTags.length
        ? el('div', { class: 'ledger-tags' }, event.reasonTags.map((tag) => el('span', { class: 'chit' }, tag)))
        : document.createTextNode('—');
      const xUrl = safeXUrl(event.url);
      const tr = el(
        'tr',
        {},
        el(
          'td',
          { class: 'ledger-time' },
          el('span', { class: 'ledger-main' }, when ?? t('common.unavailable')),
          el('span', { class: 'ledger-sub' }, relativeTime(event.announcedAt, Date.now(), locale)),
        ),
        el('td', { class: 'ledger-summary' }, event.summary, xUrl ? link(xUrl, ` ${t('common.originalPost')}`, { external: true }) : null),
        el('td', {}, evidence),
        el('td', {}, reason),
        el('td', {}, el('span', { class: 'muted' }, event.source ?? '—')),
      );
      body.append(tr);
    }
    table.append(head, body);
    logHost.append(el('div', { class: 'ledger-wrap' }, table));
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
          `${t('radar.showMore')} · ${formatNumber(rows.length - shown.length, locale)}`,
        ),
      );
    }
  }

  host.append(
    leaf(t, { title: t('timeline.statEvents') }, statsHost),
    leaf(t, { title: t('timeline.rhythmTitle'), note: t('timeline.rhythmNote') }, rhythmHost),
    leaf(t, { title: t('timeline.logTitle'), note: t('timeline.logNote'), tools: filterHost }, logHost),
  );

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

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

function evidenceMark(event, t) {
  if (event.bankedGrant || event.group === 'banked') {
    return [el('span', { class: 'mark', dataset: { tone: 'info', shape: 'rule' } }, t('radar.kind.banked'))];
  }
  const status = String(event.verification ?? '').toLowerCase();
  if (status.includes('verified') || event.confirmed) {
    return [el('span', { class: 'mark', dataset: { tone: 'ok', shape: 'rule' } }, t('timeline.verified'))];
  }
  if (status.includes('observed')) {
    return [el('span', { class: 'mark', dataset: { tone: 'info', shape: 'ring' } }, t('timeline.observed'))];
  }
  if (event.group === 'signal') {
    return [el('span', { class: 'mark', dataset: { tone: 'warn', shape: 'ring' } }, t('radar.kind.signal'))];
  }
  return [el('span', { class: 'mark', dataset: { tone: 'plain', shape: 'ring' } }, t('timeline.pending'))];
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

function fact(term, value) {
  return el('div', { class: 'fact' }, el('dt', {}, term), el('dd', {}, value));
}
