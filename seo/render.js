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
    guidesTitle: 'Codex 额度重置：先搞清楚这几件事',
    guidesLead:
      '如果你刚遇到额度用完、或者看到有人说「Codex 重置了」，下面三篇说明可以帮你判断这次重置和你有没有关系。所有数字都以账号里「设置 → 用量」为准，本站只记录公开的全局重置。',
    faqTitle: '常见问题',
    faq: [
      {
        q: 'Codex 今天会重置吗？',
        a: '全站范围的重置由 OpenAI 决定，没有公开的时间表。首页的 24 与 48 小时概率来自本站台账上的历史节奏模型，带区间与置信度，是估计而不是承诺。',
      },
      {
        q: 'Codex 重置和 5 小时限额刷新是一回事吗？',
        a: '不是。5 小时窗口每天会自动刷新多次；本站记录的是 OpenAI 主动对所有人发起的全局重置，两者完全不同。',
      },
      {
        q: '这里的数据从哪里来？',
        a: '来自本站自己维护的公开台账：每条重置或备用额度都能追溯到一条公开的 X 原帖，记录在仓库的 data/ledger.json 里，不调用任何第三方接口。',
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
    guidesTitle: 'Codex resets: three things worth getting straight',
    guidesLead:
      'If you just ran out of quota, or saw someone claim “Codex reset”, these three explainers tell you whether it applies to your account. Your account (Settings → Usage) is the authority; this site tracks public global resets only.',
    faqTitle: 'Common questions',
    faq: [
      {
        q: 'Did Codex reset today?',
        a: 'A site-wide reset is OpenAI’s call and has no public schedule. The 24h and 48h probabilities on the overview come from a cadence model over this site’s own ledger, with a range and a confidence level — an estimate, not a promise.',
      },
      {
        q: 'Is a Codex reset the same as the 5-hour limit refreshing?',
        a: 'No. The 5-hour window refreshes automatically several times a day. This site records global resets that OpenAI grants to everyone.',
      },
      {
        q: 'Where does the data come from?',
        a: 'From this site’s own public ledger: every reset and banked grant traces back to a public post on X and is stored in data/ledger.json in the repository. No third-party API is called.',
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
  const options =
    locale === 'en'
      ? { timeZone: zone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
      : { timeZone: zone, month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false };
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

function statCard(labelText, value, note) {
  return tag(
    'div',
    { class: 'ssr-stat' },
    [tag('span', { class: 'ssr-stat-label' }, esc(labelText)), tag('strong', { class: 'ssr-stat-value' }, esc(value)), note ? tag('span', { class: 'ssr-stat-note' }, esc(note)) : ''].join(''),
  );
}

/** A row whose text came from an English source stays marked as English. */
function textLang(text, locale) {
  const ascii = String(text || '').replace(/[\s\d\p{P}]/gu, '');
  return /^[\x00-\x7f]*$/.test(ascii) && ascii.length > 0 ? 'en' : locale;
}

/* ------------------------------------------------------------- page meta */

/**
 * Copy that belongs to the server renderer rather than to the client route
 * table. `/rhythm` is new in v2 and must render even if the client router has
 * not learned the route yet, and `/` + `/status` changed meaning, so their
 * head copy lives here too. Everything else still comes from `seo-meta.js`.
 */
const LOCAL_META = {
  home: {
    zh: {
      path: '/',
      title: 'Codex 重置追踪：今天会重置吗？重置概率与记录',
      description:
        '追踪 OpenAI Codex 的全局额度重置：最近一次已确认重置、未来 24 与 48 小时重置概率及区间、重置节奏与完整记录。数据来自本站公开台账，每条都可追溯到一条 X 原帖。',
      h1: 'Codex 今天会重置吗？',
    },
    en: {
      path: '/en/',
      title: 'Codex Reset Tracker — Did Codex Reset Today? Records & Forecast',
      description:
        'Track OpenAI Codex quota resets: the last verified reset, 24h and 48h probabilities with ranges, reset rhythm and the full record — from this site’s own ledger.',
      h1: 'Will Codex reset today?',
    },
  },
  status: {
    zh: {
      path: '/status',
      title: 'Codex 数据状态：台账新鲜度、覆盖范围与模型回测',
      description:
        '本站只有一个数据源：仓库里的公开台账。这里说明它更新到什么时候、覆盖了哪些时间、哪里还有缺口，以及模型参数与自带回测结果。',
      h1: '数据状态',
    },
    en: {
      path: '/en/status',
      title: 'Codex Reset Data Status — Ledger Freshness, Coverage & Backtest',
      description:
        'One data source: the public ledger in this repository. How fresh it is, which period it covers, where the gaps are, and the model parameters behind every number.',
      h1: 'Data status',
    },
  },
  rhythm: {
    zh: {
      path: '/rhythm',
      title: '重置节奏：Codex 重置的间隔、时段与高频窗口',
      description:
        '把每一次已确认重置放到同一条时间轴上：间隔多久、落在星期几的几点、下一次最可能出现在哪个窗口，以及这些数字是怎么算出来的。',
      h1: '重置节奏',
      lead: null,
    },
    en: {
      path: '/en/rhythm',
      title: 'Codex Reset Rhythm — Intervals, Hour Windows and Cadence',
      description:
        'Every confirmed reset on one timeline: how far apart they land, which weekday and hour they cluster in, the most likely window, and how each number is computed.',
      h1: 'Reset rhythm',
      lead: null,
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
      return tag('a', { href: page.path }, esc(label(locale, 'nav')[key]));
    })
    .join('');
}

function relatedNav(locale) {
  return tag('nav', { class: 'seo-related', 'aria-label': label(locale, 'relatedTitle') }, [
    tag('h2', {}, esc(label(locale, 'relatedTitle'))),
    tag('ul', {}, [
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'rhythm').path }, esc(navLabel(locale, 'rhythm')))),
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'timeline').path }, esc(navLabel(locale, 'timeline')))),
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'status').path }, esc(navLabel(locale, 'status')))),
      tag('li', {}, tag('a', { href: pageMetaFor(locale, 'vigil').path }, esc(navLabel(locale, 'vigil')))),
      tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
    ].join('')),
  ].join(''));
}

/* ------------------------------------------------------------- components */

/** One `.fact` inside a `.factgrid`: label, value and an optional footnote. */
function factCard(labelText, value, note) {
  return tag('div', { class: 'fact ssr-stat' }, [
    tag('span', { class: 'fact-label ssr-stat-label' }, esc(labelText)),
    tag('strong', { class: 'fact-value ssr-stat-value' }, esc(value)),
    note ? tag('p', { class: 'fact-note ssr-stat-note' }, esc(note)) : '',
  ].join(''));
}

function factGrid(items) {
  const cards = items.filter(Boolean).map((item) => factCard(item.label, item.value, item.note)).join('');
  return cards ? tag('div', { class: 'factgrid ssr-stats' }, cards) : '';
}

/** Same table, but with localised headers for the given locale. */
function metricTable(locale, rows) {
  return tag('table', { class: 'data-table ssr-table' }, [
    tag('thead', {}, tag('tr', {}, [
      tag('th', { scope: 'col' }, esc(label(locale, 'valueTable'))),
      tag('th', { scope: 'col' }, esc(label(locale, 'valueValue'))),
    ].join(''))),
    tag('tbody', {}, rows.map((row) => tag('tr', {}, [
      tag('th', { scope: 'row' }, esc(row[0])),
      tag('td', {}, esc(row[1])),
    ].join(''))).join('')),
  ].join(''));
}

/** `08:00` in the visitor-facing zone for a UTC hour. */
function zoneHourLabel(hour, locale) {
  const reference = new Date();
  reference.setUTCHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    timeZone: zoneFor(locale),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(reference);
}

function utcRangeLabel(startHour, endHour) {
  const pad = (hour) => `${String(hour).padStart(2, '0')}:00`;
  return `${pad(startHour)}–${pad(endHour)}`;
}

function pctRange(range) {
  if (!range || typeof range.lower !== 'number' || typeof range.upper !== 'number') return null;
  return `${Math.round(range.lower * 100)}–${Math.round(range.upper * 100)}%`;
}

function confidenceWord(locale, level) {
  const table = label(locale, 'confidence');
  return table[level] || table.low;
}

/** The three-hour windows, with a share computed if the payload lacks one. */
function normalizeWindows(snap) {
  const all = Array.isArray(snap.rhythm && snap.rhythm.windows) ? snap.rhythm.windows : [];
  const total = snap.rhythm && snap.rhythm.stats && snap.rhythm.stats.resets ? snap.rhythm.stats.resets : snap.resets.length;
  return all.map((window) => ({
    ...window,
    share: typeof window.share === 'number' ? window.share : total ? window.count / total : 0,
  }));
}

/** Top windows by count. A payload that already ships exactly five is trusted as-is. */
function topWindows(snap, limit = 5) {
  const rows = normalizeWindows(snap);
  if (rows.length > limit) rows.sort((a, b) => b.count - a.count || a.start_hour - b.start_hour);
  return rows.slice(0, limit);
}

/** The `.heatmap` block shared by the overview and /rhythm. */
function heatmapBlock(locale, snap) {
  const grid = Array.isArray(snap.rhythm && snap.rhythm.heatmap) ? snap.rhythm.heatmap : [];
  if (!grid.length) return '';
  const stored = snap.rhythm.weekday_labels && snap.rhythm.weekday_labels[locale === 'en' ? 'en' : 'zh'];
  const days = Array.isArray(stored) && stored.length === 7 ? stored : label(locale, 'weekdays');
  const total = snap.rhythm.stats && snap.rhythm.stats.resets ? snap.rhythm.stats.resets : snap.resets.length;
  const max = Math.max(1, ...grid.flat());
  const levelOf = (count) => {
    if (!count) return 0;
    const share = count / max;
    if (share <= 0.25) return 1;
    if (share <= 0.5) return 2;
    if (share <= 0.75) return 3;
    return 4;
  };
  const head = [tag('span', { class: 'heatmap-corner', 'aria-hidden': 'true' }, '')];
  for (let hour = 0; hour < 24; hour += 1) {
    head.push(tag('span', { class: 'heatmap-hour', 'aria-hidden': 'true' }, String(hour).padStart(2, '0')));
  }
  const cells = [];
  for (let day = 0; day < 7; day += 1) {
    cells.push(tag('span', { class: 'heatmap-day' }, esc(days[day] || '')));
    for (let hour = 0; hour < 24; hour += 1) {
      const count = grid[day] && grid[day][hour] !== undefined ? grid[day][hour] : 0;
      const title = label(locale, 'heatmapCell')
        .replace('{day}', days[day] || '')
        .replace('{hour}', `${String(hour).padStart(2, '0')}:00`)
        .replace('{count}', String(count));
      cells.push(tag('span', { class: 'heatmap-cell', 'data-level': String(levelOf(count)), title }, ''));
    }
  }
  return tag('div', { class: 'heatmap', role: 'img', 'aria-label': label(locale, 'heatmapAria').replace('{n}', String(total)) }, [
    tag('div', { class: 'heatmap-grid' }, head.join('') + cells.join('')),
    tag('p', { class: 'heatmap-legend' }, esc(label(locale, 'heatmapLegend'))),
  ].join(''));
}

function kindOfRecord(locale, record) {
  if (record.kind === 'banked' || record.type === 'credits') return label(locale, 'kindBanked');
  if (record.type === 'reset' && record.pending) return label(locale, 'pending');
  if (record.type === 'reset') return label(locale, 'kindReset');
  return label(locale, 'kindOther');
}

function recordRow(locale, record) {
  const source = record.url
    ? tag('a', { href: record.url, rel: 'noopener nofollow', target: '_blank' }, esc(label(locale, 'sourcePost')))
    : tag('span', { class: 'ssr-row-text' }, esc(label(locale, 'sourceLedger')));
  return tag('li', { class: 'ssr-row ssr-row--record' }, [
    tag('time', { datetime: isoStamp(record.at) || '' }, esc(formatDateTime(record.at, locale))),
    tag('span', { class: 'ssr-row-zone' }, esc(zoneLabel(locale))),
    tag('span', { class: 'ssr-row-kind' }, esc(kindOfRecord(locale, record))),
    source,
  ].join(''));
}

/* ---------------------------------------------------------------- verdict */

function probabilityCard(locale, snap, hours) {
  const level = snap.confidence || 'low';
  const value = hours === 24 ? snap.chance24 : snap.chance48;
  const range = pctRange(hours === 24 ? snap.forecast.probabilities.range_24h : snap.forecast.probabilities.range_48h);
  return tag('div', { class: 'verdict-number', 'data-confidence': level }, [
    tag('strong', { class: 'verdict-value' }, esc(value === null || value === undefined ? '—' : `${value}%`)),
    tag('span', { class: 'verdict-label' }, esc(label(locale, hours === 24 ? 'probability24' : 'probability48'))),
    tag('span', { class: 'verdict-range' }, esc(range ? label(locale, 'rangeLabel').replace('{range}', range) : label(locale, 'insufficient'))),
    tag('span', { class: 'verdict-confidence' }, esc(label(locale, 'confidenceLabel').replace('{level}', confidenceWord(locale, level)))),
  ].join(''));
}

/** The site's main answer sentence, lifted from the ledger's own numbers. */
function verdictSentence(locale, snap) {
  const range24 = pctRange(snap.forecast.probabilities.range_24h);
  const range48 = pctRange(snap.forecast.probabilities.range_48h);
  const share = snap.wait && typeof snap.wait.shorter_share === 'number' ? Math.round(snap.wait.shorter_share * 100) : null;
  const age = snap.wait && snap.wait.days !== null ? snap.wait.days : snap.ageDays;
  if (locale === 'en') {
    const chunks = [];
    if (snap.chance24 !== null && snap.chance24 !== undefined) chunks.push(`a ${snap.chance24}% chance of a reset in the next 24 hours${range24 ? ` (range ${range24})` : ''}`);
    if (snap.chance48 !== null && snap.chance48 !== undefined) chunks.push(`${snap.chance48}% in the next 48 hours${range48 ? ` (range ${range48})` : ''}`);
    const first = chunks.length ? `There is ${chunks.join(' and ')}.` : 'Not enough data to publish a probability yet.';
    const second = age === null || age === undefined
      ? ''
      : ` The current wait is ${age} days${share === null ? '' : `, longer than ${share}% of past intervals`}.`;
    return `${first}${second}`;
  }
  const chunks = [];
  if (snap.chance24 !== null && snap.chance24 !== undefined) chunks.push(`未来 24 小时 ${snap.chance24}%${range24 ? `（区间 ${range24}）` : ''}`);
  if (snap.chance48 !== null && snap.chance48 !== undefined) chunks.push(`48 小时 ${snap.chance48}%${range48 ? `（区间 ${range48}）` : ''}`);
  const first = chunks.length ? `重置概率：${chunks.join('，')}。` : '样本不足，暂时不发布概率。';
  const second = age === null || age === undefined
    ? ''
    : `当前已等待 ${age} 天${share === null ? '' : `，比 ${share}% 的历史间隔更长`}。`;
  return `${first}${second}`;
}

/** `.verdict` — probabilities, range, confidence, wait comparison, next window. */
function verdictBlock(locale, snap) {
  const page = pageMetaFor(locale, 'home');
  const facts = [];
  if (snap.lastResetAt) {
    facts.push({
      label: label(locale, 'factLastReset'),
      value: formatDateTime(snap.lastResetAt, locale),
      note: `${zoneLabel(locale)} · ${label(locale, 'since').replace('{days}', String(snap.ageDays === null || snap.ageDays === undefined ? '—' : snap.ageDays))}`,
    });
  }
  if (snap.wait && snap.wait.days !== null && snap.wait.days !== undefined) {
    const share = typeof snap.wait.shorter_share === 'number' ? Math.round(snap.wait.shorter_share * 100) : null;
    facts.push({
      label: label(locale, 'factWaited'),
      value: label(locale, 'days').replace('{n}', String(snap.wait.days)),
      note: share === null ? '' : label(locale, 'waitedNote')
        .replace('{share}', String(share))
        .replace('{median}', String(snap.wait.median_days)),
    });
  }
  // The payload's `window` is the first three-hour slot, not the busiest one;
  // the overview must agree with the TOP-5 list on /rhythm, so use the maximum.
  const window = topWindows(snap, 1)[0] || snap.window;
  if (window) {
    const total = snap.rhythm.stats && snap.rhythm.stats.resets ? snap.rhythm.stats.resets : snap.resets.length;
    const share = Math.round((typeof window.share === 'number' ? window.share : window.count / (total || 1)) * 100);
    facts.push({
      label: label(locale, 'factNextWindow'),
      value: `${zoneHourLabel(window.start_hour, locale)}–${zoneHourLabel(window.end_hour, locale)}${locale === 'en' ? ' PT' : '（北京时间）'}`,
      note: label(locale, 'windowNote')
        .replace('{range}', utcRangeLabel(window.start_hour, window.end_hour))
        .replace('{share}', String(share)),
    });
  }
  const factList = tag('dl', { class: 'verdict-facts' }, facts.map((fact) => tag('div', { class: 'fact' }, [
    tag('dt', {}, esc(fact.label)),
    tag('dd', {}, [
      tag('strong', { class: 'fact-value' }, esc(fact.value)),
      fact.note ? tag('p', {}, esc(fact.note)) : '',
    ].join('')),
  ].join(''))).join(''));
  const level = snap.confidence || 'low';
  const sample = snap.model && snap.model.interval_sample !== null && snap.model.interval_sample !== undefined ? snap.model.interval_sample : '—';
  return tag('section', { class: 'verdict', 'aria-labelledby': 'verdict-title' }, [
    tag('p', { class: 'verdict-eyebrow' }, esc(label(locale, 'verdictEyebrow'))),
    tag('h1', { id: 'verdict-title' }, esc(page.h1)),
    tag('p', { class: 'verdict-answer' }, esc(verdictSentence(locale, snap))),
    tag('div', { class: 'verdict-grid' }, [
      probabilityCard(locale, snap, 24),
      probabilityCard(locale, snap, 48),
      factList,
    ].join('')),
    tag('p', { class: 'verdict-note' }, esc(label(locale, 'verdictNote')
      .replace('{n}', String(sample))
      .replace('{confidence}', confidenceWord(locale, level)))),
  ].join(''));
}

/* --------------------------------------------------------------- overview */

function overviewBlock(locale, snap, origin) {
  const parts = [verdictBlock(locale, snap)];

  // 2. Rhythm preview: three facts, the weekday × hour heatmap, and /rhythm.
  const cadence = snap.cadence || {};
  const wait = snap.wait || {};
  const rhythmFacts = factGrid([
    cadence.overall_median_days !== null && cadence.overall_median_days !== undefined
      ? { label: label(locale, 'rhythmMedian'), value: label(locale, 'days').replace('{n}', String(cadence.overall_median_days)), note: '' }
      : null,
    cadence.recent_median_days !== null && cadence.recent_median_days !== undefined
      ? { label: label(locale, 'rhythmRecent'), value: label(locale, 'days').replace('{n}', String(cadence.recent_median_days)), note: '' }
      : null,
    wait.longest_days !== null && wait.longest_days !== undefined
      ? { label: label(locale, 'rhythmLongest'), value: label(locale, 'days').replace('{n}', String(wait.longest_days)), note: '' }
      : null,
  ]);
  parts.push(tag('section', { class: 'leaf', id: 'rhythm-preview' }, [
    tag('div', { class: 'leaf-head' }, [
      tag('h2', {}, esc(label(locale, 'rhythmTitle'))),
      tag('p', { class: 'leaf-note' }, esc(label(locale, 'rhythmNote'))),
    ].join('')),
    rhythmFacts,
    heatmapBlock(locale, snap),
    tag('p', { class: 'leaf-foot' }, tag('a', { class: 'chit', href: pageMetaFor(locale, 'rhythm').path }, esc(label(locale, 'viewRhythm')))),
  ].join('')));

  // 3. The six most recent ledger entries, each with its public source.
  const recent = Array.isArray(snap.events) ? snap.events.slice(0, 6) : [];
  parts.push(tag('section', { class: 'leaf', id: 'recent-records' }, [
    tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'recentResets')))),
    recent.length
      ? tag('ol', { class: 'ssr-rows' }, recent.map((record) => recordRow(locale, record)).join(''))
      : tag('p', { class: 'ssr-note' }, esc(label(locale, 'empty'))),
    tag('p', { class: 'leaf-foot' }, tag('a', { class: 'chit', href: pageMetaFor(locale, 'timeline').path }, esc(label(locale, 'allResets')))),
  ].join('')));

  // 4. Method and data: where the numbers come from, plus links outward.
  const methodLinks = tag('p', { class: 'ssr-more' }, [
    tag('a', { href: pageMetaFor(locale, 'status').path }, esc(navLabel(locale, 'status'))),
    ' · ',
    tag('a', { href: pageMetaFor(locale, 'rhythm').path }, esc(navLabel(locale, 'rhythm'))),
    ' · ',
    tag('a', { href: locale === 'en' ? '/en/about' : '/about' }, esc(locale === 'en' ? 'About' : '关于')),
  ].join(''));
  parts.push(tag('section', { class: 'leaf', id: 'method' }, [
    tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'methodTitle')))),
    tag('p', {}, esc(label(locale, 'methodBody'))),
    methodLinks,
  ].join('')));

  if (snap.at) {
    parts.push(
      tag('p', { class: 'ssr-updated' }, `${label(locale, 'updated')} ${formatDateTime(new Date(snap.at).toISOString(), locale)} ${zoneLabel(locale)}`),
    );
  }
  return tag('div', { id: 'ssr', class: 'ssr' }, parts.join(''));
}

/* ----------------------------------------------------------------- rhythm */

function rhythmStatsFacts(locale, snap) {
  const stats = snap.rhythm.stats || {};
  const cadence = snap.cadence || {};
  return factGrid([
    { label: label(locale, 'rhythmRecorded'), value: label(locale, 'rhythmCount').replace('{n}', String(stats.resets ?? snap.resets.length)), note: '' },
    { label: label(locale, 'rhythmSpan'), value: label(locale, 'rhythmSpanValue').replace('{n}', String(Math.round(stats.span_days ?? 0))), note: '' },
    { label: label(locale, 'rhythmMedian'), value: label(locale, 'days').replace('{n}', String(stats.median_interval_days ?? '—')), note: '' },
    cadence.recent_median_days !== null && cadence.recent_median_days !== undefined
      ? { label: label(locale, 'rhythmRecent'), value: label(locale, 'days').replace('{n}', String(cadence.recent_median_days)), note: '' }
      : null,
  ]);
}

function rhythmBlock(locale, snap) {
  const page = pageMetaFor(locale, 'rhythm');
  const intervals = Array.isArray(snap.rhythm.intervals) ? snap.rhythm.intervals : [];
  const rows = intervals.slice(-40).reverse();
  const intervalTable = rows.length
    ? tag('table', { class: 'data-table ssr-table interval-table', 'aria-label': label(locale, 'intervalTitle') }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', { scope: 'col' }, esc(label(locale, 'tableIndex'))),
          tag('th', { scope: 'col' }, esc(label(locale, 'tableResetAt'))),
          tag('th', { scope: 'col' }, esc(label(locale, 'tableGap'))),
        ].join(''))),
        tag('tbody', {}, rows.map((row, index) => tag('tr', {}, [
          tag('td', {}, esc(String(intervals.length - index))),
          tag('td', {}, tag('time', { datetime: isoStamp(row.at) || '' }, esc(formatDateTime(row.at, locale)))),
          tag('td', {}, esc(label(locale, 'days').replace('{n}', String(Math.round(row.days * 10) / 10)))),
        ].join(''))).join('')),
      ].join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'insufficient')));

  const windows = topWindows(snap, 5);
  const windowList = windows.length
    ? tag('ol', { class: 'window-list' }, windows.map((window) => tag('li', {}, esc(label(locale, 'windowLine')
        .replace('{range}', utcRangeLabel(window.start_hour, window.end_hour))
        .replace('{count}', String(window.count))
        .replace('{share}', String(Math.round((window.share || 0) * 100)))))).join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'insufficient')));

  const months = (Array.isArray(snap.rhythm.months) ? snap.rhythm.months : []).slice(0, 12);
  const monthTable = months.length
    ? tag('table', { class: 'data-table ssr-table month-table', 'aria-label': label(locale, 'monthTitle') }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', { scope: 'col' }, esc(label(locale, 'monthCol'))),
          tag('th', { scope: 'col' }, esc(label(locale, 'monthResets'))),
          tag('th', { scope: 'col' }, esc(label(locale, 'monthBanked'))),
        ].join(''))),
        tag('tbody', {}, months.map((entry) => tag('tr', {}, [
          tag('td', {}, esc(monthLabel(entry.month, locale))),
          tag('td', {}, esc(String(entry.resets))),
          tag('td', {}, esc(String(entry.banked))),
        ].join(''))).join('')),
      ].join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'insufficient')));

  const model = snap.model || {};
  const backtest = snap.backtest || {};
  const params = (snap.status && snap.status.params) || {};
  const paramRows = [
    model.name ? [label(locale, 'paramModel'), `${model.name} ${model.version || ''}`.trim()] : null,
    model.interval_sample !== undefined ? [label(locale, 'paramSample'), String(model.interval_sample)] : null,
    model.effective_sample_size !== undefined ? [label(locale, 'paramEffective'), String(model.effective_sample_size)] : null,
    model.half_life_days !== undefined || params.half_life_days !== undefined
      ? [label(locale, 'paramHalfLife'), `${model.half_life_days ?? params.half_life_days} ${locale === 'en' ? 'days' : '天'}`]
      : null,
    model.shape_k !== undefined ? [label(locale, 'paramShape'), String(model.shape_k)] : null,
    model.scale_days !== undefined ? [label(locale, 'paramScale'), `${model.scale_days} ${locale === 'en' ? 'days' : '天'}`] : null,
    model.empirical_weight !== undefined ? [label(locale, 'paramEmpirical'), String(model.empirical_weight)] : null,
    params.min_gap_hours !== undefined ? [label(locale, 'paramMinGap'), `${params.min_gap_hours} ${locale === 'en' ? 'hours' : '小时'}`] : null,
    params.bootstrap_rounds !== undefined ? [label(locale, 'paramBootstrap'), `${params.bootstrap_rounds} ${locale === 'en' ? 'rounds' : '轮'}`] : null,
    backtest.method ? [label(locale, 'paramBacktest'), backtest.method] : null,
    backtest.sample_size !== undefined ? [label(locale, 'paramBacktestSample'), String(backtest.sample_size)] : null,
    backtest.brier !== undefined && backtest.brier !== null ? [label(locale, 'paramBrier'), String(backtest.brier)] : null,
    backtest.baseline_brier !== undefined && backtest.baseline_brier !== null ? [label(locale, 'paramBaseline'), String(backtest.baseline_brier)] : null,
    backtest.status
      ? [label(locale, 'paramVerdict'), backtest.brier === null ? label(locale, 'notEnough') : backtest.better_than_baseline ? label(locale, 'beatsBaseline') : label(locale, 'belowBaseline')]
      : null,
  ].filter(Boolean);

  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('div', { class: 'page-head' }, [
      tag('p', { class: 'ssr-eyebrow' }, esc(navLabel(locale, 'rhythm'))),
      tag('h1', {}, esc(page.h1)),
      tag('p', { class: 'lead' }, esc(label(locale, 'rhythmLead'))),
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'rhythmStats')))),
      rhythmStatsFacts(locale, snap),
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, [
        tag('h2', {}, esc(label(locale, 'intervalTitle'))),
        tag('p', { class: 'leaf-note' }, esc(label(locale, 'intervalLead'))),
      ].join('')),
      tag('div', { class: 'chart-host', 'data-chart': 'rhythm-intervals', 'aria-hidden': 'true' }, ''),
      intervalTable,
      tag('p', { class: 'ssr-note' }, esc(label(locale, 'intervalNote').replace('{n}', String(intervals.length)))),
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'hourTitle')))),
      heatmapBlock(locale, snap),
      tag('h3', {}, esc(label(locale, 'windowTitle'))),
      windowList,
    ].join('')),
    tag('section', { class: 'leaf' }, monthTable),
    tag('section', { class: 'leaf', id: 'rhythm-method' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'rhythmMethodTitle')))),
      tag('p', {}, esc(label(locale, 'rhythmMethod'))),
      tag('h3', {}, esc(label(locale, 'rhythmParamsTitle'))),
      metricTable(locale, paramRows),
      tag('h3', {}, esc(label(locale, 'faqTitle'))),
      tag('dl', { class: 'ssr-faq' }, label(locale, 'rhythmFaq')
        .map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
    ].join('')),
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
          mainEntity: label(locale, 'rhythmFaq').map((item) => ({
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
    if (locale === 'en') {
      if (detail === 'beats-baseline') return 'beats baseline';
      if (detail === 'experimental') return 'experimental';
      if (detail === 'insufficient-data') return 'not enough data';
    } else {
      if (detail === 'beats-baseline') return '优于基线';
      if (detail === 'experimental') return '实验性';
      if (detail === 'insufficient-data') return '样本不足';
    }
    return detail;
  }
  if (locale === 'zh') return detail;
  const events = /(\d+)\s*条事件/.exec(detail);
  if (events) return `${events[1]} events`;
  const intervals = /(\d+)\s*个完整间隔/.exec(detail);
  if (intervals) return `${intervals[1]} completed intervals`;
  if (detail === '事件按时间正序') return 'events in chronological order';
  return /[\u4e00-\u9fff]/.test(detail) ? '' : detail;
}


/** `data/meta.json` labels are Chinese; keep the English page free of them. */
function sourceLabel(locale, source) {
  const text = source.label || '';
  if (locale !== 'en') return text;
  const url = String(source.url || '');
  if (/x\.com/i.test(url)) return 'Tibo (@thsottiaux) on X';
  return /[\u4e00-\u9fff]/.test(text) ? 'Public ledger source' : text;
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
  const rawSources = Array.isArray(snap.meta && snap.meta.sources) ? snap.meta.sources : [];
  const seenSources = new Set();
  const sources = rawSources.filter((source) => {
    const key = source.url || source.label;
    if (seenSources.has(key)) return false;
    seenSources.add(key);
    return true;
  });
  const hours = (value) => label(locale, 'hours').replace('{n}', String(value));
  const countValue = label(locale, 'coverCount');

  const freshnessFacts = factGrid([
    {
      label: label(locale, 'freshUpdated'),
      value: state.updated_at ? formatDateTime(state.updated_at, locale) : '—',
      note: zoneLabel(locale),
    },
    freshness.age_hours !== null && freshness.age_hours !== undefined
      ? { label: label(locale, 'freshAge'), value: hours(freshness.age_hours), note: '' }
      : null,
    {
      label: label(locale, 'freshState'),
      value: freshness.level === 'fresh' ? label(locale, 'fresh') : freshness.level === 'stale' ? label(locale, 'stale') : label(locale, 'unknownState'),
      note: freshness.threshold_hours ? label(locale, 'freshThreshold').replace('{n}', String(freshness.threshold_hours)) : '',
    },
    dataset.total !== undefined ? { label: label(locale, 'freshTotal'), value: String(dataset.total), note: '' } : null,
  ]);

  const coverageFacts = factGrid([
    dataset.first_at ? { label: label(locale, 'coverFirst'), value: formatDay(dataset.first_at, locale), note: zoneLabel(locale) } : null,
    dataset.last_reset_at ? { label: label(locale, 'coverLast'), value: formatDateTime(dataset.last_reset_at, locale), note: zoneLabel(locale) } : null,
    dataset.reset !== undefined ? { label: label(locale, 'coverResets'), value: countValue.replace('{n}', String(dataset.reset)), note: '' } : null,
    dataset.banked !== undefined ? { label: label(locale, 'coverBanked'), value: countValue.replace('{n}', String(dataset.banked)), note: '' } : null,
    dataset.span_days !== undefined ? { label: label(locale, 'coverSpan'), value: label(locale, 'coverSpanValue').replace('{n}', String(Math.round(dataset.span_days))), note: '' } : null,
  ]);

  const gapTable = gaps.length
    ? tag('table', { class: 'data-table ssr-table gap-table', 'aria-label': label(locale, 'gapTitle') }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', { scope: 'col' }, esc(label(locale, 'gapFrom'))),
          tag('th', { scope: 'col' }, esc(label(locale, 'gapTo'))),
          tag('th', { scope: 'col' }, esc(label(locale, 'gapDays'))),
        ].join(''))),
        tag('tbody', {}, gaps.map((gap) => tag('tr', {}, [
          tag('td', {}, esc(gap.from)),
          tag('td', {}, esc(gap.to)),
          tag('td', {}, esc(label(locale, 'gapDaysValue').replace('{n}', String(gap.days)))),
        ].join(''))).join('')),
      ].join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'gapNone')));

  const checkList = checks.length
    ? tag('ul', { class: 'check-list' }, checks.map((check) => tag('li', { class: `check ${check.ok ? 'check--ok' : 'check--bad'}` }, [
        tag('span', { class: 'check-name' }, esc((label(locale, 'checkNames') || {})[check.name] || check.name)),
        tag('span', { class: 'check-state' }, esc(check.ok ? label(locale, 'checkPass') : label(locale, 'checkFail'))),
        tag('span', { class: 'check-detail' }, esc(checkDetail(locale, check))),
      ].join(''))).join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'empty')));

  const paramRows = [
    model.name ? [label(locale, 'paramModel'), `${model.name} ${model.version || ''}`.trim()] : null,
    model.interval_sample !== undefined ? [label(locale, 'paramSample'), String(model.interval_sample)] : null,
    model.effective_sample_size !== undefined ? [label(locale, 'paramEffective'), String(model.effective_sample_size)] : null,
    params.half_life_days !== undefined || model.half_life_days !== undefined
      ? [label(locale, 'paramHalfLife'), `${model.half_life_days ?? params.half_life_days} ${locale === 'en' ? 'days' : '天'}`]
      : null,
    model.shape_k !== undefined ? [label(locale, 'paramShape'), String(model.shape_k)] : null,
    model.scale_days !== undefined ? [label(locale, 'paramScale'), `${model.scale_days} ${locale === 'en' ? 'days' : '天'}`] : null,
    model.empirical_weight !== undefined ? [label(locale, 'paramEmpirical'), String(model.empirical_weight)] : null,
    params.empirical_blend !== undefined ? [label(locale, 'paramEmpiricalBlend'), String(params.empirical_blend)] : null,
    params.min_gap_hours !== undefined ? [label(locale, 'paramMinGap'), `${params.min_gap_hours} ${locale === 'en' ? 'hours' : '小时'}`] : null,
    params.bootstrap_rounds !== undefined ? [label(locale, 'paramBootstrap'), `${params.bootstrap_rounds} ${locale === 'en' ? 'rounds' : '轮'}`] : null,
    backtest.method ? [label(locale, 'paramBacktest'), backtest.method] : null,
    backtest.sample_size !== undefined ? [label(locale, 'paramBacktestSample'), String(backtest.sample_size)] : null,
    backtest.brier !== undefined && backtest.brier !== null ? [label(locale, 'paramBrier'), String(backtest.brier)] : null,
    backtest.baseline_brier !== undefined && backtest.baseline_brier !== null ? [label(locale, 'paramBaseline'), String(backtest.baseline_brier)] : null,
    backtest.brier !== null && backtest.brier !== undefined
      ? [label(locale, 'paramVerdict'), backtest.better_than_baseline ? label(locale, 'beatsBaseline') : label(locale, 'belowBaseline')]
      : null,
  ].filter(Boolean);

  const sourceList = sources.length
    ? tag('ul', { class: 'ssr-sources' }, sources.map((source) => tag('li', {},
        tag('a', { href: source.url, rel: 'noopener nofollow', target: '_blank' }, esc(sourceLabel(locale, source))))).join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'empty')));

  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('div', { class: 'page-head' }, [
      tag('p', { class: 'ssr-eyebrow' }, esc(navLabel(locale, 'status'))),
      tag('h1', {}, esc(page.h1)),
      tag('p', { class: 'lead' }, esc(label(locale, 'dataStatusLead'))),
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'freshTitle')))),
      freshnessFacts,
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'coverTitle')))),
      coverageFacts,
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'gapTitle')))),
      gapTable,
      tag('p', { class: 'ssr-note' }, esc(label(locale, 'gapNote'))),
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'checkTitle')))),
      checkList,
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'modelTitle')))),
      metricTable(locale, paramRows),
    ].join('')),
    tag('section', { class: 'leaf' }, [
      tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(label(locale, 'sourceTitle')))),
      sourceList,
      tag('p', { class: 'ssr-note' }, esc(label(locale, 'sourceNote'))),
      snap.updatedAt ? tag('p', { class: 'ssr-updated' }, `${label(locale, 'statusUpdatedNote')} ${formatDateTime(snap.updatedAt, locale)} ${zoneLabel(locale)}`) : '',
    ].join('')),
  ].join(''));
}

function vigilBlock(locale, snap) {
  const meta = routeMetaFor(locale, 'vigil');
  const cadence = [];
  if (snap.lastResetAt) {
    cadence.push(statCard(label(locale, 'lastResetAt'), formatDateTime(snap.lastResetAt, locale), zoneLabel(locale)));
  }
  if (snap.typicalDays !== null) {
    cadence.push(statCard(label(locale, 'typicalGap'), label(locale, 'days').replace('{n}', String(Math.round(snap.typicalDays * 10) / 10)), ''));
  }
  const faq = label(locale, 'faq');
  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('p', { class: 'ssr-eyebrow' }, esc(navLabel(locale, 'vigil'))),
    tag('h1', {}, esc(meta.h1)),
    tag('p', { class: 'ssr-lead' }, esc(meta.lead)),
    cadence.length ? tag('div', { class: 'ssr-stats' }, cadence.join('')) : '',
    tag('h2', {}, esc(tx(locale, 'vigil.sleepTitle'))),
    tag('p', {}, esc(tx(locale, 'vigil.sleepNote'))),
    tag('h2', {}, esc(label(locale, 'faqTitle'))),
    tag('dl', { class: 'ssr-faq' }, faq.map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
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
        mainEntity: label(locale, 'faq').map((item) => ({
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
          '一条「今天会重置」的公开承诺先记为 announced；等到事件时间点明确、有公开证据表明它确实落地，才改为 confirmed。没有确认的条目会一直保留 announced 标记，并在概览里单独提示。',
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
      'Tibo 的 Codex 28 天更新计划已经结束：Day 1–28 的完整复盘表，哪几天是重置、哪几天是产品更新、哪几天没有公开记录，以及活动结束后看什么。',
    h1: 'Codex 28 天计划复盘：Day 1–28',
    lead: '2026 年 10 月 5 日到 11 月 1 日，Tibo 连续 28 天发布更新或重置。活动已经结束，这一页冻结成复盘：哪几天是重置、哪几天是产品更新、哪几天没有公开记录。',
    badge: '已结束 · 2026-11-01',
    day: 'Day',
    date: '日期（PT）',
    what: '当天内容',
    status: '状态',
    recorded: '已收录',
    missing: '无公开记录',
    reset: '重置',
    update: '产品更新',
    banked: '备用额度',
    stats: [
      ['活动窗口', '{start} – {end}'],
      ['有记录', '{n} / 28 天'],
      ['其中重置', '{n} 次'],
    ],
    afterTitle: '结束后看什么',
    afterBody: '活动结束后不再有每日更新，站点改为持续跟踪重置节奏：',
    afterRhythm: '重置节奏：间隔与高频窗口',
    afterTimeline: '重置记录：完整时间线',
    faqTitle: '关于这个计划',
    faq: [
      {
        q: '这个 28 天计划是什么？',
        a: 'Tibo 在 2026 年 10 月初宣布，用 28 天每天发布一次 Codex 更新或额度重置，作为一段连续的发布节奏。活动从 10 月 5 日持续到 11 月 1 日，Day 1–28 按美国太平洋时间编号，不随访问者时区移动。',
      },
      {
        q: '之后还会有每日更新吗？',
        a: '不会。28 天活动已经在 2026 年 11 月 1 日结束，这一页冻结为复盘，不再逐日追加。站点现在改为持续跟踪重置节奏：间隔分布、高频窗口和未来 24 / 48 小时概率都在重置节奏页与概览页上。',
      },
      {
        q: '为什么有的天没有内容？',
        a: '只收录有公开来源的记录。没有公开来源的日子保持「无公开记录」，不推断也不填补。',
      },
    ],
    note: '活动日按 Tibo 的每日编号；表格中的事件时间为公告时间。台账只收公开可追溯的记录。',
  },
  en: {
    path: '/en/plan',
    title: 'Codex 28-Day Plan Retrospective: Days 1–28, Complete Record',
    description:
      'The Codex 28-day run announced by Tibo is over. A full Day 1–28 retrospective: which days were resets, which were product updates, which had no public record, and where to look next.',
    h1: 'The Codex 28-day plan: a retrospective',
    lead: 'From 5 October to 1 November 2026, Tibo shipped something every day for 28 days. The run is over; this page is frozen as a retrospective: which days were resets, which were product updates, and which have no public record.',
    badge: 'Ended · 2026-11-01',
    day: 'Day',
    date: 'Date (PT)',
    what: 'What landed',
    status: 'State',
    recorded: 'Recorded',
    missing: 'No public record',
    reset: 'Reset',
    update: 'Product update',
    banked: 'Banked',
    stats: [
      ['Window', '{start} – {end}'],
      ['Recorded', '{n} / 28 days'],
      ['Of which resets', '{n}'],
    ],
    afterTitle: 'Where to look now',
    afterBody: 'The day-by-day run is over, so the site now tracks the reset rhythm continuously:',
    afterRhythm: 'Reset rhythm: intervals and windows',
    afterTimeline: 'Reset history: the full timeline',
    faqTitle: 'About this run',
    faq: [
      {
        q: 'What was the Codex 28-day plan?',
        a: 'In early October 2026 Tibo announced a run of 28 consecutive days of shipping, each day numbered Day 1 through Day 28. The run went from 5 October to 1 November and is numbered in Pacific Time, so it never shifts with the visitor’s timezone.',
      },
      {
        q: 'Will there still be daily updates?',
        a: 'No. The 28-day run ended on 1 November 2026 and this page is frozen as a retrospective; nothing is appended to it any more. The site now tracks the reset rhythm continuously — intervals, high-frequency windows and the 24h/48h probabilities live on the rhythm page and the overview.',
      },
      {
        q: 'Why are some days empty?',
        a: 'Only days with a public source are recorded. A day without a public source stays “no public record”; nothing is inferred or filled in.',
      },
    ],
    note: 'Activity days follow Tibo’s own numbering; event times above are announcement times. The ledger only keeps public, traceable records.',
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
    push(day, { kind, text: event.summary || '', url: event.url || null }, `event:${event.at}:${kind}`);
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

  const kindOf = (item) => {
    if (item.kind === 'reset') return copy.reset;
    if (item.kind === 'pending') return `${copy.reset}（${label(locale, 'pending')}）`;
    if (item.kind === 'banked') return copy.banked;
    return copy.update;
  };

  const rows = [];
  for (let index = 1; index <= total; index += 1) {
    const date = dateOfDay(index);
    const items = (byDay.get(index) || []).slice(0, 2);
    const state = items.length ? copy.recorded : copy.missing;
    const cell = items.length
      ? items
          .map((item) => {
            const text = plain(item.text, 120);
            const link = item.url ? ` ${tag('a', { href: item.url, rel: 'noopener nofollow', target: '_blank' }, '↗')}` : '';
            return `<span class="plan-kind">${esc(kindOf(item))}</span>${text ? ` ${tag('span', { lang: textLang(text, locale) }, esc(text))}` : ''}${link}`;
          })
          .join('<br>')
      : '';
    rows.push(
      `<tr${items.length ? '' : ' class="plan-empty"'}><td>${index}</td><td><time datetime="${date}">${esc(shortDate(date, locale))}</time></td><td>${cell}</td><td>${esc(state)}</td></tr>`,
    );
  }

  const stats = factGrid(copy.stats.map(([name, template], index) => ({
    label: name,
    value: template
      .replace('{start}', shortDate(startDate, locale))
      .replace('{end}', shortDate(endDate, locale))
      .replace('{n}', String(index === 2 ? resetCount : recordedDays)),
    note: '',
  })));

  const after = tag('section', { class: 'leaf', id: 'plan-after' }, [
    tag('div', { class: 'leaf-head' }, tag('h2', {}, esc(copy.afterTitle))),
    tag('p', {}, esc(copy.afterBody)),
    tag('p', { class: 'ssr-more' }, [
      tag('a', { href: pageMetaFor(locale, 'rhythm').path }, esc(copy.afterRhythm)),
      ' · ',
      tag('a', { href: pageMetaFor(locale, 'timeline').path }, esc(copy.afterTimeline)),
    ].join('')),
  ].join(''));

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
    tag('a', { class: 'skip-link', href: '#doc' }, esc(label(locale, 'skip'))),
    tag('header', { class: 'masthead' }, tag('div', { class: 'masthead-inner' }, [
      tag('a', { class: 'wordmark', href: locale === 'en' ? '/en/' : '/', 'aria-label': 'Codex Reset' }, [
        tag('span', { class: 'wordmark-mark', 'aria-hidden': 'true' }, ''),
        tag('span', { class: 'wordmark-text' }, 'Codex Reset'),
      ].join('')),
      tag('nav', { class: 'masthead-nav', 'aria-label': label(locale, 'nav').home }, primaryNav(locale)),
    ].join(''))),
    tag('main', { class: 'page doc', id: 'doc', tabindex: '-1' }, [
      tag('nav', { class: 'doc-crumbs', 'aria-label': label(locale, 'breadcrumb') },
        tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'nav').home)) + ' / ' + tag('span', {}, 'Day 1–28'),
      ),
      tag('section', { class: 'page-head plan-hero' }, [
        tag('p', { class: 'verdict-eyebrow' }, esc(locale === 'en' ? '28-DAY RETROSPECTIVE' : '28 天计划复盘')),
        tag('h1', {}, esc(copy.h1)),
        tag('p', { class: 'plan-badge' }, esc(copy.badge)),
        tag('p', { class: 'lead' }, esc(copy.lead)),
      ].join('')),
      stats,
      tag('table', { class: 'data-table ssr-table plan-table', 'aria-label': copy.h1 }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', { scope: 'col' }, esc(copy.day)),
          tag('th', { scope: 'col' }, esc(copy.date)),
          tag('th', { scope: 'col' }, esc(copy.what)),
          tag('th', { scope: 'col' }, esc(copy.status)),
        ].join(''))),
        tag('tbody', {}, rows.join('')),
      ].join('')),
      tag('p', { class: 'ssr-note' }, esc(copy.note)),
      after,
      tag('section', { class: 'doc-section' }, [
        tag('h2', {}, esc(copy.faqTitle)),
        tag('dl', { class: 'doc-faq' }, copy.faq.map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
      ].join('')),
      tag('aside', { class: 'doc-related' }, [
        tag('h2', {}, esc(label(locale, 'relatedTitle'))),
        tag('ul', {}, [
          tag('li', {}, tag('a', { href: pageMetaFor(locale, 'rhythm').path }, esc(navLabel(locale, 'rhythm')))),
          tag('li', {}, tag('a', { href: pageMetaFor(locale, 'timeline').path }, esc(navLabel(locale, 'timeline')))),
          tag('li', {}, tag('a', { href: pageMetaFor(locale, 'status').path }, esc(navLabel(locale, 'status')))),
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
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(date);
  }
  return `${year} 年 ${Number(monthNumber)} 月`;
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
      ? 'A reset announcement and a landed reset are different records: an entry marked pending has been announced but not yet observed. Banked grants are not resets either — they are allowances an account redeems manually. Every month below is a page of its own, and the live overview always carries the most recent one.'
      : '重置公告和已经生效的重置是两种记录：标记为待确认的条目只代表公告已经发出，还没有观测到生效。备用额度也不算一次重置，它是账号里可以手动使用的一次额度发放。下面每个月都是独立页面，最新一条始终在概览页上。')),
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
  const confidence = confidenceWord('zh', zh.confidence || 'low');
  const range24 = pctRange(zh.forecast.probabilities.range_24h);
  const range48 = pctRange(zh.forecast.probabilities.range_48h);
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
    zh.chance24 !== null ? `- 未来 24 小时重置概率：${zh.chance24}%${range24 ? `（区间 ${range24}）` : ''}，置信度${confidence}` : null,
    zh.chance48 !== null ? `- 未来 48 小时重置概率：${zh.chance48}%${range48 ? `（区间 ${range48}）` : ''}，置信度${confidence}` : null,
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
