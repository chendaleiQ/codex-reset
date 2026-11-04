/**
 * Overview — the one question the site exists to answer, then the rhythm it is
 * based on, the records themselves, and where the numbers come from.
 */

import { clear, el, link, safeXUrl } from '../dom.js';
import { forecastView, rhythmView, timelineView } from '../model.js';
import { getState, subscribe } from '../store.js';
import { formatDateTime, formatDays, formatNumber } from '../format.js';
import { getTimeZone, subscribeTimeZone, zoneShort } from '../time-zone.js';
import { fact, factGrid, heatmapBlock, leaf, padHour, windowRange } from './_parts.js';

const RECENT_LIMIT = 6;

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];

  host.classList.add('home-page');

  /* --- 1. the verdict ------------------------------------------------------ */

  const answer = el('p', { class: 'verdict-answer' });
  const number24 = el('div', { class: 'verdict-number', dataset: { confidence: 'low' } });
  const number48 = el('div', { class: 'verdict-number', dataset: { confidence: 'low' } });
  const facts = el('dl', { class: 'verdict-facts' });
  const note = el('p', { class: 'verdict-note' });
  const pending = el('div', { class: 'verdict-pending', hidden: true });
  const updated = el('p', { class: 'verdict-updated field-hint' });

  const verdict = el(
    'header',
    { class: 'verdict' },
    el('p', { class: 'verdict-eyebrow' }, t('verdict.eyebrow')),
    el('h1', {}, t('home.title')),
    answer,
    el('div', { class: 'verdict-grid' }, number24, number48, facts),
    note,
    pending,
    updated,
  );

  /* --- 2. the rhythm preview ---------------------------------------------- */

  const rhythmHost = el('div', { class: 'rhythm-preview' });
  const rhythmSection = leaf(t, {
    title: t('home.rhythmTitle'),
    note: t('home.rhythmNote'),
    id: 'rhythm-preview',
  }, rhythmHost);
  const rhythmFoot = el(
    'div',
    { class: 'leaf-foot' },
    link('/rhythm', t('home.viewRhythm'), { className: 'chit' }),
  );

  /* --- 3. recent records --------------------------------------------------- */

  const recentHost = el('div');
  const recentSection = leaf(t, {
    title: t('home.recentTitle'),
    note: t('home.recentNote'),
  }, recentHost);
  recentSection.append(
    el('div', { class: 'leaf-foot' }, link('/timeline', t('home.allRecords'), { className: 'chit' })),
  );

  /* --- 4. method and data -------------------------------------------------- */

  const methodSection = leaf(t, { title: t('home.methodTitle') });
  methodSection.append(
    el('p', { class: 'method-body' }, t('home.methodBody')),
    el(
      'div',
      { class: 'method-links' },
      link('/status', t('home.methodStatus'), { className: 'chit' }),
      link('/rhythm', t('home.methodRhythm'), { className: 'chit' }),
      link('/about', t('home.methodAbout'), { className: 'chit' }),
    ),
  );

  rhythmSection.append(rhythmFoot);
  host.append(verdict, rhythmSection, recentSection, methodSection);

  /* --- painting ----------------------------------------------------------- */

  const pair = (node, percent, range, numeric) => {
    const meter = numeric && percent !== null
      ? el(
          'span',
          { class: 'verdict-meter', 'aria-hidden': 'true' },
          el('span', {
            class: 'verdict-meter-band',
            style: `--lo:${numeric.lower}%;--hi:${numeric.upper}%;--at:${percent}%`,
          }),
        )
      : null;
    node.replaceChildren(
      el('span', { class: 'verdict-value' }, percent === null ? '—' : `${percent}%`),
      el('span', { class: 'verdict-label' }, node === number24 ? t('verdict.window24') : t('verdict.window48')),
      el('span', { class: 'verdict-range' }, range === null ? t('verdict.rangeNone') : t('verdict.range', { range })),
      meter,
    );
  };

  function paintVerdict() {
    const view = forecastView(state.forecast, locale);
    if (!view) {
      answer.textContent = state.forecastError ? t('common.readError') : t('common.loading');
      answer.dataset.tone = state.forecastError ? 'warn' : 'plain';
      pair(number24, null, null, null);
      pair(number48, null, null, null);
      facts.replaceChildren();
      note.textContent = '';
      pending.hidden = true;
      updated.textContent = '';
      return;
    }

    const days = view.ageDays === null ? null : formatDays(view.ageDays, locale);
    const share = view.wait?.shorterShare ?? null;
    answer.dataset.tone = view.confidence === 'low' ? 'warn' : 'plain';
    if (view.chance24 === null || view.chance48 === null) {
      answer.textContent = t('verdict.answerNoData');
    } else if (days === null) {
      answer.textContent = t('verdict.answerNoData');
    } else if (share === null) {
      answer.textContent = t('verdict.answerNoShare', { p24: view.chance24, p48: view.chance48, days });
    } else {
      answer.textContent = t('verdict.answer', { p24: view.chance24, p48: view.chance48, days, share });
    }

    for (const node of [number24, number48]) node.dataset.confidence = view.confidence ?? 'low';
    pair(number24, view.chance24, view.range24, view.range24Numeric);
    pair(number48, view.chance48, view.range48, view.range48Numeric);

    const lastReset = formatDateTime(view.lastResetAt, locale);
    const waitDays = view.wait?.days ?? view.ageDays;
    const localRange = view.window ? windowRange(view.window.startHour, view.window.endHour, getTimeZone()) : null;
    const utcRange = view.window
      ? `${padHour(view.window.startHour)}–${padHour(view.window.endHour)}`
      : null;

    facts.replaceChildren(
      fact(
        t('verdict.lastReset'),
        lastReset ?? t('common.unavailable'),
        view.ageDays === null ? t('common.unavailable') : t('verdict.age', { days: formatDays(view.ageDays, locale) }),
      ),
      fact(
        t('verdict.waited'),
        waitDays === null ? t('common.unavailable') : formatDays(waitDays, locale),
        share === null
          ? null
          : t('verdict.waitNote', {
              share,
              median: view.wait?.medianDays === null ? '—' : formatDays(view.wait.medianDays, locale),
            }),
        { unit: waitDays === null ? null : locale === 'zh' ? '天' : 'days' },
      ),
      fact(
        t('verdict.nextWindow'),
        localRange ?? t('common.unavailable'),
        view.window
          ? t('verdict.windowUtc', {
              range: utcRange,
              count: formatNumber(view.window.count, locale),
              total: formatNumber(view.window.total, locale),
            })
          : t('verdict.windowNone'),
      ),
    );
    // The fact helper appends the note after the value; the window fact keeps the
    // UTC label under it, which is exactly the contract's two-line shape.

    if (view.model) {
      note.textContent = t('verdict.note', {
        n: formatNumber(view.model.intervalSample, locale),
        level: t(`verdict.confidence.${view.confidence ?? 'low'}`),
      });
    } else {
      note.textContent = t('verdict.noteNoSample');
    }

    if (view.mode === 'pending' && view.pending) {
      const url = safeXUrl(view.pending.source_url);
      pending.hidden = false;
      pending.replaceChildren(
        el(
          'p',
          {},
          t('verdict.pendingNote', {
            time: formatDateTime(view.pending.at, locale) ?? t('common.unavailable'),
            quote: String(view.pending.quote ?? '').slice(0, 120),
          }),
        ),
        url ? link(url, t('verdict.pendingLink'), { external: true, className: 'chit' }) : null,
      );
    } else {
      pending.hidden = true;
      pending.replaceChildren();
    }
    updated.textContent = view.updatedAt
      ? t('verdict.updated', { time: formatDateTime(view.updatedAt, locale) ?? '—' })
      : '';
  }

  function paintRhythm() {
    const view = rhythmView(state.rhythm, locale);
    rhythmHost.replaceChildren();
    if (!view) {
      if (state.rhythmError) rhythmHost.append(el('p', { class: 'empty' }, t('common.readError')));
      return;
    }
    const median = view.stats.medianIntervalDays;
    const recent = view.recentMedianDays;
    const longest = view.stats.longestIntervalDays;
    const facts = factGrid([
      fact(t('home.medianInterval'), median === null ? '—' : formatDays(median, locale), null, {
        unit: median === null ? null : locale === 'zh' ? '天' : 'days',
      }),
      fact(t('home.recentMedian'), recent === null ? '—' : formatDays(recent, locale), null, {
        unit: recent === null ? null : locale === 'zh' ? '天' : 'days',
      }),
      fact(t('home.longestInterval'), longest === null ? '—' : formatDays(longest, locale), null, {
        unit: longest === null ? null : locale === 'zh' ? '天' : 'days',
      }),
    ]);
    rhythmHost.append(
      facts,
      heatmapBlock({
        heatmap: view.heatmap,
        weekdayLabels: view.weekdayLabels,
        t,
        locale,
        total: view.heatTotal,
      }),
    );
  }

  function paintRecent() {
    const view = timelineView(state.timeline);
    clear(recentHost);
    if (!view) {
      recentHost.append(el('p', { class: 'empty' }, state.timelineError ? t('common.readError') : t('common.loading')));
      return;
    }
    const rows = view.events.slice().reverse().slice(0, RECENT_LIMIT);
    if (!rows.length) {
      recentHost.append(el('p', { class: 'empty' }, t('timeline.empty')));
      return;
    }
    // The gap to the previous reset is the useful second column; the kind is
    // already implied by it (a banked grant has no gap).
    const chronological = view.events.slice();
    const gaps = new Map();
    for (let i = 1; i < chronological.length; i += 1) {
      const previous = Date.parse(chronological[i - 1].at ?? '');
      const current = Date.parse(chronological[i].at ?? '');
      if (Number.isFinite(previous) && Number.isFinite(current)) gaps.set(chronological[i], (current - previous) / 86_400_000);
    }
    const table = el('table', { class: 'data-table recent-table' });
    table.append(
      el(
        'thead',
        {},
        el('tr', {}, el('th', {}, t('home.colWhen')), el('th', {}, t('home.colGap')), el('th', {}, t('home.colSource'))),
      ),
    );
    const body = el('tbody');
    for (const event of rows) {
      const url = safeXUrl(event.sourceUrl);
      const gap = gaps.get(event);
      body.append(
        el(
          'tr',
          {},
          el('td', { class: 'table-time' }, formatDateTime(event.at, locale) ?? t('common.unavailable')),
          el(
            'td',
            { class: 'num' },
            event.kind === 'banked'
              ? el('span', { class: 'muted' }, t('home.kindBanked'))
              : gap === undefined
                ? el('span', { class: 'muted' }, '—')
                : t('common.days', { n: formatDays(gap, locale) }),
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
    table.append(body);
    recentHost.append(el('div', { class: 'table-wrap' }, table));
  }

  paintVerdict();
  paintRhythm();
  paintRecent();

  const unsubscribe = subscribe((slice) => {
    if (slice === 'forecast') paintVerdict();
    if (slice === 'rhythm') paintRhythm();
    if (slice === 'timeline') paintRecent();
  });
  cleanups.push(unsubscribe);
  cleanups.push(subscribeTimeZone(() => {
    paintVerdict();
    paintRecent();
  }));

  const ticker = setInterval(() => {
    if (!document.hidden) paintVerdict();
  }, 60_000);
  cleanups.push(() => clearInterval(ticker));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

