/** Shared display timezone. Instants stay absolute; calendar grouping happens last. */
const KEY = 'codex-reset.timeZone';
export const ACTIVITY_ZONE = 'America/Los_Angeles';
const listeners = new Set();

export function validTimeZone(value) {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
}

export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function readPreference() {
  try { const saved = localStorage.getItem(KEY); return validTimeZone(saved) ? saved : 'local'; } catch { return 'local'; }
}
let preference = readPreference();
export const getTimeZonePreference = () => preference;
export const getTimeZone = () => preference === 'local' ? localTimeZone() : preference;

export function setTimeZone(value) {
  if (value !== 'local' && !validTimeZone(value)) return false;
  if (preference === value) return false;
  preference = value;
  try { localStorage.setItem(KEY, value); } catch { /* storage is optional */ }
  listeners.forEach((listener) => listener(getTimeZone()));
  return true;
}

export function subscribeTimeZone(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dateKey(value, timeZone = getTimeZone()) {
  const at = typeof value === 'number' ? value : Date.parse(value ?? '');
  if (!Number.isFinite(at)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function hourInZone(value, timeZone = getTimeZone()) {
  const at = typeof value === 'number' ? value : Date.parse(value ?? '');
  if (!Number.isFinite(at)) return null;
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(at));
}

export function zoneOffset(timeZone = getTimeZone(), at = Date.now()) {
  return new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at).find((part) => part.type === 'timeZoneName').value.replace('GMT', 'UTC');
}

export function zoneLabel(timeZone = getTimeZone(), locale = 'zh', at = Date.now()) {
  const names = locale === 'zh'
    ? { 'Asia/Shanghai': '北京时间', 'America/Los_Angeles': '美国太平洋时间', UTC: '协调世界时' }
    : { 'Asia/Shanghai': 'Beijing', 'America/Los_Angeles': 'US Pacific', UTC: 'Coordinated Universal Time' };
  return `${names[timeZone] || timeZone} (${zoneOffset(timeZone, at)})`;
}

/** Resolve a civil midnight, including DST, for the activity's Pacific boundaries. */
export function activityMidnight(date) {
  const target = Date.parse(`${date}T00:00:00Z`);
  let at = target;
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ACTIVITY_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(at).map(({ type, value }) => [type, Number(value)]));
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const difference = target - wall;
    at += difference;
    if (!difference) break;
  }
  return at;
}
