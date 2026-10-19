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
        svgEl('title', {}, `${formatDay(gap.event.announcedAt, locale) ?? ''} · ${formatDays(gap.days, locale)}d`),
      );
      const describe = () => {
        if (!readout) return;
        readout.replaceChildren(
          el('strong', {}, `${formatDays(gap.days, locale)} ${locale === 'zh' ? '天' : 'days'}`),
          document.createTextNode(
            ` — ${formatDay(gap.event.announcedAt, locale) ?? ''} ${locale === 'zh' ? '重置，距上一次' : 'reset, after'} ${formatDays(gap.days, locale)} ${locale === 'zh' ? '天' : 'days'}`,
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

/**
 * A post is shown in the reader's language. The original is never hidden, only
 * folded, and the fold is labelled with what the translation is.
 */
export function feedItem(post, { t, locale, now = Date.now() }) {
  const kindKey = `radar.kind.${post.kind}`;
  const kindLabel = t(kindKey);
  const kindNote = t(`radar.kindNote.${post.kind}`);
  const meta = el(
    'div',
    { class: 'feed-meta' },
    el(
      'span',
      { class: 'feed-kind', dataset: { kind: post.kind }, title: kindNote === `radar.kindNote.${post.kind}` ? undefined : kindNote },
      kindLabel === kindKey ? post.kind : kindLabel,
    ),
    el('span', { class: 'feed-time' }, relativeTime(post.at, now, locale)),
  );
  const body = el('div', { class: 'feed-body' });

  const translated = locale !== 'en' && post.localizedText && post.localizedText !== post.text;
  body.append(el('p', { class: 'feed-text' }, translated ? post.localizedText : post.text || post.localizedText || ''));
  if (translated) {
    body.append(
      el(
        'details',
        { class: 'translation' },
        el('summary', {}, t('common.showOriginal')),
        el('p', {}, post.text),
      ),
    );
  }
  const foot = el('div', { class: 'feed-foot' });
  const xUrl = safeXUrl(post.url);
  if (xUrl) foot.append(link(xUrl, t('common.viewOnX'), { external: true, className: 'chit' }));
  if (post.isReply && post.replyingTo) foot.append(el('span', { class: 'muted' }, `↩ @${post.replyingTo}`));
  if (translated) foot.append(el('span', { class: 'muted' }, t('common.translated')));
  if (post.replies || post.reposts || post.likes) {
    const stats = el('span', { class: 'feed-stats' });
    if (post.replies) stats.append(el('span', { class: 'feed-stat' }, icon('reply', { size: 13 }), formatCompact(post.replies, locale)));
    if (post.reposts) stats.append(el('span', { class: 'feed-stat' }, icon('repost', { size: 13 }), formatCompact(post.reposts, locale)));
    if (post.likes) stats.append(el('span', { class: 'feed-stat' }, icon('heart', { size: 13 }), formatCompact(post.likes, locale)));
    foot.append(stats);
  }
  body.append(foot);
  return el('article', { class: 'feed-item', dataset: { kind: post.kind } }, meta, body);
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
