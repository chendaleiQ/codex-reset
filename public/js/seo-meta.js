/**
 * Page metadata — the single source shared by the server renderer and the
 * client router.
 *
 * The server injects the head and a first-paint body for every route; the
 * client re-applies the same values when the router changes URL so a
 * client-side navigation never leaves a stale title or canonical behind.
 *
 * Chinese is the default locale and lives at the root. English lives under
 * `/en/…`. Both spellings point at each other through hreflang.
 */

export const SITE_NAME = 'Codex Reset';
export const LOCALES = ['zh', 'en'];
export const DEFAULT_LOCALE = 'zh';

/** Locale-neutral route keys, in navigation order. */
export const ROUTE_KEYS = ['home', 'rhythm', 'timeline', 'status', 'vigil'];

const META = {
  home: {
    zh: {
      path: '/',
      title: 'Codex 重置追踪：今天会重置吗？重置概率与记录',
      description:
        '追踪 OpenAI Codex 的全局额度重置：最近一次已确认重置、未来 24 与 48 小时重置概率及区间、重置节奏与完整记录。数据来自本站公开台账，每条都可追溯到一条 X 原帖。',
      h1: 'Codex 今天会重置吗？',
      lead: '用本站公开台账回答一个问题：今天会不会重置。概率、等待对比和下一次高频窗口都在这里，证据指向完整节奏页。',
    },
    en: {
      path: '/en/',
      title: 'Codex Reset Tracker — Did Codex Reset Today? Records & Forecast',
      description:
        'Track OpenAI Codex quota resets: the last verified reset, 24h and 48h probabilities with ranges, reset rhythm and the full record — from this site’s own ledger.',
      h1: 'Will Codex reset today?',
      lead: 'One question, answered from our own public ledger: the probabilities, how this wait compares with history, and the next high-frequency window.',
    },
  },
  rhythm: {
    zh: {
      path: '/rhythm',
      title: '重置节奏：Codex 重置的间隔、时段与高频窗口',
      description:
        '把每一次已确认重置放到同一条时间轴上：间隔多久、落在星期几的几点、下一次最可能出现在哪个窗口，以及这些数字是怎么算出来的。',
      h1: '重置节奏',
      lead: '把每一次已确认重置放到同一条时间轴上：间隔多久、落在星期几的几点、下一条最可能出现在哪个窗口。全部由本站台账在本地计算。',
    },
    en: {
      path: '/en/rhythm',
      title: 'Codex Reset Rhythm — Intervals, Hour Windows and Cadence',
      description:
        'Every confirmed reset on one timeline: how far apart they land, which weekday and hour they cluster in, the most likely window, and how each number is computed.',
      h1: 'Reset rhythm',
      lead: 'Every confirmed reset on one timeline: how long the gaps are, which weekday hours they land in, and where the next one is most likely to appear. All computed locally from our own ledger.',
    },
  },
  timeline: {
    zh: {
      path: '/timeline',
      title: 'Codex 重置记录：每一次已确认重置与间隔',
      description:
        'Codex 额度重置的完整记录：每一次已确认重置的时间、与上一次相隔的天数、备用额度发放，以及每一条可追溯的公开原帖，按你选择的时区显示。',
      h1: 'Codex 额度重置记录',
      lead: '按时间汇总每一次重置与备用额度发放，并给出相邻两次已确认重置之间的间隔；每条都能追到一条公开原帖。',
    },
    en: {
      path: '/en/timeline',
      title: 'Codex Reset History — Every Confirmed Reset and Interval',
      description:
        'The full record of Codex quota resets: each confirmed reset time, the gap since the previous one, banked grants, and a traceable public post for every row, in your time zone.',
      h1: 'Codex reset history',
      lead: 'Every reset and banked grant in order, with the interval between consecutive confirmed resets; each row links back to a public post.',
    },
  },
  status: {
    zh: {
      path: '/status',
      title: 'Codex 数据状态：台账新鲜度、覆盖范围与模型回测',
      description:
        '本站只有一个数据源：仓库里的公开台账。这里说明它更新到什么时候、覆盖了哪些时间、哪里还有缺口，以及模型参数与自带回测结果。',
      h1: '数据状态',
      lead: '这个站只有一个数据源：仓库里的公开台账。这里说明它更新到什么时候、覆盖了哪些时间、哪里还有缺口，以及模型的自带回测。',
    },
    en: {
      path: '/en/status',
      title: 'Codex Reset Data Status — Ledger Freshness, Coverage & Backtest',
      description:
        'One data source: the public ledger in this repository. How fresh it is, which period it covers, where the gaps are, and the model parameters behind every number.',
      h1: 'Data status',
      lead: 'This site has exactly one data source: the public ledger in the repository. This page shows when it was updated, what it covers, where the gaps are, and how the model scored against itself.',
    },
  },
  vigil: {
    zh: {
      path: '/vigil',
      title: '一起等重置：Codex 重置等待墙与重置时段',
      description:
        '在等待墙上留下名字，看看此刻有多少人一起等下一次 Codex 额度重置，并按本站台账统计重置最常落在一天里的哪些小时。',
      h1: '一起等重置',
      lead: '留个名字，看看此刻有多少人也在等下一次重置；下面是从台账统计出的重置时段。',
    },
    en: {
      path: '/en/vigil',
      title: 'Wait Together — Codex Reset Wall and Reset Hours',
      description:
        'Leave your name on the wall, see how many people are waiting for the next Codex quota reset right now, and read the hours resets most often land in from our own ledger.',
      h1: 'Wait together',
      lead: 'Leave a name, see how many people are waiting for the next reset right now, and read the hours resets actually land in.',
    },
  },
};

export function routeMeta(key, locale) {
  const entry = META[key]?.[locale] ?? META[key]?.[DEFAULT_LOCALE];
  if (!entry) return null;
  return { key, locale, ...entry };
}

/** Canonical path for a route key in a locale. */
export function pathFor(key, locale) {
  return routeMeta(key, locale)?.path ?? '/';
}

/** Alternate-language paths for a route key, for hreflang. */
export function alternatesFor(key) {
  return { zh: pathFor(key, 'zh'), en: pathFor(key, 'en'), xDefault: pathFor(key, 'zh') };
}

/**
 * Resolve a URL pathname to a route key and locale. Accepts `/en/timeline`,
 * `/en/timeline/` and `/timeline`. Anything else resolves to null so the
 * server can answer with a real 404 instead of a soft one.
 */
export function resolvePath(pathname) {
  let path = pathname || '/';
  let locale = DEFAULT_LOCALE;
  if (path === '/en' || path.startsWith('/en/')) {
    locale = 'en';
    path = path.slice(3) || '/';
  }
  if (path.length > 1) path = path.replace(/\/+$/, '') || '/';
  if (path === '') path = '/';
  const key = ROUTE_KEYS.find((candidate) => META[candidate][DEFAULT_LOCALE].path === path);
  return key ? { key, locale } : null;
}
