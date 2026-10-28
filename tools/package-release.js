#!/usr/bin/env node
// Snapshot only runtime/deployment files; never package .git, credentials or local tooling.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const target = process.argv[2];
if (!target || !fs.existsSync(target) || fs.readdirSync(target).length) {
  throw new Error('Pass an existing empty staging directory');
}
const files = {};
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');
function copy(relative) {
  const source = path.join(root, relative);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source).sort()) copy(`${relative}/${name}`);
  } else {
    const data = fs.readFileSync(source);
    const dest = path.join(target, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    files[relative] = digest(data);
  }
}
for (const file of ['server.js', 'package.json', 'seo', 'public', 'deploy']) copy(file);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha256 = digest(JSON.stringify(files));
const createdAt = new Date().toISOString();
const commit = git('rev-parse', 'HEAD');
const dirty = !!git('status', '--porcelain');
if (process.env.GITHUB_ACTIONS === 'true' && (dirty || commit !== process.env.GITHUB_SHA)) {
  throw new Error('Actions must package a clean checkout of the triggering commit');
}
const id = `${createdAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${sha256.slice(0, 12)}`;
fs.writeFileSync(path.join(target, 'RELEASE.json'), JSON.stringify({
  id, createdAt, commit, dirty, sha256, files,
}, null, 2) + '\n');
process.stdout.write(id + '\n');
