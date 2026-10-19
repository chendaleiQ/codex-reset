/** Formatting helpers. Every one of them is total: bad input yields a labelled gap, never "NaN". */

const LOCALE_TAG = { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP', es: 'es-ES' };

export const tag = (locale) => LOCALE_TAG[locale] || LOCALE_TAG.zh;

export function parseTime(value) {
  const at = Date.parse(value ?? '');
  return Number.isFinite(at) ? at : null;
}

export function duration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return { unit: 'second', value: Math.max(0, Math.round(ms / 1000)) };
  if (minutes < 60) return { unit: 'minute', value: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { unit: 'hour', value: hours, minutes: minutes % 60 };
  return { unit: 'day', value: Math.floor(hours / 24) };
}

export function relativeTime(iso, now = Date.now(), locale = 'zh') {
  const at = parseTime(iso);
  if (at === null) return '';
  const diff = at - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto', style: 'short' });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

export function formatDuration(ms, locale = 'zh') {
  const d = duration(ms);
  if (!d) return null;
  const relative = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'always', style: 'narrow' });
  if (d.unit === 'second') return relative.format(-d.value, 'second');
  if (d.unit === 'minute') return relative.format(-d.value, 'minute');
  if (d.unit === 'hour') return relative.format(-d.value, 'hour');
  return relative.format(-d.value, 'day');
}

/** Days between two instants, at 1 decimal place, as a number. */
export function daysBetween(fromIso, toMs = Date.now()) {
  const from = parseTime(fromIso);
  if (from === null) return null;
  return Math.max(0, (toMs - from) / 86_400_000);
}

export function formatDays(days, locale = 'zh') {
  if (!Number.isFinite(days)) return null;
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 1, minimumFractionDigits: days < 10 ? 1 : 0 }).format(days);
}

export function formatDateTime(iso, locale = 'zh', timeZone) {
  const at = parseTime(iso);
  if (at === null) return null;
  return new Intl.DateTimeFormat(tag(locale), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone, timeZoneName: 'short' } : {}),
  }).format(new Date(at));
}

export function formatClock(iso, locale = 'zh', timeZone) {
  const at = parseTime(iso);
  if (at === null) return null;
  return new Intl.DateTimeFormat(tag(locale), { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(at));
}

export function formatDay(iso, locale = 'zh', timeZone) {
  const at = parseTime(iso);
  if (at === null) return null;
  return new Intl.DateTimeFormat(tag(locale), { month: 'short', day: 'numeric', timeZone }).format(new Date(at));
}

export function formatNumber(value, locale = 'zh', options) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(tag(locale), options).format(n);
}

export function formatCompact(value, locale = 'zh') {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1000) return String(n);
  return new Intl.NumberFormat(tag(locale), {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: n >= 10_000 ? 0 : 1,
  }).format(n);
}

export function formatPercent(value, locale = 'zh', fractionDigits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Accepts either 0–1 or 0–100.
  const pct = n > 1 ? n : n * 100;
  return `${new Intl.NumberFormat(tag(locale), { maximumFractionDigits: fractionDigits }).format(pct)}%`;
}

export function bounds(lower, upper, locale = 'zh') {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  const fmt = (v) => new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 0 }).format(v * 100);
  return `${fmt(lower)}–${fmt(upper)}%`;
}

export function offsetLabel(timeZone, locale = 'zh') {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find(({ type }) => type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone || 'UTC';
  }
}

export function zoneFromIONA(iso, locale = 'zh') {
  return formatClock(iso, locale, undefined);
}

export function flag(code) {
  if (!/^[A-Z]{2}$/.test(String(code ?? ''))) return '';
  return String.fromCodePoint(...[...String(code)].map((ch) => 127462 + ch.charCodeAt(0) - 65));
}

export function regionName(code, locale = 'zh') {
  if (!/^[A-Z]{2}$/.test(String(code ?? ''))) return '';
  try {
    return new Intl.DisplayNames([tag(locale)], { type: 'region' }).of(String(code)) || String(code);
  } catch {
    return String(code);
  }
}

/** Counts down to a deadline as hh:mm:ss, or null once it has passed. */
export function countdown(deadlineIso, now = Date.now()) {
  const deadline = parseTime(deadlineIso);
  if (deadline === null) return null;
  const remaining = deadline - now;
  if (remaining <= 0) return { overdue: true, ms: -remaining };
  const total = Math.floor(remaining / 1000);
  return {
    overdue: false,
    ms: remaining,
    hours: String(Math.floor(total / 3600)).padStart(2, '0'),
    minutes: String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
    seconds: String(total % 60).padStart(2, '0'),
  };
}
