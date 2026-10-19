/**
 * Notifications. The mirror is read-only, so there is no server to push from:
 * alerts fire from the page's own polling, and that limitation is stated in
 * the interface rather than hidden.
 */

const KEY = 'codex-reset.alerts';
const seenKey = 'codex-reset.lastNotifiedReset';

export const supported = () => typeof Notification !== 'undefined';

export function alertsEnabled() {
  return supported() && Notification.permission === 'granted' && read() === true;
}

function read() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* storage disabled */
  }
}

export async function enableAlerts() {
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'dismissed';
  write(true);
  return 'granted';
}

export function disableAlerts() {
  write(false);
}

export function sendTest(t) {
  if (!alertsEnabled()) return false;
  try {
    new Notification(t('push.title'), { body: t('push.granted'), tag: 'codex-reset-test' });
    return true;
  } catch {
    return false;
  }
}

/** Fires once per newly observed reset, only while a tab is open. */
export function announceReset(t, lastResetAt) {
  if (!alertsEnabled() || !lastResetAt) return false;
  let previous = null;
  try {
    previous = localStorage.getItem(seenKey);
  } catch {
    previous = null;
  }
  if (previous === lastResetAt) return false;
  try {
    localStorage.setItem(seenKey, lastResetAt);
  } catch {
    /* storage disabled — fall through and notify anyway */
  }
  if (!previous) return false;
  try {
    new Notification(t('push.title'), { body: t('home.verdict.today'), tag: 'codex-reset' });
    return true;
  } catch {
    return false;
  }
}
