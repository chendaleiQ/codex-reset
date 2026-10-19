/**
 * Status — the five Codex surfaces drawn as five service lines, plus the
 * incident ledger: what started, how long recovery took, and whether a reset
 * followed. Evidence, never outage prediction.
 */

import { el, link, safeHref } from '../dom.js';
import { endpoints } from '../api.js';
import { statusView, surfaceTone } from '../model.js';
import { subscribeTimeZone } from '../time-zone.js';
import { getState, subscribe } from '../store.js';
import { formatDateTime, formatDays, formatNumber, relativeTime } from '../format.js';
import { leaf } from './_parts.js';

const RANGE = '90d';

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];
  let history = null;
  let historyError = null;

  host.append(
    el(
      'header',
      { class: 'page-head' },
      el('h1', {}, t('status.h1')),
      el('p', { class: 'lead' }, t('status.lede')),
    ),
  );

  const incidentHost = el('div');
  const surfacesHost = el('div');
  const historyHost = el('div');
  const statsHost = el('div');

  host.append(
    leaf(t, { title: t('status.incident') }, incidentHost),
    leaf(t, { title: t('status.surfaces'), note: t('status.surfacesNote') }, surfacesHost),
    leaf(t, { title: t('status.incidents'), note: t('status.incidentsNote'), tools: statsHost }, historyHost),
  );

  function paintIncident() {
    const view = statusView(state.status);
    incidentHost.replaceChildren();
    if (!view) {
      incidentHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    if (!view.incident) {
      incidentHost.append(el('p', { class: 'note', dataset: { tone: 'plain' } }, t('status.noIncident')));
      return;
    }
    const incident = view.incident;
    const block = el('div', { class: 'incident', dataset: { impact: incident.impact ?? 'minor' } });
    block.append(
      el('span', { class: 'mark', dataset: { tone: incident.impact === 'minor' ? 'warn' : 'bad', shape: 'rule' } }, t(`state.${incident.impact === 'minor' ? 'degraded_performance' : 'partial_outage'}`)),
      el('span', { class: 'incident-name' }, incident.name ?? ''),
      incident.hours ? el('span', { class: 'muted' }, `${t('status.duration')} ${formatDays(incident.hours / 24, locale)}d`) : null,
      el('span', { class: 'muted' }, relativeTime(incident.started_at, Date.now(), locale)),
    );
    const url = safeHref(incident.source_url ?? `https://status.openai.com/incidents/${incident.id}`);
    if (url) block.append(link(url, `${t('status.viewOfficial')} ↗`, { external: true, className: 'chit' }));
    incidentHost.append(block);
  }

  function paintSurfaces() {
    const view = statusView(state.status);
    surfacesHost.replaceChildren();
    if (!view) {
      surfacesHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const list = el('div', { class: 'surfaces' });
    const palette = ['var(--line-cobalt)', 'var(--line-green)', 'var(--line-amber)', 'var(--line-violet)', 'var(--line-teal)'];
    view.surfaces.forEach((surface, index) => {
      const tone = surfaceTone(surface.status);
      const track = el('div', { class: 'surface-track' }, el('span', { style: `--w:${tone === 'ok' ? 100 : tone === 'warn' ? 66 : 38}%;--track:${palette[index % palette.length]}` }));
      list.append(
        el(
          'div',
          { class: 'surface', dataset: { state: tone } },
          el('span', { class: 'surface-name' }, el('span', { class: 'line-swatch', style: `--track:${palette[index % palette.length]}` }), surface.label),
          track,
          el('span', { class: 'surface-state' }, t(`state.${surface.status}`)),
        ),
      );
    });
    surfacesHost.append(list);
  }

  function paintStats() {
    statsHost.replaceChildren();
    if (!history?.stats) return;
    const stats = history.stats;
    const facts = el('dl', { class: 'factgrid timeline-stats' });
    facts.append(
      fact(t('timeline.statEvents'), formatNumber(stats.incident_count, locale), `${stats.days} ${locale === 'zh' ? '天' : 'days'}`),
      fact(t('status.resolved'), formatNumber(stats.resolved_incident_count, locale)),
      fact(t('status.duration'), `${formatNumber(stats.median_recovery_minutes, locale)}m`, locale === 'zh' ? '中位数' : 'median'),
    );
    if (stats.recovery_to_reset_median_minutes) {
      facts.append(
        fact(t('status.resetFollowed'), `${formatNumber(stats.recovery_to_reset_median_minutes / 60, locale)}h`, locale === 'zh' ? '恢复后中位' : 'median after recovery'),
      );
    }
    statsHost.append(facts);
  }

  function paintHistory() {
    historyHost.replaceChildren();
    if (historyError) {
      historyHost.append(el('p', { class: 'empty' }, t('common.readError')));
      return;
    }
    if (!history) {
      historyHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const rows = history.incidents ?? [];
    if (!rows.length) {
      historyHost.append(el('p', { class: 'ledger-empty' }, t('status.noIncident')));
      return;
    }
    const table = el('table', { class: 'ledger' });
    table.append(
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', {}, t('status.started')),
          el('th', {}, t('timeline.col.event')),
          el('th', {}, t('status.duration')),
          el('th', {}, t('status.component')),
        ),
      ),
    );
    const body = el('tbody');
    for (const incident of rows) {
      const started = Date.parse(incident.started_at ?? '');
      const resolved = Date.parse(incident.resolved_at ?? '');
      const minutes = Number.isFinite(started) && Number.isFinite(resolved) ? (resolved - started) / 60_000 : null;
      const url = safeHref(incident.source_url);
      const stateLabel = incident.status === 'resolved' ? t('status.resolved') : t(`state.${incident.impact === 'minor' ? 'degraded_performance' : 'partial_outage'}`);
      body.append(
        el(
          'tr',
          {},
          el(
            'td',
            { class: 'ledger-time' },
            el('span', { class: 'ledger-main' }, formatDateTime(incident.started_at, locale) ?? '—'),
            el('span', { class: 'ledger-sub' }, relativeTime(incident.started_at, Date.now(), locale)),
          ),
          el(
            'td',
            { class: 'ledger-summary' },
            incident.name ?? '—',
            url ? link(url, ` ${t('common.source')}`, { external: true }) : null,
          ),
          el(
            'td',
            {},
            el('div', { class: 'ledger-stack' }, el('span', { class: 'ledger-main' }, minutes === null ? '—' : `${formatNumber(minutes / 60, locale)}h`), el('span', { class: 'mark', dataset: { tone: incident.status === 'resolved' ? 'ok' : 'warn', shape: 'rule' } }, stateLabel)),
          ),
          el(
            'td',
            {},
            incident.codex_related ? el('span', { class: 'chit', dataset: { tone: 'line' } }, 'Codex') : el('span', { class: 'muted' }, '—'),
          ),
        ),
      );
    }
    table.append(body);
    historyHost.append(el('div', { class: 'ledger-wrap' }, table));
    if (history.methodology?.official_source) {
      const url = safeHref(history.methodology.official_source);
      historyHost.append(
        el('p', { class: 'field-hint', style: 'margin-top:12px' }, `${t('footer.data')} · ${history.methodology.official_source}`),
      );
    }
  }

  paintIncident();
  paintSurfaces();

  const unsubscribe = subscribe((slice) => {
    if (slice === 'status') {
      paintIncident();
      paintSurfaces();
    }
  });
  cleanups.push(unsubscribe, subscribeTimeZone(() => { paintIncident(); paintHistory(); }));

  try {
    history = await endpoints.statusHistory(RANGE, { locale });
    if (history.current) state.status = state.status ?? history.current;
  } catch (error) {
    historyError = error;
  }
  paintStats();
  paintHistory();
  paintIncident();
  paintSurfaces();

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

function fact(term, value, sub) {
  const node = el('div', { class: 'fact' }, el('dt', {}, term), el('dd', {}, value));
  if (sub) node.append(el('p', {}, sub));
  return node;
}
