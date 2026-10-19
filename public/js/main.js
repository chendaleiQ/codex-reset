/**
 * Bootstrap: locale, the shell (masthead, hour column, status chip), the
 * client-side router, and the shared services every view uses.
 */

import { $, clear, el, icon, text } from './dom.js';
import { detectLocale, LOCALE_LABEL, locales, normalizeLocale, translator } from './i18n.js';
import { formatClock, formatDateTime } from './format.js';
import { getState, setLocale, startStore, subscribe } from './store.js';
import { statusView } from './model.js';
import { getTimeZone, getTimeZonePreference, localTimeZone, setTimeZone, subscribeTimeZone, zoneLabel } from './time-zone.js';

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
  if (meta) meta.setAttribute('content', dark ? '#101114' : '#eef1f5');
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

/* ----------------------------------------------------------------- the shell */

function renderNav(path) {
  const nav = $('#primary-nav');
  clear(nav);
  for (const route of ROUTES.filter((entry) => entry.inNav)) {
    nav.append(
      el(
        'a',
        {
          href: route.path,
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

function switchLocale(code) {
  const next = normalizeLocale(code);
  if (!next || next === app.locale) return;
  try {
    localStorage.setItem('codex-reset.locale', next);
  } catch {
    /* storage disabled */
  }
  applyLocale(next);
  setLocale(next);
  renderNav(currentPath());
  renderLocaleMenu();
  renderClock();
  render(currentPath(), { replace: true, force: true });
}

function applyLocale(next) {
  app.locale = next;
  app.t = translator(next);
  document.documentElement.lang = next === 'zh' ? 'zh-Hans' : next;
  document.title = `${app.t('app.name')} — ${app.t('app.tagline')}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute('content', app.t('app.description'));
  text($('#wordmark-sub'), app.t('app.sub'));
  text($('#colophon-note'), app.t('footer.disclaimer'));
  text($('#skip'), app.t('nav.skip'));
  document.querySelectorAll('[data-i18n]').forEach((node) => text(node, app.t(node.dataset.i18n)));
  applyTheme(activeTheme ?? readTheme());
  renderTimeZoneControl();
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
  const select = $('#timezone-select');
  if (!select) return;
  const selected = getTimeZonePreference();
  const zones = [...new Set(['local', 'Asia/Shanghai', 'America/Los_Angeles', 'UTC', selected])];
  select.replaceChildren(...zones.map((zone) => el('option', { value: zone },
    zone === 'local' ? app.t('timezone.local', { zone: zoneLabel(localTimeZone(), app.locale) }) : zoneLabel(zone, app.locale),
  )));
  select.value = selected;
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
  main.replaceChildren(host);
  document.title = `${app.t('app.name')} — ${app.t(route.title)}`;
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
  if (!ROUTES.some((route) => route.path === path)) return;
  event.preventDefault();
  app.navigate(href);
}

/* --------------------------------------------------------------------- boot */

function boot() {
  app.announce = makeAnnouncer();
  app.toast = makeToast();
  applyTheme(readTheme());
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
  $('#timezone-select')?.addEventListener('change', (event) => setTimeZone(event.target.value));
  subscribeTimeZone(() => { renderTimeZoneControl(); renderClock(); renderUpdated(); });
  setInterval(() => { if (!document.hidden) renderClock(); }, 30_000);

  const fromPath = normalizeLocale((location.pathname.match(/^\/([a-z]{2})(?:-[A-Za-z]+)?\//) || [])[1]);
  const locale = fromPath ?? detectLocale();
  applyLocale(locale);

  const menu = $('#locale-menu');
  const button = $('#locale-button');
  button?.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden');
    if (open) menu.removeAttribute('hidden');
    else menu.setAttribute('hidden', '');
    button.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('.locale')) {
      menu?.setAttribute('hidden', '');
      button?.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu?.setAttribute('hidden', '');
      button?.setAttribute('aria-expanded', 'false');
    }
  });
  menu?.addEventListener('click', () => {
    menu.setAttribute('hidden', '');
    button?.setAttribute('aria-expanded', 'false');
  });

  renderNav(currentPath());
  renderLocaleMenu();
  renderStatusChip();
  renderClock();

  subscribe((slice) => {
    if (slice === 'status') renderStatusChip();
    if (slice === 'forecast' || slice === 'locale') renderClock();
    if (slice === 'forecast') renderUpdated();
  });

  startStore(locale);

  document.addEventListener('click', onClick);
  window.addEventListener('popstate', () => void render(currentPath()));
  void render(currentPath(), { force: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

export { app };
