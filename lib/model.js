'use strict';
/**
 * The model. Everything the site calls a "prediction" is computed here from our
 * own ledger — no upstream forecast, no black box.
 *
 * The idea in one paragraph: a reset is a renewal event. Between confirmed
 * resets we have a sample of completed waits (intervals, in days). Given how
 * long the current wait already is, we want P(a reset lands within the next H
 * hours) — a conditional survival question, not "what is the base rate".
 * We answer it twice and blend:
 *
 *   1. a two-parameter Weibull renewal fit over the intervals, weighted by
 *      recency (half-life 60 days) so the current cadence dominates the sample
 *      without throwing the long history away;
 *   2. the empirical (weighted) survival curve, which assumes nothing about
 *      the shape but says nothing past the longest observed interval.
 *
 * The blend weight is the Weibull fit's effective sample size, so with little
 * data the curve is extrapolating, and with a lot of data it is mostly the
 * data itself. The interval comes from a seeded bootstrap: resample the
 * intervals, refit, recompute, keep the 10th and 90th percentile.
 *
 * Honesty rules encoded here: announced-but-unlanded resets never enter the
 * sample; the sample only contains publicly sourced events; the model ships
 * with its own walk-forward backtest, including when it fails.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** Model parameters, shown verbatim on /status and /rhythm. */
const PARAMS = Object.freeze({
  name: 'renewal-blend',
  version: 'v1',
  half_life_days: 60,
  min_gap_hours: 6,
  empirical_blend: 12, // pseudo-count: weight = ess / (ess + 12)
  bootstrap_rounds: 400,
  bootstrap_seed: 20261104,
  min_train_intervals: 12,
  stale_hours: 168,
  gap_days: 30,
});

/* ------------------------------------------------------------------ numbers */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function parseTime(value) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : null;
}

/** Lanczos approximation; only used to normalise the Weibull scale. */
function gamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const x = z - 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < 9; i += 1) a += c[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * a;
}

/** Deterministic PRNG so the published range never flickers between requests. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted, share) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * clamp(share, 0, 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
};

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

const round1 = (value) => (Number.isFinite(value) ? Math.round(value * 10) / 10 : null);
const round3 = (value) => (Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null);

/* -------------------------------------------------------------- ledger */

/**
 * Normalises and validates the ledger. A bad row is dropped, not guessed:
 * the caller reports `errors` on /status so a typo cannot silently change a
 * published probability.
 */
function readLedger(raw, now = Date.now()) {
  const errors = [];
  const source = raw && Array.isArray(raw.events) ? raw.events : null;
  if (!source) {
    return { events: [], errors: ['ledger: events[] missing'], updatedAt: null };
  }
  const seen = new Set();
  const events = [];
  for (const [index, row] of source.entries()) {
    if (!row || typeof row !== 'object') {
      errors.push(`event[${index}]: not an object`);
      continue;
    }
    const kind = row.kind === 'banked' ? 'banked' : row.kind === 'reset' ? 'reset' : null;
    const at = parseTime(row.at);
    const announcedAt = parseTime(row.announced_at) ?? at;
    if (!kind) errors.push(`event[${index}]: unknown kind`);
    if (at === null) errors.push(`event[${index}]: unparseable at`);
    if (!kind || at === null) continue;
    const id = String(row.id || `${kind}-${at}`);
    if (seen.has(id)) {
      errors.push(`event[${index}]: duplicate id ${id}`);
      continue;
    }
    seen.add(id);
    events.push({
      id,
      kind,
      date: typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
        ? row.date
        : new Date(at).toISOString().slice(0, 10),
      at,
      atIso: new Date(at).toISOString(),
      announcedAt,
      announcedAtIso: announcedAt === null ? null : new Date(announcedAt).toISOString(),
      effectiveAt: parseTime(row.effective_at),
      state: row.state === 'announced' ? 'announced' : 'confirmed',
      quote: typeof row.quote === 'string' ? row.quote : '',
      sourceUrl: typeof row.source_url === 'string' && /^https?:\/\//.test(row.source_url) ? row.source_url : null,
    });
  }
  events.sort((a, b) => a.at - b.at);
  const updatedAt = parseTime(raw.updated_at);
  if (updatedAt === null) errors.push('ledger: updated_at missing');
  if (updatedAt !== null && updatedAt > now + HOUR_MS) errors.push('ledger: updated_at is in the future');
  return { events, errors, updatedAt };
}

/** Confirmed resets only; the model sample must never include a promise. */
function resetEvents(events) {
  return events.filter((event) => event.kind === 'reset' && event.state === 'confirmed');
}

/* ------------------------------------------------------------- intervals */

/**
 * Days between consecutive confirmed resets. Two resets closer than
 * `min_gap_hours` are one propagation wave, so the later one is skipped —
 * otherwise a single reset landing in two cohorts would read as a 0.2d wait.
 */
function buildIntervals(resets, minGapHours = PARAMS.min_gap_hours) {
  const rows = [];
  for (const reset of resets) {
    const previous = rows[rows.length - 1];
    if (!previous) {
      rows.push(reset);
      continue;
    }
    const gapHours = (reset.at - previous.at) / HOUR_MS;
    if (gapHours < minGapHours) continue;
    rows.push(reset);
  }
  const intervals = [];
  for (let i = 1; i < rows.length; i += 1) {
    intervals.push({ at: rows[i].at, atIso: rows[i].atIso, days: (rows[i].at - rows[i - 1].at) / DAY_MS });
  }
  return { resets: rows, intervals };
}

/** Recency weights, newest interval weighted 1, 60 days ago weighted 0.5. */
function recencyWeights(intervals, halfLifeDays = PARAMS.half_life_days) {
  if (!intervals.length) return [];
  const newest = Math.max(...intervals.map((row) => row.at));
  return intervals.map((row) => 0.5 ** (((newest - row.at) / DAY_MS) / halfLifeDays));
}

function weightedStats(values, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!values.length || !(total > 0)) return { mean: null, variance: null, ess: 0, total: 0 };
  const m = values.reduce((sum, value, i) => sum + value * weights[i], 0) / total;
  const variance = values.reduce((sum, value, i) => sum + weights[i] * (value - m) ** 2, 0) / total;
  const squares = weights.reduce((sum, w) => sum + w * w, 0);
  return { mean: m, variance, ess: (total * total) / squares, total };
}

/**
 * Weighted method-of-moments Weibull fit. `k` comes from the coefficient of
 * variation using the standard approximation; it is clamped so a handful of
 * identical gaps cannot produce a step function.
 */
function fitWeibull(intervals, weights) {
  if (!intervals.length) return null;
  const { mean: m, variance, ess } = weightedStats(intervals, weights);
  if (!(m > 0) || !(variance >= 0)) return null;
  const cv = Math.sqrt(variance) / m;
  const k = clamp(cv > 0 ? cv ** -1.086 : 3.5, 0.8, 3.5);
  const scale = m / gamma(1 + 1 / k);
  if (!(scale > 0)) return null;
  return { k, scale, ess, mean: m, cv };
}

/** Standard normal CDF, used to kernel-smooth the empirical curve. */
function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const density = 0.3989422804014327 * Math.exp(-x * x / 2);
  const cdf = 1 - density * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

/**
 * Weighted, kernel-smoothed share of the sample longer than `days`.
 *
 * A raw step function makes the published probability jump by several points
 * between two adjacent ages for no reason a reader could see, so each sampled
 * interval contributes Φ((x - days) / bandwidth) instead of a 0/1 step. The
 * bandwidth of half a day keeps the shape of the data without inventing
 * resolution the sample does not have.
 */
function empiricalSurvival(intervals, weights, days, bandwidth = 0.6) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!(total > 0)) return null;
  let tail = 0;
  for (let i = 0; i < intervals.length; i += 1) tail += weights[i] * normalCdf((intervals[i] - days) / bandwidth);
  return tail / total;
}

/**
 * Survival of the waiting time at `days`, blended. Returns null only when
 * there is no sample at all.
 */
function survivalAt(model, days) {
  if (!model) return null;
  const weibull = Math.exp(-((days / model.scale) ** model.k));
  const empirical = empiricalSurvival(model.intervals, model.weights, days, 0.6);
  if (empirical === null) return weibull;
  const blend = clamp(model.fit.ess / (model.fit.ess + PARAMS.empirical_blend), 0, 1);
  return clamp(blend * weibull + (1 - blend) * empirical, 1e-6, 1);
}

/** The number the site publishes: P(reset within `hours` | waited `ageDays`). */
function probability(model, ageDays, hours) {
  if (!model) return null;
  const age = Math.max(0, ageDays);
  const horizon = hours / 24;
  const start = survivalAt(model, age);
  const end = survivalAt(model, age + horizon);
  if (start === null || end === null) return null;
  if (start <= 1e-6) return 1;
  return clamp(1 - end / start, 0, 1);
}

/* ---------------------------------------------------------------- rhythm */

const WEEKDAY_LABELS_ZH = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEKDAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** UTC bucket of one timestamp: Monday = 0. */
function utcSlot(time) {
  const date = new Date(time);
  return { weekday: (date.getUTCDay() + 6) % 7, hour: date.getUTCHours() };
}

function buildRhythm(resets, banked, now) {
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const hour = Array.from({ length: 24 }, () => 0);
  const weekday = Array.from({ length: 7 }, () => 0);
  for (const reset of resets) {
    const slot = utcSlot(reset.at);
    heatmap[slot.weekday][slot.hour] += 1;
    hour[slot.hour] += 1;
    weekday[slot.weekday] += 1;
  }

  // Sliding three-hour window across the 24h circle.
  const windows = [];
  for (let start = 0; start < 24; start += 1) {
    let count = 0;
    for (let offset = 0; offset < 3; offset += 1) count += hour[(start + offset) % 24];
    windows.push({ start_hour: start, end_hour: (start + 3) % 24, count });
  }
  // Rank the busiest windows, then drop any that overlap an already chosen one
  // so the list reads as five distinct times of day instead of five near-copies
  // of the same peak.
  const ranked = windows.slice().sort((a, b) => b.count - a.count || a.start_hour - b.start_hour);
  const chosen = [];
  for (const candidate of ranked) {
    if (chosen.length >= 5) break;
    const overlaps = chosen.some((picked) => {
      const distance = Math.min(
        (candidate.start_hour - picked.start_hour + 24) % 24,
        (picked.start_hour - candidate.start_hour + 24) % 24,
      );
      return distance < 3;
    });
    if (!overlaps) chosen.push(candidate);
  }
  const top = chosen.map((window) => ({
    ...window,
    share: resets.length ? round3(window.count / resets.length) : 0,
    label: `${String(window.start_hour).padStart(2, '0')}:00–${String(window.end_hour).padStart(2, '0')}:00 UTC`,
  }));

  const byMonth = new Map();
  const bump = (month, key) => {
    if (!byMonth.has(month)) byMonth.set(month, { month, resets: 0, banked: 0 });
    byMonth.get(month)[key] += 1;
  };
  for (const reset of resets) bump(new Date(reset.at).toISOString().slice(0, 7), 'resets');
  for (const grant of banked) bump(new Date(grant.at).toISOString().slice(0, 7), 'banked');
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));

  const days = resets.map((reset) => (reset.at - resets[0].at) / DAY_MS);
  return {
    heatmap,
    hour,
    weekday,
    // The five busiest three-hour windows, not the raw 24 slots: every caller
    // ranks windows, so the ranking belongs here and nowhere else.
    windows: top,
    months,
    weekday_labels: { zh: WEEKDAY_LABELS_ZH, en: WEEKDAY_LABELS_EN },
    stats: {
      resets: resets.length,
      banked: banked.length,
      span_days: days.length ? round1(days[days.length - 1]) : 0,
    },
  };
}

/* --------------------------------------------------------------- backtest */

/**
 * Walk forward, one evaluation per UTC day: using only the intervals that had
 * completed by that day, predict whether a reset lands within 24 hours, then
 * score it. The baseline is the training-window share of intervals shorter
 * than a day, i.e. "always say the base rate".
 */
function backtest(intervals, { from = 0 } = {}) {
  if (intervals.length < PARAMS.min_train_intervals) {
    return { method: 'walk-forward', sample_size: 0, brier: null, baseline_brier: null, better_than_baseline: false, status: 'insufficient-data' };
  }
  const weights = recencyWeights(intervals);
  const first = intervals[0].at;
  const last = intervals[intervals.length - 1].at;
  let scored = 0;
  let error = 0;
  let baselineError = 0;
  for (let day = from; day < Math.floor((last - first) / DAY_MS); day += 1) {
    const time = first + day * DAY_MS;
    const completed = [];
    const completedWeights = [];
    for (let i = 0; i < intervals.length; i += 1) {
      if (intervals[i].at <= time) {
        completed.push(intervals[i].days);
        completedWeights.push(weights[i]);
      }
    }
    if (completed.length < PARAMS.min_train_intervals) continue;
    let previousAt = first;
    for (let i = 0; i < intervals.length; i += 1) {
      previousAt = intervals[i].at;
      if (intervals[i].at > time) break;
    }
    const fit = fitWeibull(completed, completedWeights);
    if (!fit) continue;
    const model = { intervals: completed, weights: completedWeights, fit, k: fit.k, scale: fit.scale };
    const age = (time - previousAt) / DAY_MS;
    const p = probability(model, age, 24);
    if (p === null) continue;
    // Actual: does the next reset land before this time + 24h?
    let nextAt = null;
    for (let i = 0; i < intervals.length; i += 1) {
      if (intervals[i].at > time) {
        nextAt = intervals[i].at;
        break;
      }
    }
    if (nextAt === null) continue;
    const outcome = (nextAt - time) / DAY_MS <= 1 ? 1 : 0;
    const baseRate = completed.filter((value) => value <= 1).length / completed.length;
    error += (p - outcome) ** 2;
    baselineError += (baseRate - outcome) ** 2;
    scored += 1;
  }
  if (!scored) {
    return { method: 'walk-forward', sample_size: 0, brier: null, baseline_brier: null, better_than_baseline: false, status: 'insufficient-data' };
  }
  const brier = error / scored;
  const baselineBrier = baselineError / scored;
  return {
    method: 'walk-forward',
    sample_size: scored,
    brier: round3(brier),
    baseline_brier: round3(baselineBrier),
    better_than_baseline: brier < baselineBrier,
    status: brier < baselineBrier ? 'beats-baseline' : 'experimental',
  };
}

/* --------------------------------------------------------------- forecast */

/**
 * Builds the whole forecast payload. `now` is injected so tests can pin it.
 */
function forecast(ledger, { now = Date.now() } = {}) {
  const resets = resetEvents(ledger.events);
  const banked = ledger.events.filter((event) => event.kind === 'banked');
  const { resets: series, intervals } = buildIntervals(resets);
  const values = intervals.map((row) => row.days);
  const weights = recencyWeights(intervals);
  const fit = fitWeibull(values, weights);
  const model = fit ? { intervals: values, weights, fit, k: fit.k, scale: fit.scale } : null;

  const lastReset = series[series.length - 1] ?? null;
  const ageDays = lastReset ? (now - lastReset.at) / DAY_MS : null;
  const pending = ledger.events
    .filter((event) => event.kind === 'reset' && event.state === 'announced')
    .sort((a, b) => b.at - a.at)[0] ?? null;

  const p24 = ageDays === null ? null : probability(model, ageDays, 24);
  const p48 = ageDays === null ? null : probability(model, ageDays, 48);

  // Seeded bootstrap range: resample the interval sample, refit, recompute.
  let range24 = null;
  let range48 = null;
  if (model && p24 !== null && values.length >= 6) {
    const random = mulberry32(PARAMS.bootstrap_seed);
    const draws24 = [];
    const draws48 = [];
    const total = weights.reduce((sum, w) => sum + w, 0);
    for (let round = 0; round < PARAMS.bootstrap_rounds; round += 1) {
      const sample = [];
      const sampleWeights = [];
      for (let pick = 0; pick < values.length; pick += 1) {
        let target = random() * total;
        let index = 0;
        while (index < weights.length - 1 && target > weights[index]) {
          target -= weights[index];
          index += 1;
        }
        sample.push(values[index]);
        sampleWeights.push(1);
      }
      const resampledFit = fitWeibull(sample, sampleWeights);
      if (!resampledFit) continue;
      const resampled = { intervals: sample, weights: sampleWeights, fit: resampledFit, k: resampledFit.k, scale: resampledFit.scale };
      const a = probability(resampled, ageDays, 24);
      const b = probability(resampled, ageDays, 48);
      if (a !== null) draws24.push(a);
      if (b !== null) draws48.push(b);
    }
    draws24.sort((a, b) => a - b);
    draws48.sort((a, b) => a - b);
    if (draws24.length >= 20) {
      range24 = { lower: clamp(quantile(draws24, 0.1), 0, p24), upper: clamp(quantile(draws24, 0.9), p24, 1) };
    }
    if (draws48.length >= 20) {
      range48 = { lower: clamp(quantile(draws48, 0.1), 0, p48), upper: clamp(quantile(draws48, 0.9), p48, 1) };
    }
  }

  const rhythm = buildRhythm(series, banked, now);
  const hour = rhythm.hour;
  const window = rhythm.windows[0] ?? null;

  const recent = values.slice(-8);
  const overallMedian = median(values);
  const recentMedian = median(recent);
  const cadence = {
    recent_median_days: round1(recentMedian),
    recent_sample: recent.length,
    weighted_mean_days: round1(weightedStats(values, weights).mean),
    overall_median_days: round1(overallMedian),
    accelerating: Number.isFinite(recentMedian) && Number.isFinite(overallMedian) ? recentMedian < overallMedian : false,
  };

  const wait = ageDays === null
    ? null
    : {
        days: round1(ageDays),
        sample: values.length,
        shorter_share: values.length ? round3(values.filter((value) => value < ageDays).length / values.length) : null,
        median_days: round1(overallMedian),
        mean_days: round1(mean(values)),
        longest_days: values.length ? round1(Math.max(...values)) : null,
        position: ageDays > (overallMedian ?? 0) ? 'longer_than_most' : 'within_normal',
      };

  const sample = values.length;
  const freshness = ledger.updatedAt === null ? 'unknown' : (now - ledger.updatedAt) / HOUR_MS;
  const score = backtest(intervals);
  let confidence = 'low';
  if (sample >= 24 && score.better_than_baseline && freshness !== 'unknown' && freshness < PARAMS.stale_hours * 4) confidence = 'high';
  else if (sample >= 12) confidence = 'medium';

  const evidence = [
    {
      code: 'intervals',
      label_zh: '完整间隔样本',
      label_en: 'Completed intervals',
      detail_zh: `${sample} 个间隔，中位 ${round1(overallMedian) ?? '—'} 天，最近 8 次中位 ${round1(recentMedian) ?? '—'} 天`,
      detail_en: `${sample} intervals, median ${round1(overallMedian) ?? '—'}d, last eight median ${round1(recentMedian) ?? '—'}d`,
      href: '/rhythm',
    },
    {
      code: 'window',
      label_zh: '重置高发窗口',
      label_en: 'High-frequency window',
      detail_zh: window ? `${window.label}，占样本 ${Math.round(window.share * 100)}%` : '样本不足',
      detail_en: window ? `${window.label}, ${Math.round(window.share * 100)}% of the sample` : 'not enough data',
      href: '/rhythm',
    },
    {
      code: 'backtest',
      label_zh: '自带回测',
      label_en: 'Own backtest',
      detail_zh: score.brier === null
        ? '样本不足，暂不发布回测分'
        : `Brier ${score.brier}，基线 ${score.baseline_brier}，${score.better_than_baseline ? '优于基线' : '未优于基线'}`,
      detail_en: score.brier === null
        ? 'not enough data yet'
        : `Brier ${score.brier} vs baseline ${score.baseline_brier} (${score.better_than_baseline ? 'beats baseline' : 'does not beat baseline'})`,
      href: '/status',
    },
  ];

  return {
    updated_at: ledger.updatedAt === null ? null : new Date(ledger.updatedAt).toISOString(),
    generated_at: new Date(now).toISOString(),
    mode: pending ? 'pending' : 'model',
    pending: pending
      ? { id: pending.id, at: pending.atIso, quote: pending.quote, source_url: pending.sourceUrl }
      : null,
    last_reset_at: lastReset ? lastReset.atIso : null,
    age_days: round1(ageDays),
    probabilities: {
      raw_24h: round3(p24),
      raw_48h: round3(p48),
      rounded_24h: p24 === null ? null : Math.round(p24 * 100),
      rounded_48h: p48 === null ? null : Math.round(p48 * 100),
      range_24h: range24,
      range_48h: range48,
    },
    confidence,
    confidence_note: confidence === 'high'
      ? `样本 ${sample} 个间隔，回测优于基线，数据更新于 ${new Date(ledger.updatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC。`
      : confidence === 'medium'
        ? `样本 ${sample} 个间隔，回测尚不稳定，概率只作历史节奏参考。`
        : `样本只有 ${sample} 个间隔，概率置信度低，请当作宽泛的历史节奏。`,
    model: fit
      ? {
          name: PARAMS.name,
          version: PARAMS.version,
          interval_sample: sample,
          effective_sample_size: round1(fit.ess),
          half_life_days: PARAMS.half_life_days,
          shape_k: round3(fit.k),
          scale_days: round1(fit.scale),
          empirical_weight: round3(clamp(1 - fit.ess / (fit.ess + PARAMS.empirical_blend), 0, 1)),
        }
      : null,
    backtest: score,
    cadence,
    wait,
    window,
    windows: rhythm.windows,
    evidence,
  };
}

/* ----------------------------------------------------------------- status */

function freshStatus(ledger, forecastPayload, { now = Date.now(), sources = [] } = {}) {
  const resets = resetEvents(ledger.events);
  const banked = ledger.events.filter((event) => event.kind === 'banked');
  const ageHours = ledger.updatedAt === null ? null : (now - ledger.updatedAt) / HOUR_MS;
  const { intervals } = buildIntervals(resets);
  const gaps = [];
  for (const interval of intervals) {
    if (interval.days > PARAMS.gap_days) {
      const end = new Date(interval.at);
      const start = new Date(interval.at - interval.days * DAY_MS);
      gaps.push({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), days: round1(interval.days) });
    }
  }
  const checks = [
    { name: 'ledger', ok: ledger.errors.length === 0, detail: ledger.errors.length ? ledger.errors.slice(0, 3).join('; ') : `${ledger.events.length} 条事件` },
    { name: 'order', ok: ledger.events.every((event, index, list) => index === 0 || event.at >= list[index - 1].at), detail: '事件按时间正序' },
    { name: 'sample', ok: intervals.length >= PARAMS.min_train_intervals, detail: `${intervals.length} 个完整间隔` },
    { name: 'backtest', ok: forecastPayload.backtest.status !== 'insufficient-data', detail: forecastPayload.backtest.status },
  ];
  return {
    updated_at: ledger.updatedAt === null ? null : new Date(ledger.updatedAt).toISOString(),
    generated_at: new Date(now).toISOString(),
    dataset: {
      first_at: ledger.events[0]?.atIso ?? null,
      last_reset_at: forecastPayload.last_reset_at,
      reset: resets.length,
      banked: banked.length,
      total: ledger.events.length,
      span_days: ledger.events.length ? round1((ledger.events[ledger.events.length - 1].at - ledger.events[0].at) / DAY_MS) : 0,
      age_hours: round1(ageHours),
    },
    freshness: {
      level: ageHours === null ? 'unknown' : ageHours <= PARAMS.stale_hours ? 'fresh' : 'stale',
      age_hours: round1(ageHours),
      threshold_hours: PARAMS.stale_hours,
    },
    gaps,
    sources: Array.isArray(sources) ? sources : [],
    model: forecastPayload.model,
    backtest: forecastPayload.backtest,
    checks,
    params: { half_life_days: PARAMS.half_life_days, empirical_blend: PARAMS.empirical_blend, bootstrap_rounds: PARAMS.bootstrap_rounds, min_gap_hours: PARAMS.min_gap_hours, gap_days: PARAMS.gap_days, stale_hours: PARAMS.stale_hours },
  };
}

module.exports = {
  PARAMS,
  DAY_MS,
  parseTime,
  gamma,
  readLedger,
  resetEvents,
  buildIntervals,
  recencyWeights,
  fitWeibull,
  empiricalSurvival,
  normalCdf,
  survivalAt,
  probability,
  buildRhythm,
  backtest,
  forecast,
  freshStatus,
  median,
  mean,
  quantile,
  round1,
  round3,
  utcSlot,
};
