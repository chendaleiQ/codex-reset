'use strict';
/**
 * Loads the browser's pure-data ES modules from Node without adding a build
 * step or changing the package type.
 *
 * The sources are rewritten into `data:` URLs, resolving relative imports the
 * same way the browser would, so a module can import its neighbours and still
 * be loaded here.
 */

const fs = require('node:fs');
const path = require('node:path');

const cache = new Map();

function moduleUrl(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const source = fs
    .readFileSync(absolute, 'utf8')
    .replace(/from (['"])(\.[^'"]+)\1/g, (match, quote, relative) => {
      const target = path.resolve(path.dirname(absolute), relative);
      return `from ${quote}${moduleUrl(target)}${quote}`;
    });
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(absolute, url);
  return url;
}

module.exports = { moduleUrl };
