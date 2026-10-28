/**
 * Bootstrap: locale, the shell (masthead, hour column, status chip), the
 * client-side router, and the shared services every view uses.
 */

import { $, clear, el, icon, text } from './dom.js';
import { detectLocale, LOCALE_LABEL, locales, normalizeLocale, translator } from './i18n.js';
import { formatClock, formatDateTime } from './format.js';
import { getState, setLocale, startStore, subscribe } from './store.js';
import { alertsStatus, announceReset, disableAlerts, enableAlerts, markSeen, sendTest } from './notify.js';
import { statusView } from './model.js';
import { getTimeZone, getTimeZonePreference, localTimeZone, setTimeZone, subscribeTimeZone, zoneLabel, zoneShort } from './time-zone.js';
import { applyPageSeo, localizeLinks } from './seo.js';
import { pathFor, resolvePath } from './seo-meta.js';

/**
 * Overview and reset history are the primary routes. Service status and
 * the community waiting page remain reachable from the footer.
 */
const ROUTES = [
  { path: '/', key: 'home', label: 'nav.home', title: 'app.tagline', inNav: true },
  { path: '/timeline', key: 'timeline', label: 'nav.timeline', title: 'timeline.h1', inNav: true },
  { path: '/status', key: 'status', label: 'nav.status', title: 'status.h1', inNav: false },
  { path: '/vigil', key: 'vigil', label: 'nav.vigil', title: 'vigil.h1', inNav: false },
];

const app = {
  locale: 'zh',
  t: translator('zh'),
  state: getState(),
  announce: () => {},
  toast: () => {},
  navigate: () => {},
  onCleanup: null,
};

/* ------------------------------------------------------------------ utilities */

function makeAnnouncer() {
  const region = $('#announcer');
  let timer = 0;
  return (message) => {
    if (!region || !message) return;
    region.textContent = '';
    clearTimeout(timer);
    timer = setTimeout(() => {
      region.textContent = message;
    }, 40);
  };
}

function makeToast() {
  const node = $('#toast');
  let timer = 0;
  return (message) => {
    if (!node || !message) return;
    node.textContent = message;
    node.hidden = false;
    requestAnimationFrame(() => node.setAttribute('data-open', 'true'));
    clearTimeout(timer);
    timer = setTimeout(() => {
      node.removeAttribute('data-open');
      setTimeout(() => {
        node.hidden = true;
      }, 200);
    }, 2600);
  };
}

/* ---------------------------------------------------------------- the theme */

const THEME_KEY = 'codex-reset.theme';
let activeTheme = null;

/** Printed signage by default; the backlit panel only when asked for. */
function readTheme() {
  const fromQuery = new URLSearchParams(location.search).get('theme');
  if (fromQuery === 'dark' || fromQuery === 'light') return fromQuery;
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme) {
  activeTheme = theme;
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  const button = $('#theme-toggle');
  if (!button) return;
  const dark = theme === 'dark';
  button.replaceChildren(icon(dark ? 'moon' : 'sun', { size: 15 }));
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', app.t(dark ? 'theme.toLight' : 'theme.toDark'));
  button.title = app.t(dark ? 'theme.toLight' : 'theme.toDark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#101114' : '#f5f6f8');
}

function toggleTheme() {
  const next = activeTheme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage disabled */
  }
  applyTheme(next);
}

/* --------------------------------------------------------------- reminders */

function renderAlertsButton() {
  const button = $('#alerts-button');
  if (!button) return;
  const status = alertsStatus();
  button.replaceChildren(icon('bell', { size: 15 }));
  button.dataset.state = status === 'on' ? 'on' : 'off';
  button.setAttribute('aria-pressed', String(status === 'on'));
  button.setAttribute('aria-label', `${app.t('push.button')} · ${app.t(`push.state.${status}`)}`);
  button.title = app.t('push.button');
}

function renderAlertsMenu() {
  const menu = $('#alerts-menu');
  if (!menu) return;
  const status = alertsStatus();
  menu.setAttribute('aria-label', app.t('push.menuTitle'));
  const method = el(
    'button',
    {
      type: 'button',
      class: 'alerts-method',
      'aria-pressed': String(status === 'on'),
      dataset: { state: status },
      onclick: toggleAlerts,
    },
    el(
      'span',
      { class: 'alerts-method-text' },
      el('span', { class: 'alerts-method-name' }, app.t('push.method.browser')),
      el('span', { class: 'alerts-method-note' }, app.t(status === 'blocked' ? 'push.blockedHint' : 'push.method.browserNote')),
    ),
    el('span', { class: 'alerts-method-state' }, app.t(`push.state.${status}`)),
  );
  menu.replaceChildren(
    el('p', { class: 'alerts-menu-title' }, app.t('push.menuTitle')),
    method,
    el('p', { class: 'alerts-menu-note' }, app.t('push.onlyBrowser')),
    el('p', { class: 'alerts-menu-note' }, app.t('push.limit')),
    ...(status === 'on'
      ? [el('button', { type: 'button', class: 'btn btn--quiet alerts-test', onclick: runAlertTest }, app.t('push.test'))]
      : []),
  );
}

async function toggleAlerts() {
  const status = alertsStatus();
  if (status === 'on') {
    disableAlerts();
    renderAlertsButton();
    renderAlertsMenu();
    app.toast(app.t('push.disabled'));
    return;
  }
  if (status === 'unsupported' || status === 'blocked') {
    app.toast(app.t(status === 'unsupported' ? 'push.unsupported' : 'push.blocked'));
    return;
  }
  const result = await enableAlerts();
  if (result === 'granted') markSeen(app.state.forecast?.last_reset_at);
  renderAlertsButton();
  renderAlertsMenu();
  const message = {
    granted: 'push.enabled',
    blocked: 'push.blocked',
    unsupported: 'push.unsupported',
    dismissed: 'push.dismissed',
  }[result];
  app.toast(app.t(message ?? 'push.dismissed'));
}

function runAlertTest() {
  app.toast(app.t(sendTest(app.t) ? 'push.testSent' : 'push.testFailed'));
}

/* ----------------------------------------------------------------- the shell */

function renderNav(path) {
  const nav = $('#primary-nav');
  clear(nav);
  for (const route of ROUTES.filter((entry) => entry.inNav)) {
    nav.append(
      el(
        'a',
        {
          href: pathFor(route.key, app.locale),
          ...(route.path === path ? { 'aria-current': 'page' } : {}),
        },
        app.t(route.label),
      ),
    );
  }
}

function renderLocaleMenu() {
  const menu = $('#locale-menu');
  clear(menu);
  menu.setAttribute('aria-label', '语言');
  for (const code of locales()) {
    menu.append(
      el(
        'li',
        { role: 'option', 'aria-selected': String(code === app.locale) },
        el('button', { type: 'button', dataset: { locale: code }, onclick: () => switchLocale(code) }, LOCALE_LABEL[code] ?? code),
      ),
    );
  }
  text($('#locale-label'), LOCALE_LABEL[app.locale] ?? app.locale);
}

/** Language is part of the URL, so switching it is a navigation, not a redraw. */
function switchLocale(code) {
  const next = normalizeLocale(code);
  if (!next || next === app.locale) return;
  try {
    localStorage.setItem('codex-reset.locale', next);
  } catch {
    /* storage disabled */
  }
  const route = resolvePath(currentPath())?.key ?? 'home';
  location.assign(pathFor(route, next));
}

function applyLocale(next) {
  app.locale = next;
  app.t = translator(next);
  document.documentElement.lang = next === 'zh' ? 'zh-Hans' : next;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', app.t('app.description'));
  text($('#wordmark-sub'), app.t('app.sub'));
  localizeLinks(next);
  text($('#colophon-note'), app.t('footer.disclaimer'));
  text($('#skip'), app.t('nav.skip'));
  document.querySelectorAll('[data-i18n]').forEach((node) => text(node, app.t(node.dataset.i18n)));
  applyTheme(activeTheme ?? readTheme());
  renderTimeZoneControl();
  renderAlertsButton();
  if ($('#alerts-menu')?.hasAttribute('hidden') === false) renderAlertsMenu();
  renderUpdated();
}

function renderStatusChip() {
  const chip = $('#status-chip');
  const view = statusView(app.state.status);
  if (!chip) return;
  if (!view) {
    chip.dataset.tone = 'dim';
    text(chip.querySelector('.status-chip-text'), app.t('common.unavailable'));
    chip.setAttribute('title', app.t('common.readError'));
    return;
  }
  chip.dataset.tone = view.tone;
  const label = app.t(`state.${view.codex ?? 'unknown'}`) || view.codex;
  text(chip.querySelector('.status-chip-text'), label === `state.${view.codex}` ? app.t('state.unknown') : label);
  chip.setAttribute('title', view.incident?.name ?? view.description ?? '');
}

/* -------------------------------------------------------- the masthead clock */

let clockSignature = '';

function renderTimeZoneControl() {
  const button = $('#timezone-button');
  const menu = $('#timezone-menu');
  if (!button || !menu) return;
  const selected = getTimeZonePreference();
  const zones = [...new Set(['local', 'Asia/Shanghai', 'America/Los_Angeles', 'UTC', selected])];
  text($('#timezone-label'), zoneShort(getTimeZone(), app.locale));
  button.title = app.t('timezone.hint');
  button.setAttribute('aria-label', `${app.t('timezone.label')}: ${zoneShort(getTimeZone(), app.locale)}`);
  menu.setAttribute('aria-label', app.t('timezone.label'));
  menu.replaceChildren(...zones.map((zone) =>
    el('li', { role: 'option', 'aria-selected': String(zone === selected) },
      el('button', { type: 'button', dataset: { zone }, onclick: () => setTimeZone(zone) },
        zone === 'local' ? app.t('timezone.local', { zone: zoneLabel(localTimeZone(), app.locale) }) : zoneLabel(zone, app.locale),
      ),
    ),
  ));
}

function renderUpdated() {
  const updated = app.state.forecast?.updated_at;
  if (updated) text($('#colophon-updated'), `${app.t('common.updatedAt')} ${formatDateTime(updated, app.locale)}`);
}

function renderClock() {
  const host = $('#masthead-clock');
  if (!host) return;
  const now = new Date();
  const time = formatClock(now.toISOString(), app.locale);
  const signature = `${app.locale}|${getTimeZone()}|${time}`;
  if (signature === clockSignature) return;
  clockSignature = signature;
  host.replaceChildren(
    document.createTextNode(app.t('home.clockNow')),
    el('b', {}, time),
  );
}

/* -------------------------------------------------------------------- router */

function currentPath() {
  const raw = location.pathname.replace(/^\/[a-z]{2}(?:-[A-Za-z]+)?(?=\/|$)/, '') || '/';
  return raw === '' ? '/' : raw.replace(/\/+$/, '') || '/';
}

let activeCleanup = null;
let mounted = null;

/** Replace the server-rendered first paint (or the previous view) in place. */
function mountView(main, host) {
  const shell = $('#ssr');
  if (shell) shell.replaceWith(host);
  else if (mounted?.isConnected) mounted.replaceWith(host);
  else main.replaceChildren(host);
  mounted = host;
}

async function render(path, { force = false } = {}) {
  const route = ROUTES.find((entry) => entry.path === path) ?? ROUTES[0];
  const main = $('#main');
  if (!main) return;
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  const module = await import(`./views/${route.key}.js`);
  const host = el('div', { class: 'page-enter' });
  mountView(main, host);
  applyPageSeo(route.key, app.locale);
  if (route.key !== 'home') $('#seo-guide')?.remove();
  const cleanup = await module.render(host, app, {});
  activeCleanup = typeof cleanup === 'function' ? cleanup : null;
  if (force) host.classList.remove('page-enter');
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: force ? 'auto' : 'smooth' });
  renderNav(route.path);
}

app.navigate = (href) => {
  const url = new URL(href, location.origin);
  if (url.origin !== location.origin) {
    window.open(url.toString(), '_blank', 'noopener');
    return;
  }
  history.pushState({}, '', url.pathname + url.hash);
  if (url.hash) {
    const target = document.querySelector(url.hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  void render(currentPath().split('#')[0] || '/');
};

function onClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target.closest?.('a[href]');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href || anchor.target === '_blank' || href.startsWith('http') || href.startsWith('mailto:')) return;
  if (href.startsWith('#')) {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  const path = href.split('#')[0];
  if (!resolvePath(path)) return;
  event.preventDefault();
  app.navigate(href);
}

/* --------------------------------------------------------------------- boot */

function boot() {
  app.announce = makeAnnouncer();
  app.toast = makeToast();
  applyTheme(readTheme());
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  subscribeTimeZone(() => { renderTimeZoneControl(); renderClock(); renderUpdated(); });
  setInterval(() => { if (!document.hidden) renderClock(); }, 30_000);

  const fromPath = normalizeLocale((location.pathname.match(/^\/([a-z]{2})(?:-[A-Za-z]+)?\//) || [])[1]);
  const locale = fromPath ?? detectLocale();
  applyLocale(locale);

  const menus = [
    { selector: '.alerts', button: $('#alerts-button'), menu: $('#alerts-menu'), onOpen: renderAlertsMenu },
    { selector: '.locale', button: $('#locale-button'), menu: $('#locale-menu') },
    { selector: '.tz', button: $('#timezone-button'), menu: $('#timezone-menu') },
  ];
  const closeMenu = (entry) => {
    entry.menu?.setAttribute('hidden', '');
    entry.button?.setAttribute('aria-expanded', 'false');
  };
  for (const entry of menus) {
    entry.button?.addEventListener('click', () => {
      if (!entry.menu) return;
      const open = entry.menu.hasAttribute('hidden');
      menus.forEach(closeMenu);
      if (open) {
        entry.onOpen?.();
        entry.menu.removeAttribute('hidden');
        entry.button.setAttribute('aria-expanded', 'true');
      }
    });
    entry.menu?.addEventListener('click', () => closeMenu(entry));
  }
  document.addEventListener('click', (event) => {
    for (const entry of menus) {
      if (!event.target.closest?.(entry.selector)) closeMenu(entry);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') menus.forEach(closeMenu);
  });

  renderNav(currentPath());
  renderLocaleMenu();
  renderAlertsButton();
  renderStatusChip();
  renderClock();

  subscribe((slice) => {
    if (slice === 'status') renderStatusChip();
    if (slice === 'forecast' || slice === 'locale') renderClock();
    if (slice === 'forecast') {
      renderUpdated();
      announceReset(app.t, app.state.forecast?.last_reset_at);
    }
  });

  startStore(locale);

  document.addEventListener('click', onClick);
  window.addEventListener('popstate', () => void render(currentPath()));
  void render(currentPath(), { force: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export { app };
