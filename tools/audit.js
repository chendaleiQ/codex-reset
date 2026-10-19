/**
 * Geometry and contrast audit for one route. Complements the anti-pattern
 * detector with numeric checks: effective contrast per text node, container
 * overflow, alignment of major block edges, and control hit sizes.
 *
 *   node tools/probe.js <url> --eval "$(cat tools/audit.js)" --width W --height H
 */

(() => {
  const parseColor = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  const over = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const ratio = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  const effectiveBackground = (node) => {
    let bg = { r: 0, g: 0, b: 0, a: 0 };
    const chain = [];
    let current = node;
    while (current && current !== document.documentElement.parentNode) {
      const colour = parseColor(getComputedStyle(current).backgroundColor);
      if (colour && colour.a > 0) chain.push(colour);
      current = current.parentElement;
    }
    // Composite from the root down.
    for (let i = chain.length - 1; i >= 0; i -= 1) bg = over(chain[i], bg);
    if (bg.a < 1) {
      const root = parseColor(getComputedStyle(document.documentElement).backgroundColor);
      bg = over(bg, root && root.a > 0 ? root : { r: 255, g: 255, b: 255, a: 1 });
    }
    return bg;
  };

  const textNodes = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const value = walk.currentNode.nodeValue.trim();
    if (value.length < 2) continue;
    const parent = walk.currentNode.parentElement;
    if (!parent) continue;
    if (parent.closest('[aria-hidden="true"]')) continue;
    const style = getComputedStyle(parent);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.5) continue;
    textNodes.push({ node: walk.currentNode, parent, style, value });
  }

  const contrast = [];
  for (const entry of textNodes) {
    const fg = parseColor(entry.style.color);
    if (!fg) continue;
    const bg = effectiveBackground(entry.parent);
    const composited = fg.a < 1 ? over(fg, bg) : fg;
    const size = parseFloat(entry.style.fontSize);
    const weight = Number(entry.style.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const value = ratio(composited, bg);
    if (value < need) {
      contrast.push({
        selector: `${entry.parent.tagName}.${(entry.parent.className || '').toString().split(' ')[0]}`,
        text: entry.value.slice(0, 26),
        size,
        ratio: Math.round(value * 100) / 100,
        need,
      });
    }
  }

  const clipped = [];
  for (const node of document.querySelectorAll('body *')) {
    const style = getComputedStyle(node);
    if (style.overflow === 'visible' && style.overflowX === 'visible') continue;
    if (node.scrollHeight - node.clientHeight > 4 && node.clientHeight > 0) {
      clipped.push({ selector: `${node.tagName}.${(node.className || '').toString().split(' ')[0]}`, delta: node.scrollHeight - node.clientHeight });
    }
  }

  const small = [];
  for (const node of document.querySelectorAll('a[href], button, select, input, summary')) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (getComputedStyle(node).position === 'absolute' && rect.height < 10) continue;
    if (rect.height < 28 || rect.width < 24) {
      small.push({ selector: `${node.tagName}.${(node.className || '').toString().split(' ')[0]}`, w: Math.round(rect.width), h: Math.round(rect.height) });
    }
  }

  const edges = {};
  for (const selector of ['.wordmark', '.page-head h1', '.route', '.leaf', '.departure-label', '.colophon-mark']) {
    const node = document.querySelector(selector);
    if (node) edges[selector] = Math.round(node.getBoundingClientRect().left);
  }

  return {
    fontsLoaded: document.fonts ? [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family) : null,
    contrast,
    clipped: clipped.slice(0, 8),
    smallTargets: small.slice(0, 10),
    edges,
    docHeight: Math.round(document.documentElement.scrollHeight),
  };
})();
