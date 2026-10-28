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

/** Locale-neutral route keys. */
export const ROUTE_KEYS = ['home', 'timeline', 'status', 'vigil'];

const META = {
  home: {
    zh: {
      path: '/',
      title: 'Codex 重置追踪：今天会重置吗？额度重置记录与预测',
      description:
        '追踪 OpenAI Codex 的额度重置：最近一次已确认重置、未来 24 与 48 小时重置概率、28 天活动日历、Tibo 官方信号与 OpenAI 服务状态。中英文实时更新。',
      h1: 'Codex 今天会重置吗？',
      lead: '查看每一次已验证的额度重置，以及未来 24 与 48 小时的重置概率。数据来自 Tibo 的公开动态与 OpenAI 服务状态。',
    },
    en: {
      path: '/en/',
      title: 'Codex Reset Tracker — Did Codex Reset Today? Records & Forecast',
      description:
        'Track OpenAI Codex quota resets: the last verified reset, 24h and 48h reset probabilities, the 28-day activity calendar, Tibo’s public signals and OpenAI status. Updated live in English and Chinese.',
      h1: 'Will Codex reset today?',
      lead: 'Every verified quota reset, plus the 24h and 48h probability of the next one. Sourced from Tibo’s public posts and OpenAI status.',
    },
  },
  timeline: {
    zh: {
      path: '/timeline',
      title: 'Codex 重置记录（北京时间）：完整时间线与间隔',
      description:
        'Codex 额度重置的完整历史记录：每一次重置公告的北京时间、相邻重置之间的间隔天数、备用额度发放和待确认条目，并可切换到自己的时区查看。',
      h1: 'Codex 额度重置记录',
      lead: '按时间汇总每一次重置、备用额度发放和相关公告，并给出相邻两次已验证重置之间的间隔。',
    },
    en: {
      path: '/en/timeline',
      title: 'Codex Reset History — Every Verified Reset and Interval',
      description:
        'The full history of Codex quota resets: each verified reset time, the gap between resets, banked resets and unconfirmed announcements, filterable by type and timezone.',
      h1: 'Codex reset history',
      lead: 'Every reset, banked grant and related announcement in order, with the interval between consecutive verified resets.',
    },
  },
  status: {
    zh: {
      path: '/status',
      title: 'Codex 服务状态：登录、CLI 与 API 是否正常',
      description:
        'Codex 各服务的实时运行状态：网页版、API、CLI、VS Code 扩展与 IDE 集成，并记录故障开始、恢复时间以及之后是否出现额度重置。',
      h1: 'Codex 服务状态',
      lead: '查看各项服务是否正常，以及最近的故障与恢复记录。',
    },
    en: {
      path: '/en/status',
      title: 'Codex Service Status — Web, CLI, API and IDE Health',
      description:
        'Live operational status for every Codex surface: web, API, CLI, the VS Code extension and IDE integrations, with incident start and recovery times.',
      h1: 'Codex service status',
      lead: 'Whether each Codex surface is operating normally, plus recent incidents and recoveries.',
    },
  },
  vigil: {
    zh: {
      path: '/vigil',
      title: 'Codex 重置时间规律：历史几点重置？多久一次？',
      description:
        '统计 Codex 历史上通常几点发生额度重置、平均间隔多少天，以及备用额度的发放时段，并记录当前有多少人在等下一次重置。',
      h1: 'Codex 历史上通常几点重置？',
      lead: '看看历史重置集中在哪些时段、多久出现一次，以及现在有多少人也在等。',
    },
    en: {
      path: '/en/vigil',
      title: 'When Does Codex Reset? Reset Times and Patterns',
      description:
        'Which hours Codex resets usually land in, how many days apart resets tend to be, when banked resets are granted, and how many people are waiting for the next one.',
      h1: 'When does Codex usually reset?',
      lead: 'The hours and cadence resets actually land in, and how many people are waiting for the next one right now.',
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
