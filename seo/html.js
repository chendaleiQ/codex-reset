'use strict';
/**
 * Tiny HTML helpers for the server renderer.
 *
 * Everything that reaches the browser goes through `esc()`; attribute values
 * are escaped separately because the two contexts have different rules.
 */

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, (character) => ENTITIES[character]);
}

/** Serialises an attribute map. `false`, null and undefined are omitted. */
function attrs(map = {}) {
  return Object.entries(map)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${esc(value)}"`))
    .join('');
}

function tag(name, map, children) {
  const head = `<${name}${attrs(map)}>`;
  if (children === undefined || children === null) return head;
  const body = Array.isArray(children) ? children.join('') : String(children);
  return `${head}${body}</${name}>`;
}

const voidTag = (name, map) => `<${name}${attrs(map)}>`;

/** JSON-LD payloads are script contents: `<` must never close the tag early. */
function jsonLd(payload) {
  const body = JSON.stringify(payload, null, 0)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${body}</script>`;
}

/** ISO date (YYYY-MM-DD) from a timestamp, or null. */
function isoDate(value) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

/** Hour-precision ISO stamp for sitemap lastmod. */
function isoStamp(value) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { esc, attrs, tag, voidTag, jsonLd, isoDate, isoStamp };
