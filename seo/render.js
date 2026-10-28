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
    estimate: '预测值，仅供参考，不代表官方承诺。',
    recentResets: '最近的重置记录',
    allResets: '查看全部记录',
    interval: '间隔 {days} 天',
    verified: '已确认',
    pending: '待确认',
    empty: '暂时没有可用的上游数据，稍后会自动恢复。',
    skip: '跳到主要内容',
    nav: { home: '概览', timeline: '重置记录', status: '服务状态', vigil: '一起等重置' },
    readGuide: '阅读说明',
    guidesTitle: 'Codex 额度重置：先搞清楚这几件事',
    guidesLead:
      '如果你刚遇到额度用完、或者看到有人说「Codex 重置了」，下面三篇说明可以帮你判断这次重置和你有没有关系。所有数字都以账号里「设置 → 用量」为准，本站只记录公开的全局重置。',
    faqTitle: '常见问题',
    faq: [
      {
        q: 'Codex 今天会重置吗？',
        a: '全站范围的重置由 OpenAI 决定，没有固定时间表。可以看本站首页给出的 24 / 48 小时概率，它来自公开信号与历史节奏的推算，不等于承诺。',
      },
      {
        q: 'Codex 重置和 5 小时限额刷新是一回事吗？',
        a: '不是。5 小时窗口每天会自动刷新多次；本站记录的是 OpenAI 主动对所有人发起的全局重置，两者完全不同。',
      },
      {
        q: '这里的数据从哪里来？',
        a: '来自 Tibo（@thsottiaux）在 X 上的公开动态、OpenAI Status 以及公开的预测数据。公告、待确认和已确认分开记录，不把预告当成已经发生的重置。',
      },
    ],
    statusTitle: '各项服务的运行状态',
    statusNote: 'Codex 的网页版、API、CLI 和 IDE 集成共用同一份额度，但故障是各自独立的：某个入口异常时，其它入口通常仍然可用。持续故障之后，官方有时会用一次额度重置来补偿，这也是重置的一个常见来源。数据来自 OpenAI Status，与官方页面同步更新。',
    statusOk: '正常',
    statusBad: '异常',
    historicalTitle: '历史上的重置节奏',
    typicalGap: '近期重置间隔中位数',
    days: '{n} 天',
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
    dataNote: '数据来自公开来源，仅供参考。',
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
    archiveNotes: '时间按北京时间（UTC+8）显示；类型区分重置公告、待确认和备用额度发放。',
  },
  en: {
    lastVerified: 'Last verified reset',
    updated: 'Updated',
    daysAgo: '{days} days ago',
    chance24: 'Chance of a reset in the next 24 hours',
    chance48: 'Chance of a reset in the next 48 hours',
    estimate: 'Estimates for reference only — not an official commitment.',
    recentResets: 'Recent reset records',
    allResets: 'View all records',
    interval: '{days} days apart',
    verified: 'Verified',
    pending: 'Pending',
    empty: 'Upstream data is unavailable right now; it will return automatically.',
    skip: 'Skip to main content',
    nav: { home: 'Overview', timeline: 'Reset history', status: 'Service status', vigil: 'The vigil' },
    readGuide: 'Read the guide',
    guidesTitle: 'Codex resets: three things worth getting straight',
    guidesLead:
      'If you just ran out of quota, or saw someone claim “Codex reset”, these three explainers tell you whether it applies to your account. Your account (Settings → Usage) is the authority; this site tracks public global resets only.',
    faqTitle: 'Common questions',
    faq: [
      {
        q: 'Did Codex reset today?',
        a: 'A site-wide reset is OpenAI’s call and has no fixed schedule. The 24h and 48h probabilities on the overview come from public signals and historical cadence — an estimate, not a promise.',
      },
      {
        q: 'Is a Codex reset the same as the 5-hour limit refreshing?',
        a: 'No. The 5-hour window refreshes automatically several times a day. This site records global resets that OpenAI grants to everyone.',
      },
      {
        q: 'Where does the data come from?',
        a: 'Tibo’s (@thsottiaux) public posts on X, OpenAI Status and public forecast data. Announced, pending and verified records are kept separate — a teaser is never counted as a landed reset.',
      },
    ],
    statusTitle: 'Surface status',
    statusNote: 'Codex web, API, CLI and IDE integrations draw on the same quota but fail independently: one surface going down rarely stops the others. After a sustained incident OpenAI has sometimes compensated with a quota reset, which is one of the regular sources of resets. Data comes from OpenAI Status and follows the official page.',
    statusOk: 'Operational',
    statusBad: 'Degraded',
    historicalTitle: 'Historical cadence',
    typicalGap: 'Median gap between recent resets',
    days: '{n} days',
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
    dataNote: 'Data comes from public sources and is for reference only.',
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

function postRow(post, locale) {
  const text = plain(post.text, 180);
  return tag('li', { class: 'ssr-row ssr-row--post' }, [
    tag('time', { datetime: isoStamp(post.at) || '' }, esc(formatDateTime(post.at, locale))),
    tag('span', { class: 'ssr-row-zone' }, esc(zoneLabel(locale))),
    tag('span', { class: 'ssr-row-text', lang: textLang(text, locale) }, esc(text)),
  ].join(''));
}

function overviewBlock(locale, snap, origin) {
  const page = routeMetaFor(locale, 'home');
  const parts = [
    tag('p', { class: 'ssr-eyebrow' }, esc(tx(locale, 'home.eyebrow'))),
    tag('h1', {}, esc(page.h1)),
    tag('p', { class: 'ssr-lead' }, esc(page.lead)),
  ];

  if (snap.lastResetAt) {
    const cards = [
      statCard(
        label(locale, 'lastVerified'),
        formatDateTime(snap.lastResetAt, locale),
        `${zoneLabel(locale)}${snap.ageDays !== null ? ' · ' + label(locale, 'daysAgo').replace('{days}', String(Math.round(snap.ageDays))) : ''}`,
      ),
      snap.chance24 === null ? '' : statCard(label(locale, 'chance24'), `${snap.chance24}%`, ''),
      snap.chance48 === null ? '' : statCard(label(locale, 'chance48'), `${snap.chance48}%`, ''),
    ].join('');
    parts.push(tag('div', { class: 'ssr-stats' }, cards));
    parts.push(tag('p', { class: 'ssr-note' }, esc(label(locale, 'estimate'))));
  }

  if (snap.posts.length) {
    parts.push(
      tag('section', { class: 'ssr-section', 'aria-labelledby': 'ssr-feed' }, [
        tag('h2', { id: 'ssr-feed' }, esc(tx(locale, 'home.posts'))),
        tag('ol', { class: 'ssr-rows' }, snap.posts.slice(0, 5).map((post) => postRow(post, locale)).join('')),
        tag('p', { class: 'ssr-more' }, [
          tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(label(locale, 'allResets'))),
          ' · ',
          tag('a', { href: articlePath('codex-reset', locale) }, esc(label(locale, 'readGuide'))),
        ].join('')),
      ].join('')),
    );
  } else {
    parts.push(tag('p', { class: 'ssr-note' }, esc(label(locale, 'empty'))));
  }

  if (snap.at) {
    parts.push(
      tag('p', { class: 'ssr-updated' }, `${label(locale, 'updated')} ${formatDateTime(new Date(snap.at).toISOString(), locale)} ${zoneLabel(locale)}`),
    );
  }
  return tag('div', { id: 'ssr', class: 'ssr' }, parts.join(''));
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

  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('p', { class: 'ssr-eyebrow' }, esc(tx(locale, 'nav.timeline'))),
    tag('h1', {}, esc(meta.h1)),
    tag('p', { class: 'ssr-lead' }, esc(label(locale, 'timelineLead'))),
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

function statusBlock(locale, snap) {
  const meta = routeMetaFor(locale, 'status');
  const surfaces = snap.status.surfaces;
  const list = surfaces.length
    ? tag('ul', { class: 'ssr-status-list' }, surfaces.map((surface) =>
        tag('li', { class: `ssr-status ssr-status--${surface.status === 'operational' ? 'ok' : 'bad'}` }, [
          tag('span', { class: 'ssr-status-name' }, esc(surface.label)),
          tag('span', { class: 'ssr-status-state' }, esc(surface.status === 'operational' ? label(locale, 'statusOk') : label(locale, 'statusBad'))),
        ].join('')),
      ).join(''))
    : tag('p', { class: 'ssr-note' }, esc(label(locale, 'empty')));
  return tag('div', { id: 'ssr', class: 'ssr' }, [
    tag('p', { class: 'ssr-eyebrow' }, esc(tx(locale, 'nav.status'))),
    tag('h1', {}, esc(meta.h1)),
    tag('p', { class: 'ssr-lead' }, esc(meta.lead)),
    snap.status.description ? tag('p', { class: 'ssr-signal' }, esc(plain(snap.status.description, 160))) : '',
    tag('h2', {}, esc(label(locale, 'statusTitle'))),
    list,
    tag('p', { class: 'ssr-note' }, esc(label(locale, 'statusNote'))),
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
    tag('p', { class: 'ssr-eyebrow' }, esc(tx(locale, 'nav.vigil'))),
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
    tag('div', { class: 'guide-cards' }, items),
    tag('h3', {}, esc(label(locale, 'faqTitle'))),
    tag('dl', { class: 'ssr-faq' }, faq.map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
  ].join(''));
}

/* -------------------------------------------------------------- assembling */

function routeMetaFor(locale, key) {
  return shared.meta.routeMeta(key, locale);
}

function documentFor({ origin, pathname }) {
  const resolved = shared.meta.resolvePath(pathname);
  if (!resolved) return null;
  const { key, locale } = resolved;
  const snap = data.snapshot(locale);
  const page = routeMetaFor(locale, key);
  const alternates = shared.meta.alternatesFor(key);

  const body = {
    home: overviewBlock,
    timeline: timelineBlock,
    status: statusBlock,
    vigil: vigilBlock,
  }[key](locale, snap, origin);
  const showGuide = key === 'home';

  const graph = [webSiteNode(origin, locale)];
  const graphNodes = {
    home: () => [
      {
        '@type': 'Dataset',
        name: locale === 'en' ? 'Codex reset records' : 'Codex 额度重置记录',
        description: page.description,
        url: `${origin}${locale === 'en' ? '/en/timeline' : '/timeline'}`,
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
  }[key]();
  graph.push(...graphNodes);
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

  const related = tag('nav', { class: 'seo-related', 'aria-label': label(locale, 'relatedTitle') }, [
    tag('h2', {}, esc(label(locale, 'relatedTitle'))),
    tag('ul', {}, [
      tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(tx(locale, 'nav.timeline')))),
      tag('li', {}, tag('a', { href: locale === 'en' ? '/en/status' : '/status' }, esc(tx(locale, 'nav.status')))),
      tag('li', {}, tag('a', { href: locale === 'en' ? '/en/vigil' : '/vigil' }, esc(tx(locale, 'nav.vigil')))),
      tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
    ].join('')),
  ].join(''));

  return {
    status: 200,
    head,
    body: body + (showGuide ? guideSection(locale) : related),
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
      tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(tx(locale, 'nav.timeline')))),
    ].join('')),
  ].join(''));

  const nav = shared.meta.ROUTE_KEYS.map((key) => {
    const route = routeMetaFor(locale, key);
    return tag('a', { href: route.path }, esc(label(locale, 'nav')[key]));
  }).join('');

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

/* ------------------------------------------------------------ 28-day plan */

const seedPath = path.join(__dirname, '..', 'public', 'data', 'series.json');
let seedCache = null;

function seriesSeed() {
  if (seedCache === undefined || seedCache === null) {
    try {
      seedCache = JSON.parse(require('node:fs').readFileSync(seedPath, 'utf8'));
    } catch {
      seedCache = { startDate: '2026-10-05', days: 28 };
    }
  }
  return seedCache;
}

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

function dayNumber(dateString) {
  const seed = seriesSeed();
  const start = Date.parse(`${seed.startDate}T00:00:00Z`);
  const date = Date.parse(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(date)) return null;
  return Math.round((date - start) / 86_400_000) + 1;
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
    title: 'Codex 28 天计划日历：Day 1–28 更新与重置记录',
    description:
      'Tibo 宣布的 Codex 28 天更新计划（Day 1–28）完整日历：每一天的日期、对应的重置或产品更新，以及已收录与未收录的天数。按美国太平洋时间编号。',
    h1: 'Codex 28 天更新计划：Day 1–28 完整日历',
    lead: '2026 年 10 月 5 日起，Codex 负责人 Tibo 用 28 天逐日发布更新，其中一部分是额度重置。这里是完整的 Day 1–28 对照表：活动日按美国太平洋时间编号，不随访问者时区变化。',
    day: 'Day',
    date: '日期（PT）',
    what: '当天内容',
    status: '状态',
    recorded: '已收录',
    missing: '未收录',
    reset: '重置',
    update: '产品更新',
    banked: '备用额度',
    stats: [
      ['活动窗口', '{start} – {end}'],
      ['已收录', '{n} / 28 天'],
      ['其中重置', '{n} 次'],
    ],
    faqTitle: '关于这个计划',
    faq: [
      {
        q: 'Codex 28 天计划是什么？',
        a: 'Tibo 在 2026 年 10 月初宣布，用 28 天每天发布一次 Codex 更新或额度重置，作为一段连续的发布节奏。活动日按他的编号 Day 1–28 计算。',
      },
      {
        q: '每天都是重置吗？',
        a: '不是。28 天里只有一部分日子是全局重置，其余是产品更新、性能改进或插件发布。本页把两类分开标注。',
      },
      {
        q: '为什么有的天没有内容？',
        a: '上游只收录有公开来源的发布。没有来源的日子保持空白，不推断也不填补，等消息出现后再补。',
      },
    ],
    note: '活动日来自 Tibo 的每日编号；表格中的事件时间为公告时间。数据来自公开来源，仅供参考。',
  },
  en: {
    path: '/en/plan',
    title: 'Codex 28-Day Plan — Full Day 1–28 Calendar',
    description:
      'The complete Codex 28-day run announced by Tibo: every Day 1–28 with its date, the reset or product update that landed, and which days are still unrecorded. Numbered in Pacific Time.',
    h1: 'The Codex 28-day plan: a full Day 1–28 calendar',
    lead: 'Starting 5 October 2026, Codex lead Tibo shipped something every day for 28 days — some days a quota reset, most days a product update. This is the complete Day 1–28 table. Activity days are numbered in Pacific Time and never shift with the visitor’s timezone.',
    day: 'Day',
    date: 'Date (PT)',
    what: 'What landed',
    status: 'State',
    recorded: 'Recorded',
    missing: 'Not recorded',
    reset: 'Reset',
    update: 'Product update',
    banked: 'Banked',
    stats: [
      ['Window', '{start} – {end}'],
      ['Recorded', '{n} / 28 days'],
      ['Of which resets', '{n}'],
    ],
    faqTitle: 'About this run',
    faq: [
      {
        q: 'What is the Codex 28-day plan?',
        a: 'In early October 2026 Tibo announced a run of 28 consecutive days of shipping, each day numbered Day 1 through Day 28. Some days carried a global quota reset; most carried a product update.',
      },
      {
        q: 'Is every day a reset?',
        a: 'No. Only a subset of the 28 days were global resets; the rest were product updates, performance work or plugin launches. This page keeps the two apart.',
      },
      {
        q: 'Why are some days empty?',
        a: 'Only days with a public source are recorded. Nothing is inferred or filled in; a blank day stays blank until a source appears.',
      },
    ],
    note: 'Activity days follow Tibo’s own numbering; event times above are announcement times. Data comes from public sources and is for reference only.',
  },
};

function planRows(locale) {
  const seed = seriesSeed();
  const total = Number(seed.days) || 28;
  const startDate = seed.startDate || '2026-10-05';
  const snap = data.snapshot(locale);
  const byDay = new Map();
  const dateOfDay = (index) => {
    const start = Date.parse(`${startDate}T00:00:00Z`);
    return new Date(start + (index - 1) * 86_400_000).toISOString().slice(0, 10);
  };
  const push = (record) => {
    const date = pacificDate(record.at);
    const number = date ? dayNumber(date) : null;
    if (!number || number < 1 || number > total) return;
    if (!byDay.has(number)) byDay.set(number, []);
    const bucket = byDay.get(number);
    const key = (record.summary || '').slice(0, 40);
    if (key && bucket.some((entry) => (entry.summary || '').slice(0, 40) === key)) return;
    bucket.push(record);
  };

  // The live API only carries signals and grants; the local seed holds the
  // early day-by-day posts, so the two are merged here rather than lost.
  for (const post of Array.isArray(seed.posts) ? seed.posts : []) {
    const summary = (locale === 'en' ? post.en : post.zh || post.en) || '';
    if (!summary) continue;
    push({ at: post.at, type: 'update', pending: false, summary, url: null });
  }
  for (const record of snap.records) push(record);
  return { total, startDate, dateOfDay, byDay, snap };
}

function planDocument({ origin, pathname }) {
  const locale = pathname.startsWith('/en/') ? 'en' : 'zh';
  const copy = PLAN[locale];
  const { total, startDate, dateOfDay, byDay, snap } = planRows(locale);

  const kindOf = (record) => {
    if (record.type === 'reset') return record.pending ? `${copy.reset}（${label(locale, 'pending')}）` : copy.reset;
    if (record.type === 'credits' || record.type === 'boost' || record.type === 'unlock') return copy.banked;
    return copy.update;
  };

  const rows = [];
  for (let index = 1; index <= total; index += 1) {
    const date = dateOfDay(index);
    const items = (byDay.get(index) || []).slice(0, 2);
    const state = items.length ? copy.recorded : copy.missing;
    const cell = items.length
      ? items
          .map((record) => {
            const text = plain(record.summary, 120);
            return `<span class="plan-kind">${esc(kindOf(record))}</span>${text ? ` ${tag('span', { lang: textLang(text, locale) }, esc(text))}` : ''}`;
          })
          .join('<br>')
      : '';
    rows.push(
      `<tr${items.length ? '' : ' class="plan-empty"'}><td>${index}</td><td><time datetime="${date}">${esc(shortDate(date, locale))}</time></td><td>${cell}</td><td>${esc(state)}</td></tr>`,
    );
  }

  const resetCount = [...byDay.values()].flat().filter((record) => record.type === 'reset').length;
  const recordedDays = [...byDay.keys()].length;
  const endDate = dateOfDay(total);
  const stats = copy.stats
    .map(([name, template]) =>
      tag('div', { class: 'ssr-stat' }, [
        tag('span', { class: 'ssr-stat-label' }, esc(name)),
        tag('strong', { class: 'ssr-stat-value' }, esc(
          template.replace('{start}', shortDate(startDate, locale)).replace('{end}', shortDate(endDate, locale))
            .replace('{n}', String(name.includes('重置') || name.toLowerCase().includes('reset') ? resetCount : recordedDays)),
        )),
      ].join('')),
    )
    .join('');

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

  const nav = shared.meta.ROUTE_KEYS.map((key) => {
    const route = routeMetaFor(locale, key);
    return tag('a', { href: route.path }, esc(label(locale, 'nav')[key]));
  }).join('');

  const body = [
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
        tag('a', { href: locale === 'en' ? '/en/' : '/' }, esc(label(locale, 'nav').home)) + ' / ' + tag('span', {}, 'Day 1–28'),
      ),
      tag('h1', {}, esc(copy.h1)),
      tag('p', { class: 'doc-lead' }, esc(copy.lead)),
      tag('div', { class: 'ssr-stats' }, stats),
      tag('table', { class: 'ssr-table plan-table' }, [
        tag('thead', {}, tag('tr', {}, [
          tag('th', { scope: 'col' }, copy.day),
          tag('th', { scope: 'col' }, esc(copy.date)),
          tag('th', { scope: 'col' }, esc(copy.what)),
          tag('th', { scope: 'col' }, esc(copy.status)),
        ].join(''))),
        tag('tbody', {}, rows.join('')),
      ].join('')),
      tag('p', { class: 'ssr-note' }, esc(copy.note)),
      tag('section', { class: 'doc-section' }, [
        tag('h2', {}, esc(copy.faqTitle)),
        tag('dl', { class: 'doc-faq' }, copy.faq.map((item) => tag('dt', {}, esc(item.q)) + tag('dd', {}, esc(item.a))).join('')),
      ].join('')),
      tag('aside', { class: 'doc-related' }, [
        tag('h2', {}, esc(label(locale, 'relatedTitle'))),
        tag('ul', {}, [
          tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(tx(locale, 'nav.timeline')))),
          tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
          tag('li', {}, tag('a', { href: articlePath('codex-5-hour-limit', locale) }, esc(articleMeta('codex-5-hour-limit', locale).h1))),
        ].join('')),
      ].join('')),
    ].join('')),
    tag('footer', { class: 'colophon' }, tag('div', { class: 'colophon-inner' }, [
      tag('p', { class: 'colophon-note' }, esc(label(locale, 'official'))),
      tag('p', { class: 'colophon-source' }, esc(label(locale, 'note' in copy ? 'dataNote' : 'dataNote'))),
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
  const nav = shared.meta.ROUTE_KEYS.map((key) => {
    const route = routeMetaFor(locale, key);
    return tag('a', { href: route.path }, esc(label(locale, 'nav')[key]));
  }).join('');
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
        tag('li', {}, tag('a', { href: locale === 'en' ? '/en/timeline' : '/timeline' }, esc(tx(locale, 'nav.timeline')))),
        tag('li', {}, tag('a', { href: locale === 'en' ? '/en/plan' : '/plan' }, esc(locale === 'en' ? 'The 28-day plan' : '28 天更新计划'))),
        tag('li', {}, tag('a', { href: articlePath('codex-reset', locale) }, esc(articleMeta('codex-reset', locale).h1))),
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
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /__health',
    '',
    'User-agent: GPTBot',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

function llmsTxt(origin) {
  const lines = [
    '# Codex Reset',
    '',
    '> Unofficial tracker for OpenAI Codex quota resets: the last verified reset, 24/48 hour probabilities, the 28-day activity calendar, reset history and Codex service status. Chinese is the default language; English lives under /en/.',
    '',
    '## Pages',
    ...shared.meta.ROUTE_KEYS.map((key) => {
      const route = routeMetaFor('zh', key);
      return `- [${label('zh', 'nav')[key]}](${origin}${route.path}): ${route.description}`;
    }),
    ...shared.meta.ROUTE_KEYS.map((key) => {
      const route = routeMetaFor('en', key);
      return `- [${label('en', 'nav')[key]}](${origin}${route.path}): ${route.description}`;
    }),
    '',
    '## The 28-day run',
    `- [Codex 28 天更新计划](${origin}/plan): 完整的 Day 1–28 日历，每天对应的重置或产品更新。`,
    `- [Codex 28-day plan](${origin}/en/plan): the full Day 1–28 calendar with what landed each day.`,
    '',
    '## Monthly archive',
    `- [按月归档](${origin}/archive): 每个月一页的重置记录，含时间、类型与间隔。`,
    `- [Monthly archive](${origin}/en/archive): one page per month of reset records.`,
    '',
    '## Guides',
    ...SLUGS.map((slug) => {
      const meta = articleMeta(slug, 'zh');
      return `- [${meta.h1}](${origin}${meta.path}): ${meta.description}`;
    }),
    '',
    '## Data',
    `- [Forecast JSON](${origin}/api/forecast): current probabilities and the last reset time.`,
    `- [Timeline JSON](${origin}/api/timeline): every recorded reset and banked grant.`,
    `- [Status JSON](${origin}/api/status): Codex surface status from OpenAI Status.`,
    '',
    '## Notes',
    '- Unofficial project, not affiliated with OpenAI.',
    '- A reset “announcement” and a landed reset are different records; check the confirmation state before reporting one.',
    '',
  ];
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
  articleDocument,
  planDocument,
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
