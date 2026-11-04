/**
 * The shared read loop. One place decides how often the local API is polled,
 * one place decides what a partial failure means, and views subscribe to the
 * slices they need instead of each running their own fetches.
 *
 * Everything here is same-origin and reads the release's own dataset; there is
 * no third-party request anywhere in this file.
 */

import { endpoints, invalidate } from './api.js';

const listeners = new Set();
const state = {
  locale: 'zh',
  forecast: null,
  forecastError: null,
  rhythm: null,
  rhythmError: null,
  status: null,
  statusError: null,
  health: null,
  timeline: null,
  timelineError: null,
};

/** The probability moves as the wait grows, so the forecast slice is the fast one. */
const FAST_MS = 30_000;
const SLOW_MS = 300_000;

let timers = [];
let running = false;

export const getState = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(slice) {
  for (const listener of listeners) listener(slice, state);
}

async function loadForecast({ fresh = false } = {}) {
  try {
    state.forecast = await endpoints.forecast({ locale: state.locale, fresh, ttl: 20_000, params: {} });
    state.forecastError = null;
  } catch (error) {
    state.forecastError = error;
  }
  emit('forecast');
}

async function loadRhythm({ fresh = false } = {}) {
  try {
    state.rhythm = await endpoints.rhythm({ locale: state.locale, fresh });
    state.rhythmError = null;
  } catch (error) {
    state.rhythmError = error;
  }
  emit('rhythm');
}

async function loadStatus({ fresh = false } = {}) {
  try {
    state.status = await endpoints.status({ locale: state.locale, fresh });
    state.statusError = null;
  } catch (error) {
    state.statusError = error;
  }
  emit('status');
}

async function loadTimeline({ fresh = false } = {}) {
  try {
    state.timeline = await endpoints.timeline({ locale: state.locale, fresh });
    state.timelineError = null;
  } catch (error) {
    state.timelineError = error;
  }
  emit('timeline');
}

async function loadHealth() {
  try {
    state.health = await endpoints.health({ locale: state.locale });
  } catch {
    state.health = null;
  }
  emit('health');
}

/** Starts the loop. Safe to call twice; the second call is a no-op. */
export function startStore(locale = state.locale) {
  if (running) return;
  running = true;
  state.locale = locale;
  void loadForecast();
  void loadRhythm();
  void loadStatus();
  void loadTimeline();
  void loadHealth();

  const tick = () => {
    void loadForecast();
    void loadStatus();
  };
  timers.push(setInterval(tick, FAST_MS));
  timers.push(setInterval(() => {
    void loadRhythm({ fresh: true });
    void loadHealth();
  }, SLOW_MS));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      invalidate('/api/');
      void loadForecast({ fresh: true });
      void loadRhythm({ fresh: true });
      void loadStatus();
      void loadTimeline();
    }
  });
}

export function stopStore() {
  for (const timer of timers) clearInterval(timer);
  timers = [];
  running = false;
}

export function setLocale(locale) {
  state.locale = locale;
  invalidate('/api/');
  state.forecast = null;
  state.rhythm = null;
  state.status = null;
  state.timeline = null;
  emit('locale');
  void loadForecast({ fresh: true });
  void loadRhythm({ fresh: true });
  void loadStatus();
  void loadTimeline();
}

export async function refreshForecast() {
  invalidate('/api/forecast');
  state.forecast = null;
  emit('forecast');
  await loadForecast({ fresh: true });
}

export { loadForecast, loadRhythm, loadStatus, loadTimeline };
