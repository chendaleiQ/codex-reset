/**
 * Data status — the honest page about the site's only data source.
 *
 * Not an upstream status board: this page is about our own ledger — when it was
 * last updated, what it covers, where the gaps are, what the checks say, and
 * what the model's own backtest scored.
 */

import { el, link, safeXUrl } from '../dom.js';
import { dataStatusView, forecastView } from '../model.js';
import { getState, loadStatus, subscribe } from '../store.js';
import { formatDateTime, formatDays, formatNumber, relativeTime } from '../format.js';
import { getTimeZone, subscribeTimeZone } from '../time-zone.js';
import { fact, factGrid, leaf } from './_parts.js';

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];

  host.append(
    el(
      'header',
      { class: 'page-head' },
      el('h1', {}, t('datastatus.h1')),
      el('p', { class: 'lead' }, t('datastatus.lead')),
    ),
  );

  const freshnessHost = el('div');
  const coverageHost = el('div');
  const gapsHost = el('div');
  const checksHost = el('div');
  const modelHost = el('div');
  const sourcesHost = el('div');

  host.append(
    leaf(t, { title: t('datastatus.freshness') }, freshnessHost),
    leaf(t, { title: t('datastatus.coverage') }, coverageHost),
    leaf(t, { title: t('datastatus.gaps'), note: t('datastatus.gapsNote') }, gapsHost),
    leaf(t, { title: t('datastatus.checks') }, checksHost),
    leaf(t, { title: t('datastatus.model') }, modelHost),
    leaf(t, { title: t('datastatus.sources') }, sourcesHost),
  );

  const view = () => dataStatusView(state.status);

  const formatFullDate = (iso) => {
    const at = Date.parse(iso ?? '');
    if (!Number.isFinite(at)) return null;
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: getTimeZone(),
    }).format(new Date(at));
  };

  function unavailable(node, error) {
    node.replaceChildren(el('p', { class: 'empty' }, error ? t('common.readError') : t('common.loading')));
  }

  function paintFreshness(status) {
    freshnessHost.replaceChildren();
    if (!status) return unavailable(freshnessHost, state.statusError);
    const { dataset, freshness } = status;
    freshnessHost.append(
      factGrid([
        fact(
          t('datastatus.updated'),
          formatDateTime(status.updatedAt, locale) ?? t('common.unavailable'),
          status.updatedAt ? t('datastatus.age', { when: relativeTime(status.updatedAt, Date.now(), locale) }) : null,
        ),
        fact(
          t('datastatus.level'),
          el(
            'span',
            { class: 'level-text', dataset: { tone: freshness.level === 'fresh' ? 'ok' : freshness.level === 'stale' ? 'warn' : 'plain' } },
            t(`datastatus.level.${freshness.level}`),
          ),
          t('datastatus.threshold', { n: freshness.thresholdHours }),
        ),
        fact(t('datastatus.events'), formatNumber(dataset.total, locale)),
      ]),
    );
  }

  function paintCoverage(status) {
    coverageHost.replaceChildren();
    if (!status) return unavailable(coverageHost, state.statusError);
    const { dataset } = status;
    coverageHost.append(
      factGrid([
        fact(t('datastatus.first'), formatFullDate(dataset.firstAt) ?? t('common.unavailable')),
        fact(t('datastatus.lastReset'), formatDateTime(dataset.lastResetAt, locale) ?? t('common.unavailable')),
        fact(t('datastatus.resets'), formatNumber(dataset.reset, locale)),
        fact(t('datastatus.banked'), formatNumber(dataset.banked, locale)),
        fact(t('datastatus.span'), formatNumber(Math.round(dataset.spanDays), locale), null, {
          unit: locale === 'zh' ? '天' : 'days',
        }),
      ]),
    );
  }

  function paintGaps(status) {
    gapsHost.replaceChildren();
    if (!status) return unavailable(gapsHost, state.statusError);
    if (!status.gaps.length) {
      gapsHost.append(el('p', { class: 'note' }, t('datastatus.noGaps')));
      return;
    }
    const table = el('table', { class: 'data-table gap-table' });
    table.append(
      el(
        'thead',
        {},
        el('tr', {}, el('th', {}, t('datastatus.gapFrom')), el('th', {}, t('datastatus.gapTo')), el('th', { class: 'num' }, t('datastatus.gapDays'))),
      ),
    );
    const body = el('tbody');
    for (const gap of status.gaps) {
      body.append(
        el(
          'tr',
          {},
          el('td', {}, formatFullDate(gap.from) ?? gap.from ?? '—'),
          el('td', {}, formatFullDate(gap.to) ?? gap.to ?? '—'),
          el(
            'td',
            { class: 'num' },
            gap.days === null
              ? '—'
              : `${formatDays(gap.days, locale)} ${locale === 'zh' ? '天' : 'days'}`,
          ),
        ),
      );
    }
    table.append(body);
    gapsHost.append(el('div', { class: 'table-wrap' }, table));
  }

  const CHECK_DETAILS = {
    'beats-baseline': 'datastatus.beats',
    'experimental': 'datastatus.notBeats',
    'insufficient-data': 'datastatus.insufficient',
  };

  function checkDetail(check) {
    const key = CHECK_DETAILS[check.detail];
    if (key) return t(key);
    const detailKey = `datastatus.checkDetail.${check.name}`;
    const detail = t(detailKey);
    if (detail !== detailKey) {
      return check.value === null || check.value === undefined
        ? detail
        : t(detailKey, { n: formatNumber(check.value, locale) });
    }
    return check.detail;
  }

  function paintChecks(status) {
    checksHost.replaceChildren();
    if (!status) return unavailable(checksHost, state.statusError);
    const list = el('ul', { class: 'check-list' });
    for (const check of status.checks) {
      const labelKey = `datastatus.check.${check.name}`;
      const label = t(labelKey);
      list.append(
        el(
          'li',
          { class: `check ${check.ok ? 'check--ok' : 'check--bad'}`, dataset: { ok: String(check.ok) } },
          el('span', { class: 'check-name' }, label === labelKey ? check.name : label),
          el('span', { class: 'check-state' }, check.ok ? t('datastatus.checkOk') : t('datastatus.checkFail')),
          el('span', { class: 'check-detail' }, checkDetail(check)),
        ),
      );
    }
    checksHost.append(list);
  }

  function paintModel(status) {
    modelHost.replaceChildren();
    const forecast = forecastView(state.forecast, locale);
    const model = status?.model ?? forecast?.model ?? null;
    const backtest = status?.backtest ?? forecast?.backtest ?? null;
    const params = status?.params ?? {};
    const rows = [];
    const push = (label, value) => {
      if (value === null || value === undefined || value === '') return;
      rows.push([label, value]);
    };
    if (model) {
      push(t('datastatus.modelName'), model.name ? `${model.name} ${model.version ?? ''}`.trim() : null);
      push(t('rhythm.paramHalfLife'), model.half_life_days === undefined ? null : t('rhythm.valueDays', { n: model.half_life_days }));
      push(t('rhythm.paramShape'), model.shape_k);
      push(t('rhythm.paramEmpirical'), model.empirical_weight);
      push(t('rhythm.paramSample'), model.interval_sample);
      push(t('rhythm.paramEffSample'), model.effective_sample_size);
    } else {
      push(t('datastatus.insufficient'), null);
    }
    if (params.min_gap_hours !== undefined) push(t('rhythm.paramMinGap'), t('rhythm.valueHours', { n: params.min_gap_hours }));
    if (params.empirical_blend !== undefined) push(t('datastatus.empiricalBlend'), params.empirical_blend);
    if (params.bootstrap_rounds !== undefined) push(t('rhythm.paramBootstrap'), params.bootstrap_rounds);
    if (params.gap_days !== undefined) push(t('datastatus.gapThreshold'), t('rhythm.valueDays', { n: params.gap_days }));
    if (params.stale_hours !== undefined) push(t('datastatus.staleHours'), t('rhythm.valueHours', { n: params.stale_hours }));

    modelHost.append(el('p', { class: 'method-body' }, t('datastatus.modelNote')));

    if (backtest) {
      if (backtest.brier === null || backtest.brier === undefined) {
        modelHost.append(el('p', { class: 'note' }, t('datastatus.insufficient')));
      } else {
        modelHost.append(
          factGrid([
            fact(
              t('datastatus.brier'),
              formatNumber(backtest.brier, locale),
              backtest.method === 'walk-forward' ? t('rhythm.methodWalkForward') : backtest.method ?? null,
            ),
            fact(t('datastatus.baseline'), formatNumber(backtest.baselineBrier, locale), backtest.betterThanBaseline ? t('datastatus.beats') : t('datastatus.notBeats')),
            fact(t('rhythm.paramSample'), formatNumber(backtest.sampleSize ?? model?.sample_size, locale)),
          ], 'factgrid backtest-facts'),
        );
      }
    }

    if (rows.length) {
      const table = el('table', { class: 'data-table param-table' });
      const body = el('tbody');
      for (const [label, value] of rows) body.append(el('tr', {}, el('th', { scope: 'row' }, label), el('td', {}, String(value))));
      table.append(body);
      modelHost.append(
        el(
          'details',
          { class: 'method-details' },
          el('summary', {}, t('rhythm.paramsSummary')),
          el('div', { class: 'table-wrap' }, table),
        ),
      );
    }
  }

  function paintSources(status) {
    sourcesHost.replaceChildren();
    const seen = new Set();
    const sources = (status?.sources?.length ? status.sources : [{ label: t('datastatus.sourceFallback'), url: 'https://x.com/thsottiaux' }])
      .filter((source) => {
        const key = `${source.label ?? ''}|${source.url ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const list = el('ul', { class: 'source-list' });
    for (const source of sources) {
      const url = safeXUrl(source.url);
      list.append(
        el(
          'li',
          {},
          el(
            'span',
            { class: 'source-label' },
            locale === 'en' ? t('datastatus.sourceFallback') : source.label ?? t('datastatus.sourceFallback'),
          ),
          url ? link(url, `${t('datastatus.openSource')} ↗`, { external: true, className: 'table-link' }) : null,
        ),
      );
    }
    sourcesHost.append(list, el('p', { class: 'field-hint' }, t('datastatus.sourceNote')));
  }

  function paintAll() {
    const status = view();
    paintFreshness(status);
    paintCoverage(status);
    paintGaps(status);
    paintChecks(status);
    paintModel(status);
    paintSources(status);
  }

  if (state.status) paintAll();
  else {
    paintAll();
    await loadStatus();
    paintAll();
  }

  const unsubscribe = subscribe((slice) => {
    if (slice === 'status' || slice === 'forecast') paintAll();
  });
  cleanups.push(unsubscribe);
  cleanups.push(subscribeTimeZone(() => paintAll()));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}
