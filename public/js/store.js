/**
 * The shared read loop. One place decides how often the public API is polled,
 * one place decides what a partial failure means, and views subscribe to the
 * slices they need instead of each running their own fetches.
 */

import { endpoints, invalidate } from './api.js';

const listeners = new Set();
const state = {
  locale: 'zh',
  forecast: null,
  forecastError: null,
  status: null,
  statusError: null,
  health: null,
  timeline: null,
  timelineError: null,
  feed: null,
  feedError: null,
  updatedAt: null,
};

const FORECAST_MS = 30_000;
const STATUS_MS = 300_000;

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

async function loadStatus({ fresh = false } = {}) {
  try {
    state.status = await endpoints.status({ locale: state.locale, fresh });
    state.statusError = null;
  } catch (error) {
    state.statusError = error;
  }
  emit('status');
}

async function loadTimeline() {
  try {
    state.timeline = await endpoints.timeline({ locale: state.locale, ttl: 300_000 });
    state.timelineError = null;
  } catch (error) {
    state.timelineError = error;
  }
  emit('timeline');
}

async function loadFeed() {
  try {
    state.feed = await endpoints.feed({ locale: state.locale, ttl: 30_000 });
    state.feedError = null;
  } catch (error) {
    state.feedError = error;
  }
  emit('feed');
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
  void loadFeed();
  void loadForecast();
  void loadStatus();
  void loadTimeline();
  void loadHealth();

  const tick = () => {
    if (document.hidden) return;
    void loadFeed();
    void loadForecast();
    void loadStatus();
  };
  timers.push(setInterval(tick, FORECAST_MS));
  timers.push(setInterval(() => void loadHealth(), STATUS_MS));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      invalidate('/api/');
      void loadFeed();
      void loadForecast({ fresh: true });
      void loadStatus();
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
  state.status = null;
  state.timeline = null;
  state.feed = null;
  emit('locale');
  void loadFeed();
  void loadForecast({ fresh: true });
  void loadStatus();
  void loadTimeline();
}

export async function refreshForecast() {
  invalidate('/api/forecast');
  state.forecast = null;
  emit('forecast');
  await loadForecast({ fresh: true });
}

export { loadFeed, loadTimeline, loadForecast };
