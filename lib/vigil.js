'use strict';
/**
 * The vigil wall, stored on this server.
 *
 * This is the only writable surface on the site. The container is read-only, so
 * the store lives in `STATE_DIR` (mounted from the host) and every write is an
 * atomic rename; if the directory is not writable the API says so instead of
 * pretending the entry was saved.
 *
 * Entries are scoped to the current waiting epoch — the stretch since the last
 * confirmed reset — which is what the page has always meant by "waiting
 * together". One name per epoch, so re-submitting a name updates it instead of
 * stacking duplicates.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const model = require('./model');

const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..', 'state');
const STORE = path.join(STATE_DIR, 'vigil.json');
const MAX_ENTRIES = 800;
const MAX_NAME = 24;
const MAX_DAYS = 365;
const MAX_AMENS = 99;

const EMPTY = { version: 1, entries: [], amens: {}, updated_at: null };

function cleanName(value) {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if ([...text].length > MAX_NAME) return [...text].slice(0, MAX_NAME).join('');
  return text;
}

function cleanCountry(value) {
  const text = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : null;
}

function cleanDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(MAX_DAYS, Math.round(number)));
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    if (!parsed || !Array.isArray(parsed.entries)) return { ...EMPTY };
    return {
      version: 1,
      entries: parsed.entries.filter((entry) => entry && typeof entry.name === 'string'),
      amens: parsed.amens && typeof parsed.amens === 'object' ? parsed.amens : {},
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

let writeMode = null;

function writeStore(store) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const next = { ...store, version: 1, updated_at: new Date().toISOString() };
  const temporary = `${STORE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next, null, 1));
  fs.renameSync(temporary, STORE);
  if (writeMode !== 'rw') writeMode = 'rw';
  return next;
}

/**
 * The ledger is injected by the caller (`bind`) rather than required here, so
 * this module stays a plain store and the server owns the data snapshot.
 */
let ledgerEvents = [];

function bind(events) {
  ledgerEvents = Array.isArray(events) ? events : [];
}

/** Current epoch: the wait that started with the last confirmed reset. */
function currentEpoch() {
  const resets = ledgerEvents.filter((event) => event.kind === 'reset' && event.state === 'confirmed');
  const last = resets[resets.length - 1] ?? null;
  if (!last) return { id: 'unknown', started_at: null, cycle: 0, kind: 'reset', startedMs: null };
  return {
    id: last.date,
    started_at: last.atIso,
    cycle: resets.length,
    kind: 'reset',
    startedMs: last.at,
  };
}

function wallFor(store, current) {
  return store.entries
    .filter((entry) => (current.startedMs === null ? true : Date.parse(entry.at) >= current.startedMs))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      days: Number(entry.days) || 0,
      country: entry.country ?? null,
      at: entry.at,
    }))
    .sort((a, b) => b.days - a.days || a.at.localeCompare(b.at));
}

function archives(store, events) {
  const resets = events.filter((event) => event.kind === 'reset' && event.state === 'confirmed');
  const windows = [];
  for (let i = Math.max(1, resets.length - 4); i < resets.length; i += 1) {
    windows.push({ epoch_id: resets[i - 1].date, from: resets[i - 1].at, to: resets[i].at, ended_at: resets[i].atIso });
  }
  return windows
    .map((window) => ({
      epoch_id: window.epoch_id,
      count: store.entries.filter((entry) => {
        const at = Date.parse(entry.at);
        return at >= window.from && at < window.to;
      }).length,
      ended_at: window.ended_at,
    }))
    .filter((row) => row.count > 0)
    .reverse();
}

/** Read-only payload for `GET /api/pray`. */
function payload() {
  const current = currentEpoch();
  const store = readStore();
  const wall = wallFor(store, current);
  const amens = {};
  for (const entry of wall) amens[entry.id] = Math.min(MAX_AMENS, Number(store.amens[entry.id]) || 0);
  return {
    epoch: { id: current.id, started_at: current.started_at, cycle: current.cycle, kind: current.kind },
    believers: wall.length,
    wall: wall.slice(0, 120),
    amens,
    archive: archives(store, ledgerEvents),
    complete: false,
    writable: writeMode !== 'error',
  };
}

/** Adds or updates one entry in the current epoch. */
function join({ name, days, country } = {}) {
  const clean = cleanName(name);
  if (!clean) {
    const error = new Error('invalid_name');
    error.status = 400;
    throw error;
  }
  const current = currentEpoch();
  const store = readStore();
  const entry = {
    id: crypto.createHash('sha1').update(`${current.id}:${clean.toLowerCase()}`).digest('hex').slice(0, 10),
    name: clean,
    days: cleanDays(days),
    country: cleanCountry(country),
    at: new Date().toISOString(),
  };
  const existing = store.entries.findIndex((row) => row.id === entry.id);
  if (existing >= 0) store.entries[existing] = { ...entry, at: store.entries[existing].at };
  else store.entries.push(entry);
  if (store.entries.length > MAX_ENTRIES) store.entries = store.entries.slice(-MAX_ENTRIES);
  try {
    writeStore(store);
  } catch (error) {
    writeMode = 'error';
    const wrapped = new Error('storage_unavailable');
    wrapped.status = 503;
    wrapped.detail = String(error && error.message ? error.message : error);
    throw wrapped;
  }
  return { entry, believers: wallFor(store, current).length };
}

/** One "+1 amen" on an entry. */
function amen(id) {
  const key = String(id ?? '').trim().toLowerCase();
  if (!/^[a-f0-9]{10}$/.test(key)) {
    const error = new Error('invalid_id');
    error.status = 400;
    throw error;
  }
  const store = readStore();
  const count = Math.min(MAX_AMENS, (Number(store.amens[key]) || 0) + 1);
  store.amens[key] = count;
  try {
    writeStore(store);
  } catch (error) {
    writeMode = 'error';
    const wrapped = new Error('storage_unavailable');
    wrapped.status = 503;
    wrapped.detail = String(error && error.message ? error.message : error);
    throw wrapped;
  }
  return { count };
}

module.exports = { STATE_DIR, STORE, bind, payload, join, amen, readStore, MAX_ENTRIES };
