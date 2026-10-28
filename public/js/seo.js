/**
 * Keeps the document head in sync with the router.
 *
 * The server already ships the correct head for the first paint; this module
 * only matters after a client-side navigation, where the URL changes without a
 * document load. Without it, every page would keep the landing page's title.
 */

import { routeMeta, alternatesFor } from './seo-meta.js';

function metaTag(attribute, name, content) {
  let node = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, name);
    document.head.append(node);
  }
  node.setAttribute('content', content);
  return node;
}

function linkTag(rel, href, hreflang) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement('link');
    node.setAttribute('rel', rel);
    if (hreflang) node.setAttribute('hreflang', hreflang);
    document.head.append(node);
  }
  node.setAttribute('href', href);
  return node;
}

export function applyPageSeo(key, locale) {
  const meta = routeMeta(key, locale);
  if (!meta) return;
  const absolute = (path) => `${location.origin}${path}`;

  document.title = meta.title;
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-Hans';

  metaTag('name', 'description', meta.description);
  linkTag('canonical', absolute(meta.path));

  const alternates = alternatesFor(key);
  linkTag('alternate', absolute(alternates.zh), 'zh-Hans');
  linkTag('alternate', absolute(alternates.en), 'en');
  linkTag('alternate', absolute(alternates.xDefault), 'x-default');

  metaTag('property', 'og:title', meta.title);
  metaTag('property', 'og:description', meta.description);
  metaTag('property', 'og:url', absolute(meta.path));
  metaTag('property', 'og:locale', locale === 'en' ? 'en_US' : 'zh_CN');
  metaTag('property', 'og:locale:alternate', locale === 'en' ? 'zh_CN' : 'en_US');
  metaTag('name', 'twitter:title', meta.title);
  metaTag('name', 'twitter:description', meta.description);
}

/** Rewrite the click-through targets the server rendered once. */
export function localizeLinks(locale) {
  const prefix = locale === 'en' ? '/en' : '';
  const map = {
    plan: `${prefix}/plan`,
    guide: `${prefix}/guide/codex-reset`,
    'guide-limit': `${prefix}/guide/codex-5-hour-limit`,
    'guide-banked': `${prefix}/guide/codex-banked-reset`,
  };
  for (const node of document.querySelectorAll('[data-seo-link]')) {
    const next = map[node.dataset.seoLink];
    if (next) node.setAttribute('href', next);
  }
}
