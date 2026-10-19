/**
 * Reset overview, a calendar with selected-day detail, then the latest posts.
 */

import { clear, el, icon, link } from '../dom.js';
import { buildSeries } from '../series.js';
import { createSeriesCalendar } from '../series-calendar.js';
import { feedView, forecastView, timelineView } from '../model.js';
import { getState, subscribe } from '../store.js';
import { formatDateTime, formatNumber, relativeTime } from '../format.js';
import { getTimeZone, subscribeTimeZone, zoneLabel } from '../time-zone.js';
import { feedItem, leaf } from './_parts.js';

const DEFAULT_POSTS = 5;

const KIND_FILTERS = [
  ['all', 'radar.filter.all'],
  ['signal', 'radar.kind.signal'],
  ['reset', 'radar.kind.reset'],
  ['banked', 'radar.kind.banked'],
  ['limits', 'radar.kind.limits'],
  ['boost', 'radar.kind.boost'],
  ['codex', 'radar.kind.codex'],
  ['candidate', 'radar.kind.candidate'],
  ['other', 'radar.kind.other'],
];

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];

  let seed = null;
  try {
    seed = await fetch('/data/series.json').then((response) => (response.ok ? response.json() : null));
  } catch {
    seed = null;
  }

  host.classList.add('home-page');
  const headline = el('p', { class: 'home-update' }, t('common.loading'));
  const subline = el('p', { class: 'home-update-note' }, '');
  host.append(el('header', { class: 'home-heading' },
    el('div', {}, el('p', { class: 'home-eyebrow' }, t('home.eyebrow')), el('h1', {}, t('home.title')), el('p', { class: 'lead' }, t('home.intro'))),
    el('div', { class: 'home-latest' }, headline, subline),
  ));

  const stripHost = el('section', { class: 'reset-summary', 'aria-label': t('home.summary') });
  const calendarHost = el('div');
  const progress = el('span', { class: 'calendar-progress' });
  const calendarNote = el('p', { class: 'calendar-footnote' });
  const postHost = el('div');
  const filterHost = el('div', { class: 'filters' });

  let kindFilter = 'all';
  let postLimit = DEFAULT_POSTS;
  let postsSignature;

  host.append(
    stripHost,
    el('section', { class: 'calendar-section', 'aria-labelledby': 'calendar-title' },
      el('div', { class: 'calendar-section-head' },
        el('div', {}, el('div', { class: 'calendar-title-row' }, el('h2', { id: 'calendar-title' }, t('series.title')), progress), el('p', {}, t('series.note'))),
        link(seed?.source ?? 'https://x.com/thsottiaux', t('series.source'), { external: true, className: 'chit' }),
      ), calendarHost, calendarNote,
    ),
    leaf(
      t,
      { title: t('home.posts'), note: t('home.postsNote'), tools: filterHost },
      postHost,
    ),
  );
  const calendar = createSeriesCalendar(calendarHost, { locale, t });

  function sources() {
    return {
      feed: state.feed ? feedView(state.feed) : null,
      timeline: state.timeline ? timelineView(state.timeline) : null,
      seed,
    };
  }

  /* --- 1. did he post? ---------------------------------------------------- */

  function paintHeadline() {
    const feed = state.feed ? feedView(state.feed) : null;
    clear(subline);
    if (!feed) {
      headline.textContent = t(state.feedError ? 'home.headline.none' : 'home.headline.loading');
      if (state.feedError) subline.textContent = t('common.readError');
      return;
    }
    const at = feed.newestPostAt ?? feed.posts[0]?.at ?? null;
    const when = relativeTime(at, Date.now(), locale);
    const signal = feed.signal && feed.signal.active !== false ? feed.signal : null;

    headline.dataset.tone = signal ? 'bad' : 'plain';
    headline.textContent = signal
      ? t('home.headline.signal')
      : when
        ? t('home.headline.posted', { when })
        : t('home.headline.none');
    subline.append(
      document.createTextNode(at ? t('home.headline.at', { time: formatDateTime(at, locale) ?? '—' }) : t('common.unavailable')),
      document.createTextNode(' · '),
      document.createTextNode(
        signal ? t('home.signal.active') : feed.signalNewestAt ? t('home.signal.last', { when: relativeTime(feed.signalNewestAt, Date.now(), locale) }) : t('home.signal.none'),
      ),
    );
  }

  /* --- reset date and clearly labelled estimates ------------------------- */

  function paintStrip() {
    const feed = state.feed ? feedView(state.feed) : null;
    const forecast = forecastView(state.forecast, locale);
    clear(stripHost);

    const facts = el('dl', { class: 'reset-facts' });
    facts.append(
      fact(
        t('home.lastVerifiedReset'),
        formatDateTime(forecast?.lastResetAt, locale) ?? t('common.unavailable'),
        forecast?.ageDays != null ? t('home.ageDays', { days: formatNumber(forecast.ageDays, locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) }) : t('home.waitingData'),
      ),
      fact(t('home.chance24'), forecast?.chance24 != null ? `${forecast.chance24}%` : t('common.unavailable'), t('home.estimate')),
      fact(t('home.chance48'), forecast?.chance48 != null ? `${forecast.chance48}%` : t('common.unavailable'), t('home.estimate')),
    );

    stripHost.append(facts, el('div', { class: 'reset-summary-foot' },
      el('p', {}, icon('info'), t('home.forecastNote')),
      el('a', { href: '/timeline', class: 'chit' }, t('home.allResets'), icon('arrow')),
    ));
    if (state.forecastError) stripHost.append(el('p', { class: 'field-hint' }, t(forecast ? 'common.staleData' : 'common.readError')));
    if (feed?.stale) stripHost.append(el('p', { class: 'field-hint' }, t('radar.stale')));
  }

  /* --- 2. one calendar, with the detail attached to its selected date ----- */

  function paintSeries() {
    const series = buildSeries(sources());
    progress.textContent = t('series.recordedDays', { n: series.recordedDays, total: series.length });
    calendar.update(series);
    calendarNote.textContent = t('calendar.timezone', { zone: zoneLabel(getTimeZone(), locale) });
    if (state.timelineError || state.feedError) calendarNote.append(document.createTextNode(` ${t('calendar.partial')}`));
    else if (!state.timeline || !state.feed) calendarNote.append(document.createTextNode(` ${t('calendar.syncing')}`));
  }

  /* --- 3. the posts ------------------------------------------------------- */

  function paintFilters() {
    if (filterHost.childElementCount) {
      filterHost.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === kindFilter)));
      return;
    }
    filterHost.replaceChildren();
    for (const [id, key] of KIND_FILTERS) {
      filterHost.append(
        el(
          'button',
          {
            type: 'button',
            class: 'filter',
            dataset: { filter: id },
            'aria-pressed': String(kindFilter === id),
            onclick: () => {
              kindFilter = id;
              postLimit = DEFAULT_POSTS;
              paintFilters();
              paintPosts();
            },
          },
          t(key),
        ),
      );
    }
  }

  function paintPosts() {
    const feed = state.feed ? feedView(state.feed) : null;
    const signature = JSON.stringify([feed?.posts, Boolean(state.feedError), kindFilter, postLimit]);
    if (signature === postsSignature) return;
    postsSignature = signature;
    clear(postHost);
    if (!feed) {
      postHost.append(el('p', { class: 'empty' }, state.feedError ? t('common.readError') : t('common.loading')));
      return;
    }
    const rows = feed.posts.filter((post) => post.kind !== 'context').filter((post) => kindFilter === 'all' || post.kind === kindFilter);
    if (!rows.length) {
      postHost.append(el('p', { class: 'empty' }, t('radar.empty')));
      return;
    }
    const shown = rows.slice(0, postLimit);
    const list = el('div', { class: 'feed' });
    for (const post of shown) list.append(feedItem(post, { t, locale }));
    postHost.append(list);
    if (rows.length > shown.length) {
      postHost.append(
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--quiet',
            style: 'margin-top:24px',
            onclick: () => {
              postLimit = rows.length;
              paintPosts();
            },
          },
          `${t('radar.showMore')} · ${formatNumber(rows.length - shown.length, locale)}`,
        ),
      );
    }
  }

  function paintAll() {
    paintHeadline();
    paintStrip();
    paintSeries();
    paintPosts();
  }

  paintFilters();
  paintAll();

  const unsubscribe = subscribe((slice) => {
    if (slice === 'feed') { paintHeadline(); paintSeries(); paintPosts(); }
    if (slice === 'timeline') paintSeries();
    if (slice === 'forecast' || slice === 'feed') paintStrip();
  });
  cleanups.push(unsubscribe, subscribeTimeZone(() => { paintHeadline(); paintStrip(); paintSeries(); }));

  const ticker = setInterval(() => {
    if (!document.hidden) {
      paintHeadline();
      paintStrip();
      paintSeries();
    }
  }, 60_000);
  cleanups.push(() => clearInterval(ticker));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

/* ------------------------------------------------------------------ fragments */

function fact(term, value, sub) {
  const node = el('div', { class: 'fact' }, el('dt', {}, term), el('dd', {}, value));
  if (sub) node.append(el('p', {}, sub));
  return node;
}
