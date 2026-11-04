'use strict';
/**
 * Server-side rendering.
 *
 * Every crawlable URL answers with a complete document: title, description,
 * canonical, hreflang, structured data and — crucially — real text in the
 * first byte. The client app then replaces the first-paint block with its
 * interactive view, so JavaScript adds capability instead of content.
 */

const path = require('node:path');

const { esc, tag, voidTag, jsonLd, isoDate, isoStamp } = require('./html');
const { moduleUrl } = require('./esm');
const data = require('./data');
const { ARTICLES, SLUGS, articleMeta, articlePath, slugFromPath } = require('./articles');

const PUBLIC_JS = path.join(__dirname, '..', 'public', 'js');

/** Loaded once at boot: the browser modules that are pure data. */
let shared = null;

async function init() {
  if (shared) return shared;
  const load = (name) => import(moduleUrl(path.join(PUBLIC_JS, name)));
  const [meta, i18n] = await Promise.all([load('seo-meta.js'), load('i18n.js')]);
  shared = { meta, t: { zh: i18n.translator('zh'), en: i18n.translator('en') } };
  return shared;
}

function tx(locale, key, params) {
  return shared.t[locale === 'en' ? 'en' : 'zh'](key, params);
}

/* ------------------------------------------------------------------ labels */

const LABELS = {
  zh: {
    lastVerified: '最近一次已确认重置',
    updated: '更新于',
    daysAgo: '距今 {days} 天',
    chance24: '未来 24 小时重置概率',
    chance48: '未来 48 小时重置概率',
    estimate: '概率来自本站台账上的历史节奏模型，不代表 OpenAI 的承诺。',
    recentResets: '最近的重置记录',
    allResets: '查看全部记录',
    interval: '间隔 {days} 天',
    verified: '已确认',
    pending: '待确认',
    empty: '台账暂时没有可用的数据，稍后再试。',
    skip: '跳到主要内容',
    nav: { home: '概览', rhythm: '重置节奏', timeline: '重置记录', status: '数据状态', vigil: '一起等重置' },
    readGuide: '阅读说明',
    guidesTitle: '先搞清楚这几件事',
    guidesLead:
      '如果你刚遇到额度用完，或者看到有人说 Codex 重置了，下面几篇可以帮你判断这次重置和你有没有关系。所有数字以账号里「设置 → 用量」为准，本站只记录公开的全局重置。',
    faqTitle: '常见问题',
    faq: [
      {
        q: 'Codex 今天会重置吗？',
        a: '全站范围的重置由 OpenAI 决定，没有公开时间表。首页的 24 与 48 小时概率来自本站台账里的历史间隔，带可能范围和可信度，是估计，不是承诺。',
      },
      {
        q: 'Codex 重置和 5 小时限额刷新是一回事吗？',
        a: '不是。5 小时窗口每天会自动刷新多次；这里记录的是 OpenAI 主动对所有人发起的全局重置，两者完全不同。',
      },
      {
        q: '这里的数据从哪里来？',
        a: '来自本站自己维护的公开台账：每条都能点回一条 X 原帖，不调用第三方接口。',
      },
    ],
    historicalTitle: '历史上的重置节奏',
    typicalGap: '近期重置间隔中位数',
    days: '{n} 天',
    hours: '{n} 小时',
    lastResetAt: '上次重置',
    timelineLead: '按时间倒序记录每一次重置与备用额度发放，并给出相邻两次已验证重置之间的间隔。',
    timelineNote: '「间隔」是相邻两次重置公告之间相差的天数，可以用来判断当前的节奏比历史上更密还是更疏。备用额度不算一次重置，它只是一次可以手动使用的额度发放；重置公告在确认生效之前，会单独标记为待确认。',
    tableDate: '日期（北京时间）',
    tableType: '类型',
    tableInterval: '间隔',
    tableSource: '来源',
    kindReset: '重置',
    kindBanked: '备用额度',
    kindOther: '产品更新',
    readMore: '继续阅读',
    notFoundTitle: '页面不存在',
    notFoundLead: '这个地址没有对应的页面。可以回到概览，或直接看重置记录。',
    backHome: '回到概览',
    articleUpdated: '最后更新',
    sourcesTitle: '参考来源',
    relatedTitle: '相关阅读',
    official: '非官方项目，与 OpenAI 无关。',
    dataNote: '数据来自本站公开台账，仅供参考。',
    breadcrumb: '面包屑',
    guideIndex: '说明',
    archiveTitle: '按月归档',
    archiveLead: '按月份查看 Codex 的重置记录，每个月一页，包含每次公告的时间、类型和间隔。',
    archiveMonths: '{n} 个月',
    archiveResets: '本月记录的重置',
    archiveGap: '与上个月最后一次重置相隔 {days} 天',
    archivePrev: '上个月',
    archiveNext: '下个月',
    archiveAll: '全部记录',
    archiveEmpty: '这个月还没有记录。',
    archiveH1: '{year} 年 {month} 月 Codex 重置记录',
    archiveNotes: '时间按北京时间（UTC+8）显示；类型区分重置、待确认和备用额度发放。',
    weekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],

    /* --- 首页结论台 ------------------------------------------------------- */
    verdictEyebrow: 'CODEX 额度追踪',
    probability24: '未来 24 小时',
    probability48: '未来 48 小时',
    rangeLabel: '区间 {range}',
    confidenceLabel: '置信度 {level}',
    confidence: { high: '高', medium: '中', low: '低' },
    insufficient: '样本不足',
    factLastReset: '最近一次已确认重置',
    factWaited: '已等待',
    factNextWindow: '下一次高频窗口',
    since: '距今 {days} 天',
    waitedNote: '比 {share}% 的历史间隔更长 · 中位 {median} 天',
    windowNote: 'UTC {range} · 占样本 {share}%',
    verdictNote:
      '概率来自本站台账上的历史节奏模型（样本 {n} 个间隔，置信度 {confidence}），不代表 OpenAI 的承诺。',

    /* --- 节奏摘要 --------------------------------------------------------- */
    rhythmTitle: '重置节奏',
    rhythmNote: '所有已确认重置之间的间隔，以及一天里最常发生重置的时段。',
    rhythmMedian: '间隔中位数',
    rhythmRecent: '最近 8 次中位',
    rhythmLongest: '最长间隔',
    viewRhythm: '查看完整节奏',
    methodTitle: '方法与数据',
    methodBody:
      '数据来自本站自己维护的公开台账：每条重置或备用额度都能追到一条公开的 X 原帖，台账随仓库一起部署，不调用任何第三方接口。24 与 48 小时概率是把历史间隔当作更新过程、在本地算出来的，带区间与置信度，不是官方承诺。',
    methodLinks: '数据状态 · 重置节奏 · 关于',
    sourcePost: 'X 原帖 ↗',
    sourceLedger: '台账记录',
    heatmapAria: '重置发生时段：UTC 小时 × 星期，共 {n} 次',
    heatmapLegend: '周一为第一行；列是 UTC 小时。颜色越深表示该时段重置次数越多。',
    heatmapCell: '{day} {hour} UTC · {count} 次',

    /* --- /rhythm ---------------------------------------------------------- */
    rhythmLead:
      '把每一次已确认重置放到同一条时间轴上：间隔多久、落在星期几的几点、下一条最可能出现在哪个窗口。全部由本站台账在本地计算。',
    rhythmStats: '节奏概况',
    rhythmRecorded: '已记录重置',
    rhythmSpan: '覆盖跨度',
    rhythmCount: '{n} 次',
    rhythmSpanValue: '{n} 天',
    intervalTitle: '间隔分布',
    intervalLead: '相邻两次已确认重置之间的天数。表里按时间倒序，最多列出最近 40 条。',
    intervalNote: '样本共 {n} 个间隔；间隔不足 6 小时的两次记录会被视为同一次传播，只保留较早的一条。',
    tableIndex: '#',
    tableResetAt: '重置时间',
    tableGap: '距上一次',
    hourTitle: '星期 × 小时',
    windowTitle: '最可能的窗口',
    windowLine: 'UTC {range} · {count} 次 · {share}%',
    monthTitle: '按月',
    monthCol: '月份',
    monthResets: '重置',
    monthBanked: '备用额度',
    rhythmMethodTitle: '这个数字怎么算的',
    rhythmMethod:
      '概率是更新过程（renewal process）估计：先用带 60 天半衰期的样本拟合 Weibull 生存曲线，再与经验生存率按有效样本量加权；区间由 400 轮自助重采样给出 10–90 分位。模型自带 walk-forward 回测，回测分数与参数见下方。',
    rhythmFaq: [
      {
        q: '为什么用间隔分布，而不是固定时间表？',
        a: '重置没有公开的固定时间表。把两次重置之间的等待当作更新过程，用已有间隔估计「已经等了 t 天之后，接下来 24 小时再发生一次」的概率，比猜日期更稳。',
      },
      {
        q: '为什么概率每天都会变？',
        a: '概率是条件概率：等待越久，「马上要发生」的相对风险越高。台账更新或间隔样本变化时，数字也会重算。',
      },
      {
        q: '区间和置信度怎么理解？',
        a: '区间是 400 轮自助重采样后的 10–90 分位，表示模型自身的不确定度；置信度由样本量、数据新鲜度和回测是否优于基线共同决定。',
      },
    ],
    rhythmParamsTitle: '模型参数与回测',
    paramModel: '模型',
    paramSample: '间隔样本',
    paramEffective: '有效样本量',
    paramHalfLife: '半衰期',
    paramShape: 'Weibull 形状参数',
    paramScale: 'Weibull 尺度',
    paramEmpirical: '经验生存率权重',
    paramEmpiricalBlend: '经验混合伪计数',
    paramMinGap: '最小间隔',
    paramBootstrap: '自助重采样',
    paramBacktest: '回测方法',
    paramBacktestSample: '回测评估点',
    paramBrier: '回测 Brier',
    paramBaseline: '基线 Brier',
    paramVerdict: '回测结论',
    beatsBaseline: '优于基线',
    belowBaseline: '未优于基线',
    notEnough: '样本不足',

    /* --- /status ---------------------------------------------------------- */
    dataStatusLead:
      '这个站只有一个数据源：仓库里的公开台账。这里说明它更新到什么时候、覆盖了哪些时间、哪里还有缺口，以及模型的自带回测。',
    freshTitle: '数据新鲜度',
    freshUpdated: '台账更新时间',
    freshAge: '距今',
    freshState: '状态',
    freshTotal: '事件总数',
    fresh: '新鲜',
    stale: '过期',
    unknownState: '未知',
    freshThreshold: '超过 {n} 小时未更新即标记为过期',
    coverTitle: '覆盖范围',
    coverFirst: '首次记录',
    coverLast: '最近重置',
    coverResets: '重置次数',
    coverBanked: '备用额度次数',
    coverSpan: '跨度',
    coverCount: '{n} 次',
    coverSpanValue: '{n} 天',
    gapTitle: '已知缺口',
    gapFrom: '从',
    gapTo: '到',
    gapDays: '间隔天数',
    gapNone: '没有超过 30 天的缺口。',
    gapNote: '缺口是相邻两次已确认重置之间超过 30 天的间隔；不填补、不推断。',
    checkTitle: '自检',
    checkPass: '通过',
    checkFail: '失败',
    checkNames: { ledger: '台账校验', order: '时间顺序', sample: '样本量', backtest: '回测' },
    modelTitle: '模型',
    sourceTitle: '数据来源',
    sourceNote:
      '只收公开可追溯事件：不填补缺口、不假装自己在实时监测，也不抓取任何第三方接口。台账由维护者人工整理并写进仓库，随发布部署。',
    statusUpdatedNote: '最近一次台账更新',
    valueTable: '指标',
    valueValue: '数值',
    gapDaysValue: '{n} 天',
  },
  en: {
    lastVerified: 'Last verified reset',
    updated: 'Updated',
    daysAgo: '{days} days ago',
    chance24: 'Chance of a reset in the next 24 hours',
    chance48: 'Chance of a reset in the next 48 hours',
    estimate: 'Probabilities come from a cadence model over this site’s own ledger, not an OpenAI commitment.',
    recentResets: 'Recent reset records',
    allResets: 'View all records',
    interval: '{days} days apart',
    verified: 'Verified',
    pending: 'Pending',
    empty: 'The ledger has no usable data right now; please try again shortly.',
    skip: 'Skip to main content',
    nav: { home: 'Overview', rhythm: 'Reset rhythm', timeline: 'Reset history', status: 'Data status', vigil: 'The vigil' },
    readGuide: 'Read the guide',
    guidesTitle: 'Three things worth getting straight',
    guidesLead:
      'If you have just run out of quota, or saw someone say Codex reset, the pieces below help you decide whether this reset has anything to do with you. Your account under Settings → Usage is the authority; this site only records public global resets.',
    faqTitle: 'Common questions',
    faq: [
      {
        q: 'Did Codex reset today?',
        a: 'A site-wide reset is up to OpenAI and there is no public schedule. The 24h and 48h probabilities on this page come from the historical gaps in this site’s ledger, carrying a likely range and a confidence level — an estimate, not a promise.',
      },
      {
        q: 'Is a Codex reset the same as the 5-hour limit refreshing?',
        a: 'No. The 5-hour window refreshes automatically several times a day; what is recorded here is a global reset that OpenAI grants to everyone.',
      },
      {
        q: 'Where does the data come from?',
        a: 'From this site’s own public ledger: every row links back to a public post on X, and no third-party API is called.',
      },
    ],
    historicalTitle: 'Historical cadence',
    typicalGap: 'Median gap between recent resets',
    days: '{n} days',
    hours: '{n} hours',
    lastResetAt: 'Last reset',
    timelineLead: 'Every reset and banked grant in reverse chronological order, with the gap between consecutive verified resets.',
    timelineNote: 'The gap column is the number of days between consecutive reset announcements, which shows whether the current cadence is denser or sparser than usual. A banked grant is not a reset — it is an allowance you redeem manually. An announcement stays marked pending until it actually lands.',
    tableDate: 'Date (PT)',
    tableType: 'Type',
    tableInterval: 'Gap',
    tableSource: 'Source',
    kindReset: 'Reset',
    kindBanked: 'Banked',
    kindOther: 'Product update',
    readMore: 'Read more',
    notFoundTitle: 'Page not found',
    notFoundLead: 'There is no page at this address. Head back to the overview, or look at the reset history.',
    backHome: 'Back to the overview',
    articleUpdated: 'Last updated',
    sourcesTitle: 'Sources',
    relatedTitle: 'Related reading',
    official: 'Unofficial project, not affiliated with OpenAI.',
    dataNote: 'Data comes from this site’s public ledger and is for reference only.',
    breadcrumb: 'Breadcrumb',
    guideIndex: 'Guides',
    archiveTitle: 'Monthly archive',
    archiveLead: 'Codex reset records month by month, one page each, with the time, type and gap of every entry.',
    archiveMonths: '{n} months',
    archiveResets: 'Resets recorded this month',
    archiveGap: 'Gap from the last reset of the previous month: {days} days',
    archivePrev: 'Previous month',
    archiveNext: 'Next month',
    archiveAll: 'All records',
    archiveEmpty: 'No records in this month yet.',
    archiveH1: 'Codex resets in {month} {year}',
    archiveNotes: 'Times are shown in Pacific Time; types separate reset announcements, pending entries and banked grants.',
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

    verdictEyebrow: 'CODEX QUOTA TRACKER',
    probability24: 'Next 24 hours',
    probability48: 'Next 48 hours',
    rangeLabel: 'Range {range}',
    confidenceLabel: 'Confidence {level}',
    confidence: { high: 'high', medium: 'medium', low: 'low' },
    insufficient: 'Not enough data',
    factLastReset: 'Last confirmed reset',
    factWaited: 'Waiting since then',
    factNextWindow: 'Most likely window',
    since: '{days} days ago',
    waitedNote: 'Longer than {share}% of past intervals · median {median} days',
    windowNote: 'UTC {range} · {share}% of the sample',
    verdictNote:
      'Probabilities come from a cadence model over this site’s own ledger ({n} intervals, confidence {confidence}) and are not an OpenAI commitment.',

    rhythmTitle: 'Reset rhythm',
    rhythmNote: 'The gaps between confirmed resets, and the hours of the day they cluster in.',
    rhythmMedian: 'Median interval',
    rhythmRecent: 'Median of last 8',
    rhythmLongest: 'Longest interval',
    viewRhythm: 'See the full rhythm',
    methodTitle: 'Method and data',
    methodBody:
      'The data is this site’s own public ledger: every reset and banked grant traces back to a public post on X, and the ledger ships with the repository — no third-party API is called. The 24h and 48h probabilities are a local renewal-process estimate over historical intervals, with a range and a confidence level, not an official promise.',
    methodLinks: 'Data status · Reset rhythm · About',
    sourcePost: 'Original post ↗',
    sourceLedger: 'Ledger entry',
    heatmapAria: 'When resets land: UTC hour × weekday, {n} resets',
    heatmapLegend: 'Monday is the first row; columns are UTC hours. Darker means more resets in that slot.',
    heatmapCell: '{day} {hour} UTC · {count} resets',

    rhythmLead:
      'Every confirmed reset on one timeline: how far apart they land, which weekday and hour they cluster in, and the window the next one is most likely to fall in. All computed locally from this site’s ledger.',
    rhythmStats: 'At a glance',
    rhythmRecorded: 'Resets recorded',
    rhythmSpan: 'Covered span',
    rhythmCount: '{n} resets',
    rhythmSpanValue: '{n} days',
    intervalTitle: 'Interval distribution',
    intervalLead: 'Days between consecutive confirmed resets, newest first. The table lists up to the most recent 40.',
    intervalNote: 'The sample holds {n} intervals; two records less than 6 hours apart are treated as one wave and only the earlier one is kept.',
    tableIndex: '#',
    tableResetAt: 'Reset time',
    tableGap: 'Gap',
    hourTitle: 'Weekday × hour',
    windowTitle: 'Most likely windows',
    windowLine: 'UTC {range} · {count} resets · {share}%',
    monthTitle: 'By month',
    monthCol: 'Month',
    monthResets: 'Resets',
    monthBanked: 'Banked',
    rhythmMethodTitle: 'How the number is computed',
    rhythmMethod:
      'The probability is a renewal-process estimate: a Weibull survival curve fitted to recency-weighted intervals (60-day half-life) is blended with the empirical survival curve by effective sample size, and the range comes from 400 bootstrap resamples at the 10th–90th percentile. The model ships with its own walk-forward backtest; the scores and parameters are below.',
    rhythmFaq: [
      {
        q: 'Why model intervals instead of a schedule?',
        a: 'There is no public schedule. Treating the wait between resets as a renewal process and asking “given we have already waited t days, how likely is a reset in the next 24 hours?” is far steadier than guessing dates.',
      },
      {
        q: 'Why does the probability change every day?',
        a: 'It is conditional: the longer the current wait, the higher the relative hazard of an imminent reset. The figure is recomputed whenever the ledger or the interval sample changes.',
      },
      {
        q: 'How should the range and confidence be read?',
        a: 'The range is the 10th–90th percentile across 400 bootstrap resamples and reflects the model’s own uncertainty; confidence combines sample size, data freshness and whether the backtest beats its baseline.',
      },
    ],
    rhythmParamsTitle: 'Model parameters and backtest',
    paramModel: 'Model',
    paramSample: 'Interval sample',
    paramEffective: 'Effective sample size',
    paramHalfLife: 'Half-life',
    paramShape: 'Weibull shape k',
    paramScale: 'Weibull scale',
    paramEmpirical: 'Empirical weight',
    paramEmpiricalBlend: 'Empirical blend pseudo-count',
    paramMinGap: 'Minimum gap',
    paramBootstrap: 'Bootstrap rounds',
    paramBacktest: 'Backtest method',
    paramBacktestSample: 'Evaluated days',
    paramBrier: 'Backtest Brier',
    paramBaseline: 'Baseline Brier',
    paramVerdict: 'Backtest verdict',
    beatsBaseline: 'beats baseline',
    belowBaseline: 'does not beat baseline',
    notEnough: 'not enough data',

    dataStatusLead:
      'This site has exactly one data source: the public ledger in the repository. Here is how current it is, which period it covers, where the gaps are, and the model’s own backtest.',
    freshTitle: 'Data freshness',
    freshUpdated: 'Ledger updated',
    freshAge: 'Age',
    freshState: 'State',
    freshTotal: 'Events in total',
    fresh: 'Fresh',
    stale: 'Stale',
    unknownState: 'Unknown',
    freshThreshold: 'Marked stale once untouched for more than {n} hours',
    coverTitle: 'Coverage',
    coverFirst: 'First record',
    coverLast: 'Most recent reset',
    coverResets: 'Resets',
    coverBanked: 'Banked grants',
    coverSpan: 'Span',
    coverCount: '{n}',
    coverSpanValue: '{n} days',
    gapTitle: 'Known gaps',
    gapFrom: 'From',
    gapTo: 'To',
    gapDays: 'Days apart',
    gapNone: 'No gap longer than 30 days.',
    gapNote: 'A gap is a stretch of more than 30 days between two confirmed resets. Nothing is filled in or inferred.',
    checkTitle: 'Self-checks',
    checkPass: 'pass',
    checkFail: 'fail',
    checkNames: { ledger: 'Ledger', order: 'Order', sample: 'Sample size', backtest: 'Backtest' },
    modelTitle: 'Model',
    sourceTitle: 'Data sources',
    sourceNote:
      'Only public, traceable events: no gaps are filled in, no account is monitored, and no third-party API is called. The ledger is maintained by hand in the repository and ships with each release.',
    statusUpdatedNote: 'Last ledger update',
    valueTable: 'Metric',
    valueValue: 'Value',
    gapDaysValue: '{n} days',
  },
};

const label = (locale, key) => LABELS[locale === 'en' ? 'en' : 'zh'][key];

/* -------------------------------------------------------------- formatting */

function zoneFor(locale) {
  return locale === 'en' ? 'America/Los_Angeles' : 'Asia/Shanghai';
}

function formatDateTime(value, locale) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return tx(locale, 'common.unavailable');
  const zone = zoneFor(locale);
  const options = {
    timeZone: zone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', options).format(new Date(time));
}

function formatDay(value, locale) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return tx(locale, 'common.unavailable');
  const options = { timeZone: zoneFor(locale), year: 'numeric', month: locale === 'en' ? 'short' : 'long', day: 'numeric' };
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', options).format(new Date(time));
}

function zoneLabel(locale) {
  return locale === 'en' ? 'PT' : '北京时间';
}

/** Upstream text is HTML-flavoured and entity-encoded; flatten it to plain text. */
function plain(value, limit = 240) {
  let text = String(value ?? '');
  text = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (limit && text.length > limit) text = `${text.slice(0, limit).trimEnd()}…`;
  return text;
}

function daysBetween(from, to) {
  const a = Date.parse(from ?? '');
  const b = Date.parse(to ?? '');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/* ---------------------------------------------------------------- head/SEO */

function headBlock({ origin, locale, title, description, canonical, alternates, image, jsonld }) {
  const absolute = (pathname) => `${origin}${pathname}`;
  const tags = [
    tag('title', {}, esc(title)),
    voidTag('meta', { name: 'description', content: description }),
    voidTag('meta', { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' }),
    // Search Console ownership token; must stay in the head of every page.
    voidTag('meta', { name: 'google-site-verification', content: '_vSYq_Jfd8ZiwFzUo5Rf5L4lDRx02HPa-CXh8U44Fj4' }),
    voidTag('link', { rel: 'canonical', href: absolute(canonical) }),
    voidTag('link', { rel: 'alternate', hreflang: 'zh-Hans', href: absolute(alternates.zh) }),
    voidTag('link', { rel: 'alternate', hreflang: 'en', href: absolute(alternates.en) }),
    voidTag('link', { rel: 'alternate', hreflang: 'x-default', href: absolute(alternates.xDefault) }),
    voidTag('meta', { property: 'og:type', content: 'website' }),
    voidTag('meta', { property: 'og:site_name', content: 'Codex Reset' }),
    voidTag('meta', { property: 'og:title', content: title }),
    voidTag('meta', { property: 'og:description', content: description }),
    voidTag('meta', { property: 'og:url', content: absolute(canonical) }),
    voidTag('meta', { property: 'og:locale', content: locale === 'en' ? 'en_US' : 'zh_CN' }),
    voidTag('meta', { property: 'og:locale:alternate', content: locale === 'en' ? 'zh_CN' : 'en_US' }),
    voidTag('meta', { property: 'og:image', content: absolute(image || '/og-image.png') }),
    voidTag('meta', { property: 'og:image:width', content: '1200' }),
    voidTag('meta', { property: 'og:image:height', content: '630' }),
    voidTag('meta', { property: 'og:image:alt', content: title }),
    voidTag('meta', { name: 'twitter:card', content: 'summary_large_image' }),
    voidTag('meta', { name: 'twitter:title', content: title }),
    voidTag('meta', { name: 'twitter:description', content: description }),
    voidTag('meta', { name: 'twitter:image', content: absolute(image || '/og-image.png') }),
  ];
  if (jsonld) tags.push(jsonLd(jsonld));
  return tags.join('\n');
}

function webSiteNode(origin, locale) {
  return {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    url: `${origin}${locale === 'en' ? '/en/' : '/'}`,
    name: 'Codex Reset',
    inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
    description:
      locale === 'en'
        ? 'Unofficial tracker for OpenAI Codex quota resets: verified reset records, 24h and 48h probabilities and the reset history.'
        : '非官方项目：追踪 OpenAI Codex 的额度重置、24 与 48 小时重置概率和完整重置记录。',
  };
}

function organizationNode(origin, locale) {
  return {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'Codex Reset',
    url: `${origin}${locale === 'en' ? '/en/' : '/'}`,
    logo: `${origin}/icon-512.png`,
    sameAs: ['https://github.com/chendaleiQ', 'https://x.com/thsottiaux'],
    codeRepository: 'https://github.com/chendaleiQ/codex-reset',
  };
}

function breadcrumb(origin, locale, trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.path}`,
    })),
  };
}

/* -------------------------------------------------------------- first paint */

/**
 * Sibling of `public/js/format.js` for the server: same locale tags, same
 * rounding, so the first paint and the hydrated view cannot disagree.
 */
function formatDays(value, locale) {
  const days = Number(value);
  if (!Number.isFinite(days)) return null;
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    maximumFractionDigits: 1,
    minimumFractionDigits: days < 10 ? 1 : 0,
  }).format(days);
}

function formatNumber(value, locale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN').format(n);
}

function relativeTime(iso, locale) {
  const at = Date.parse(iso ?? '');
  if (!Number.isFinite(at)) return '';
  const diff = at - Date.now();
  const abs = Math.abs(diff);
  const formatter = new Intl.RelativeTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { numeric: 'auto', style: 'short' });
  if (abs < 60_000) return formatter.format(Math.round(diff / 1000), 'second');
  if (abs < 3_600_000) return formatter.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return formatter.format(Math.round(diff / 3_600_000), 'hour');
  return formatter.format(Math.round(diff / 86_400_000), 'day');
}

/** Date with the year, optionally with the clock — /status always shows years. */
function formatFullDate(value, locale, withTime = false) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return null;
  const options = {
    timeZone: zoneFor(locale),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  if (withTime) Object.assign(options, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', options).format(new Date(time));
}

/** A row whose text came from an English source stays marked as English. */
function textLang(text, locale) {
  const ascii = String(text || '').replace(/[\s\d\p{P}]/gu, '');
  return /^[\x00-\x7f]*$/.test(ascii) && ascii.length > 0 ? 'en' : locale;
}

const padHour = (hour) => `${String(Math.max(0, Math.min(23, Number(hour) || 0))).padStart(2, '0')}:00`;

/** Shifts a UTC hour into the locale's zone, exactly like `_parts.js`. */
function windowRange(startHour, endHour, locale = 'zh') {
  const start = Number(startHour);
  const end = Number(endHour);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const zone = zoneFor(locale);
  const edges = [start, end].map((hour) => {
    const stamp = Date.UTC(2026, 0, 5, hour);
    const label = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(stamp));
    return `${label}:00`;
  });
  return `${edges[0]}–${edges[1]}`;
}

const utcRangeLabel = (startHour, endHour) => `${padHour(startHour)}–${padHour(endHour)}`;

function unitFor(locale, unit) {
  if (!unit) return null;
  if (locale === 'zh') return { days: '天', hours: '小时', resets: '次', count: '次' }[unit] || null;
  return { days: 'days', hours: 'hours', resets: 'resets', count: 'resets' }[unit] || null;
}

function faqItems(locale) {
  return ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']
    .map((key) => ({ q: tx(locale, `faq.${key}`), a: tx(locale, `faq.a${key.slice(1)}`) }))
    .filter((item) => item.q && item.a);
}

function rhythmFaqItems(locale) {
  return ['q1', 'q2', 'q3', 'q4']
    .map((key) => ({ q: tx(locale, `rhythm.faq.${key}`), a: tx(locale, `rhythm.faq.a${key.slice(1)}`) }))
    .filter((item) => item.q && item.a);
}

function faqDetails(items) {
  return tag('div', { class: 'faq' }, items.map((item) => tag('details', {}, [
    tag('summary', {}, esc(item.q)),
    tag('p', {}, esc(item.a)),
  ].join(''))).join(''));
}

/* ------------------------------------------------------------- page meta */

/**
 * Head copy: the body copy comes from `public/js/i18n.js`, but the metadata is
 * server-rendered first and must satisfy the crawler checks, so it lives here.
 * `/rhythm` is handled locally so the SSR route never depends on the client
 * route table shipping `rhythm` in the same order.
 */
const LOCAL_META = {
  home: {
    zh: {
      path: '/',
      title: 'Codex 重置追踪：今天会重置吗？重置概率与记录',
      description:
        '看本站自己的公开台账：上一次 Codex 重置是什么时候、未来 24 和 48 小时再重置的可能有多大、可能范围和可信度，以及最近的重置记录。每条都能点回原帖。',
      h1: 'Codex 今天会重置吗？',
    },
    en: {
      path: '/en/',
      title: 'Codex Reset Tracker — Did Codex Reset Today? Records & Forecast',
      description:
        'From this site’s own ledger: when Codex last reset, how likely another reset is within 24 or 48 hours, the likely range and confidence, and the recent record.',
      h1: 'Will Codex reset today?',
    },
  },
  status: {
    zh: {
      path: '/status',
      title: 'Codex 数据状态：台账更新、覆盖范围与缺口',
      description:
        '本站只有一个数据源：仓库里的公开台账。这里写清楚它上次什么时候更新、覆盖了哪段时间、哪些地方还有缺口，以及数据检查是否正常。',
      h1: '数据状态',
    },
    en: {
      path: '/en/status',
      title: 'Codex Data Status — Ledger Updates, Coverage and Gaps',
      description:
        'One data source: the public ledger in this repository. When it was last updated, which period it covers, where the gaps are, and whether the checks pass.',
      h1: 'Data status',
    },
  },
  rhythm: {
    zh: {
      path: '/rhythm',
      title: '重置节奏：Codex 重置的间隔、时段与高频窗口',
      description:
        '过去每次重置之间隔了多久、通常发生在星期几的几点、下一次最可能出现在哪个时段，以及这些数字是怎么算出来的。全部由本站台账在本地计算。',
      h1: '重置节奏',
    },
    en: {
      path: '/en/rhythm',
      title: 'Codex Reset Rhythm — Intervals, Hour Windows and Cadence',
      description:
        'How far apart Codex resets have landed, which weekday and hour they cluster in, the most likely window, and how each number is computed — from this site’s own ledger.',
      h1: 'Reset rhythm',
    },
  },
};

function pageMetaFor(locale, key) {
  const override = LOCAL_META[key];
  if (override) return { key, locale, ...override[locale === 'en' ? 'en' : 'zh'] };
  return routeMetaFor(locale, key);
}

function navLabel(locale, key) {
  const table = label(locale, 'nav') || {};
  return table[key] || key;
}

function primaryNav(locale) {
  return ['home', 'rhythm', 'timeline']
    .map((key) => {
      const page = pageMetaFor(locale, key);
      return tag('a', { href: page.path }, esc(tx(locale, `nav.${key}`)));
    })
    .join('');
}

function relatedNav(locale) {
  return tag('nav', { class: 'seo-related', 'aria-label': label(locale, 'relatedTitle') }, [
    tag('h2', {}, esc(label(locale, 'relatedTitle'))),
    tag('ul', {}, [
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'rhythm').path }, esc(tx(locale, 'nav.rhythm')))),
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'timeline').path }, esc(tx(locale, 'nav.timeline')))),
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'status').path }, esc(tx(locale, 'nav.status')))),
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'vigil').path }, esc(tx(locale, 'nav.vigil')))),
      tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
    ].join('')),
  ].join(''));
}

/* ------------------------------------------------------------- components */

/** One figure inside a `.factgrid`, matching `_parts.js`'s `fact()`. */
function factCard(locale, term, value, sub, { unit, html } = {}) {
  const body = [html ? String(value) : esc(value)];
  const unitText = unitFor(locale, unit);
  if (unitText) body.push(tag('span', { class: 'unit' }, esc(unitText)));
  if (sub) body.push(tag('p', {}, esc(sub)));
  return tag('div', { class: 'fact' }, tag('dt', {}, esc(term)) + tag('dd', {}, body.join('')));
}

function factGrid(cards, className = 'factgrid') {
  const items = cards.filter(Boolean);
  return items.length ? tag('dl', { class: className }, items.join('')) : '';
}

/** The leaf shell: a heading, an optional note line, then the content. */
function leafSection(locale, { title, note, id }, children) {
  const head = [tag('h2', {}, esc(title))];
  if (note) head.push(tag('p', { class: 'leaf-note' }, esc(note)));
  const attrs = { class: 'leaf' };
  if (id) attrs.id = id;
  return tag('section', attrs, [
    tag('div', { class: 'leaf-head' }, head.join('')),
    ...children,
  ].join(''));
}

function paramTable(rows) {
  return tag('table', { class: 'data-table param-table' }, [
    tag('tbody', {}, rows.map((row) => tag('tr', {},
      tag('th', { scope: 'row' }, esc(row[0])) + tag('td', {}, esc(row[1])))).join('')),
  ].join(''));
}

/** `data/meta.json` labels are Chinese; keep the English page free of them. */
function sourceLabel(locale, source) {
  const text = source.label || '';
  if (locale !== 'en') return text || tx(locale, 'datastatus.sourceFallback');
  const url = String(source.url || '');
  if (/x\.com/i.test(url)) return tx(locale, 'datastatus.sourceFallback');
  return /[\u4e00-\u9fff]/.test(text) ? tx(locale, 'datastatus.sourceFallback') : text;
}

/* ---------------------------------------------------------------- verdict */

function probabilityCard(locale, snap, hours) {
  const value = hours === 24 ? snap.chance24 : snap.chance48;
  const range = hours === 24 ? snap.forecast.probabilities.range_24h : snap.forecast.probabilities.range_48h;
  const numeric = range && typeof range.lower === 'number' && typeof range.upper === 'number'
    ? { lo: Math.round(range.lower * 100), hi: Math.round(range.upper * 100) }
    : null;
  const at = value === null || value === undefined ? null : value;
  const meter = numeric && at !== null
    ? tag('span', { class: 'verdict-meter', 'aria-hidden': 'true' }, tag('span', {
        class: 'verdict-meter-band',
        style: `--lo:${numeric.lo}%;--hi:${numeric.hi}%;--at:${at}%`,
      }, ''))
    : '';
  const rangeText = numeric
    ? tx(locale, 'verdict.range', { range: `${numeric.lo}–${numeric.hi}%` })
    : tx(locale, 'verdict.rangeNone');
  return tag('div', { class: 'verdict-number', 'data-confidence': snap.confidence || 'low' }, [
    tag('span', { class: 'verdict-value' }, value === null || value === undefined ? '—' : `${value}%`),
    tag('span', { class: 'verdict-label' }, esc(tx(locale, hours === 24 ? 'verdict.window24' : 'verdict.window48'))),
    tag('span', { class: 'verdict-range' }, esc(rangeText)),
    meter,
  ].join(''));
}

/** The one sentence the whole page exists to answer. */
function verdictAnswer(locale, snap) {
  const days = snap.ageDays === null || snap.ageDays === undefined ? null : formatDays(snap.ageDays, locale);
  const share = snap.wait && typeof snap.wait.shorter_share === 'number' ? Math.round(snap.wait.shorter_share * 100) : null;
  if (snap.chance24 === null || snap.chance48 === null || days === null) return tx(locale, 'verdict.answerNoData');
  if (share === null) return tx(locale, 'verdict.answerNoShare', { p24: snap.chance24, p48: snap.chance48, days });
  return tx(locale, 'verdict.answer', { p24: snap.chance24, p48: snap.chance48, days, share });
}

function verdictFacts(locale, snap) {
  const facts = [];
  const ageDays = snap.ageDays === null || snap.ageDays === undefined ? null : formatDays(snap.ageDays, locale);
  facts.push(factCard(locale,
    tx(locale, 'verdict.lastReset'),
    formatDateTime(snap.lastResetAt, locale) || tx(locale, 'common.unavailable'),
    ageDays === null ? tx(locale, 'common.unavailable') : tx(locale, 'verdict.age', { days: ageDays }),
  ));
  const wait = snap.wait || {};
  const waitDays = wait.days === null || wait.days === undefined ? null : formatDays(wait.days, locale);
  const share = typeof wait.shorter_share === 'number' ? Math.round(wait.shorter_share * 100) : null;
  facts.push(factCard(locale,
    tx(locale, 'verdict.waited'),
    waitDays === null ? tx(locale, 'common.unavailable') : waitDays,
    share === null ? null : tx(locale, 'verdict.waitNote', {
      share,
      median: wait.median_days === null || wait.median_days === undefined ? '—' : formatDays(wait.median_days, locale),
    }),
    { unit: waitDays === null ? null : 'days' },
  ));
  const window = snap.window;
  const local = window ? windowRange(window.start_hour, window.end_hour, locale) : null;
  facts.push(factCard(locale,
    tx(locale, 'verdict.nextWindow'),
    local || tx(locale, 'common.unavailable'),
    window
      ? tx(locale, 'verdict.windowUtc', {
          range: utcRangeLabel(window.start_hour, window.end_hour),
          count: formatNumber(window.count ?? 0, locale),
          total: formatNumber(window.total ?? snap.resets.length, locale),
        })
      : tx(locale, 'verdict.windowNone'),
  ));
  return facts;
}

function verdictBlock(locale, snap) {
  const confidence = snap.confidence || 'low';
  const model = snap.model || null;
  const pending = snap.forecast && snap.forecast.mode === 'pending' ? snap.forecast.pending : null;
  const pendingBlock = pending
    ? tag('div', { class: 'verdict-pending' }, [
        tag('p', {}, esc(tx(locale, 'verdict.pendingNote', {
          time: formatDateTime(pending.at, locale) || tx(locale, 'common.unavailable'),
          quote: plain(pending.quote, 120),
        }))),
        pending.source_url
          ? tag('a', { href: pending.source_url, rel: 'noopener nofollow', target: '_blank', class: 'chit' }, esc(tx(locale, 'verdict.pendingLink')))
          : '',
      ].join(''))
    : '';
  return tag('header', { class: 'verdict', 'aria-labelledby': 'verdict-title' }, [
    tag('p', { class: 'verdict-eyebrow' }, esc(tx(locale, 'verdict.eyebrow'))),
    tag('h1', { id: 'verdict-title' }, esc(tx(locale, 'home.title'))),
    tag('p', { class: 'verdict-answer' }, esc(verdictAnswer(locale, snap))),
    tag('div', { class: 'verdict-grid' }, [
      probabilityCard(locale, snap, 24),
      probabilityCard(locale, snap, 48),
      tag('dl', { class: 'verdict-facts' }, verdictFacts(locale, snap).join('')),
    ].join('')),
    tag('p', { class: 'verdict-note' }, esc(model
      ? tx(locale, 'verdict.note', {
          n: formatNumber(model.interval_sample, locale) ?? '—',
          level: tx(locale, `verdict.confidence.${confidence}`),
        })
      : tx(locale, 'verdict.noteNoSample'))),
    pendingBlock,
    tag('p', { class: 'verdict-updated field-hint' }, esc(snap.updatedAt
      ? tx(locale, 'verdict.updated', { time: formatDateTime(snap.updatedAt, locale) || '—' })
      : '')),
  ].join(''));
}

/* --------------------------------------------------------------- overview */

function recentRows(locale, snap) {
  const chronological = Array.isArray(snap.events) ? snap.events.slice().reverse() : [];
  const gaps = new Map();
  for (let index = 1; index < chronological.length; index += 1) {
    const previous = Date.parse(chronological[index - 1].at ?? '');
    const current = Date.parse(chronological[index].at ?? '');
    if (Number.isFinite(previous) && Number.isFinite(current)) gaps.set(chronological[index], (current - previous) / 86_400_000);
  }
  return chronological.slice().reverse().slice(0, 6).map((event) => {
    const gap = gaps.get(event);
    const url = event.url && /^https?:\/\//.test(event.url) ? event.url : null;
    return tag('tr', {}, [
      tag('td', { class: 'table-time' }, esc(formatDateTime(event.at, locale) || tx(locale, 'common.unavailable'))),
      tag('td', { class: 'num' }, event.kind === 'banked'
        ? tag('span', { class: 'muted' }, esc(tx(locale, 'home.kindBanked')))
        : gap === undefined
          ? tag('span', { class: 'muted' }, '—')
          : esc(tx(locale, 'common.days', { n: formatDays(gap, locale) }))),
      tag('td', {}, url
        ? tag('a', { href: url, rel: 'noopener nofollow', target: '_blank', class: 'table-link' }, esc(`${tx(locale, 'home.sourcePost')} ↗`))
        : tag('span', { class: 'muted' }, esc(tx(locale, 'home.sourceLedger')))),
    ].join(''));
  });
}

function overviewBlock(locale, snap, origin) {
  const parts = [verdictBlock(locale, snap)];

  // 2. Rhythm preview: three figures and the weekday × hour heatmap.
  const cadence = snap.cadence || {};
  const wait = snap.wait || {};
  const rhythmFacts = factGrid([
    factCard(locale, tx(locale, 'home.medianInterval'),
      cadence.overall_median_days === null || cadence.overall_median_days === undefined ? '—' : formatDays(cadence.overall_median_days, locale),
      null, { unit: 'days' }),
    factCard(locale, tx(locale, 'home.recentMedian'),
      cadence.recent_median_days === null || cadence.recent_median_days === undefined ? '—' : formatDays(cadence.recent_median_days, locale),
      null, { unit: 'days' }),
    factCard(locale, tx(locale, 'home.longestInterval'),
      wait.longest_days === null || wait.longest_days === undefined ? '—' : formatDays(wait.longest_days, locale),
      null, { unit: 'days' }),
  ]);
  parts.push(leafSection(locale, {
    id: 'rhythm-preview',
    title: tx(locale, 'home.rhythmTitle'),
    note: tx(locale, 'home.rhythmNote'),
  }, [
    tag('div', { class: 'rhythm-preview' }, rhythmFacts + heatmapBlock(locale, snap)),
    tag('div', { class: 'leaf-foot' }, tag('a', { class: 'chit', href: pageMetaFor(locale, 'rhythm').path }, esc(tx(locale, 'home.viewRhythm')))),
  ]));

  // 3. Recent records, newest first, with the gap to the previous event.
  const rows = recentRows(locale, snap);
  const recent = tag('div', { class: 'table-wrap' }, tag('table', { class: 'data-table recent-table' }, [
    tag('thead', {}, tag('tr', {}, [
      tag('th', {}, esc(tx(locale, 'home.colWhen'))),
      tag('th', {}, esc(tx(locale, 'home.colGap'))),
      tag('th', {}, esc(tx(locale, 'home.colSource'))),
    ].join(''))),
    tag('tbody', {}, rows.join('')),
  ].join('')));
  parts.push(leafSection(locale, {
    title: tx(locale, 'home.recentTitle'),
    note: tx(locale, 'home.recentNote'),
  }, [
    tag('div', {}, rows.length ? recent : tag('p', { class: 'empty' }, esc(tx(locale, 'timeline.empty')))),
    tag('div', { class: 'leaf-foot' }, tag('a', { class: 'chit', href: pageMetaFor(locale, 'timeline').path }, esc(tx(locale, 'home.allRecords')))),
  ]));

  // 4. Where the numbers come from.
  parts.push(leafSection(locale, { title: tx(locale, 'home.methodTitle') }, [
    tag('p', { class: 'method-body' }, esc(tx(locale, 'home.methodBody'))),
    tag('div', { class: 'method-links' }, [
      tag('a', { class: 'chit', href: pageMetaFor(locale, 'status').path }, esc(tx(locale, 'home.methodStatus'))),
      tag('a', { class: 'chit', href: pageMetaFor(locale, 'rhythm').path }, esc(tx(locale, 'home.methodRhythm'))),
      tag('a', { class: 'chit', href: locale === 'en' ? '/en/about' : '/about' }, esc(tx(locale, 'home.methodAbout'))),
    ].join('')),
  ]));

  return tag('div', { id: 'ssr', class: 'ssr' }, parts.join(''));
}

/* ----------------------------------------------------------------- rhythm */

function rhythmStatsFacts(locale, snap) {
  const stats = snap.rhythm.stats || {};
  const cadence = snap.cadence || {};
  return factGrid([
    factCard(locale, tx(locale, 'rhythm.statsResets'),
      formatNumber(stats.resets ?? snap.resets.length, locale), null, { unit: 'resets' }),
    factCard(locale, tx(locale, 'rhythm.statsSpan'),
      formatNumber(Math.round(stats.span_days || 0), locale), null, { unit: 'days' }),
    factCard(locale, tx(locale, 'rhythm.statsMedian'),
      stats.median_interval_days === null || stats.median_interval_days === undefined ? '—' : formatDays(stats.median_interval_days, locale),
      null, { unit: 'days' }),
    factCard(locale, tx(locale, 'rhythm.statsRecent'),
      cadence.recent_median_days === null || cadence.recent_median_days === undefined ? '—' : formatDays(cadence.recent_median_days, locale),
      null, { unit: 'days' }),
  ]);
}

function windowList(locale, snap) {
  const rows = Array.isArray(snap.rhythm.windows) ? snap.rhythm.windows.slice(0, 5) : [];
  if (!rows.length) return tag('p', { class: 'empty' }, esc(tx(locale, 'verdict.windowNone')));
  const items = rows.map((window, index) => {
    const range = utcRangeLabel(window.start_hour, window.end_hour);
    const local = windowRange(window.start_hour, window.end_hour, locale) ?? '—';
    const share = typeof window.share === 'number' ? Math.round(window.share * 100) : null;
    return tag('li', { class: 'window-row' }, [
      tag('span', { class: 'window-index', 'aria-hidden': 'true' }, String(index + 1)),
      tag('span', { class: 'window-main' }, [
        tag('span', { class: 'window-range' }, esc(tx(locale, 'rhythm.windowRow', {
          range,
          local,
          count: formatNumber(window.count ?? 0, locale),
          share: share === null ? '—' : share,
        }))),
        tag('span', { class: 'window-bar', 'aria-hidden': 'true' }, tag('span', {
          style: `--w:${Math.max(0, Math.min(100, share || 0))}%`,
        }, '')),
      ].join('')),
    ].join(''));
  });
  return tag('ol', { class: 'window-list' }, items.join(''));
}

function intervalTable(locale, snap) {
  const intervals = Array.isArray(snap.rhythm.intervals) ? snap.rhythm.intervals : [];
  const rows = intervals.slice(-40).reverse();
  if (!rows.length) return tag('p', { class: 'empty' }, esc(tx(locale, 'common.unavailable')));
  return tag('table', { class: 'data-table interval-table', 'aria-label': tx(locale, 'rhythm.distribution') }, [
    tag('thead', {}, tag('tr', {}, [
      tag('th', {}, esc(label(locale, 'tableIndex'))),
      tag('th', {}, esc(label(locale, 'tableResetAt'))),
      tag('th', { class: 'num' }, esc(label(locale, 'tableGap'))),
    ].join(''))),
    tag('tbody', {}, rows.map((row, index) => tag('tr', {}, [
      tag('td', {}, esc(String(intervals.length - index))),
      tag('td', {}, tag('time', { datetime: isoStamp(row.at) || '' }, esc(formatDateTime(row.at, locale)))),
      tag('td', { class: 'num' }, esc(tx(locale, 'common.days', { n: formatDays(row.days, locale) }))),
    ].join(''))).join('')),
  ].join(''));
}

function monthTable(locale, snap) {
  const months = (Array.isArray(snap.rhythm.months) ? snap.rhythm.months : []).slice(0, 12);
  if (!months.length) return tag('p', { class: 'empty' }, esc(tx(locale, 'common.unavailable')));
  return tag('div', { class: 'table-wrap' }, tag('table', { class: 'data-table month-table' }, [
    tag('thead', {}, tag('tr', {}, [
      tag('th', {}, esc(tx(locale, 'rhythm.monthCol'))),
      tag('th', { class: 'num' }, esc(tx(locale, 'rhythm.colResets'))),
      tag('th', { class: 'num' }, esc(tx(locale, 'rhythm.colBanked'))),
    ].join(''))),
    tag('tbody', {}, months.map((entry) => tag('tr', {}, [
      tag('td', {}, esc(monthLabel(entry.month, locale))),
      tag('td', { class: 'num' }, esc(formatNumber(entry.resets, locale))),
      tag('td', { class: 'num' }, esc(formatNumber(entry.banked, locale))),
    ].join(''))).join('')),
  ].join('')));
}

function rhythmParamRows(locale, snap) {
  const model = snap.model || {};
  const backtest = snap.backtest || {};
  const params = (snap.status && snap.status.params) || {};
  const rows = [];
  const push = (name, value) => {
    if (value === null || value === undefined || value === '') return;
    rows.push([name, String(value)]);
  };
  if (model.half_life_days !== undefined) push(tx(locale, 'rhythm.paramHalfLife'), tx(locale, 'rhythm.valueDays', { n: model.half_life_days }));
  push(tx(locale, 'rhythm.paramShape'), model.shape_k);
  push(tx(locale, 'rhythm.paramEmpirical'), model.empirical_weight);
  push(tx(locale, 'rhythm.paramSample'), formatNumber(model.interval_sample, locale));
  push(tx(locale, 'rhythm.paramEffSample'), model.effective_sample_size === undefined ? null : formatNumber(model.effective_sample_size, locale));
  if (params.bootstrap_rounds !== undefined) push(tx(locale, 'rhythm.paramBootstrap'), formatNumber(params.bootstrap_rounds, locale));
  if (params.min_gap_hours !== undefined) push(tx(locale, 'rhythm.paramMinGap'), tx(locale, 'rhythm.valueHours', { n: params.min_gap_hours }));
  if (backtest.method) push(tx(locale, 'rhythm.paramBacktestMethod'), tx(locale, 'rhythm.methodWalkForward'));
  if (backtest.brier !== null && backtest.brier !== undefined) {
    push(tx(locale, 'rhythm.paramBrier'), backtest.brier);
    push(tx(locale, 'rhythm.paramBaseline'), backtest.baseline_brier);
  }
  return rows;
}

function rhythmBlock(locale, snap) {
  const page = pageMetaFor(locale, 'rhythm');
  const params = rhythmParamRows(locale, snap);

  const distribution = tag('div', { class: 'chart-host' }, [
    tag('p', { class: 'pair-readout' }, esc(tx(locale, 'rhythm.readout'))),
    intervalTable(locale, snap),
  ].join(''));

  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('header', { class: 'page-head' }, [
      tag('h1', {}, esc(tx(locale, 'rhythm.h1'))),
      tag('p', { class: 'lead' }, esc(tx(locale, 'rhythm.lead'))),
    ].join('')),
    leafSection(locale, { title: tx(locale, 'rhythm.overview') }, [tag('div', {}, rhythmStatsFacts(locale, snap))]),
    leafSection(locale, {
      title: tx(locale, 'rhythm.distribution'),
      note: tx(locale, 'rhythm.distributionNote'),
    }, [distribution]),
    leafSection(locale, {
      title: tx(locale, 'rhythm.weekdayTitle'),
      note: tx(locale, 'rhythm.weekdayNote'),
    }, [tag('div', {}, [
      heatmapBlock(locale, snap),
      tag('h3', { class: 'subhead' }, esc(tx(locale, 'rhythm.windowsTitle'))),
      tag('p', { class: 'field-hint' }, esc(tx(locale, 'rhythm.windowsNote'))),
      windowList(locale, snap),
    ])]),
    leafSection(locale, {
      title: tx(locale, 'rhythm.monthTitle'),
      note: tx(locale, 'rhythm.monthNote'),
    }, [tag('div', {}, monthTable(locale, snap))]),
    leafSection(locale, { title: tx(locale, 'rhythm.methodTitle') }, [tag('div', {}, [
      tag('p', { class: 'method-body' }, esc(tx(locale, 'rhythm.methodBody'))),
      params.length
        ? tag('details', { class: 'method-details' }, [
            tag('summary', {}, esc(tx(locale, 'rhythm.paramsSummary'))),
            tag('div', { class: 'table-wrap' }, paramTable(params)),
          ].join(''))
        : '',
      tag('h3', { class: 'subhead' }, esc(tx(locale, 'rhythm.faqTitle'))),
      faqDetails(rhythmFaqItems(locale)),
      tag('div', { class: 'method-links' }, [
        tag('a', { class: 'chit', href: pageMetaFor(locale, 'status').path }, esc(tx(locale, 'home.methodStatus'))),
        tag('a', { class: 'chit', href: pageMetaFor(locale, 'timeline').path }, esc(tx(locale, 'home.allRecords'))),
      ].join('')),
    ])]),
  ].join(''));
}

function rhythmDocument({ origin, pathname }) {
  const locale = pathname.startsWith('/en/') ? 'en' : 'zh';
  const page = pageMetaFor(locale, 'rhythm');
  const alternates = {
    zh: pageMetaFor('zh', 'rhythm').path,
    en: pageMetaFor('en', 'rhythm').path,
  };
  alternates.xDefault = alternates.zh;
  const snap = data.snapshot(locale);
  const head = headBlock({
    origin,
    locale,
    title: page.title,
    description: page.description,
    canonical: page.path,
    alternates,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        webSiteNode(origin, locale),
        organizationNode(origin, locale),
        {
          '@type': 'WebPage',
          '@id': `${origin}${page.path}#webpage`,
          url: `${origin}${page.path}`,
          name: page.title,
          description: page.description,
          inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
          isPartOf: { '@id': `${origin}/#website` },
          primaryImageOfPage: { '@type': 'ImageObject', url: `${origin}/og-image.png` },
        },
        {
          '@type': 'Dataset',
          name: locale === 'en' ? 'Codex reset intervals and windows' : 'Codex 重置间隔与时段统计',
          description: page.description,
          url: `${origin}${page.path}`,
          inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
          isAccessibleForFree: true,
          creator: { '@type': 'Organization', name: 'Codex Reset', url: origin },
          distribution: [
            { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${origin}/api/rhythm` },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: rhythmFaqItems(locale).map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
      ],
    },
  });
  return {
    status: 200,
    head,
    body: rhythmBlock(locale, snap) + relatedNav(locale),
    lang: locale === 'en' ? 'en' : 'zh-Hans',
  };
}

function timelineBlock(locale, snap) {
  const meta = routeMetaFor(locale, 'timeline');
  const records = snap.records.slice(0, 24);
  const resets = snap.records.filter((record) => record.type === 'reset');
  const gaps = new Map();
  resets.forEach((record, index) => {
    const previous = resets[index + 1];
    gaps.set(record, previous ? daysBetween(previous.at, record.at) : null);
  });
  const kindLabel = (record) => {
    if (record.type === 'reset') return record.pending ? label(locale, 'pending') : label(locale, 'kindReset');
    if (record.type === 'credits' || record.type === 'boost' || record.type === 'unlock') return label(locale, 'kindBanked');
    return label(locale, 'kindOther');
  };

  const body = records.length
    ? tag(
        'table',
        { class: 'ssr-table' },
        [
          tag('caption', {}, esc(label(locale, 'recentResets'))),
          tag('thead', {}, tag('tr', {}, [
            tag('th', { scope: 'col' }, esc(label(locale, 'tableDate'))),
            tag('th', { scope: 'col' }, esc(label(locale, 'tableType'))),
            tag('th', { scope: 'col' }, esc(label(locale, 'tableInterval'))),
            tag('th', { scope: 'col' }, esc(label(locale, 'tableSource'))),
          ].join(''))),
          tag('tbody', {}, records.map((record) => {
            const gap = gaps.get(record);
            const text = plain(record.summary, 96);
            return tag('tr', {}, [
              tag('td', {}, tag('time', { datetime: isoStamp(record.at) || '' }, esc(formatDay(record.at, locale)))),
              tag('td', {}, esc(kindLabel(record))),
              tag('td', {}, gap === null || gap === undefined ? '—' : esc(String(gap))),
              tag('td', { lang: textLang(text, locale) }, esc(text || '—')),
            ].join(''));
          }).join('')),
        ].join(''),
      )
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'empty')));

  const summary = snap.resets.length
    ? locale === 'en'
      ? `As of ${formatDateTime(new Date(snap.at || Date.now()).toISOString(), locale)} ${zoneLabel(locale)}, this record holds ${snap.resets.length} reset announcements, the most recent on ${formatDateTime(snap.lastResetAt, locale)}.${snap.typicalDays !== null ? ` The median gap between recent resets is about ${Math.round(snap.typicalDays * 10) / 10} days.` : ''}`
      : `截至 ${formatDateTime(new Date(snap.at || Date.now()).toISOString(), locale)}（${zoneLabel(locale)}），共记录 ${snap.resets.length} 次重置公告，最近一次在 ${formatDateTime(snap.lastResetAt, locale)}。${snap.typicalDays !== null ? `近期相邻重置间隔中位数约 ${Math.round(snap.typicalDays * 10) / 10} 天。` : ''}`
    : null;

  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('p', { class: 'ssr-eyebrow' }, esc(navLabel(locale, 'timeline'))),
    tag('h1', {}, esc(meta.h1)),
    tag('p', { class: 'ssr-lead' }, esc(label(locale, 'timelineLead'))),
    summary ? tag('p', { class: 'ssr-answer' }, tag('strong', {}, locale === 'en' ? 'Quick answer: ' : '快速回答：') + esc(summary)) : '',
    body,
    tag('p', { class: 'ssr-note' }, esc(label(locale, 'timelineNote'))),
    tag('nav', { class: 'archive-nav', 'aria-label': label(locale, 'archiveTitle') }, [
      tag('a', { href: archivePath(locale) }, esc(label(locale, 'archiveTitle'))),
      ...archiveMonths(locale).slice(0, 4).map((entry) =>
        tag('a', { href: archivePath(locale, entry.month) }, esc(monthLabel(entry.month, locale))),
      ),
    ].join('')),
  ].join(''));
}


/** `lib/model.js` writes its check details in Chinese; normalise them here. */
function checkDetail(locale, check) {
  const detail = check.detail || '';
  if (check.name === 'backtest') {
    if (detail === 'beats-baseline') return tx(locale, 'datastatus.beats');
    if (detail === 'experimental') return tx(locale, 'datastatus.notBeats');
    if (detail === 'insufficient-data') return tx(locale, 'datastatus.insufficient');
    return detail;
  }
  if (locale === 'zh') return detail;
  const events = /(\d+)\s*条事件/.exec(detail);
  if (events) return `${events[1]} events`;
  const intervals = /(\d+)\s*个完整间隔/.exec(detail);
  if (intervals) return `${intervals[1]} completed intervals`;
  if (detail === '事件按时间正序') return 'in chronological order';
  return /[\u4e00-\u9fff]/.test(detail) ? '' : detail;
}

/** Weekday × hour grid, structurally identical to `_parts.js`. */
function heatmapBlock(locale, snap) {
  const grid = Array.isArray(snap.rhythm && snap.rhythm.heatmap) ? snap.rhythm.heatmap : [];
  if (!grid.length) return '';
  const stored = snap.rhythm.weekday_labels && snap.rhythm.weekday_labels[locale === 'en' ? 'en' : 'zh'];
  const days = Array.isArray(stored) && stored.length === 7 ? stored : label(locale, 'weekdays');
  const total = snap.rhythm.stats && snap.rhythm.stats.resets ? snap.rhythm.stats.resets : snap.resets.length;
  const max = grid.flat().reduce((peak, value) => Math.max(peak, Number(value) || 0), 0);
  const head = [tag('span', { class: 'heatmap-corner', 'aria-hidden': 'true' }, '')];
  for (let hour = 0; hour < 24; hour += 1) {
    head.push(tag('span', { class: 'heatmap-hour', 'aria-hidden': 'true' }, String(hour).padStart(2, '0')));
  }
  const cells = [];
  for (let day = 0; day < 7; day += 1) {
    cells.push(tag('span', { class: 'heatmap-day' }, esc(days[day] || '')));
    for (let hour = 0; hour < 24; hour += 1) {
      const count = Number(grid[day] && grid[day][hour]) || 0;
      const level = count === 0 || max === 0 ? 0 : count / max <= 0.25 ? 1 : count / max <= 0.5 ? 2 : count / max <= 0.75 ? 3 : 4;
      cells.push(tag('span', {
        class: 'heatmap-cell',
        'data-level': String(level),
        title: tx(locale, 'heatmap.cellTitle', { day: days[day] || '', hour: String(hour).padStart(2, '0'), count }),
      }, ''));
    }
  }
  const swatches = [0, 1, 2, 3, 4].map((level) => tag('span', { class: 'heatmap-swatch', 'data-level': String(level) }, '')).join('');
  return tag('div', {
    class: 'heatmap',
    role: 'img',
    'aria-label': tx(locale, 'heatmap.aria', { n: formatNumber(total, locale) ?? String(total) }),
  }, [
    tag('div', { class: 'heatmap-grid' }, head.join('') + cells.join('')),
    tag('div', { class: 'heatmap-foot' }, [
      tag('p', { class: 'heatmap-legend' }, esc(tx(locale, 'heatmap.legend'))),
      tag('p', { class: 'heatmap-scale', 'aria-hidden': 'true' }, [
        tag('span', { class: 'heatmap-scale-label' }, esc(tx(locale, 'heatmap.scaleLow'))),
        swatches,
        tag('span', { class: 'heatmap-scale-label' }, esc(tx(locale, 'heatmap.scaleHigh'))),
      ].join('')),
    ].join('')),
  ].join(''));
}

/* ------------------------------------------------------------------ status */

function checkStateText(locale, check) {
  return check.ok ? tx(locale, 'datastatus.checkOk') : tx(locale, 'datastatus.checkFail');
}

function statusBlock(locale, snap) {
  const page = pageMetaFor(locale, 'status');
  const state = snap.status || {};
  const dataset = state.dataset || {};
  const freshness = state.freshness || {};
  const params = state.params || {};
  const model = state.model || {};
  const backtest = state.backtest || {};
  const gaps = Array.isArray(state.gaps) ? state.gaps : [];
  const checks = Array.isArray(state.checks) ? state.checks : [];

  const rawSources = Array.isArray(state.sources) && state.sources.length
    ? state.sources
    : Array.isArray(snap.meta && snap.meta.sources) ? snap.meta.sources : [];
  const seenSources = new Set();
  const sources = rawSources.filter((source) => {
    const key = `${source.label || ''}|${source.url || ''}`;
    if (seenSources.has(key)) return false;
    seenSources.add(key);
    return true;
  });

  const level = freshness.level === 'fresh' || freshness.level === 'stale' ? freshness.level : 'unknown';
  const tone = level === 'fresh' ? 'ok' : level === 'stale' ? 'warn' : 'plain';
  const freshnessFacts = factGrid([
    factCard(locale,
      tx(locale, 'datastatus.updated'),
      formatDateTime(state.updated_at, locale) || tx(locale, 'common.unavailable'),
      state.updated_at ? tx(locale, 'datastatus.age', { when: relativeTime(state.updated_at, locale) }) : null,
    ),
    factCard(locale,
      tx(locale, 'datastatus.level'),
      tag('span', { class: 'mark', 'data-tone': tone, 'data-shape': 'rule' }, esc(tx(locale, `datastatus.level.${level}`))),
      freshness.threshold_hours !== undefined ? tx(locale, 'datastatus.threshold', { n: freshness.threshold_hours }) : null,
      { html: true },
    ),
    factCard(locale, tx(locale, 'datastatus.events'), formatNumber(dataset.total, locale) ?? '—'),
  ]);

  const coverageFacts = factGrid([
    factCard(locale, tx(locale, 'datastatus.first'), formatFullDate(dataset.first_at, locale) || tx(locale, 'common.unavailable')),
    factCard(locale, tx(locale, 'datastatus.lastReset'), formatDateTime(dataset.last_reset_at, locale) || tx(locale, 'common.unavailable')),
    factCard(locale, tx(locale, 'datastatus.resets'), formatNumber(dataset.reset, locale) ?? '—'),
    factCard(locale, tx(locale, 'datastatus.banked'), formatNumber(dataset.banked, locale) ?? '—'),
    factCard(locale, tx(locale, 'datastatus.span'), formatNumber(Math.round(dataset.span_days || 0), locale) ?? '—', null, { unit: 'days' }),
  ]);

  const gapTable = gaps.length
    ? tag('div', { class: 'table-wrap' }, tag('table', { class: 'data-table gap-table' }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', {}, esc(tx(locale, 'datastatus.gapFrom'))),
          tag('th', {}, esc(tx(locale, 'datastatus.gapTo'))),
          tag('th', { class: 'num' }, esc(tx(locale, 'datastatus.gapDays'))),
        ].join(''))),
        tag('tbody', {}, gaps.map((gap) => tag('tr', {}, [
          tag('td', {}, esc(formatFullDate(gap.from, locale) || gap.from || '—')),
          tag('td', {}, esc(formatFullDate(gap.to, locale) || gap.to || '—')),
          tag('td', { class: 'num' }, esc(gap.days === null || gap.days === undefined
            ? '—'
            : `${formatDays(gap.days, locale)} ${locale === 'en' ? 'days' : '天'}`)),
        ].join(''))).join('')),
      ].join('')))
    : tag('p', { class: 'note' }, esc(tx(locale, 'datastatus.noGaps')));

  const checkList = checks.length
    ? tag('ul', { class: 'check-list' }, checks.map((check) => {
        const names = label(locale, 'checkNames') || {};
        const key = `datastatus.check.${check.name}`;
        const fallback = tx(locale, key);
        const name = fallback === key ? names[check.name] || check.name : fallback;
        return tag('li', {
          class: `check ${check.ok ? 'check--ok' : 'check--bad'}`,
          'data-ok': String(check.ok),
        }, [
          tag('span', { class: 'check-name' }, esc(name)),
          tag('span', { class: 'check-state' }, esc(checkStateText(locale, check))),
          tag('span', { class: 'check-detail' }, esc(checkDetail(locale, check))),
        ].join(''));
      }).join(''))
    : tag('p', { class: 'empty' }, esc(tx(locale, 'common.unavailable')));

  const paramRows = [];
  const pushParam = (name, value) => {
    if (value === null || value === undefined || value === '') return;
    paramRows.push([name, String(value)]);
  };
  if (model.name) pushParam(tx(locale, 'datastatus.modelName'), `${model.name} ${model.version || ''}`.trim());
  pushParam(tx(locale, 'rhythm.paramHalfLife'), model.half_life_days === undefined ? null : tx(locale, 'rhythm.valueDays', { n: model.half_life_days }));
  pushParam(tx(locale, 'rhythm.paramShape'), model.shape_k);
  pushParam(tx(locale, 'rhythm.paramEmpirical'), model.empirical_weight);
  pushParam(tx(locale, 'rhythm.paramSample'), model.interval_sample);
  pushParam(tx(locale, 'rhythm.paramEffSample'), model.effective_sample_size);
  if (params.min_gap_hours !== undefined) pushParam(tx(locale, 'rhythm.paramMinGap'), tx(locale, 'rhythm.valueHours', { n: params.min_gap_hours }));
  if (params.empirical_blend !== undefined) pushParam(tx(locale, 'datastatus.empiricalBlend'), params.empirical_blend);
  if (params.bootstrap_rounds !== undefined) pushParam(tx(locale, 'rhythm.paramBootstrap'), params.bootstrap_rounds);
  if (params.gap_days !== undefined) pushParam(tx(locale, 'datastatus.gapThreshold'), tx(locale, 'rhythm.valueDays', { n: params.gap_days }));
  if (params.stale_hours !== undefined) pushParam(tx(locale, 'datastatus.staleHours'), tx(locale, 'rhythm.valueHours', { n: params.stale_hours }));
  if (backtest.method) pushParam(tx(locale, 'rhythm.paramBacktestMethod'), tx(locale, 'rhythm.methodWalkForward'));

  const backtestFacts = backtest.brier === null || backtest.brier === undefined
    ? tag('p', { class: 'note' }, esc(tx(locale, 'datastatus.insufficient')))
    : factGrid([
        factCard(locale, tx(locale, 'datastatus.brier'), formatNumber(backtest.brier, locale) ?? '—', backtest.method || null),
        factCard(locale, tx(locale, 'datastatus.baseline'), formatNumber(backtest.baseline_brier, locale) ?? '—',
          backtest.better_than_baseline ? tx(locale, 'datastatus.beats') : tx(locale, 'datastatus.notBeats')),
        factCard(locale, tx(locale, 'rhythm.paramSample'), formatNumber(backtest.sample_size, locale) ?? '—'),
      ], 'factgrid backtest-facts');

  const sourceList = sources.length
    ? tag('ul', { class: 'source-list' }, sources.map((source) => {
        const url = source.url && /^https?:\/\//.test(source.url) ? source.url : null;
        return tag('li', {}, [
          tag('span', { class: 'source-label' }, esc(sourceLabel(locale, source))),
          url
            ? tag('a', { href: url, rel: 'noopener nofollow', target: '_blank', class: 'table-link' }, esc(`${tx(locale, 'datastatus.openSource')} ↗`))
            : '',
        ].join(''));
      }).join(''))
    : tag('p', { class: 'empty' }, esc(tx(locale, 'common.unavailable')));

  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('header', { class: 'page-head' }, [
      tag('h1', {}, esc(tx(locale, 'datastatus.h1'))),
      tag('p', { class: 'lead' }, esc(tx(locale, 'datastatus.lead'))),
    ].join('')),
    leafSection(locale, { title: tx(locale, 'datastatus.freshness') }, [tag('div', {}, freshnessFacts)]),
    leafSection(locale, { title: tx(locale, 'datastatus.coverage') }, [tag('div', {}, coverageFacts)]),
    leafSection(locale, { title: tx(locale, 'datastatus.gaps'), note: tx(locale, 'datastatus.gapsNote') }, [tag('div', {}, gapTable)]),
    leafSection(locale, { title: tx(locale, 'datastatus.checks') }, [tag('div', {}, checkList)]),
    leafSection(locale, { title: tx(locale, 'datastatus.model') }, [tag('div', {}, [
      tag('p', { class: 'method-body' }, esc(tx(locale, 'datastatus.modelNote'))),
      paramRows.length
        ? tag('details', { class: 'method-details' }, [
            tag('summary', {}, esc(tx(locale, 'rhythm.paramsSummary'))),
            tag('div', { class: 'table-wrap' }, paramTable(paramRows)),
          ].join(''))
        : '',
      backtestFacts,
    ])]),
    leafSection(locale, { title: tx(locale, 'datastatus.sources') }, [tag('div', {}, [
      sourceList,
      tag('p', { class: 'field-hint' }, esc(tx(locale, 'datastatus.sourceNote'))),
    ])]),
  ].join(''));
}

/* ------------------------------------------------------------------ vigil */

function vigilBlock(locale, snap) {
  const facts = factGrid([
    factCard(locale,
      tx(locale, 'verdict.lastReset'),
      formatDateTime(snap.lastResetAt, locale) || tx(locale, 'common.unavailable'),
      zoneLabel(locale),
    ),
    snap.wait && snap.wait.median_days !== null && snap.wait.median_days !== undefined
      ? factCard(locale, tx(locale, 'home.medianInterval'), formatDays(snap.wait.median_days, locale), null, { unit: 'days' })
      : null,
  ]);
  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('header', { class: 'page-head' }, [
      tag('h1', {}, esc(tx(locale, 'vigil.h1'))),
      tag('p', { class: 'lead' }, esc(tx(locale, 'vigil.lede'))),
    ].join('')),
    leafSection(locale, { title: tx(locale, 'vigil.sleepTitle'), note: tx(locale, 'vigil.sleepNote') }, [
      facts,
      tag('p', { class: 'field-hint' }, esc(`${tx(locale, 'vigil.sleepLegend')} · ${tx(locale, 'vigil.sleepLegendQuiet')}`)),
      tag('p', { class: 'field-hint' }, esc(tx(locale, 'vigil.sleepFooter'))),
    ]),
    leafSection(locale, { title: tx(locale, 'vigil.faq') }, [faqDetails(faqItems(locale))]),
  ].join(''));
}

/* --------------------------------------------------------- permanent block */

function guideSection(locale) {
  const planCard = tag('a', { class: 'guide-card', href: locale === 'en' ? '/en/plan' : '/plan' }, [
    tag('span', { class: 'guide-card-title' }, esc(locale === 'en' ? 'The 28-day run, in retrospect' : '28 天计划复盘：Day 1–28 逐日对照')),
    tag('span', { class: 'guide-card-tagline' }, esc(locale === 'en' ? 'The run is over — every day, frozen as a record' : '活动已结束，每一天冻结成复盘')),
  ].join(''));
  const cards = [
    ['codex-reset', locale === 'en' ? 'What a reset actually means' : '三类重置到底有什么区别'],
    ['codex-5-hour-limit', locale === 'en' ? 'How the 5-hour limit is clocked' : '5 小时限额怎么算'],
    ['codex-banked-reset', locale === 'en' ? 'Banked resets, and when to spend one' : '备用额度怎么用、会不会过期'],
  ];
  const faq = label(locale, 'faq');
  const items = cards.map(([slug, tagline]) => {
    const meta = articleMeta(slug, locale);
    return tag('a', { class: 'guide-card', href: meta.path }, [
      tag('span', { class: 'guide-card-title' }, esc(meta.h1)),
      tag('span', { class: 'guide-card-tagline' }, esc(tagline)),
    ].join(''));
  }).join('');

  return tag('section', { class: 'seo-guide', id: 'seo-guide', 'aria-labelledby': 'seo-guide-title' }, [
    tag('h2', { id: 'seo-guide-title' }, esc(label(locale, 'guidesTitle'))),
    tag('p', { class: 'seo-guide-lead' }, esc(label(locale, 'guidesLead'))),
    tag('div', { class: 'guide-cards' }, planCard + items),
    tag('p', { class: 'guide-more' }, [
      tag('a', { href: articlePath('codex-quota-run-out', locale) }, esc(articleMeta('codex-quota-run-out', locale).h1)),
      tag('a', { href: articlePath('codex-reset-alert', locale) }, esc(articleMeta('codex-reset-alert', locale).h1)),
      tag('a', { href: archivePath(locale) }, esc(label(locale, 'archiveTitle'))),
    ].join('')),
    tag('h3', {}, esc(label(locale, 'faqTitle'))),
    tag('dl', { class: 'ssr-faq' }, faq.map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
  ].join(''));
}

/* -------------------------------------------------------------- assembling */

/**
 * Resolve a pathname to a route key and locale. `/rhythm` is handled here even
 * if the client route table has not learned it yet, so the SSR route never
 * depends on `seo-meta.js` shipping in the same order.
 */
function resolveRoute(pathname) {
  const resolved = shared.meta.resolvePath(pathname);
  if (resolved) return resolved;
  let path = pathname || '/';
  let locale = 'zh';
  if (path === '/en' || path.startsWith('/en/')) {
    locale = 'en';
    path = path.slice(3) || '/';
  }
  if (path.length > 1) path = path.replace(/\/+$/, '') || '/';
  if (path === '') path = '/';
  if (path === '/rhythm') return { key: 'rhythm', locale };
  return null;
}

function routeMetaFor(locale, key) {
  return shared.meta.routeMeta(key, locale);
}

function documentFor({ origin, pathname }) {
  const resolved = resolveRoute(pathname);
  if (!resolved) return null;
  const { key, locale } = resolved;
  if (key === 'rhythm') return rhythmDocument({ origin, pathname });

  const snap = data.snapshot(locale);
  const page = pageMetaFor(locale, key);
  const alternates = {
    zh: pageMetaFor('zh', key).path,
    en: pageMetaFor('en', key).path,
    xDefault: pageMetaFor('zh', key).path,
  };
  const builders = {
    home: overviewBlock,
    timeline: timelineBlock,
    status: statusBlock,
    vigil: vigilBlock,
  };
  const build = builders[key];
  if (!build) return null;
  const body = build(locale, snap, origin);
  const showGuide = key === 'home';

  const graph = [webSiteNode(origin, locale), organizationNode(origin, locale)];
  const nodeBuilders = {
    home: () => [
      {
        '@type': 'Dataset',
        name: locale === 'en' ? 'Codex reset records' : 'Codex 额度重置记录',
        description: page.description,
        url: `${origin}${pageMetaFor(locale, 'timeline').path}`,
        inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
        temporalCoverage: snap.resets.length ? `${isoDate(snap.resets[snap.resets.length - 1].at)}/` : undefined,
        isAccessibleForFree: true,
        creator: { '@type': 'Organization', name: 'Codex Reset', url: origin },
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${origin}/api/timeline`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: label(locale, 'faq').map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
    vigil: () => [
      {
        '@type': 'FAQPage',
        mainEntity: faqItems(locale).map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
    timeline: () => [
      {
        '@type': 'ItemList',
        name: page.h1,
        itemListElement: snap.records.slice(0, 20).map((reset, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: `${formatDay(reset.at, locale)} — ${plain(reset.summary, 80) || label(locale, 'kindReset')}`,
          url: reset.url || undefined,
        })),
      },
    ],
    status: () => [],
  };
  graph.push(...(nodeBuilders[key] ? nodeBuilders[key]() : []));
  graph.push({
    '@type': 'WebPage',
    '@id': `${origin}${page.path}#webpage`,
    url: `${origin}${page.path}`,
    name: page.title,
    description: page.description,
    inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
    isPartOf: { '@id': `${origin}/#website` },
    primaryImageOfPage: { '@type': 'ImageObject', url: `${origin}/og-image.png` },
  });

  const head = headBlock({
    origin,
    locale,
    title: page.title,
    description: page.description,
    canonical: page.path,
    alternates,
    jsonld: { '@context': 'https://schema.org', '@graph': graph },
  });

  return {
    status: 200,
    head,
    body: body + (showGuide ? guideSection(locale) : relatedNav(locale)),
    lang: locale === 'en' ? 'en' : 'zh-Hans',
  };
}

/* ----------------------------------------------------------- article pages */

function articleHead({ origin, locale, meta }) {
  const alternates = {
    zh: articlePath(meta.slug, 'zh'),
    en: articlePath(meta.slug, 'en'),
    xDefault: articlePath(meta.slug, 'zh'),
  };
  const graph = [
    webSiteNode(origin, locale),
    organizationNode(origin, locale),
    {
      '@type': 'Article',
      '@id': `${origin}${meta.path}#article`,
      headline: meta.h1,
      description: meta.description,
      inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
      datePublished: meta.updated,
      dateModified: meta.updated,
      mainEntityOfPage: { '@id': `${origin}${meta.path}` },
      author: { '@type': 'Organization', name: 'Codex Reset', url: origin },
      publisher: { '@type': 'Organization', name: 'Codex Reset', url: origin },
      about: { '@type': 'Thing', name: 'OpenAI Codex' },
    },
    breadcrumb(origin, locale, [
      { name: locale === 'en' ? 'Overview' : '概览', path: locale === 'en' ? '/en/' : '/' },
      { name: label(locale, 'guideIndex'), path: locale === 'en' ? '/en/guide/' : '/guide/' },
      { name: meta.h1, path: meta.path },
    ]),
    {
      '@type': 'FAQPage',
      mainEntity: meta.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];
  return headBlock({
    origin,
    locale,
    title: meta.title,
    description: meta.description,
    canonical: meta.path,
    alternates,
    jsonld: { '@context': 'https://schema.org', '@graph': graph },
  });
}

function articleBody({ origin, locale, meta }) {
  const sections = meta.sections
    .map((section) =>
      tag('section', { class: 'doc-section' }, [
        tag('h2', {}, esc(section.h2)),
        ...(section.paragraphs || []).map((paragraph) => tag('p', {}, esc(paragraph))),
        section.list ? tag('ul', {}, section.list.map((item) => tag('li', {}, esc(item))).join('')) : '',
      ].join('')),
    )
    .join('');

  const faq = tag('section', { class: 'doc-section' }, [
    tag('h2', {}, esc(label(locale, 'faqTitle'))),
    tag('dl', { class: 'doc-faq' }, meta.faq.map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
  ].join(''));

  const sources = tag('section', { class: 'doc-sources' }, [
    tag('h2', {}, esc(label(locale, 'sourcesTitle'))),
    tag('ul', {}, meta.sources.map((source) => tag('li', {}, tag('a', { href: source.url, rel: 'noopener nofollow', target: '_blank' }, esc(source.label)))).join('')),
  ].join(''));

  const related = tag('aside', { class: 'doc-related' }, [
    tag('h2', {}, esc(label(locale, 'relatedTitle'))),
    tag('ul', {}, [
      ...meta.related.map((slug) => articleMeta(slug, locale)).filter(Boolean).map((entry) => tag('li', {}, tag('a', { href: entry.path }, esc(entry.h1)))),
      tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(navLabel(locale, 'timeline')))),
    ].join('')),
  ].join(''));

  const nav = primaryNav(locale);

  return [
    tag('a', { class: 'skip-link', href: '#doc' }, esc(label(locale, 'skip'))),
    tag('header', { class: 'masthead' }, tag('div', { class: 'masthead-inner' }, [
      tag('a', { class: 'wordmark', href: locale === 'en' ? '/en/' : '/', 'aria-label': 'Codex Reset' }, [
        tag('span', { class: 'wordmark-mark', 'aria-hidden': 'true' }, ''),
        tag('span', { class: 'wordmark-text' }, 'Codex Reset'),
      ].join('')),
      tag('nav', { class: 'masthead-nav', 'aria-label': label(locale, 'nav').home }, nav),
    ].join(''))),
    tag('main', { class: 'page doc', id: 'doc', tabindex: '-1' }, [
      tag('nav', { class: 'doc-crumbs', 'aria-label': label(locale, 'breadcrumb') },
        tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'nav').home)) + ' / ' + tag('span', {}, esc(label(locale, 'guideIndex'))),
      ),
      tag('article', { class: 'doc-article' }, [
        tag('h1', {}, esc(meta.h1)),
        tag('p', { class: 'doc-lead' }, esc(meta.lead)),
        tag('p', { class: 'doc-updated' }, `${label(locale, 'articleUpdated')} ${meta.updated}`),
        sections,
        faq,
        sources,
        related,
      ].join('')),
    ].join('')),
    tag('footer', { class: 'colophon' }, tag('div', { class: 'colophon-inner' }, [
      tag('p', { class: 'colophon-note' }, esc(label(locale, 'official'))),
      tag('p', { class: 'colophon-source' }, esc(label(locale, 'dataNote'))),
    ].join(''))),
  ].join('');
}

function articleDocument({ origin, pathname }) {
  const found = slugFromPath(pathname);
  if (!found) return null;
  const meta = articleMeta(found.slug, found.locale);
  const head = articleHead({ origin, locale: found.locale, meta });
  const body = articleBody({ origin, locale: found.locale, meta });
  return {
    status: 200,
    head,
    headExtra: [
      voidTag('meta', { name: 'theme-color', content: '#f5f6f8' }),
      voidTag('link', { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/tokens.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/base.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/shell.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/seo.css' }),
    ].join('\n'),
    // Standalone document: no client router, no polling.
    body,
    lang: found.locale === 'en' ? 'en' : 'zh-Hans',
    standalone: true,
  };
}

/* ----------------------------------------------------------------- about */

const ABOUT = {
  zh: {
    path: '/about',
    title: '关于 Codex Reset：数据来源、判定标准与已知限制',
    description:
      'Codex Reset 是一个个人做的非官方项目，追踪 OpenAI Codex 的额度重置。这里说明数据从哪里来、一次重置是怎么判定「已确认」的、更新频率，以及已知的限制。',
    h1: '关于 Codex Reset',
    lead: '这是一个个人维护的非官方项目，追踪 OpenAI Codex 的全局额度重置。下面把数据来源、判定口径和已知限制写清楚，方便你自己判断这些数字能信到什么程度。',
    sections: [
      {
        h2: '这是什么',
        paragraphs: [
          'Codex Reset 记录 OpenAI Codex 的全局额度重置，并给出未来 24 与 48 小时的重置概率。所有记录来自本站自己维护的一份公开台账：每一条都附有公开的 X 原帖链接，可以从台账一路追溯回原始发言。',
          '站点分为三层：概览给结论（概率、区间、置信度、等待对比与高频窗口），重置节奏页给间隔与时段分布，重置记录页给完整时间线。另外还有数据状态页（台账覆盖与自检）、28 天计划复盘和几篇中英文说明。',
        ],
      },
      {
        h2: '数据从哪里来',
        list: [
          '仓库里的 data/ledger.json：维护者人工整理的公开事件台账，每条带 source_url，指向公开的 X 原帖。',
          '仓库里的 data/posts.json：28 天活动期间逐日更新的冻结档案，供 /plan 复盘使用。',
          '仓库里的 data/meta.json：覆盖范围与来源摘要。',
          'lib/model.js：概率、区间、回测全部在本地计算，不依赖任何外部服务。',
        ],
        paragraphs: [
          '站点只读公开数据，不登录任何账号，也读不到任何人的个人额度；运行时不会请求任何第三方接口。',
        ],
      },
      {
        h2: '一次重置是怎么被判定为「已确认」的',
        paragraphs: [
          '台账里区分 announced（已宣布）与 confirmed（已确认）两种状态，只有 confirmed 的重置才会进入概率样本。',
          '一条「今天会重置」的公开承诺先记为 announced；等公开帖明确说已经重置，才改为 confirmed。本站不做账号级观测，只记录公开原帖。没有确认的条目会一直保留 announced 标记，并在概览里单独提示。',
        ],
      },
      {
        h2: '更新频率与口径',
        list: [
          '页面数据来自仓库台账，随发布部署更新；台账最后更新时间写在数据状态页上。',
          '具体时间按访问者时区显示；概率与高频窗口按 UTC 计算，并明确标注 UTC。',
          '28 天活动的活动日按美国太平洋时间编号，不随访问者时区移动。',
          '概率是历史节奏模型的估计，带区间与置信度，不代表 OpenAI 的承诺。',
        ],
      },
      {
        h2: '已知限制',
        list: [
          '看不到任何个人账号的额度余量，那只能在自己的「设置 → 用量」或 CLI 的 /usage 里看。',
          '台账由人工整理，极端情况下可能比原帖晚一段时间收录。',
          '浏览器提醒依赖页面自身的轮询，页面关闭或设备休眠时不会触发。',
          '数据缺口不填补、不推断；覆盖范围与缺口都写在数据状态页上。',
          '这是个人项目，出问题没有 SLA；与 OpenAI 没有任何关系。',
        ],
      },
      {
        h2: '联系方式',
        paragraphs: [
          '这个站是开源的，代码在 github.com/chendaleiQ/codex-reset（MIT 许可）：发现问题可以直接提 issue，或者对着源码看数字是怎么算的。判断上的分歧也可以直接在 X 上找 @thsottiaux 的原始帖子核对。',
        ],
      },
    ],
  },
  en: {
    path: '/en/about',
    title: 'About Codex Reset — Sources, Method and Limitations',
    description:
      'Codex Reset is an unofficial personal project that tracks OpenAI Codex quota resets. Where the data comes from, how a reset is marked confirmed, how often it updates, and the known limits.',
    h1: 'About Codex Reset',
    lead: 'This is an unofficial project maintained by one person. Below is where the data comes from, how a reset is judged, and what the numbers cannot tell you.',
    sections: [
      {
        h2: 'What this is',
        paragraphs: [
          'Codex Reset records global quota resets for OpenAI Codex and estimates the probability of the next one over 24 and 48 hours. Every record comes from a public ledger this site maintains itself: each row carries a link to the public post on X it came from, so any number can be traced back to the original statement.',
          'The site has three layers: the overview gives the verdict (probability, range, confidence, wait comparison and the most likely window), the rhythm page gives intervals and hours, and the history page gives the full timeline. There is also a data-status page (coverage and self-checks), a 28-day retrospective and a handful of explainers in both languages.',
        ],
      },
      {
        h2: 'Where the data comes from',
        list: [
          'data/ledger.json in the repository — the hand-maintained public ledger, every row carrying a source_url pointing at a public post on X.',
          'data/posts.json — the frozen day-by-day archive of the 28-day run, used by the /plan retrospective.',
          'data/meta.json — coverage and source summary.',
          'lib/model.js — probabilities, ranges and backtests are all computed locally, with no external service.',
        ],
        paragraphs: ['The site reads public data only: it never signs into an account, cannot see anyone’s private allowance, and makes no third-party requests at runtime.'],
      },
      {
        h2: 'How a reset becomes “confirmed”',
        paragraphs: [
          'The ledger separates announced from confirmed, and only confirmed resets enter the probability sample.',
          'A public “reset is coming” post is recorded as announced. It flips to confirmed once its event time is pinned down and public evidence shows it actually landed. Anything without confirmation keeps the announced mark and is called out separately on the overview.',
        ],
      },
      {
        h2: 'Cadence and conventions',
        list: [
          'Page data comes from the repository ledger and updates with each release; the last ledger update is printed on the data-status page.',
          'Exact times follow the visitor’s timezone; probabilities and windows are computed in UTC and labelled as such.',
          '28-day activity days are numbered in Pacific Time and never shift with the visitor’s timezone.',
          'Probabilities are cadence-model estimates with a range and a confidence level, not OpenAI commitments.',
        ],
      },
      {
        h2: 'Known limitations',
        list: [
          'It cannot read your personal allowance — that lives in Settings → Usage or /usage in the CLI.',
          'The ledger is maintained by hand, so in rare cases an entry can lag the original post.',
          'Browser alerts depend on the page polling; they do not fire with the page closed or the device asleep.',
          'Gaps are never filled in or inferred; coverage and gaps are both printed on the data-status page.',
          'One person runs this. There is no SLA, and there is no affiliation with OpenAI.',
        ],
      },
      {
        h2: 'Contact',
        paragraphs: ['Corrections and questions: open an issue on GitHub (chendaleiQ), or check the original post from @thsottiaux on X.'],
      },
    ],
  },
};

function aboutDocument({ origin, pathname }) {
  const locale = pathname.startsWith('/en') ? 'en' : 'zh';
  const copy = ABOUT[locale];
  const alternates = { zh: ABOUT.zh.path, en: ABOUT.en.path, xDefault: ABOUT.zh.path };
  const head = headBlock({
    origin,
    locale,
    title: copy.title,
    description: copy.description,
    canonical: copy.path,
    alternates,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${origin}/#organization`,
          name: 'Codex Reset',
          url: `${origin}${locale === 'en' ? '/en/' : '/'}`,
          logo: `${origin}/icon-512.png`,
          description: copy.description,
          sameAs: ['https://github.com/chendaleiQ', 'https://x.com/thsottiaux'],
          codeRepository: 'https://github.com/chendaleiQ/codex-reset',
        },
        {
          '@type': 'AboutPage',
          url: `${origin}${copy.path}`,
          name: copy.title,
          description: copy.description,
          inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
          isPartOf: { '@id': `${origin}/#website` },
          about: { '@type': 'Organization', '@id': `${origin}/#organization` },
        },
        breadcrumb(origin, locale, [
          { name: locale === 'en' ? 'Overview' : '概览', path: locale === 'en' ? '/en/' : '/' },
          { name: copy.h1, path: copy.path },
        ]),
      ],
    },
  });

  const sections = copy.sections
    .map((section) =>
      tag('section', { class: 'doc-section' }, [
        tag('h2', {}, esc(section.h2)),
        ...(section.paragraphs || []).map((paragraph) => tag('p', {}, esc(paragraph))),
        section.list ? tag('ul', {}, section.list.map((item) => tag('li', {}, esc(item))).join('')) : '',
      ].join('')),
    )
    .join('');

  const main = tag('main', { class: 'page doc', id: 'doc', tabindex: '-1' }, [
    tag('nav', { class: 'doc-crumbs', 'aria-label': label(locale, 'breadcrumb') },
      tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'nav').home)) + ' / ' + tag('span', {}, esc(copy.h1)),
    ),
    tag('h1', {}, esc(copy.h1)),
    tag('p', { class: 'doc-lead' }, esc(copy.lead)),
    sections,
    tag('aside', { class: 'doc-related' }, [
      tag('h2', {}, esc(label(locale, 'relatedTitle'))),
      tag('ul', {}, [
        tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(navLabel(locale, 'timeline')))),
        tag('li', {}, tag('a', { href: locale === 'en' ? '/en/plan' : '/plan' }, esc(locale === 'en' ? 'The 28-day retrospective' : '28 天计划复盘'))),
        tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
        tag('li', {}, tag('a', { href: 'https://github.com/chendaleiQ/codex-reset', rel: 'noopener' }, esc(locale === 'en' ? 'Source code (GitHub)' : '源码（GitHub，MIT）'))),
      ].join('')),
    ].join('')),
  ].join(''));

  const shell = docShell(locale, main);
  return { status: 200, head, headExtra: shell.headExtra, body: shell.body, lang: shell.lang, standalone: true };
}

/* ------------------------------------------------------------ 28-day plan */

/** Calendar date in Tibo's timezone — the day numbering never moves. */
function pacificDate(value) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shortDate(dateString, locale) {
  const time = Date.parse(`${dateString}T12:00:00Z`);
  if (!Number.isFinite(time)) return dateString || '';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    timeZone: 'UTC',
    month: locale === 'en' ? 'short' : 'long',
    day: 'numeric',
  }).format(new Date(time));
}

const PLAN = {
  zh: {
    path: '/plan',
    title: 'Codex 28 天计划复盘：Day 1–28 已结束的完整记录',
    description:
      'Tibo 的 Codex 28 天更新计划已经结束：Day 1–28 的完整复盘表，哪几天是重置、哪几天是产品更新、哪几天没有公开记录，以及活动结束后该看哪里。',
    h1: 'Codex 28 天计划复盘：Day 1–28',
    lead: '2026 年 10 月 5 日到 11 月 1 日，Tibo 连续 28 天发布更新或重置。活动已经结束，这一页就冻结成复盘：哪几天是重置、哪几天是产品更新、哪几天我们没找到公开记录。',
    badge: '已结束 · 2026-11-01',
    day: 'Day',
    date: '日期（PT）',
    what: '当天内容',
    missing: '无公开记录',
    reset: '重置',
    update: '产品更新',
    banked: '备用额度',
    stats: [
      ['活动时间', '{start} – {end}'],
      ['有内容的天数', '{n} / 28 天'],
      ['其中重置', '{n} 次'],
    ],
    afterTitle: '之后看哪里',
    afterBody: '活动结束后不再有每日更新；想看下一次重置大概什么时候来，去这两页：',
    afterRhythm: '重置节奏：间隔与最容易重置的时段',
    afterTimeline: '重置记录：完整时间线',
    faqTitle: '关于这次复盘',
    faq: [
      {
        q: '这个 28 天计划是什么？',
        a: 'Tibo 在 2026 年 10 月初宣布，用 28 天每天发一次 Codex 更新或额度重置。活动从 10 月 5 日持续到 11 月 1 日，Day 1–28 按美国太平洋时间编号，不随访问者时区移动。',
      },
      {
        q: '之后还有每日更新吗？',
        a: '没有了。28 天活动已经在 2026 年 11 月 1 日结束，这一页只作为复盘保留。站点现在持续跟踪重置节奏，想看下一次大概什么时候来，去重置节奏页。',
      },
      {
        q: '为什么有的天没有内容？',
        a: '我们只收录有公开来源的记录。没找到公开来源的日子就写「无公开记录」，不猜也不补。',
      },
    ],
    note: '活动日按 Tibo 的编号；表里的时间是公告时间。只收公开可追溯的记录。',
  },
  en: {
    path: '/en/plan',
    title: 'Codex 28-Day Plan Retrospective: Days 1–28, Complete Record',
    description:
      'The Codex 28-day run announced by Tibo is over. A day-by-day retrospective of Day 1–28: which days were resets, which were product updates, which have no public record, and where to look next.',
    h1: 'The Codex 28-day plan: a retrospective',
    lead: 'From 5 October to 1 November 2026, Tibo shipped something every day for 28 days. The run is over, so this page is frozen as a retrospective: which days were resets, which were product updates, and which have no public record.',
    badge: 'Ended · 2026-11-01',
    day: 'Day',
    date: 'Date (PT)',
    what: 'What landed',
    missing: 'No public record',
    reset: 'Reset',
    update: 'Product update',
    banked: 'Banked',
    stats: [
      ['Run window', '{start} – {end}'],
      ['Days with a record', '{n} / 28 days'],
      ['Of which resets', '{n}'],
    ],
    afterTitle: 'Where to look now',
    afterBody: 'There are no daily updates any more. To see when the next reset is likely, start here:',
    afterRhythm: 'Reset rhythm: gaps and the busiest hours',
    afterTimeline: 'Reset history: the full timeline',
    faqTitle: 'About this retrospective',
    faq: [
      {
        q: 'What was the Codex 28-day plan?',
        a: 'In early October 2026 Tibo announced a run of 28 consecutive days of shipping, one Codex update or quota reset a day. It ran from 5 October to 1 November 2026, numbered Day 1–28 in Pacific Time so it never shifts with the visitor’s timezone.',
      },
      {
        q: 'Are there still daily updates?',
        a: 'No. The 28-day run ended on 1 November 2026 and this page is kept as a retrospective only. The site now tracks the reset rhythm continuously — the rhythm page is where to look for the next likely window.',
      },
      {
        q: 'Why do some days have nothing?',
        a: 'Only days with a public source are recorded. A day without a public source says “no public record”; nothing is guessed or filled in.',
      },
    ],
    note: 'Activity days follow Tibo’s own numbering; times above are announcement times. Only public, traceable records are kept.',
  },
};

/**
 * Day-by-day rows for the retrospective. Data is `snapshot().posts` (the frozen
 * 28-day archive) merged with the ledger, deduplicated by Pacific date; the Day
 * number is always derived from the date, never read from the archive.
 */
function planRows(locale) {
  const snap = data.snapshot(locale);
  const archive = snap.posts && Array.isArray(snap.posts.posts) ? snap.posts.posts : [];
  const total = Number(snap.posts && snap.posts.days) || 28;
  const startDate = (snap.posts && snap.posts.startDate) || '2026-10-05';
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const dateOfDay = (index) => new Date(start + (index - 1) * 86_400_000).toISOString().slice(0, 10);
  const dayOfDate = (date) => {
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time)) return null;
    const number = Math.round((time - start) / 86_400_000) + 1;
    return number >= 1 && number <= total ? number : null;
  };
  const byDay = new Map();
  const push = (day, item, dedupe) => {
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    const bucket = byDay.get(day);
    if (dedupe && bucket.some((existing) => existing.dedupe === dedupe)) return;
    bucket.push({ ...item, dedupe });
  };

  for (const post of archive) {
    const day = dayOfDate(pacificDate(post.at));
    if (!day) continue;
    const text = locale === 'en' ? post.en || post.zh || '' : post.zh || post.en || '';
    if (!text) continue;
    push(day, { kind: 'update', text, url: post.url || null }, `post:${post.at}`);
  }
  for (const event of Array.isArray(snap.events) ? snap.events : []) {
    const day = dayOfDate(pacificDate(event.at));
    if (!day) continue;
    if (event.type !== 'reset' && event.type !== 'credits') continue;
    const kind = event.type === 'reset' ? (event.pending ? 'pending' : 'reset') : 'banked';
    push(day, { kind, text: '', url: event.url || null }, `event:${event.at}:${kind}`);
  }
  for (const list of byDay.values()) list.sort((a, b) => (a.kind === 'update' ? 1 : 0) - (b.kind === 'update' ? 1 : 0));

  const all = [...byDay.values()].flat();
  return {
    total,
    startDate,
    endDate: dateOfDay(total),
    dateOfDay,
    byDay,
    recordedDays: byDay.size,
    resetCount: all.filter((item) => item.kind === 'reset').length,
    snap,
  };
}

function planDocument({ origin, pathname }) {
  const locale = pathname.startsWith('/en/') ? 'en' : 'zh';
  const copy = PLAN[locale];
  const { total, startDate, endDate, dateOfDay, byDay, recordedDays, resetCount } = planRows(locale);
  const sourceLinkText = `${tx(locale, 'datastatus.openSource')} ↗`;

  const kindOf = (item) => {
    if (item.kind === 'reset') return copy.reset;
    if (item.kind === 'pending') return copy.reset;
    if (item.kind === 'banked') return copy.banked;
    return copy.update;
  };

  const rows = [];
  for (let index = 1; index <= total; index += 1) {
    const date = dateOfDay(index);
    const items = byDay.get(index) || [];
    const cell = tag('td', {}, items.length
      ? items.map((item) => {
          const kind = tag('span', { class: 'plan-kind' }, esc(kindOf(item)));
          if (item.kind === 'update') {
            const text = plain(item.text, 120);
            return `${kind}${text ? ` ${tag('span', { lang: textLang(text, locale) }, esc(text))}` : ''}`;
          }
          const url = item.url && /^https?:\/\//.test(item.url) ? item.url : null;
          return `${kind}${url ? ` ${tag('a', { href: url, rel: 'noopener nofollow', target: '_blank', class: 'table-link' }, esc(sourceLinkText))}` : ''}`;
        }).join('<br>')
      : tag('span', { class: 'muted' }, esc(copy.missing)));
    rows.push(tag('tr', items.length ? {} : { class: 'plan-empty' }, [
      tag('td', {}, String(index)),
      tag('td', {}, tag('time', { datetime: date }, esc(shortDate(date, locale)))),
      cell,
    ].join('')));
  }

  const stats = factGrid(copy.stats.map(([name, template], index) => factCard(locale, name, template
    .replace('{start}', shortDate(startDate, locale))
    .replace('{end}', shortDate(endDate, locale))
    .replace('{n}', String(index === 2 ? resetCount : recordedDays)))));

  const after = leafSection(locale, { title: copy.afterTitle }, [
    tag('p', {}, esc(copy.afterBody)),
    tag('div', { class: 'method-links' }, [
      tag('a', { class: 'chit', href: pageMetaFor(locale, 'rhythm').path }, esc(copy.afterRhythm)),
      tag('a', { class: 'chit', href: pageMetaFor(locale, 'timeline').path }, esc(copy.afterTimeline)),
    ].join('')),
  ]);

  const alternates = { zh: PLAN.zh.path, en: PLAN.en.path, xDefault: PLAN.zh.path };
  const head = headBlock({
    origin,
    locale,
    title: copy.title,
    description: copy.description,
    canonical: copy.path,
    alternates,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        webSiteNode(origin, locale),
        organizationNode(origin, locale),
        {
          '@type': 'WebPage',
          url: `${origin}${copy.path}`,
          name: copy.title,
          description: copy.description,
          inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
          isPartOf: { '@id': `${origin}/#website` },
        },
        {
          '@type': 'ItemList',
          name: copy.h1,
          numberOfItems: total,
          itemListElement: Array.from({ length: total }, (unused, offset) => ({
            '@type': 'ListItem',
            position: offset + 1,
            name: `${copy.day} ${offset + 1} — ${shortDate(dateOfDay(offset + 1), locale)}`,
          })),
        },
        {
          '@type': 'FAQPage',
          mainEntity: copy.faq.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        },
      ],
    },
  });

  const body = [
    tag('a', { class: 'skip-link', href: '#doc' }, esc(tx(locale, 'nav.skip'))),
    tag('header', { class: 'masthead' }, tag('div', { class: 'masthead-inner' }, [
      tag('a', { class: 'wordmark', href: locale === 'en' ? '/en/' : '/', 'aria-label': 'Codex Reset' }, [
        tag('span', { class: 'wordmark-mark', 'aria-hidden': 'true' }, ''),
        tag('span', { class: 'wordmark-text' }, 'Codex Reset'),
      ].join('')),
      tag('nav', { class: 'masthead-nav', 'aria-label': tx(locale, 'nav.home') }, primaryNav(locale)),
    ].join(''))),
    tag('main', { class: 'page doc', id: 'doc', tabindex: '-1' }, [
      tag('nav', { class: 'doc-crumbs', 'aria-label': label(locale, 'breadcrumb') },
        tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(tx(locale, 'nav.home'))) + ' / ' + tag('span', {}, 'Day 1–28'),
      ),
      tag('header', { class: 'page-head plan-hero' }, [
        tag('p', { class: 'verdict-eyebrow' }, esc(locale === 'en' ? '28-DAY RETROSPECTIVE' : '28 天计划复盘')),
        tag('h1', {}, esc(copy.h1)),
        tag('p', { class: 'plan-badge' }, esc(copy.badge)),
        tag('p', { class: 'lead' }, esc(copy.lead)),
      ].join('')),
      stats,
      tag('div', { class: 'table-wrap' }, tag('table', { class: 'data-table plan-table', 'aria-label': copy.h1 }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', {}, esc(copy.day)),
          tag('th', {}, esc(copy.date)),
          tag('th', {}, esc(copy.what)),
        ].join(''))),
        tag('tbody', {}, rows.join('')),
      ].join(''))),
      tag('p', { class: 'note' }, esc(copy.note)),
      after,
      tag('section', { class: 'doc-section' }, [
        tag('h2', {}, esc(copy.faqTitle)),
        faqDetails(copy.faq),
      ].join('')),
      tag('aside', { class: 'doc-related' }, [
        tag('h2', {}, esc(label(locale, 'relatedTitle'))),
        tag('ul', {}, [
          tag('li', {}, tag('a', { href: pageMetaFor(locale, 'rhythm').path }, esc(tx(locale, 'nav.rhythm')))),
          tag('li', {}, tag('a', { href: pageMetaFor(locale, 'timeline').path }, esc(tx(locale, 'nav.timeline')))),
          tag('li', {}, tag('a', { href: pageMetaFor(locale, 'status').path }, esc(tx(locale, 'nav.status')))),
          tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
          tag('li', {}, tag('a', { href: 'https://github.com/chendaleiQ/codex-reset', rel: 'noopener' }, esc(locale === 'en' ? 'Source code (GitHub)' : '源码（GitHub，MIT）'))),
        ].join('')),
      ].join('')),
    ].join('')),
    tag('footer', { class: 'colophon' }, tag('div', { class: 'colophon-inner' }, [
      tag('p', { class: 'colophon-note' }, esc(label(locale, 'official'))),
      tag('p', { class: 'colophon-source' }, esc(label(locale, 'dataNote'))),
    ].join(''))),
  ].join('');

  return {
    status: 200,
    head,
    headExtra: [
      voidTag('meta', { name: 'theme-color', content: '#f5f6f8' }),
      voidTag('link', { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/tokens.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/base.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/shell.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/components.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/pages.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/seo.css' }),
    ].join('\n'),
    body,
    lang: locale === 'en' ? 'en' : 'zh-Hans',
    standalone: true,
  };
}

/* --------------------------------------------------------- monthly archive */

/** `YYYY-MM` for a timestamp in the locale's display timezone. */
function localMonth(value, locale) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zoneFor(locale),
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(time));
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

function monthLabel(month, locale) {
  const [year, monthNumber] = String(month || '').split('-');
  const date = new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1, 12));
  if (!Number.isFinite(date.getTime())) return month;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Every month that has at least one record, newest first. */
function archiveMonths(locale) {
  const snap = data.snapshot(locale);
  const counts = new Map();
  for (const record of snap.records) {
    const month = localMonth(record.at, locale);
    if (!month) continue;
    counts.set(month, (counts.get(month) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, count]) => ({ month, count }));
}

function archivePath(locale, month) {
  const prefix = locale === 'en' ? '/en' : '';
  return month ? `${prefix}/archive/${month}` : `${prefix}/archive`;
}

function docShell(locale, mainHtml, extraHead) {
  const nav = primaryNav(locale);
  const body = [
    tag('a', { class: 'skip-link', href: '#doc' }, esc(label(locale, 'skip'))),
    tag('header', { class: 'masthead' }, tag('div', { class: 'masthead-inner' }, [
      tag('a', { class: 'wordmark', href: locale === 'en' ? '/en/' : '/', 'aria-label': 'Codex Reset' }, [
        tag('span', { class: 'wordmark-mark', 'aria-hidden': 'true' }, ''),
        tag('span', { class: 'wordmark-text' }, 'Codex Reset'),
      ].join('')),
      tag('nav', { class: 'masthead-nav', 'aria-label': label(locale, 'nav').home }, nav),
    ].join(''))),
    mainHtml,
    tag('footer', { class: 'colophon' }, tag('div', { class: 'colophon-inner' }, [
      tag('p', { class: 'colophon-note' }, esc(label(locale, 'official'))),
      tag('p', { class: 'colophon-source' }, esc(label(locale, 'dataNote'))),
    ].join(''))),
  ].join('');
  return {
    head: null,
    headExtra: [
      voidTag('meta', { name: 'theme-color', content: '#f5f6f8' }),
      voidTag('link', { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/tokens.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/base.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/shell.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/seo.css' }),
    ].join('\n'),
    body,
    lang: locale === 'en' ? 'en' : 'zh-Hans',
    standalone: true,
    extraHead,
  };
}

function archiveIndexDocument({ origin, pathname }) {
  const locale = pathname.startsWith('/en/') ? 'en' : 'zh';
  const months = archiveMonths(locale);
  const copyTitle = locale === 'en' ? 'Codex reset archive by month' : 'Codex 重置记录：按月归档';
  const copyDescription =
    locale === 'en'
      ? 'Every month of Codex reset records on its own page: the announcement time, the type of entry (reset, pending or banked) and the gap from the previous reset, kept in Pacific Time.'
      : '按月查看 Codex 额度重置的完整记录：每个月的重置公告时间、类型（重置、待确认或备用额度）以及与上一次重置之间的间隔，时间统一按北京时间显示。';

  const head = headBlock({
    origin,
    locale,
    title: copyTitle,
    description: copyDescription,
    canonical: archivePath(locale),
    alternates: { zh: archivePath('zh'), en: archivePath('en'), xDefault: archivePath('zh') },
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        webSiteNode(origin, locale),
        {
          '@type': 'CollectionPage',
          url: `${origin}${archivePath(locale)}`,
          name: copyTitle,
          description: copyDescription,
          inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
        },
        {
          '@type': 'ItemList',
          name: copyTitle,
          itemListElement: months.map((entry, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: monthLabel(entry.month, locale),
            url: `${origin}${archivePath(locale, entry.month)}`,
          })),
        },
      ],
    },
  });

  const rows = months.length
    ? tag('ul', { class: 'archive-list' }, months.map((entry) =>
        tag('li', {}, [
          tag('a', { href: archivePath(locale, entry.month) }, esc(monthLabel(entry.month, locale))),
          tag('span', { class: 'archive-count' }, esc(`${entry.count}`)),
        ].join('')),
      ).join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'archiveEmpty')));

  const main = tag('main', { class: 'page doc', id: 'doc', tabindex: '-1' }, [
    tag('nav', { class: 'doc-crumbs', 'aria-label': label(locale, 'breadcrumb') },
      tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'nav').home)) + ' / ' + tag('span', {}, esc(label(locale, 'archiveTitle'))),
    ),
    tag('h1', {}, esc(label(locale, 'archiveTitle'))),
    tag('p', { class: 'doc-lead' }, esc(label(locale, 'archiveLead'))),
    tag('p', {}, esc(locale === 'en'
      ? 'A reset announcement and a landed reset are different records: an entry marked pending has been announced but not yet confirmed by a public post. Banked grants are not resets either — they are allowances an account redeems manually. Every month below is a page of its own, and the live overview always carries the most recent one.'
      : '重置公告和已经生效的重置是两种记录：标记为待确认的条目只代表公告已经发出，还没有公开帖明确说它落地。备用额度也不算一次重置，它是账号里可以手动使用的一次额度发放。下面每个月的记录都是独立页面，最新一条始终在概览页上。')),
    rows,
    tag('aside', { class: 'doc-related' }, [
      tag('h2', {}, esc(label(locale, 'relatedTitle'))),
      tag('ul', {}, [
        tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(navLabel(locale, 'timeline')))),
        tag('li', {}, tag('a', { href: locale === 'en' ? '/en/plan' : '/plan' }, esc(locale === 'en' ? 'The 28-day retrospective' : '28 天计划复盘'))),
        tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
        tag('li', {}, tag('a', { href: 'https://github.com/chendaleiQ/codex-reset', rel: 'noopener' }, esc(locale === 'en' ? 'Source code (GitHub)' : '源码（GitHub，MIT）'))),
      ].join('')),
    ].join('')),
  ].join(''));

  const shell = docShell(locale, main);
  return { status: 200, head, headExtra: shell.headExtra, body: shell.body, lang: shell.lang, standalone: true };
}

function archiveMonthEntries(locale) {
  const snap = data.snapshot(locale);
  const grouped = new Map();
  for (const record of snap.records) {
    const month = localMonth(record.at, locale);
    if (!month) continue;
    if (!grouped.has(month)) grouped.set(month, []);
    grouped.get(month).push(record);
  }
  for (const list of grouped.values()) list.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  return grouped;
}

function archiveMonthDocument({ origin, pathname }) {
  const match = /^(?:\/en)?\/archive\/(\d{4}-\d{2})\/?$/.exec(pathname || '');
  if (!match) return null;
  const locale = pathname.startsWith('/en/') ? 'en' : 'zh';
  const month = match[1];
  const grouped = archiveMonthEntries(locale);
  const records = grouped.get(month);
  if (!records || !records.length) return null;

  const months = [...grouped.keys()].sort((a, b) => (a < b ? 1 : -1));
  const index = months.indexOf(month);
  const newer = index > 0 ? months[index - 1] : null;
  const older = index < months.length - 1 ? months[index + 1] : null;

  const title = label(locale, 'archiveH1')
    .replace('{year}', month.slice(0, 4))
    .replace('{month}', locale === 'en' ? monthLabel(month, 'en').split(' ')[0] : String(Number(month.slice(5, 7))));
  const description =
    locale === 'en'
      ? `Codex reset records for ${monthLabel(month, 'en')}: ${records.length} entries with times, types and intervals.`
      : `${monthLabel(month, 'zh')}的 Codex 额度重置记录：共 ${records.length} 条，含时间、类型与间隔。`;

  const resetCount = records.filter((record) => record.type === 'reset').length;
  const head = headBlock({
    origin,
    locale,
    title: `${title} — Codex Reset`,
    description,
    canonical: archivePath(locale, month),
    alternates: {
      zh: archivePath('zh', month),
      en: archivePath('en', month),
      xDefault: archivePath('zh', month),
    },
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        webSiteNode(origin, locale),
        {
          '@type': 'WebPage',
          url: `${origin}${archivePath(locale, month)}`,
          name: title,
          description,
          inLanguage: locale === 'en' ? 'en' : 'zh-Hans',
          datePublished: `${month}-01`,
        },
        {
          '@type': 'ItemList',
          name: title,
          itemListElement: records.map((record, position) => ({
            '@type': 'ListItem',
            position: position + 1,
            name: `${formatDateTime(record.at, locale)} — ${plain(record.summary, 80) || label(locale, 'kindReset')}`,
          })),
        },
      ],
    },
  });

  const rows = records.map((record) => {
    const kind =
      record.type === 'reset'
        ? record.pending
          ? label(locale, 'pending')
          : label(locale, 'kindReset')
        : record.type === 'credits' || record.type === 'boost' || record.type === 'unlock'
          ? label(locale, 'kindBanked')
          : label(locale, 'kindOther');
    return tag('tr', {}, [
      tag('td', {}, tag('time', { datetime: isoStamp(record.at) || '' }, esc(formatDateTime(record.at, locale)))),
      tag('td', {}, esc(kind)),
      tag('td', { lang: textLang(record.summary, locale) }, esc(plain(record.summary, 200) || '—')),
    ].join(''));
  }).join('');

  const main = tag('main', { class: 'page doc', id: 'doc', tabindex: '-1' }, [
    tag('nav', { class: 'doc-crumbs', 'aria-label': label(locale, 'breadcrumb') }, [
      tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'nav').home)),
      ' / ',
      tag('a', { href: archivePath(locale) }, esc(label(locale, 'archiveTitle'))),
      ' / ',
      tag('span', {}, esc(monthLabel(month, locale))),
    ].join('')),
    tag('h1', {}, esc(title)),
    tag('p', { class: 'doc-lead' }, esc(
      locale === 'en'
        ? `${monthLabel(month, 'en')}: ${records.length} records, ${resetCount} of them reset announcements.`
        : `${monthLabel(month, 'zh')}共记录 ${records.length} 条，其中重置 ${resetCount} 条。`,
    )),
    tag('table', { class: 'ssr-table' }, [
      tag('thead', {}, tag('tr', {}, [
        tag('th', { scope: 'col' }, esc(locale === 'en' ? 'Time (PT)' : '时间（北京时间）')),
        tag('th', { scope: 'col' }, esc(label(locale, 'tableType'))),
        tag('th', { scope: 'col' }, esc(label(locale, 'tableSource'))),
      ].join(''))),
      tag('tbody', {}, rows),
    ].join('')),
    tag('p', { class: 'ssr-note' }, esc(label(locale, 'archiveNotes'))),
    tag('nav', { class: 'archive-nav', 'aria-label': label(locale, 'archiveTitle') }, [
      older ? tag('a', { href: archivePath(locale, older) }, `← ${monthLabel(older, locale)}`) : '',
      tag('a', { href: archivePath(locale) }, esc(label(locale, 'archiveAll'))),
      newer ? tag('a', { href: archivePath(locale, newer) }, `${monthLabel(newer, locale)} →`) : '',
    ].join('')),
  ].join(''));

  const shell = docShell(locale, main);
  return { status: 200, head, headExtra: shell.headExtra, body: shell.body, lang: shell.lang, standalone: true };
}

/* ------------------------------------------------------- sitemap / robots */

function sitemapXml(origin) {
  const entries = [];
  const lastmod = isoStamp(new Date().toISOString());
  for (const key of shared.meta.ROUTE_KEYS) {
    if (key === 'rhythm') continue;
    const alternates = shared.meta.alternatesFor(key);
    for (const [lang, pathname] of [['zh-Hans', alternates.zh], ['en', alternates.en]]) {
      entries.push({
        loc: `${origin}${pathname}`,
        lastmod,
        priority: key === 'home' ? '1.0' : '0.8',
        alternates: [
          { lang: 'zh-Hans', href: `${origin}${alternates.zh}` },
          { lang: 'en', href: `${origin}${alternates.en}` },
          { lang: 'x-default', href: `${origin}${alternates.xDefault}` },
        ],
        lang,
      });
    }
  }
  entries.push({
    loc: `${origin}/rhythm`,
    lastmod,
    priority: '0.8',
    alternates: [
      { lang: 'zh-Hans', href: `${origin}/rhythm` },
      { lang: 'en', href: `${origin}/en/rhythm` },
      { lang: 'x-default', href: `${origin}/rhythm` },
    ],
  });
  entries.push({
    loc: `${origin}/en/rhythm`,
    lastmod,
    priority: '0.8',
    alternates: [
      { lang: 'zh-Hans', href: `${origin}/rhythm` },
      { lang: 'en', href: `${origin}/en/rhythm` },
      { lang: 'x-default', href: `${origin}/rhythm` },
    ],
  });
  for (const [path, lang] of [['/about', 'zh-Hans'], ['/en/about', 'en']]) {
    entries.push({
      loc: `${origin}${path}`,
      lastmod,
      priority: '0.6',
      alternates: [
        { lang: 'zh-Hans', href: `${origin}/about` },
        { lang: 'en', href: `${origin}/en/about` },
        { lang: 'x-default', href: `${origin}/about` },
      ],
    });
  }
  entries.push({
    loc: `${origin}/plan`,
    lastmod,
    priority: '0.9',
    alternates: [
      { lang: 'zh-Hans', href: `${origin}/plan` },
      { lang: 'en', href: `${origin}/en/plan` },
      { lang: 'x-default', href: `${origin}/plan` },
    ],
  });
  entries.push({
    loc: `${origin}/en/plan`,
    lastmod,
    priority: '0.9',
    alternates: [
      { lang: 'zh-Hans', href: `${origin}/plan` },
      { lang: 'en', href: `${origin}/en/plan` },
      { lang: 'x-default', href: `${origin}/plan` },
    ],
  });
  for (const locale of ['zh', 'en']) {
    const prefix = locale === 'en' ? '/en' : '';
    entries.push({
      loc: `${origin}${prefix}/archive`,
      lastmod,
      priority: '0.6',
      alternates: [
        { lang: 'zh-Hans', href: `${origin}/archive` },
        { lang: 'en', href: `${origin}/en/archive` },
        { lang: 'x-default', href: `${origin}/archive` },
      ],
    });
    for (const entry of archiveMonths(locale)) {
      entries.push({
        loc: `${origin}${archivePath(locale, entry.month)}`,
        lastmod,
        priority: '0.5',
        alternates: [
          { lang: 'zh-Hans', href: `${origin}${archivePath('zh', entry.month)}` },
          { lang: 'en', href: `${origin}${archivePath('en', entry.month)}` },
          { lang: 'x-default', href: `${origin}${archivePath('zh', entry.month)}` },
        ],
      });
    }
  }
  for (const slug of SLUGS) {
    for (const locale of ['zh', 'en']) {
      const alt = { zh: articlePath(slug, 'zh'), en: articlePath(slug, 'en') };
      entries.push({
        loc: `${origin}${alt[locale]}`,
        lastmod,
        priority: '0.7',
        alternates: [
          { lang: 'zh-Hans', href: `${origin}${alt.zh}` },
          { lang: 'en', href: `${origin}${alt.en}` },
          { lang: 'x-default', href: `${origin}${alt.zh}` },
        ],
        lang: locale,
      });
    }
  }
  const urls = entries
    .map((entry) =>
      [
        '<url>',
        `<loc>${esc(entry.loc)}</loc>`,
        `<lastmod>${entry.lastmod}</lastmod>`,
        `<priority>${entry.priority}</priority>`,
        ...entry.alternates.map((alternate) => `<xhtml:link rel="alternate" hreflang="${alternate.lang}" href="${esc(alternate.href)}"/>`),
        '</url>',
      ].join(''),
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

function robotsTxt(origin) {
  // Crawlers that feed answer engines and AI assistants are allowed on purpose:
  // the whole point of this site is to be quotable.
  const aiAgents = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-Web',
    'anthropic-ai',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot',
    'Applebot-Extended',
    'Amazonbot',
    'CCBot',
    'Bytespider',
    'DuckAssistBot',
    'cohere-ai',
    'meta-externalagent',
    'YouBot',
    'MistralAI-User',
  ];
  const lines = [
    '# Codex Reset — content may be crawled and quoted by search and answer engines.',
    '',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /__health',
    '',
  ];
  for (const agent of aiAgents) {
    lines.push(`User-agent: ${agent}`, 'Allow: /', 'Allow: /llms.txt', 'Disallow: /api/', '');
  }
  lines.push(`Sitemap: ${origin}/sitemap.xml`, `# LLM brief: ${origin}/llms.txt`, '');
  return lines.join('\n');
}

function llmsTxt(origin) {
  const zh = data.snapshot('zh');
  const stamp = zh.at ? formatDateTime(new Date(zh.at).toISOString(), 'zh') : '—';
  const lastReset = zh.lastResetAt ? formatDateTime(zh.lastResetAt, 'zh') : '—';
  const faq = label('zh', 'faq');
  const confidence = tx('zh', `verdict.confidence.${zh.confidence || 'low'}`);
  const boundsText = (range) => (range && typeof range.lower === 'number' && typeof range.upper === 'number'
    ? `${Math.round(range.lower * 100)}–${Math.round(range.upper * 100)}%`
    : null);
  const range24 = boundsText(zh.forecast.probabilities.range_24h);
  const range48 = boundsText(zh.forecast.probabilities.range_48h);
  const total = zh.rhythm.stats && zh.rhythm.stats.resets ? zh.rhythm.stats.resets : zh.resets.length;
  const window = zh.window || (Array.isArray(zh.rhythm.windows) ? zh.rhythm.windows[0] : null);
  const routeKeys = shared.meta.ROUTE_KEYS.slice();
  const keys = [];
  for (const key of routeKeys) {
    keys.push(key);
    if (key === 'home' && !routeKeys.includes('rhythm')) keys.push('rhythm');
  }
  if (!keys.includes('rhythm')) keys.push('rhythm');
  const lines = [
    '# Codex Reset',
    '',
    '> 非官方项目，以本站自己维护的公开台账追踪 OpenAI Codex 的全局额度重置：未来 24/48 小时的重置概率与区间、历史间隔与高频窗口、以及完整记录。中文为主，英文在 /en/ 下。',
    '',
    `## 当前状态（截至 ${stamp} 北京时间）`,
    '',
    `- 最近一次已确认的全局重置：${lastReset}（北京时间）`,
    zh.chance24 !== null ? `- 未来 24 小时重置概率：${zh.chance24}%${range24 ? `（可能范围 ${range24}）` : ''}，可信度${confidence}` : null,
    zh.chance48 !== null ? `- 未来 48 小时重置概率：${zh.chance48}%${range48 ? `（可能范围 ${range48}）` : ''}，可信度${confidence}` : null,
    `- 已记录的重置事件：${total} 次重置，另有 ${zh.counts.banked} 次备用额度`,
    zh.typicalDays !== null ? `- 相邻重置间隔中位数：${Math.round(zh.typicalDays * 10) / 10} 天` : null,
    window
      ? `- 最常发生重置的高频窗口：${window.label || `${String(window.start_hour).padStart(2, '0')}:00–${String(window.end_hour).padStart(2, '0')}:00 UTC`}，占样本 ${Math.round(((typeof window.share === 'number' ? window.share : window.count / (total || 1))) * 100)}%`
      : null,
    '',
    '概率来自本站台账上的历史节奏模型（Weibull 生存曲线与经验生存率混合，自助重采样给出区间），是估计，不代表 OpenAI 的官方承诺。',
    '',
    '## 可直接引用的问答',
    '',
    ...faq.map((item) => `**${item.q}**\n${item.a}\n`),
    '**Codex 额度重置是什么？**',
    'Codex 的额度分两层：5 小时滚动窗口（从本次窗口第一次请求开始计时，5 小时后自动恢复）和每周额度（按周结算）。此外还有 OpenAI 主动发起的全局重置——本站记录的是最后这一种。',
    '',
    '**备用额度（banked reset）和全局重置有什么区别？**',
    '备用额度是账号里一次性、需要手动领取的重置（设置 → 用量，或 CLI 的 /usage → Redeem reset），会在同时刷新 5 小时窗口与每周额度；全局重置是 OpenAI 对所有账号发起的，用户无法触发。',
    '',
    '## 引用本站时请注意口径',
    '',
    '- 台账区分「已宣布（announced）」与「已确认（confirmed）」：概率样本只含 confirmed，已宣布未落地的条目单列，不当作已经发生的重置。',
    '- 概率必须连同区间、置信度或样本量一起引用，不要写成确定性结论。',
    '- 时区：概率与高频窗口按 UTC 计算并标注；页面具体时间按访问者时区显示；28 天活动按美国太平洋时间编号。',
    `- 引用格式建议：Codex Reset，${origin}/，数据截至 ${stamp}（北京时间）。`,
    '',
    '## 页面',
    '',
    ...keys.map((key) => {
      const page = pageMetaFor('zh', key);
      return `- [${label('zh', 'nav')[key]} 中文](${origin}${page.path})：${page.description}`;
    }),
    ...keys.map((key) => {
      const page = pageMetaFor('en', key);
      return `- [${label('en', 'nav')[key]} English](${origin}${page.path})：${page.description}`;
    }),
    '',
    '## 28 天复盘与归档',
    '',
    `- [Codex 28 天计划复盘](${origin}/plan)：活动已经在 2026-11-01 结束，Day 1–28 逐日冻结成复盘。`,
    `- [The 28-day retrospective](${origin}/en/plan)：the same page in English.`,
    `- [按月归档](${origin}/archive)：每个月一页的重置记录，含时间、类型与间隔。`,
    '',
    '## 说明页',
    '',
    ...SLUGS.map((slug) => {
      const meta = articleMeta(slug, 'zh');
      return `- [${meta.h1}](${origin}${meta.path})：${meta.description}`;
    }),
    '',
    '## 只读数据接口',
    '',
    `- [forecast](${origin}/api/forecast)：最近一次重置时间、24/48 小时概率、区间与置信度。`,
    `- [timeline](${origin}/api/timeline)：全部重置与备用额度事件。`,
    `- [rhythm](${origin}/api/rhythm)：间隔、星期×小时热力图、三小时窗口与按月统计。`,
    `- [status](${origin}/api/status)：台账新鲜度、覆盖范围、缺口、自检与模型回测。`,
    '',
    '## 关于',
    '',
    `- [关于本站](${origin}/about)：数据来源、判定口径与已知限制。`,
    '- 个人项目，与 OpenAI 无关；不收集账号数据，也读不到任何人的个人额度；运行时不请求任何第三方接口。',
    '- 数据来源：仓库里的 data/ledger.json（维护者人工整理，每条带公开 X 原帖链接）、data/posts.json（28 天活动冻结档案）、data/meta.json。',
    '',
  ].filter((line) => line !== null);
  return lines.join('\n');
}

/* -------------------------------------------------------------- not found */

function notFoundDocument({ origin, pathname }) {
  const locale = pathname.startsWith('/en') ? 'en' : 'zh';
  const head = headBlock({
    origin,
    locale,
    title: `${label(locale, 'notFoundTitle')} — Codex Reset`,
    description: label(locale, 'notFoundLead'),
    canonical: locale === 'en' ? '/en/' : '/',
    alternates: { zh: '/', en: '/en/', xDefault: '/' },
  }).replace('index, follow, max-image-preview:large, max-snippet:-1', 'noindex, follow');
  return {
    status: 404,
    head,
    headExtra: [
      voidTag('meta', { name: 'theme-color', content: '#f5f6f8' }),
      voidTag('link', { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/tokens.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/base.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/shell.css' }),
      voidTag('link', { rel: 'stylesheet', href: '/css/seo.css' }),
    ].join('\n'),
    body: tag('main', { class: 'page doc' }, [
      tag('p', { class: 'doc-code' }, '404'),
      tag('h1', {}, esc(label(locale, 'notFoundTitle'))),
      tag('p', { class: 'doc-lead' }, esc(label(locale, 'notFoundLead'))),
      tag('p', {}, tag('a', { class: 'doc-button', href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'backHome')))),
    ].join('')),
    lang: locale === 'en' ? 'en' : 'zh-Hans',
    standalone: true,
  };
}

module.exports = {
  init,
  documentFor,
  rhythmDocument,
  articleDocument,
  planDocument,
  aboutDocument,
  archiveIndexDocument,
  archiveMonthDocument,
  notFoundDocument,
  sitemapXml,
  robotsTxt,
  llmsTxt,
  articleMeta,
  articlePath,
  SLUGS,
};
