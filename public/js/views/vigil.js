/**
 * Vigil — the wall of people waiting for the next reset, plus the genuinely
 * useful thing underneath it: an hour-by-hour record of when resets land.
 *
 * The wall is the one writable surface on the site. Names stay in this
 * browser's localStorage as a personal record; the wall itself lives on the
 * server and is refreshed every minute.
 */

import { el, icon } from '../dom.js';
import { endpoints } from '../api.js';
import { crowdSize, hourHistogram, readVigil, timelineView, vigilView, writeVigil } from '../model.js';
import { getState, loadTimeline, subscribe } from '../store.js';
import { flag, formatClock, formatDay, formatNumber, relativeTime } from '../format.js';
import { errorBlock, faqBlock, leaf } from './_parts.js';
import { getTimeZone, hourInZone, subscribeTimeZone, zoneLabel } from '../time-zone.js';

const REFRESH_MS = 60_000;

export async function render(host, app) {
  const state = getState();
  const t = app.t;
  const locale = app.locale;
  const cleanups = [];
  let vigil = null;
  let vigilError = null;
  let submitting = false;
  let pendingAmen = new Set();

  host.append(
    el(
      'header',
      { class: 'page-head' },
      el('h1', {}, t('vigil.h1')),
      el('p', { class: 'lead' }, t('vigil.lede')),
    ),
  );

  const countHost = el('div', { class: 'vigil-hero' });
  const joinHost = el('div', { class: 'join-block' });
  const wallHost = el('div', { class: 'vigil-wall-block' });
  const clockHost = el('div', { class: 'clock-plot' });
  const profileHost = el('div');

  host.append(
    el('section', { class: 'leaf', style: 'border-top:0;margin-top:0;padding-top:0' }, countHost),
    leaf(t, { title: t('vigil.joinTitle'), note: t('vigil.joinNote') }, joinHost),
    leaf(t, { title: t('vigil.wall'), note: t('vigil.wallNote') }, wallHost),
    leaf(t, { title: t('vigil.sleepTitle'), note: t('vigil.sleepNote') }, clockHost),
    leaf(t, { title: t('vigil.profile'), note: t('vigil.profileNote') }, profileHost),
    leaf(t, { title: t('vigil.faq') }, faqBlock(t)),
  );

  /* --- count -------------------------------------------------------------- */

  function paintCount() {
    countHost.replaceChildren();
    if (vigilError) {
      countHost.append(errorBlock(t, { onRetry: () => void loadVigil({ fresh: true }) }));
      return;
    }
    if (!vigil) {
      countHost.append(el('p', { class: 'empty' }, t('common.loading')));
      return;
    }
    const left = el('div');
    left.append(
      el('p', { class: 'field-label' }, t('vigil.believers')),
      el('p', { class: 'vigil-count' }, t('vigil.countLine', { n: formatNumber(vigil.believers, locale) })),
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

  /* --- join form ---------------------------------------------------------- */

  function paintJoin() {
    joinHost.replaceChildren();
    if (vigil && vigil.writable === false) {
      joinHost.append(el('p', { class: 'note', dataset: { tone: 'warn' } }, t('vigil.readOnly')));
      return;
    }
    const nameInput = el('input', {
      type: 'text',
      name: 'name',
      id: 'vigil-name',
      required: true,
      minlength: '1',
      maxlength: '24',
      autocomplete: 'nickname',
      placeholder: t('vigil.namePlaceholder'),
      'aria-describedby': 'vigil-join-error',
    });
    const daysInput = el('input', {
      type: 'number',
      name: 'days',
      id: 'vigil-days',
      min: '0',
      max: '365',
      step: '1',
      inputmode: 'numeric',
    });
    const countryInput = el('input', {
      type: 'text',
      name: 'country',
      id: 'vigil-country',
      maxlength: '2',
      pattern: '[A-Za-z]{2}',
      autocomplete: 'country',
      placeholder: t('vigil.countryPlaceholder'),
    });
    const submit = el('button', { type: 'submit', class: 'btn btn--primary' }, t('vigil.submit'));
    const error = el('p', { class: 'field-error', id: 'vigil-join-error', role: 'alert', hidden: true });

    const form = el(
      'form',
      { class: 'join-form', novalidate: true },
      el('div', { class: 'field' }, el('label', { for: 'vigil-name' }, t('vigil.name')), nameInput),
      el('div', { class: 'field' }, el('label', { for: 'vigil-days' }, t('vigil.days')), daysInput),
      el('div', { class: 'field' }, el('label', { for: 'vigil-country' }, t('vigil.country')), countryInput),
      el('div', { class: 'join-actions' }, submit),
      error,
    );

    const showError = (message) => {
      error.textContent = message;
      error.hidden = false;
    };

    const validate = () => {
      const name = String(nameInput.value ?? '').replace(/\s+/g, ' ').trim();
      if (!name || [...name].length > 24) {
        showError(t('vigil.nameError'));
        nameInput.focus();
        return null;
      }
      const rawDays = String(daysInput.value ?? '').trim();
      let days = 0;
      if (rawDays) {
        const parsed = Number(rawDays);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 365) {
          showError(t('vigil.daysError'));
          daysInput.focus();
          return null;
        }
        days = Math.round(parsed);
      }
      const rawCountry = String(countryInput.value ?? '').trim().toUpperCase();
      if (rawCountry && !/^[A-Z]{2}$/.test(rawCountry)) {
        showError(t('vigil.countryError'));
        countryInput.focus();
        return null;
      }
      return { name, days, country: rawCountry || undefined };
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      error.hidden = true;
      const entry = validate();
      if (!entry) return;
      submitting = true;
      submit.disabled = true;
      submit.textContent = t('vigil.submitting');
      try {
        const result = await endpoints.joinVigil(entry);
        const saved = result?.entry ?? { id: '', name: entry.name, days: entry.days, country: entry.country ?? null, at: new Date().toISOString() };
        writeVigil({
          epochId: vigil?.epochId ?? '',
          id: saved.id ?? '',
          name: saved.name ?? entry.name,
          days: Number(saved.days) || 0,
          at: saved.at ?? new Date().toISOString(),
          tendedAt: '',
          amens: readVigil().amens,
        });
        form.reset();
        app.toast(t('vigil.joinOk'));
        app.announce(t('vigil.joinOk'));
        await loadVigil({ fresh: true });
        paintProfile();
      } catch (failure) {
        const status = failure?.status;
        showError(
          status === 400
            ? t('vigil.nameError')
            : status === 429
              ? t('vigil.rateLimited')
              : t('vigil.joinFail'),
        );
      } finally {
        submitting = false;
        submit.disabled = false;
        submit.textContent = t('vigil.submit');
      }
    });

    joinHost.append(form);
  }

  /* --- wall --------------------------------------------------------------- */

  function paintWall() {
    wallHost.replaceChildren();
    if (!vigil) {
      wallHost.append(el('p', { class: 'empty' }, vigilError ? t('common.readError') : t('common.loading')));
      return;
    }
    const entries = vigil.wall.slice(0, 24);
    if (!entries.length) {
      wallHost.append(el('p', { class: 'empty' }, t('vigil.wallEmpty')));
      return;
    }
    const mine = readVigil();
    const list = el('div', { class: 'wall' });
    for (const entry of entries) {
      const name = String(entry.name ?? '');
      const place = flag(entry.country);
      const amens = Number(vigil.amens?.[entry.id] ?? 0);
      const button = el(
        'button',
        {
          type: 'button',
          class: 'wall-amen',
          'aria-label': t('vigil.amenAria', { name }),
          onclick: () => void sendAmen(entry.id, button),
        },
        icon('flame', { size: 12 }),
        el('span', { class: 'wall-amen-count' }, amens > 0 ? formatNumber(amens, locale) : ''),
      );
      if (pendingAmen.has(entry.id)) button.disabled = true;
      list.append(
        el(
          'div',
          { class: 'wall-item', dataset: { self: String(Boolean(mine.id) && mine.id === entry.id) } },
          el('span', { class: 'wall-name' }, name, place ? el('span', { class: 'wall-place' }, place) : null),
          el(
            'span',
            { class: 'wall-days' },
            Number(entry.days) > 0 ? t('vigil.daysWaited', { n: formatNumber(entry.days, locale) }) : t('vigil.joinedAt', { time: relativeTime(entry.at, Date.now(), locale) }),
          ),
          el('span', { class: 'wall-age' }, relativeTime(entry.at, Date.now(), locale)),
          button,
        ),
      );
    }
    wallHost.append(list);
    if (vigil.believers > entries.length) {
      wallHost.append(
        el('p', { class: 'field-hint', style: 'margin-top:12px' }, t('vigil.wallMore', { count: formatNumber(vigil.believers - entries.length, locale) })),
      );
    }
  }

  async function sendAmen(id, button) {
    if (!id || pendingAmen.has(id)) return;
    pendingAmen.add(id);
    button.disabled = true;
    try {
      const result = await endpoints.amen(id);
      if (vigil) vigil.amens[id] = Number(result?.count) || (Number(vigil.amens[id]) || 0) + 1;
      const count = button.querySelector('.wall-amen-count');
      if (count) count.textContent = formatNumber(vigil?.amens?.[id] ?? 0, locale);
      const mine = readVigil();
      if (mine.id === id) writeVigil({ ...mine, amens: [...new Set([...mine.amens, id])] });
    } catch (failure) {
      app.toast(failure?.status === 429 ? t('vigil.rateLimited') : t('vigil.amenFail'));
    } finally {
      pendingAmen.delete(id);
      button.disabled = false;
    }
  }

  /* --- sleep clock -------------------------------------------------------- */

  function paintClock() {
    const timeline = state.timeline ? timelineView(state.timeline) : null;
    clockHost.replaceChildren();
    if (!timeline) {
      clockHost.append(el('p', { class: 'empty' }, state.timelineError ? t('common.readError') : t('common.loading')));
      return;
    }
    const buckets = hourHistogram(timeline.events);
    const total = buckets.reduce((sum, count) => sum + count, 0);
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
    const time = formatClock(new Date().toISOString(), locale);
    const verdict = el('p', { class: 'clock-verdict' });
    verdict.dataset.zone = hits === 0 ? 'sleep' : hits >= peakFloor ? 'prime' : 'awake';
    verdict.textContent =
      hits === 0
        ? t('vigil.clockAsleep', { time })
        : t(hits >= peakFloor ? 'vigil.clockPrime' : 'vigil.clockAwake', { time, count: hits, total });

    clockHost.append(plot, labels, verdict, el('p', { class: 'field-hint' }, `${zoneLabel(getTimeZone(), locale)} · ${t('vigil.sleepFooter')}`));
  }

  /* --- my local record ---------------------------------------------------- */

  function paintProfile() {
    profileHost.replaceChildren();
    const mine = readVigil();
    if (!mine.name) {
      profileHost.append(el('p', { class: 'empty' }, t('vigil.profileEmpty')));
    } else {
      const rows = el('dl', { class: 'factgrid' });
      const push = (term, value) => rows.append(el('div', { class: 'fact' }, el('dt', {}, term), el('dd', {}, value)));
      push(t('vigil.name'), mine.name);
      if (mine.days > 0) push(t('vigil.profileDays'), t('common.days', { n: formatNumber(mine.days, locale) }));
      if (mine.at) push(t('vigil.profileJoined'), formatDay(mine.at, locale) ?? '—');
      if (mine.epochId) push(t('vigil.profileEpoch'), mine.epochId);
      profileHost.append(rows);
    }

    const archive = (vigil?.archive ?? []).slice(0, 6);
    if (archive.length) {
      const list = el('ul', { class: 'archive-list' });
      for (const entry of archive) {
        list.append(
          el(
            'li',
            {},
            el('span', { class: 'archive-date' }, formatDay(entry.endedAt, locale) ?? '—'),
            el('span', { class: 'archive-count' }, t('vigil.archiveCount', { n: formatNumber(entry.count, locale) })),
          ),
        );
      }
      profileHost.append(el('h3', { class: 'subhead' }, t('vigil.archive')), list);
    }
  }

  /* --- lifecycle ---------------------------------------------------------- */

  async function loadVigil({ fresh = false } = {}) {
    try {
      vigil = vigilView(await endpoints.vigil({ locale, fresh }));
      vigilError = null;
    } catch (error) {
      vigilError = error;
      vigil = null;
    }
    paintCount();
    paintJoin();
    paintWall();
  }

  paintCount();
  paintJoin();
  paintWall();
  paintClock();
  paintProfile();
  void loadVigil();
  void loadTimeline().then(paintClock);

  const unsubscribe = subscribe((slice) => {
    if (slice === 'timeline') paintClock();
  });
  cleanups.push(unsubscribe);
  cleanups.push(subscribeTimeZone(() => {
    paintCount();
    paintClock();
  }));

  const timer = setInterval(() => {
    if (!document.hidden) void loadVigil({ fresh: true });
  }, REFRESH_MS);
  cleanups.push(() => clearInterval(timer));

  return () => {
    for (const cleanup of cleanups) cleanup?.();
  };
}
