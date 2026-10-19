/** Tiny DOM helpers plus the authored icon set. No framework, no innerHTML soup. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') node.setAttribute('style', value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const svgEl = (tag, props = {}, ...children) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) if (child) node.append(child);
  return node;
};

export function replace(host, ...nodes) {
  host.replaceChildren(...nodes.flat().filter(Boolean));
}

export function on(node, type, handler, options) {
  node?.addEventListener(type, handler, options);
  return () => node?.removeEventListener(type, handler, options);
}

export const text = (node, value) => {
  if (node) node.textContent = value ?? '';
  return node;
};

/** Only https and same-origin absolute paths survive; anything else is dropped. */
export function safeHref(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeXUrl(value) {
  const href = safeHref(value);
  if (!href) return null;
  try {
    const url = new URL(href);
    if (!/(^|\.)x\.com$|(^|\.)twitter\.com$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function link(href, label, { external = false, className = '' } = {}) {
  const safe = safeHref(href);
  if (!safe) return el('span', { class: className, text: label });
  return el(
    'a',
    {
      href: safe,
      class: className,
      ...(external || safe.startsWith('http') ? { rel: 'noopener nofollow', target: '_blank' } : {}),
    },
    label,
  );
}

/* --------------------------------------------------------------- icon set --
   Authored on a 24px grid: one stroke weight, one round join, no emoji. */

const PATHS = {
  clock: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 7.5V12l3 1.8'],
  activity: ['M3 12h3.4l2.3-6 3 12 2.6-6H21'],
  shield: ['M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6l-7-2.5Z'],
  info: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 11v5.5', 'M12 7.8h.01'],
  bell: ['M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z', 'M10 19a2 2 0 0 0 4 0'],
  reply: ['M20 12.5c0 3.6-3.6 6.5-8 6.5-1 0-2-.2-2.9-.5L4.5 20l1.3-3.6A6.4 6.4 0 0 1 4 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5Z'],
  repost: ['M7 4.5 4 8h12a3 3 0 0 1 3 3v1.5', 'M17 19.5 20 16H8a3 3 0 0 1-3-3v-1.5'],
  heart: [
    'M12 19s-6.5-3.8-6.5-8.3A3.7 3.7 0 0 1 12 8.6a3.7 3.7 0 0 1 6.5 2.1C18.5 15.2 12 19 12 19Z',
  ],
  external: ['M9 5.5H5.5v13h13V15', 'M13.5 5.5H19v5.5', 'M18.4 5.6 11 13'],
  check: ['M5 12.5 9.5 17 19 7'],
  alert: ['M12 4.5 2.8 20h18.4L12 4.5Z', 'M12 10v4.2', 'M12 17.2h.01'],
  ticket: ['M4 8.5A2.5 2.5 0 0 0 4 15.5v2h16v-2a2.5 2.5 0 0 1 0-7v-2H4v2Z', 'M11 8v8'],
  flame: ['M12 3.8c3.2 3 5.2 5.4 5.2 8.2a5.2 5.2 0 0 1-10.4 0c0-1.3.6-2.6 1.7-4'],
  arrow: ['M5 12h13', 'm12.5 6.5 5.5 5.5-5.5 5.5'],
  down: ['M12 5v13', 'm6.5 12.5 5.5 5.5 5.5-5.5'],
  up: ['M12 19V6', 'm6.5 11.5 5.5-5.5 5.5 5.5'],
  sortable: ['M8.5 10 12 6.2 15.5 10', 'M8.5 14 12 17.8 15.5 14'],
  train: ['M7 4.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z', 'M5 10h14', 'm8.5 21-1.5-3.5', 'm15.5 21 1.5-3.5'],
  share: ['M12 15V4.5', 'm7.5 9 4.5-4.5L16.5 9', 'M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14'],
  sun: ['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z', 'M12 2.5v2', 'M12 19.5v2', 'M2.5 12h2', 'M19.5 12h2', 'm5.2 5.2 1.4 1.4', 'm17.4 17.4 1.4 1.4', 'm18.8 5.2-1.4 1.4', 'm6.6 17.4-1.4 1.4'],
  moon: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'],
};

export function icon(name, { size = 16, className = 'glyph', title } = {}) {
  const paths = PATHS[name] ?? PATHS.info;
  const svg = svgEl(
    'svg',
    {
      class: className,
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      'aria-hidden': title ? 'false' : 'true',
      role: title ? 'img' : 'presentation',
      ...(title ? { 'aria-label': title } : {}),
    },
    title ? svgEl('title', {}, title) : null,
    ...paths.map((d) => svgEl('path', { d })),
  );
  return svg;
}

export function clear(node) {
  node?.replaceChildren();
}

/** Copies a string and reports whether it worked. */
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
