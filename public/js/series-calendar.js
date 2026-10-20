/** One responsive calendar, with persistent selection and an inline day detail. */
import { el, icon, link, safeXUrl } from './dom.js';
import { calendarDays, SERIES_KIND } from './series.js';
import { ACTIVITY_ZONE, zoneLabel } from './time-zone.js';
import { formatDateTime, formatDay } from './format.js';

const dateOf = (date) => new Date(`${date}T12:00:00Z`);
const monthOf = (date) => date.slice(0, 7);

export function createSeriesCalendar(host, { locale, t }) {
  let series;
  let model;
  let basis = 'activity';
  let selected;
  let month;
  let signature;
  const monthLabel = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' });
  const dayLabel = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' });
  const modeControl = el('div', { class: 'calendar-view-switch', role: 'group', 'aria-label': t('calendar.basisLabel') });
  const modeNote = el('p', { class: 'calendar-basis-note' });
  const toolbar = el('div', { class: 'calendar-toolbar' });
  const grid = el('div', { class: 'calendar-grid', 'aria-label': t('calendar.choose') });
  const legend = el('div', { class: 'calendar-legend' });
  const detail = el('section', { class: 'calendar-detail', id: 'calendar-detail', 'aria-live': 'polite', 'aria-atomic': 'true' });
  host.append(modeControl, modeNote, el('div', { class: 'calendar-layout' }, el('div', { class: 'calendar-main' }, toolbar, grid, legend), detail));

  function paintDetail() {
    const row = series.rows.find((entry) => entry.date === selected);
    if (!row) return;
    detail.dataset.kind = row.kind;
    detail.replaceChildren(
      el('p', { class: 'detail-eyebrow' }, t(series.basis === 'activity' ? 'calendar.activityDetail' : 'calendar.detail'), row.day ? el('b', {}, t('series.dayN', { n: row.day })) : null),
      el('h3', {}, dayLabel.format(dateOf(row.date))),
      el('p', { class: 'detail-zone' }, t('calendar.detailTimeZone', { zone: zoneLabel(series.timeZone, locale, row.entries[0] ? Date.parse(row.entries[0].at) : Date.now()) })),
    );
    if (!row.entries.length) {
      detail.append(
        el('span', { class: 'calendar-badge', dataset: { kind: row.kind } }, labelFor(row)),
        el('p', { class: 'detail-text' }, t(row.kind === 'future' ? 'calendar.futureNote' : row.kind === 'waiting' ? (series.basis === 'activity' ? 'calendar.activityWaiting' : 'calendar.todayEmpty') : (series.basis === 'activity' ? 'calendar.activityEmpty' : 'calendar.pastEmpty'))),
      );
      return;
    }
    for (const entry of row.entries) {
      const kind = SERIES_KIND[entry.kind];
      const body = locale === 'en' ? entry.en || entry.zh : entry.zh || entry.en;
      const timeKey = entry.kind === 'reset' ? (entry.effectiveAt ? 'calendar.resetAt' : 'calendar.confirmedAt') : entry.kind === 'banked' ? 'calendar.grantedAt' : 'calendar.postedAt';
      detail.append(el('article', { class: 'calendar-entry', dataset: { kind: entry.kind, event: entry.id } },
        el('span', { class: 'calendar-badge', dataset: { kind: entry.kind } }, t(kind.label)),
        el('p', { class: 'detail-time' }, icon('clock'), t(timeKey, { time: formatDateTime(entry.at, locale, series.timeZone) })),
        el('p', { class: 'detail-text' }, body || t(kind.label)),
        entry.kind === 'banked' ? el('p', { class: 'detail-note' }, t('calendar.bankedNote')) : null,
        entry.kind === 'announced' ? el('p', { class: 'detail-note' }, t('calendar.announcedNote')) : null,
        el('p', { class: 'detail-reference' }, t('calendar.activityRef', { n: entry.day, date: formatDay(entry.at, locale, ACTIVITY_ZONE) })),
        safeXUrl(entry.url) ? link(entry.url, t('common.viewOnX'), { external: true, className: 'detail-source' }) : null,
      ));
    }
  }

  function labelFor(row) {
    return t(basis === 'activity' && row.kind === 'waiting' ? 'calendar.activityPending' : SERIES_KIND[row.kind].label);
  }

  function closestToday() {
    return series.todayDate < series.startDate ? series.startDate : series.todayDate > series.endDate ? series.endDate : series.todayDate;
  }

  function choose(date) {
    selected = date;
    grid.querySelectorAll('[data-date]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.date === selected)));
    paintDetail();
  }

  function changeMonth(next) {
    month = next;
    if (monthOf(selected) !== month) selected = series.rows.find((row) => monthOf(row.date) === month).date;
    paint();
  }

  function paint() {
    modeControl.replaceChildren(...['activity', 'event'].map((mode) => el('button', {
      type: 'button', 'aria-pressed': String(basis === mode), dataset: { basis: mode },
      onclick: () => {
        if (basis === mode) return;
        basis = mode;
        update(model);
        modeControl.querySelector(`[data-basis="${mode}"]`)?.focus({ preventScroll: true });
      },
    }, t(`calendar.basis.${mode}`))));
    modeNote.textContent = t(`calendar.basisNote.${basis}`, { zone: zoneLabel(series.timeZone, locale) });
    const months = [...new Set(series.rows.map((row) => monthOf(row.date)))];
    const index = months.indexOf(month);
    toolbar.replaceChildren(
      el('h3', { class: 'calendar-month' }, monthLabel.format(dateOf(`${month}-01`))),
      el('div', { class: 'calendar-controls' },
        el('button', {
          type: 'button',
          class: 'calendar-current',
          ...(basis === 'activity' ? { title: t('calendar.activityTodayHint') } : {}),
          onclick: () => { selected = closestToday(); month = monthOf(selected); paint(); },
        }, t(series.todayDate >= series.startDate && series.todayDate <= series.endDate ? 'calendar.jumpToday' : 'calendar.latest')),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('calendar.previous'), disabled: index === 0, onclick: () => changeMonth(months[index - 1]) }, icon('arrow', { className: 'glyph arrow-back' })),
        el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('calendar.next'), disabled: index === months.length - 1, onclick: () => changeMonth(months[index + 1]) }, icon('arrow')),
      ),
    );
    grid.replaceChildren();
    for (let day = 0; day < 7; day += 1) grid.append(el('div', { class: 'calendar-weekday', 'aria-hidden': 'true' }, t(`calendar.weekday.${day}`)));
    const first = dateOf(`${month}-01`);
    const offset = (first.getUTCDay() + 6) % 7;
    const monthLength = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const cells = Math.ceil((offset + monthLength) / 7) * 7;
    const byDate = new Map(series.rows.map((row) => [row.date, row]));
    for (let cell = 0; cell < cells; cell += 1) {
      const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), cell - offset + 1, 12));
      const iso = date.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      if (!row || monthOf(iso) !== month) {
        grid.append(el('div', { class: 'calendar-cell calendar-cell--outside', 'aria-hidden': 'true' }, el('span', { class: 'calendar-number' }, date.getUTCDate())));
        continue;
      }
      const today = row.date === series.todayDate;
      const kind = SERIES_KIND[row.kind] ?? SERIES_KIND.waiting;
      grid.append(el('button', {
        type: 'button', class: 'calendar-cell',
        dataset: { date: iso, kind: row.kind, today: String(today), ...(row.day ? { day: row.day } : {}) },
        'aria-label': `${dayLabel.format(date)}${row.day ? ` · ${t('series.dayN', { n: row.day })}` : ''} · ${labelFor(row)}${row.entries.length > 1 ? ` · ${t('calendar.eventsCount', { n: row.entries.length })}` : ''}${today ? ` · ${t(basis === 'activity' ? 'calendar.activityToday' : 'calendar.today')}` : ''}`,
        'aria-pressed': String(iso === selected), 'aria-controls': 'calendar-detail',
        onclick: () => choose(iso),
      }, el('span', { class: 'calendar-number' }, date.getUTCDate(), row.day ? el('span', { class: 'calendar-activity-day', 'aria-hidden': 'true' }, `D${row.day}`) : null, today && basis === 'event' ? el('span', { class: 'calendar-today' }, t('calendar.today')) : null),
      el('span', { class: 'calendar-outcome' },
        el('span', { class: 'calendar-dot', 'aria-hidden': 'true' }),
        el('span', { class: 'calendar-outcome-full', 'aria-hidden': 'true' }, labelFor(row)),
        el('span', { class: 'calendar-outcome-short', 'aria-hidden': 'true' }, t(`calendar.short.${row.kind}`)),
        row.entries.length > 1 ? el('span', { class: 'calendar-more', 'aria-hidden': 'true' }, `+${row.entries.length - 1}`) : null,
      )));
    }
    legend.replaceChildren();
    for (const kind of ['reset', 'banked', 'improvement', ...(series.counts.announced ? ['announced'] : [])]) {
      legend.append(el('span', { class: 'calendar-legend-item', dataset: { kind } }, el('span', { class: 'calendar-dot', 'aria-hidden': 'true' }), t(SERIES_KIND[kind].label), el('b', {}, series.counts[kind])));
    }
    paintDetail();
  }

  function update(next) {
    model = next;
    const display = calendarDays(next, { basis });
    const nextSignature = JSON.stringify(display);
    if (nextSignature === signature) return;
    signature = nextSignature;
    if (series && (series.timeZone !== display.timeZone || series.basis !== display.basis)) {
      const chosenEvent = series.rows.find((row) => row.date === selected)?.entries[0]?.id;
      selected = display.rows.find((row) => row.entries.some((entry) => entry.id === chosenEvent))?.date ?? selected;
      month = selected ? monthOf(selected) : null;
    }
    series = display;
    if (!selected || !series.rows.some((row) => row.date === selected)) {
      selected = !selected ? closestToday() : selected < series.startDate ? series.startDate : series.endDate;
      month = monthOf(selected);
    }
    month ??= monthOf(selected);
    const focusedDate = grid.contains(document.activeElement) ? document.activeElement.dataset.date : null;
    paint();
    if (focusedDate) grid.querySelector(`[data-date="${focusedDate}"]`)?.focus({ preventScroll: true });
  }

  return { update };
}
