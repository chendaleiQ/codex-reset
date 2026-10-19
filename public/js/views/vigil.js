/**
 * Vigil — the community counter that grew around the resets, plus the genuinely
 * useful thing underneath it: an hour-by-hour record of when resets actually
 * land. The counter is read-only here; the mirror writes nothing upstream.
 */

import { el, icon, link, safeXUrl } from '../dom.js';
import { endpoints } from '../api.js';
import { vigilView, timelineView, crowdSize } from '../model.js';
import { getState, loadTimeline, subscribe } from '../store.js';
import { flag, formatDay, formatNumber, relativeTime } from '../format.js';
import { errorBlock, faqBlock, leaf } from './_parts.js';

const ZONE = 'America/Los_Angeles';
const REFRESH_MS = 60_000;

function hourInZone(iso) {
  const at = Date.parse(iso ?? '');
  if (!Number.isFinite(at)) return null;
  const part = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', hour12: false }).format(new Date(at));
  return Number(part) % 24;
}

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];
  let vigil = null;
  let vigilError = null;

  host.append(
    el(
      'header',
      { class: 'page-head' },
      el('h1', {}, t('vigil.h1')),
      el('p', { class: 'lead' }, t('vigil.lede')),
    ),
  );

  const countHost = el('div', { class: 'vigil-hero' });
  const wallHost = el('div', { class: 'vigil-wall-block' });
  const clockHost = el('div', { class: 'clock-plot' });
  const profileHost = el('div');

  host.append(
    el('section', { class: 'leaf', style: 'border-top:0;margin-top:0;padding-top:0' }, countHost),
    leaf(t, { title: t('vigil.wall') }, wallHost),
    leaf(t, { title: t('vigil.sleepTitle'), note: t('vigil.sleepNote') }, clockHost),
    leaf(t, { title: t('vigil.profile'), note: t('vigil.profileNote') }, profileHost),
    leaf(t, { title: t('vigil.faq') }, faqBlock(t)),
  );

  function paintCount() {
    countHost.replaceChildren();
    if (vigilError) {
      countHost.append(errorBlock(t, { onRetry: () => void loadVigil() }));
      return;
    }
    if (!vigil) {
      countHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const left = el('div');
    left.append(
      el('p', { class: 'field-label' }, t('vigil.believers')),
      el('p', { class: 'vigil-count' }, vigil.believers ? formatNumber(vigil.believers, locale) : '—'),
      el(
        'p',
        { class: 'vigil-meta' },
        vigil.startedAt
          ? t('vigil.cycle', {
              cycle: formatNumber(vigil.cycle, locale),
              day: formatNumber(Math.max(1, Math.floor((Date.now() - Date.parse(vigil.startedAt)) / 86_400_000) + 1), locale),
            })
          : t('common.unavailable'),
        vigil.startedAt ? formatDay(vigil.startedAt, locale) : null,
      ),
    );

    const right = el('div');
    const candles = el('div', { class: 'candles', role: 'img', 'aria-label': `${crowdSize(vigil.believers)}/12` });
    const lit = Math.min(12, Math.floor(vigil.believers / 10));
    for (let index = 0; index < 12; index += 1) {
      candles.append(el('span', { class: 'candle', dataset: { lit: String(index < lit) } }));
    }
    right.append(candles, el('p', { class: 'field-hint', style: 'margin-top:12px' }, t('footer.data')));

    countHost.append(left, right);
  }

  function paintWall() {
    wallHost.replaceChildren();
    if (!vigil) {
      wallHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const entries = vigil.wall.slice(0, 24);
    if (!entries.length) {
      wallHost.append(el('p', { class: 'empty' }, t('vigil.wallEmpty')));
      return;
    }
    const list = el('div', { class: 'wall' });
    for (const entry of entries) {
      const name = String(entry.name ?? '');
      const place = [flag(entry.country), entry.city].filter(Boolean).join(' ');
      const amens = Number(vigil.amens?.[entry.n] ?? 0);
      list.append(
        el(
          'div',
          { class: 'wall-item' },
          el('span', { class: 'wall-n' }, `#${formatNumber(entry.n, locale)}`),
          el('span', { class: 'wall-name' }, name),
          el('span', { class: 'wall-place' }, place),
          el('span', { class: 'wall-age' }, relativeTime(entry.at, Date.now(), locale)),
          el(
            'span',
            { class: 'wall-amen', role: 'img', 'aria-label': t('vigil.amenAria', { n: entry.n }) },
            icon('flame', { size: 12 }),
            amens > 0 ? formatNumber(amens, locale) : '',
          ),
        ),
      );
    }
    wallHost.append(list);
    if (vigil.believers > entries.length) {
      wallHost.append(el('p', { class: 'field-hint', style: 'margin-top:12px' }, t('vigil.wallMore', { count: formatNumber(vigil.believers - entries.length, locale) })));
    }
  }

  function paintClock() {
    const timeline = state.timeline ? timelineView(state.timeline) : null;
    clockHost.replaceChildren();
    if (!timeline) {
      clockHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const buckets = Array.from({ length: 24 }, () => 0);
    let total = 0;
    for (const event of timeline.events) {
      if (event.group !== 'reset' && !event.bankedGrant) continue;
      const hour = hourInZone(event.announcedAt ?? event.effectiveAt);
      if (hour === null) continue;
      buckets[hour] += 1;
      total += 1;
    }
    const max = Math.max(1, ...buckets);
    const peakFloor = Math.max(1, Math.round(max * 0.5));
    const nowHour = hourInZone(new Date().toISOString());
    const plot = el('div', { class: 'hours-plot' });
    const labels = el('div', { class: 'hours-labels' });
    for (let h = 0; h < 24; h += 1) {
      const peak = buckets[h] >= peakFloor;
      plot.append(
        el(
          'div',
          { class: 'hours-cell', dataset: { peak: String(peak), now: String(h === nowHour) } },
          el('span', {
            class: 'hours-bar',
            style: `--h:${Math.round((buckets[h] / max) * 100)}%`,
            title: `${String(h).padStart(2, '0')}:00 · ${buckets[h]}`,
          }),
        ),
      );
      labels.append(el('span', { dataset: { peak: String(peak) } }, String(h).padStart(2, '0')));
    }
    const hits = buckets[nowHour ?? 0] ?? 0;
    const time = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date());
    const verdict = el('p', { class: 'clock-verdict' });
    verdict.dataset.zone = hits === 0 ? 'sleep' : hits >= peakFloor ? 'prime' : 'awake';
    verdict.textContent =
      hits === 0
        ? t('vigil.clockAsleep', { time })
        : t(hits >= peakFloor ? 'vigil.clockPrime' : 'vigil.clockAwake', { time, count: hits, total });

    clockHost.append(plot, labels, verdict, el('p', { class: 'field-hint' }, `${ZONE} · ${t('radar.hoursNote')}`));
  }

  function paintProfile() {
    profileHost.replaceChildren();
    const feedProfile = state.feed?.profile;
    const rows = el('dl', { class: 'factgrid' });
    rows.append(
      fact('@thsottiaux', feedProfile ? formatNumber(feedProfile.followers, locale) : '—', t('radar.followers', { n: '' })),
    );
    const x = safeXUrl('https://x.com/thsottiaux');
    const wrap = el('div', { class: 'stack' });
    wrap.append(rows);
    if (x) wrap.append(el('a', { class: 'btn', href: x, rel: 'noopener nofollow', target: '_blank' }, t('common.viewOnX')));
    if (vigil) {
      const archive = (vigil.archive ?? []).slice(0, 6);
      if (archive.length) {
        const list = el('div', { class: 'wall' });
        for (const entry of archive) {
          list.append(
            el(
              'div',
              { class: 'wall-item' },
              el('span', { class: 'wall-n' }, formatDay(entry.answered_at, locale) ?? '—'),
              el('span', { class: 'wall-name' }, t('radar.kind.reset')),
              el('span', { class: 'wall-place' }, formatNumber(entry.believers ?? entry.total ?? 0, locale)),
              el('span'),
              el('span'),
            ),
          );
        }
        wrap.append(list);
      }
    }
    profileHost.append(wrap);
  }

  async function loadVigil() {
    try {
      vigil = vigilView(await endpoints.vigil({ locale }));
      vigilError = null;
    } catch (error) {
      vigilError = error;
      vigil = null;
    }
    paintCount();
    paintWall();
    paintProfile();
  }

  paintCount();
  paintWall();
  paintClock();
  paintProfile();
  void loadVigil();
  void loadTimeline().then(paintClock);

  const unsubscribe = subscribe((slice) => {
    if (slice === 'timeline') paintClock();
    if (slice === 'status') paintProfile();
  });
  cleanups.push(unsubscribe);

  const timer = setInterval(() => {
    if (!document.hidden) void loadVigil();
  }, REFRESH_MS);
  cleanups.push(() => clearInterval(timer));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}

function fact(term, value, sub) {
  const node = el('div', { class: 'fact' }, el('dt', {}, term), el('dd', {}, value));
  if (sub) node.append(el('p', {}, sub));
  return node;
}
