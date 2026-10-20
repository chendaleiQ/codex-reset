/** Shared view parts: the leaf, the charts, the line strip, the pulse feed. */

import { el, icon, link, safeHref, safeXUrl, svgEl } from '../dom.js';
import { formatCompact, formatDay, formatDateTime, formatDays, formatNumber, relativeTime } from '../format.js';

export function leaf(t, { title, note, tools, id }, ...children) {
  const head = el('div', { class: 'leaf-head' }, el('h2', {}, title));
  if (note) head.append(el('p', { class: 'leaf-note' }, note));
  if (tools) head.append(el('div', { class: 'leaf-tools' }, tools));
  return el('section', { class: 'leaf', ...(id ? { id } : {}) }, head, ...children);
}

/* ------------------------------------------------------------------ line strip */

export function linesStrip(surfaces, t) {
  const rows = el('div', { class: 'lines' });
  for (const surface of surfaces) {
    const tone = ['degraded_performance', 'under_maintenance'].includes(surface.status)
      ? 'warn'
      : ['partial_outage', 'major_outage'].includes(surface.status)
        ? 'bad'
        : 'ok';
    rows.append(
      el(
        'div',
        { class: 'line-row', dataset: { state: tone } },
        el('span', { class: 'line-swatch', 'aria-hidden': 'true' }),
        el('span', { class: 'line-name' }, surface.label),
        el('span', { class: 'line-state' }, t(`state.${surface.status}`)),
      ),
    );
  }
  return rows;
}

/* ---------------------------------------------------------------- rhythm chart */

const RHYTHM_H = 228;

export function rhythmChart(gaps, { locale, t, readout }) {
  const wrap = el('div', { class: 'rhythm-chart' });
  const plot = el('div', { class: 'plot' });
  const caption = el('p', { class: 'rhythm-legend' });
  wrap.append(plot, caption);
  if (!gaps.length) {
    plot.append(el('p', { class: 'empty' }, t('timeline.empty')));
    return wrap;
  }

  const draw = () => {
    const width = Math.max(320, Math.round(plot.clientWidth || 900));
    const padL = 34;
    const padR = 16;
    const padT = 22;
    const padB = 34;
    const innerW = width - padL - padR;
    const innerH = RHYTHM_H - padT - padB;
    const maxDays = Math.ceil(Math.max(...gaps.map((g) => g.days)) + 1);
    const mean = gaps.reduce((sum, g) => sum + g.days, 0) / gaps.length;
    const step = innerW / gaps.length;
    const barW = Math.max(3, Math.min(28, step - Math.max(3, step * 0.28)));
    const scaleY = (days) => padT + innerH - (days / maxDays) * innerH;
    const ticks = [0, Math.round(maxDays / 2), maxDays];

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${RHYTHM_H}`, width, height: RHYTHM_H, role: 'img' });

    const grid = svgEl('g', { class: 'plot-grid' });
    for (const tick of ticks) {
      grid.append(svgEl('line', { x1: padL, x2: width - padR, y1: scaleY(tick), y2: scaleY(tick) }));
    }
    const axis = svgEl('g', { class: 'plot-axis' });
    for (const tick of ticks) {
      axis.append(svgEl('text', { x: padL - 8, y: scaleY(tick) + 4, 'text-anchor': 'end' }, String(tick)));
    }

    const bars = svgEl('g', { class: 'plot-bars' });
    gaps.forEach((gap, index) => {
      const x = padL + index * step + (step - barW) / 2;
      const y = scaleY(gap.days);
      const group = svgEl('g', { tabindex: '0', role: 'listitem' });
      const hot = gap.days >= mean;
      group.append(
        svgEl('rect', {
          x,
          y,
          width: barW,
          height: Math.max(2, padT + innerH - y),
          'data-hot': String(hot),
          rx: 1,
        }),
        svgEl('title', {}, `${formatDay(new Date(gap.at).toISOString(), locale) ?? ''} · ${formatDays(gap.days, locale)}d`),
      );
      const describe = () => {
        if (!readout) return;
        readout.replaceChildren(
          el('strong', {}, `${formatDays(gap.days, locale)} ${locale === 'zh' ? '天' : 'days'}`),
          document.createTextNode(
            ` — ${formatDay(new Date(gap.at).toISOString(), locale) ?? ''} ${locale === 'zh' ? '重置，距上一次' : 'reset, after'} ${formatDays(gap.days, locale)} ${locale === 'zh' ? '天' : 'days'}`,
          ),
        );
      };
      group.addEventListener('mouseenter', describe);
      group.addEventListener('focus', describe);
      group.addEventListener('click', () => link(gap.event.url, '').click?.());
      bars.append(group);
    });

    const meanY = scaleY(mean);
    svg.append(
      grid,
      svgEl('line', { class: 'plot-mean', x1: padL, x2: width - padR, y1: meanY, y2: meanY }),
      svgEl(
        'text',
        { class: 'plot-mean-label', x: width - padR, y: meanY - 6, 'text-anchor': 'end' },
        `${t('timeline.gap')} ${locale === 'zh' ? '均值' : 'mean'} ${formatDays(mean, locale)}`,
      ),
      axis,
      bars,
    );
    plot.replaceChildren(svg);
  };

  draw();
  const observer = new ResizeObserver(() => draw());
  observer.observe(plot);
  wrap.cleanup = () => observer.disconnect();
  return wrap;
}

/* ------------------------------------------------------------- hour histogram */

export function hoursChart(buckets, { locale, t, zone = 'UTC' }) {
  const max = Math.max(1, ...buckets);
  const peakFloor = Math.max(1, Math.round(max * 0.5));
  const nowHour = zone === 'UTC' ? new Date().getUTCHours() : new Date().getHours();
  const plot = el('div', { class: 'hours-plot' });
  const labels = el('div', { class: 'hours-labels' });
  for (let h = 0; h < 24; h += 1) {
    const peak = buckets[h] >= peakFloor;
    const cell = el(
      'div',
      {
        class: 'hours-cell',
        dataset: { peak: String(peak), now: String(h === nowHour) },
        title: `${String(h).padStart(2, '0')}:00 · ${buckets[h]} ${locale === 'zh' ? '次' : 'events'}`,
      },
      el('span', { class: 'hours-bar', style: `--h:${Math.round((buckets[h] / max) * 100)}%` }),
    );
    plot.append(cell);
    labels.append(el('span', { dataset: { peak: String(peak) } }, String(h).padStart(2, '0')));
  }
  return el('div', { class: 'stack' }, plot, labels, el('p', { class: 'clock-verdict' }, t('radar.hoursNote')));
}

/* ----------------------------------------------------------------- pulse feed */

const TIBO_PROFILE = 'https://x.com/thsottiaux';
const LINK_TOKEN = /(https?:\/\/[^\s]+|@[A-Za-z0-9_]{1,15}|#[\p{L}\p{N}_]+)/gu;
const URL_TRAIL = /[.,!?;:)\]'"”’。，！？；：、）】]+$/u;

/** Links, mentions and hashtags are what make a post read as a tweet. */
function linkify(value) {
  const source = String(value ?? '');
  const nodes = [];
  let last = 0;
  for (const match of source.matchAll(LINK_TOKEN)) {
    let token = match[0];
    let trail = '';
    if (token.startsWith('http')) {
      const trimmed = token.replace(URL_TRAIL, '');
      trail = token.slice(trimmed.length);
      token = trimmed;
    }
    if (match.index > last) nodes.push(document.createTextNode(source.slice(last, match.index)));
    if (token.startsWith('http')) {
      nodes.push(link(token, token, { external: true, className: 'feed-link' }));
    } else if (token.startsWith('@')) {
      nodes.push(link(`https://x.com/${token.slice(1)}`, token, { external: true, className: 'feed-link' }));
    } else {
      nodes.push(
        link(`https://x.com/hashtag/${encodeURIComponent(token.slice(1))}`, token, { external: true, className: 'feed-link' }),
      );
    }
    if (trail) nodes.push(document.createTextNode(trail));
    last = match.index + match[0].length;
  }
  if (last < source.length) nodes.push(document.createTextNode(source.slice(last)));
  return nodes;
}

/**
 * One post as a single-author tweet: avatar, author line, text, engagement.
 * The evidence category stays on the row, so a social-looking post never
 * passes for a verified reset.
 */
export function feedItem(post, { t, locale, now = Date.now() }) {
  const kindKey = `radar.kind.${post.kind}`;
  const kindLabel = t(kindKey);
  const kindNote = t(`radar.kindNote.${post.kind}`);
  const xUrl = safeXUrl(post.url);
  const when = relativeTime(post.at, now, locale);
  const absolute = formatDateTime(post.at, locale);

  const kind = el(
    'span',
    { class: 'feed-kind', dataset: { kind: post.kind }, title: kindNote === `radar.kindNote.${post.kind}` ? undefined : kindNote },
    kindLabel === kindKey ? post.kind : kindLabel,
  );

  let time;
  if (xUrl) {
    time = link(xUrl, when, { external: true, className: 'feed-time' });
    if (absolute) time.title = absolute;
  } else {
    time = el('time', { class: 'feed-time', datetime: post.at ?? undefined }, when);
  }

  const author = link(TIBO_PROFILE, 'Tibo', { external: true, className: 'feed-author' });
  author.append(
    el(
      'span',
      { class: 'feed-verified', role: 'img', 'aria-label': t('feed.verified'), title: t('feed.verified') },
      icon('check', { size: 10 }),
    ),
  );

  const head = el(
    'header',
    { class: 'feed-head' },
    author,
    el('span', { class: 'feed-handle' }, '@thsottiaux'),
    el('span', { class: 'feed-sep', 'aria-hidden': 'true' }, '·'),
    time,
    kind,
  );

  const body = el('div', { class: 'feed-body' }, head);
  if (post.isReply && post.replyingTo) {
    body.append(el('p', { class: 'feed-reply' }, t('feed.replyingTo', { handle: post.replyingTo })));
  }

  const translated = locale !== 'en' && post.localizedText && post.localizedText !== post.text;
  body.append(el('p', { class: 'feed-text' }, ...linkify(translated ? post.localizedText : post.text || post.localizedText || '')));
  if (translated) {
    body.append(
      el(
        'details',
        { class: 'translation' },
        el('summary', {}, t('common.showOriginal')),
        el('p', {}, ...linkify(post.text)),
      ),
    );
  }

  const foot = el('div', { class: 'feed-foot' });
  if (post.replies || post.reposts || post.likes) {
    const stats = el('span', { class: 'feed-stats' });
    const stat = (name, value, labelKey) =>
      el(
        'span',
        { class: 'feed-stat', title: t(labelKey) },
        icon(name, { size: 16 }),
        el('span', { class: 'sr-only' }, t(labelKey)),
        formatCompact(value, locale),
      );
    if (post.replies) stats.append(stat('reply', post.replies, 'feed.replies'));
    if (post.reposts) stats.append(stat('repost', post.reposts, 'feed.reposts'));
    if (post.likes) stats.append(stat('heart', post.likes, 'feed.likes'));
    foot.append(stats);
  }
  if (xUrl) {
    const open = link(xUrl, t('common.viewOnX'), { external: true, className: 'feed-open' });
    open.append(icon('external', { size: 13 }));
    foot.append(open);
  }
  if (foot.childElementCount) body.append(foot);

  const avatar = link(
    TIBO_PROFILE,
    el('img', { src: '/img/tibo-avatar.jpg', alt: '', width: 48, height: 48, loading: 'lazy', decoding: 'async' }),
    { external: true, className: 'feed-avatar' },
  );
  avatar.setAttribute('aria-label', 'Tibo (@thsottiaux)');

  return el('article', { class: 'feed-item', dataset: { kind: post.kind } }, avatar, body);
}

/* ----------------------------------------------------------------- crowd poll */

export function pollBlock(poll, { t, locale, onVote }) {
  const wrap = el('div', { class: 'stack' });
  if (!poll) {
    wrap.append(el('p', { class: 'empty' }, t('poll.closed')));
    return wrap;
  }
  const rows = el('div', { class: 'poll' });
  const unlocked = poll.unlocked;
  for (const bucket of poll.buckets) {
    const label = t(`poll.window.${bucket.id}`);
    const row = el(
      'div',
      { class: 'poll-row', dataset: { mine: String(false), locked: String(!unlocked) } },
      el('span', { class: 'poll-label' }, label),
      el('span', { class: 'poll-bar' }, el('span', { style: `--w:${unlocked ? bucket.share : 0}%` })),
      el('span', { class: 'poll-share' }, unlocked ? `${bucket.share}%` : '—'),
    );
    rows.append(row);
  }
  wrap.append(rows);

  const choices = el('div', { class: 'poll-choice' });
  for (const id of poll.openBuckets) {
    choices.append(
      el('button', { type: 'button', class: 'filter', onclick: () => onVote?.(id) }, t(`poll.window.${id}`)),
    );
  }
  if (poll.openBuckets.length) wrap.append(choices);

  const meta = el('p', { class: 'field-hint' });
  const parts = [];
  parts.push(t('poll.votes', { n: formatNumber(poll.totalVotes, locale) }));
  if (!unlocked) parts.push(t('poll.locked', { n: formatNumber(Math.max(0, poll.minVotes - poll.totalVotes), locale) }));
  if (poll.accuracy) {
    parts.push(
      t('poll.accuracy', {
        resolved: formatNumber(poll.accuracy.resolved_polls, locale),
        correct: formatNumber(poll.accuracy.crowd_correct, locale),
        pct: formatNumber(poll.accuracy.crowd_accuracy, locale),
      }),
    );
  }
  if (poll.model) {
    parts.push(t('poll.modelLine', { h24: poll.model.displayed_24h ?? '—', h48: poll.model.displayed_48h ?? '—' }));
  }
  meta.textContent = parts.join(' · ');
  wrap.append(meta);
  return wrap;
}

/* ---------------------------------------------------------------------- FAQ */

export function faqBlock(t) {
  const keys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  const list = el('div', { class: 'faq' });
  for (const key of keys) {
    list.append(
      el(
        'details',
        {},
        el('summary', {}, t(`faq.${key}`)),
        el('p', {}, t(`faq.a${key.slice(1)}`)),
      ),
    );
  }
  return list;
}

/* -------------------------------------------------------------------- errors */

export function errorBlock(t, { onRetry } = {}) {
  const wrap = el('div', { class: 'stack' });
  wrap.append(
    el('p', {}, t('error.body')),
    el('div', { class: 'row' }, el('button', { type: 'button', class: 'btn', onclick: () => onRetry?.() }, t('common.retry'))),
  );
  return wrap;
}

export function sourceLink(t, href, label) {
  const safe = safeHref(href);
  if (!safe) return null;
  return link(safe, label ?? (safe.startsWith('/') ? t('common.details') : t('common.viewOnX')), {
    external: !safe.startsWith('/'),
    className: 'chit',
  });
}

export { formatDateTime, formatCompact, formatDays, formatDay };
