/**
 * Reset rhythm — every confirmed reset on one timeline: the interval between
 * them, the weekday × hour they land in, the busiest three-hour windows, the
 * monthly counts, and the arithmetic behind the published probability.
 */

import { el, link } from '../dom.js';
import { forecastView, rhythmView } from '../model.js';
import { getState, subscribe } from '../store.js';
import { formatDays, formatNumber } from '../format.js';
import { getTimeZone, subscribeTimeZone } from '../time-zone.js';
import { fact, factGrid, heatmapBlock, leaf, rhythmChart, windowList } from './_parts.js';

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
      el('h1', {}, t('rhythm.h1')),
      el('p', { class: 'lead' }, t('rhythm.lead')),
    ),
  );

  const overviewHost = el('div');
  const chartHost = el('div', { class: 'chart-host' });
  const weekHost = el('div');
  const monthHost = el('div');
  const methodHost = el('div');

  host.append(
    leaf(t, { title: t('rhythm.overview') }, overviewHost),
    leaf(t, { title: t('rhythm.distribution'), note: t('rhythm.distributionNote') }, chartHost),
    leaf(t, { title: t('rhythm.weekdayTitle'), note: t('rhythm.weekdayNote') }, weekHost),
    leaf(t, { title: t('rhythm.monthTitle'), note: t('rhythm.monthNote') }, monthHost),
    leaf(t, { title: t('rhythm.methodTitle') }, methodHost),
  );

  /* --- overview ----------------------------------------------------------- */

  function paintOverview() {
    const view = rhythmView(state.rhythm, locale);
    overviewHost.replaceChildren();
    if (!view) {
      overviewHost.append(el('p', { class: 'empty' }, state.rhythmError ? t('common.readError') : t('common.loading')));
      return;
    }
    const { stats, recentMedianDays } = view;
    overviewHost.append(
      factGrid([
        fact(t('rhythm.statsResets'), formatNumber(stats.resets, locale), null, {
          unit: locale === 'zh' ? '次' : 'resets',
        }),
        fact(t('rhythm.statsSpan'), formatNumber(Math.round(stats.spanDays), locale), null, {
          unit: locale === 'zh' ? '天' : 'days',
        }),
        fact(t('rhythm.statsMedian'), stats.medianIntervalDays === null ? '—' : formatDays(stats.medianIntervalDays, locale), null, {
          unit: stats.medianIntervalDays === null ? null : locale === 'zh' ? '天' : 'days',
        }),
        fact(t('rhythm.statsRecent'), recentMedianDays === null ? '—' : formatDays(recentMedianDays, locale), null, {
          unit: recentMedianDays === null ? null : locale === 'zh' ? '天' : 'days',
        }),
      ]),
    );
  }

  /* --- interval chart ----------------------------------------------------- */

  function paintChart() {
    chartCleanup?.();
    chartCleanup = null;
    chartHost.replaceChildren();
    const view = rhythmView(state.rhythm, locale);
    if (!view) {
      chartHost.append(el('p', { class: 'empty' }, state.rhythmError ? t('common.readError') : t('common.loading')));
      return;
    }
    const readout = el('p', { class: 'pair-readout' }, t('rhythm.readout'));
    const chart = rhythmChart(view.intervals, { locale, t, readout });
    chartHost.append(readout, chart);
    chartCleanup = chart.cleanup;
  }

  /* --- weekday × hour + windows ------------------------------------------ */

  function paintWeek() {
    const view = rhythmView(state.rhythm, locale);
    weekHost.replaceChildren();
    if (!view) {
      weekHost.append(el('p', { class: 'empty' }, state.rhythmError ? t('common.readError') : t('common.loading')));
      return;
    }
    weekHost.append(
      heatmapBlock({
        heatmap: view.heatmap,
        weekdayLabels: view.weekdayLabels,
        t,
        locale,
        total: view.heatTotal,
      }),
      el('h3', { class: 'subhead' }, t('rhythm.windowsTitle')),
      el('p', { class: 'field-hint' }, t('rhythm.windowsNote')),
      windowList(view.windows, t, { locale, timeZone: getTimeZone() }),
    );
  }

  /* --- by month ----------------------------------------------------------- */

  function paintMonths() {
    const view = rhythmView(state.rhythm, locale);
    monthHost.replaceChildren();
    if (!view) {
      monthHost.append(el('p', { class: 'empty' }, state.rhythmError ? t('common.readError') : t('common.loading')));
      return;
    }
    const rows = view.months.slice(0, 12);
    const monthLabel = (value) => {
      const match = /^(\d{4})-(\d{2})$/.exec(String(value ?? ''));
      if (!match) return value ?? '—';
      const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(date);
    };
    if (!rows.length) {
      monthHost.append(el('p', { class: 'empty' }, t('common.unavailable')));
      return;
    }
    const table = el('table', { class: 'data-table month-table' });
    table.append(
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', {}, t('rhythm.monthCol')),
          el('th', { class: 'num' }, t('rhythm.colResets')),
          el('th', { class: 'num' }, t('rhythm.colBanked')),
        ),
      ),
    );
    const body = el('tbody');
    for (const row of rows) {
      body.append(
        el(
          'tr',
          {},
          el('td', {}, monthLabel(row.month)),
          el('td', { class: 'num' }, formatNumber(row.resets, locale)),
          el('td', { class: 'num' }, formatNumber(row.banked, locale)),
        ),
      );
    }
    table.append(body);
    monthHost.append(el('div', { class: 'table-wrap' }, table));
  }

  /* --- method + FAQ ------------------------------------------------------- */

  function paintMethod() {
    const rhythm = rhythmView(state.rhythm, locale);
    const forecast = forecastView(state.forecast, locale);
    const status = state.status;
    const params = status?.params ?? {};
    const model = forecast?.model ?? state.status?.model ?? null;
    const backtest = forecast?.backtest ?? state.status?.backtest ?? null;
    methodHost.replaceChildren();
    methodHost.append(el('p', { class: 'method-body' }, t('rhythm.methodBody')));

    const rows = [];
    const push = (label, value) => {
      if (value === null || value === undefined || value === '') return;
      rows.push([label, value]);
    };
    if (model) {
      push(t('rhythm.paramHalfLife'), model.halfLifeDays === null ? null : t('rhythm.valueDays', { n: model.halfLifeDays }));
      push(t('rhythm.paramShape'), model.shapeK);
      push(t('rhythm.paramEmpirical'), model.empiricalWeight);
      push(t('rhythm.paramSample'), formatNumber(model.intervalSample, locale));
      push(
        t('rhythm.paramEffSample'),
        model.effectiveSampleSize === null ? null : formatNumber(model.effectiveSampleSize, locale),
      );
    }
    if (params.bootstrap_rounds !== undefined) push(t('rhythm.paramBootstrap'), formatNumber(params.bootstrap_rounds, locale));
    if (params.min_gap_hours !== undefined) push(t('rhythm.paramMinGap'), t('rhythm.valueHours', { n: params.min_gap_hours }));
    if (backtest && backtest.brier !== null) {
      push(t('rhythm.paramBrier'), backtest.brier);
      push(t('rhythm.paramBaseline'), backtest.baselineBrier);
      if (backtest.method) push(t('rhythm.paramBacktestMethod'), backtest.method === 'walk-forward' ? t('rhythm.methodWalkForward') : backtest.method);
    }

    if (rows.length) {
      const table = el('table', { class: 'data-table param-table' });
      const body = el('tbody');
      for (const [label, value] of rows) body.append(el('tr', {}, el('th', { scope: 'row' }, label), el('td', {}, String(value))));
      table.append(body);
      methodHost.append(
        el(
          'details',
          { class: 'method-details' },
          el('summary', {}, t('rhythm.paramsSummary')),
          el('div', { class: 'table-wrap' }, table),
        ),
      );
    }

    const faq = el('div', { class: 'faq' });
    for (const key of ['q1', 'q2', 'q3', 'q4']) {
      faq.append(
        el(
          'details',
          {},
          el('summary', {}, t(`rhythm.faq.${key}`)),
          el('p', {}, t(`rhythm.faq.a${key.slice(1)}`)),
        ),
      );
    }
    methodHost.append(el('h3', { class: 'subhead' }, t('rhythm.faqTitle')), faq);
    if (rhythm) {
      methodHost.append(
        el(
          'div',
          { class: 'method-links' },
          link('/status', t('home.methodStatus'), { className: 'chit' }),
          link('/timeline', t('home.allRecords'), { className: 'chit' }),
        ),
      );
    }
  }

  function paintAll() {
    paintOverview();
    paintChart();
    paintWeek();
    paintMonths();
    paintMethod();
  }

  paintAll();

  const unsubscribe = subscribe((slice) => {
    if (slice === 'rhythm' || slice === 'forecast' || slice === 'status') paintAll();
  });
  cleanups.push(unsubscribe);
  cleanups.push(subscribeTimeZone(() => {
    paintChart();
  }));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}
