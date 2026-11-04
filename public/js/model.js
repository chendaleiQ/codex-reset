/**
 * View models. The own-dataset payloads are small but occasionally partial;
 * every builder here returns a total, self-describing shape so no view has to
 * guess whether a field exists, and no view can render a value without its
 * label, range or sample size.
 */

import { bounds, daysBetween, parseTime } from './format.js';
import { getTimeZone, hourInZone } from './time-zone.js';

const num = (value, fallback = null) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const isNum = (value) => Number.isFinite(Number(value)) && value !== null && value !== '';

/* ------------------------------------------------------------------ forecast */

/**
 * The numbers the site publishes, resolved once. `mode: 'pending'` means the
 * ledger holds an announced-but-unlanded reset; it is reported, but it never
 * enters the sample.
 */
export function forecastView(forecast, locale) {
  if (!forecast) return null;
  const probabilities = forecast.probabilities ?? {};
  const wait = forecast.wait ?? null;
  const cadence = forecast.cadence ?? null;
  const model = forecast.model ?? null;
  const backtest = forecast.backtest ?? null;
  const window = forecast.window ?? null;

  const shorterShare = isNum(wait?.shorter_share) ? Math.round(Number(wait.shorter_share) * 100) : null;
  const intervalSample = num(model?.interval_sample, 0);

  /** Server payloads may ship the raw 24-window sweep; normalise to the top 5. */
  const topWindows = (rows, total) =>
    rows
      .slice()
      .sort((a, b) => b.count - a.count || a.start_hour - b.start_hour)
      .slice(0, 5)
      .map((row) => {
        const share = isNum(row.share) ? Math.round(Number(row.share) * 100) : total > 0 ? Math.round((row.count / total) * 100) : null;
        return {
          startHour: num(row.start_hour, 0),
          endHour: num(row.end_hour, 0),
          count: num(row.count, 0),
          total: num(row.total, total),
          share,
          label: row.label ?? `${String(num(row.start_hour, 0)).padStart(2, '0')}:00–${String(num(row.end_hour, 0)).padStart(2, '0')}:00 UTC`,
        };
      });

  return {
    updatedAt: forecast.updated_at ?? null,
    generatedAt: forecast.generated_at ?? null,
    mode: forecast.mode === 'pending' ? 'pending' : 'model',
    pending: forecast.pending ?? null,
    lastResetAt: forecast.last_reset_at ?? null,
    ageDays: isNum(forecast.age_days) ? Number(forecast.age_days) : daysBetween(forecast.last_reset_at),
    chance24: isNum(probabilities.rounded_24h) ? Number(probabilities.rounded_24h) : null,
    chance48: isNum(probabilities.rounded_48h) ? Number(probabilities.rounded_48h) : null,
    range24: bounds(probabilities.range_24h?.lower, probabilities.range_24h?.upper, locale),
    range48: bounds(probabilities.range_48h?.lower, probabilities.range_48h?.upper, locale),
    range24Numeric: isNum(probabilities.range_24h?.lower) && isNum(probabilities.range_24h?.upper)
      ? { lower: Math.round(Number(probabilities.range_24h.lower) * 100), upper: Math.round(Number(probabilities.range_24h.upper) * 100) }
      : null,
    range48Numeric: isNum(probabilities.range_48h?.lower) && isNum(probabilities.range_48h?.upper)
      ? { lower: Math.round(Number(probabilities.range_48h.lower) * 100), upper: Math.round(Number(probabilities.range_48h.upper) * 100) }
      : null,
    confidence: typeof forecast.confidence === 'string' ? forecast.confidence : null,
    confidenceNote: forecast.confidence_note ?? null,
    cadence: cadence
      ? {
          recentMedianDays: num(cadence.recent_median_days),
          recentSample: num(cadence.recent_sample, 0),
          weightedMeanDays: num(cadence.weighted_mean_days),
          overallMedianDays: num(cadence.overall_median_days),
          accelerating: cadence.accelerating === true,
        }
      : null,
    wait: wait
      ? {
          days: num(wait.days),
          sample: num(wait.sample, 0),
          shorterShare,
          medianDays: num(wait.median_days),
          meanDays: num(wait.mean_days),
          longestDays: num(wait.longest_days),
          position: wait.position ?? null,
        }
      : null,
    window: window
      ? {
          startHour: num(window.start_hour),
          endHour: num(window.end_hour),
          label:
            window.label ??
            `${String(num(window.start_hour, 0)).padStart(2, '0')}:00–${String(num(window.end_hour, 0)).padStart(2, '0')}:00 UTC`,
          count: num(window.count, 0),
          total: num(window.total, 0),
          share: isNum(window.share)
            ? Math.round(Number(window.share) * 100)
            : intervalSample > 0
              ? Math.round((num(window.count, 0) / intervalSample) * 100)
              : null,
        }
      : null,
    windows: topWindows(Array.isArray(forecast.windows) ? forecast.windows : [], intervalSample),
    model: model
      ? {
          name: model.name ?? null,
          version: model.version ?? null,
          intervalSample: num(model.interval_sample, 0),
          effectiveSampleSize: num(model.effective_sample_size),
          halfLifeDays: num(model.half_life_days),
          shapeK: num(model.shape_k),
          scaleDays: num(model.scale_days),
          empiricalWeight: num(model.empirical_weight),
        }
      : null,
    backtest: backtest
      ? {
          method: backtest.method ?? null,
          sampleSize: num(backtest.sample_size, 0),
          brier: num(backtest.brier),
          baselineBrier: num(backtest.baseline_brier),
          betterThanBaseline: backtest.better_than_baseline === true,
          status: backtest.status ?? null,
        }
      : null,
    evidence: (Array.isArray(forecast.evidence) ? forecast.evidence : []).map((row) => ({
      code: row.code ?? null,
      label: locale === 'en' ? row.label_en : row.label_zh,
      detail: locale === 'en' ? row.detail_en : row.detail_zh,
      href: row.href ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ timeline */

/** Effective time is authoritative; the recorded instant is the fallback. */
export const eventTime = (event) => event?.effectiveAt ?? event?.at ?? event?.announcedAt ?? null;
export const isConfirmedReset = (event) =>
  (event?.kind === 'reset' || event?.group === 'reset') &&
  (event?.state === 'confirmed' || event?.confirmed === true);

export function timelineView(payload) {
  if (!payload) return null;
  const events = (Array.isArray(payload.events) ? payload.events : []).map((event) => ({
    id: String(event.id ?? ''),
    kind: event.kind === 'banked' ? 'banked' : 'reset',
    date: event.date ?? null,
    at: event.at ?? null,
    announcedAt: event.announced_at ?? event.announcedAt ?? null,
    effectiveAt: event.effective_at ?? event.effectiveAt ?? null,
    state: event.state === 'announced' ? 'announced' : 'confirmed',
    quote: String(event.quote ?? ''),
    sourceUrl: event.source_url ?? event.url ?? null,
  }));
  const counts = payload.stats ?? {};
  return {
    updatedAt: payload.updated_at ?? null,
    events,
    counts: {
      reset: num(counts.reset, events.filter((event) => event.kind === 'reset').length),
      banked: num(counts.banked, events.filter((event) => event.kind === 'banked').length),
      total: num(counts.total, events.length),
    },
    firstAt: payload.first_at ?? events[0]?.at ?? null,
    lastResetAt: payload.last_reset_at ?? null,
  };
}

/** Days between consecutive confirmed resets, oldest first. */
export function resetRhythm(events) {
  const resets = events
    .filter(isConfirmedReset)
    .map((event) => ({ at: parseTime(eventTime(event)), event }))
    .filter((row) => row.at !== null)
    .sort((a, b) => a.at - b.at);
  const gaps = [];
  for (let i = 1; i < resets.length; i += 1) {
    gaps.push({ days: (resets[i].at - resets[i - 1].at) / 86_400_000, at: resets[i].at, event: resets[i].event });
  }
  return { resets, gaps };
}

/** Events per local hour; used by the vigil sleep clock. */
export function hourHistogram(events, timeZone = getTimeZone()) {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const event of events) {
    const hour = hourInZone(eventTime(event), timeZone);
    if (hour === null) continue;
    buckets[hour] += 1;
  }
  return buckets;
}

/* -------------------------------------------------------------------- rhythm */

export function median(values) {
  const rows = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

const WEEKDAYS_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function rhythmView(payload, locale = 'zh') {
  if (!payload) return null;
  const intervals = (Array.isArray(payload.intervals) ? payload.intervals : [])
    .map((row) => ({ at: row.at ?? null, days: num(row.days) }))
    .filter((row) => row.days !== null && row.days > 0);
  const heatmap = Array.from({ length: 7 }, (_, day) => {
    const row = Array.isArray(payload.heatmap?.[day]) ? payload.heatmap[day] : [];
    return Array.from({ length: 24 }, (_, hour) => num(row[hour], 0));
  });
  const stats = payload.stats ?? {};
  const labels = payload.weekday_labels?.[locale] ?? payload.weekday_labels?.zh;
  return {
    updatedAt: payload.updated_at ?? null,
    intervals,
    heatmap,
    heatTotal: heatmap.flat().reduce((sum, value) => sum + value, 0),
    hour: (Array.isArray(payload.hour) ? payload.hour : Array.from({ length: 24 }, () => 0)).map((value) => num(value, 0)),
    weekday: (Array.isArray(payload.weekday) ? payload.weekday : Array.from({ length: 7 }, () => 0)).map((value) => num(value, 0)),
    weekdayLabels: Array.isArray(labels) && labels.length === 7 ? labels : locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_ZH,
    windows: (() => {
      const rows = (Array.isArray(payload.windows) ? payload.windows : [])
        .map((window) => ({
          start_hour: num(window.start_hour, 0),
          end_hour: num(window.end_hour, 0),
          count: num(window.count, 0),
          share: isNum(window.share) ? Number(window.share) : null,
          label: window.label ?? null,
        }))
        .sort((a, b) => b.count - a.count || a.start_hour - b.start_hour)
        .slice(0, 5);
      const total = num(stats.resets, 0);
      return rows.map((row) => ({
        startHour: row.start_hour,
        endHour: row.end_hour,
        count: row.count,
        share: row.share !== null ? Math.round(row.share * 100) : total > 0 ? Math.round((row.count / total) * 100) : null,
        label:
          row.label ??
          `${String(row.start_hour).padStart(2, '0')}:00–${String(row.end_hour).padStart(2, '0')}:00 UTC`,
      }));
    })(),
    months: (Array.isArray(payload.months) ? payload.months : []).map((row) => ({
      month: row.month ?? null,
      resets: num(row.resets, 0),
      banked: num(row.banked, 0),
    })),
    stats: {
      resets: num(stats.resets, 0),
      banked: num(stats.banked, 0),
      spanDays: num(stats.span_days, 0),
      medianIntervalDays: num(stats.median_interval_days),
      meanIntervalDays: num(stats.mean_interval_days),
      longestIntervalDays: num(stats.longest_interval_days),
      shortestIntervalDays: num(stats.shortest_interval_days),
    },
    recentMedianDays: median(intervals.slice(-8).map((row) => row.days)),
  };
}

/**
 * `data-count` bucket for the heatmap cells: 0 = empty, 4 = the busiest slot.
 * The SSR renderer applies the same rule so both sides shade identically.
 */
export function heatLevel(count, max) {
  if (!max || count <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/* ---------------------------------------------------------------- data status */

export function dataStatusView(payload) {
  if (!payload) return null;
  const dataset = payload.dataset ?? {};
  const freshness = payload.freshness ?? {};
  const backtest = payload.backtest ?? payload.model?.backtest ?? null;
  const level = ['fresh', 'stale'].includes(freshness.level) ? freshness.level : 'unknown';
  return {
    updatedAt: payload.updated_at ?? null,
    generatedAt: payload.generated_at ?? null,
    dataset: {
      firstAt: dataset.first_at ?? null,
      lastResetAt: dataset.last_reset_at ?? null,
      reset: num(dataset.reset, 0),
      banked: num(dataset.banked, 0),
      total: num(dataset.total, 0),
      spanDays: num(dataset.span_days, 0),
      ageHours: num(dataset.age_hours),
    },
    freshness: {
      level,
      ageHours: num(freshness.age_hours),
      thresholdHours: num(freshness.threshold_hours, 168),
    },
    gaps: (Array.isArray(payload.gaps) ? payload.gaps : []).map((gap) => ({
      from: gap.from ?? null,
      to: gap.to ?? null,
      days: num(gap.days),
    })),
    sources: (Array.isArray(payload.sources) ? payload.sources : []).map((source) => ({
      label: source.label ?? null,
      url: source.url ?? null,
    })),
    model: payload.model ?? null,
    backtest: backtest
      ? {
          method: backtest.method ?? null,
          sampleSize: num(backtest.sample_size, 0),
          brier: num(backtest.brier),
          baselineBrier: num(backtest.baseline_brier),
          betterThanBaseline: backtest.better_than_baseline === true,
          status: backtest.status ?? null,
        }
      : null,
    checks: (Array.isArray(payload.checks) ? payload.checks : []).map((check) => ({
      name: String(check.name ?? ''),
      ok: check.ok === true,
      value: check.value === null || check.value === undefined ? null : Number(check.value),
      detail: check.detail ?? '',
    })),
    params: payload.params ?? {},
  };
}

/* --------------------------------------------------------------------- vigil */

const VIGIL_KEY = 'codex-reset.vigil.v1';

const EMPTY_VIGIL = { epochId: '', id: '', name: '', days: 0, at: '', tendedAt: '', amens: [] };

export function readVigil() {
  try {
    const value = JSON.parse(localStorage.getItem(VIGIL_KEY) || 'null');
    if (!value || typeof value !== 'object') return { ...EMPTY_VIGIL };
    return {
      epochId: String(value.epochId || ''),
      id: String(value.id || ''),
      name: String(value.name || ''),
      days: Number(value.days) || 0,
      at: String(value.at || ''),
      tendedAt: String(value.tendedAt || ''),
      amens: Array.isArray(value.amens) ? value.amens.map(String) : [],
    };
  } catch {
    return { ...EMPTY_VIGIL };
  }
}

export function writeVigil(entry) {
  try {
    localStorage.setItem(VIGIL_KEY, JSON.stringify(entry));
  } catch {
    /* storage disabled — the local record simply does not persist */
  }
}

export function vigilView(payload) {
  if (!payload) return null;
  const epoch = payload.epoch ?? {};
  const wall = (Array.isArray(payload.wall) ? payload.wall : []).map((entry) => ({
    id: String(entry.id ?? ''),
    name: String(entry.name ?? ''),
    days: Number(entry.days) || 0,
    country: entry.country ?? null,
    at: entry.at ?? null,
  }));
  const amens = {};
  if (payload.amens && typeof payload.amens === 'object') {
    for (const [key, value] of Object.entries(payload.amens)) amens[key] = Number(value) || 0;
  }
  return {
    epochId: String(epoch.id ?? ''),
    startedAt: epoch.started_at ?? null,
    cycle: Number(epoch.cycle) || 0,
    kind: epoch.kind ?? null,
    believers: Number(payload.believers ?? wall.length) || 0,
    wall,
    amens,
    archive: (Array.isArray(payload.archive) ? payload.archive : []).map((row) => ({
      epochId: row.epoch_id ?? null,
      count: Number(row.count) || 0,
      endedAt: row.ended_at ?? null,
    })),
    complete: payload.complete === true,
    writable: payload.writable !== false,
  };
}

/** Active crowd size for the vigil illustration, capped so the markup stays sane. */
export const crowdSize = (believers) => Math.min(12, Math.max(0, Math.floor(believers || 0)));

export function flameDue(entry, now = Date.now()) {
  const last = String(entry?.tendedAt || entry?.at || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) return false;
  return last < new Date(now).toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------- health */

export function healthView(payload) {
  if (!payload) return null;
  return {
    ok: Boolean(payload.ok),
    generatedAt: payload.generated_at ?? null,
    dataset: payload.dataset ?? null,
    model: payload.model ?? null,
  };
}
