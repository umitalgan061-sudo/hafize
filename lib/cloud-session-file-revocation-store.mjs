import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 4096;
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const FINGERPRINT_RE = /^[A-Za-z0-9_-]{43}$/;
const DEFAULT_NOW = () => Date.now();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function safeNow(now) {
  const value = Number(now());
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:now');
  return value;
}

function boundedInteger(value, fallback, min, max, field) {
  const candidate = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate < min || candidate > max) {
    fail(`INVALID_CLOUD_SESSION_REVOCATION_FILE:${field}`);
  }
  return candidate;
}

export function normalizeRevocationFilePath(value) {
  if (typeof value !== 'string') fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:path');
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1024 || /[\u0000\r\n]/.test(trimmed)) {
    fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:path');
  }
  const normalized = resolve(trimmed);
  if (!isAbsolute(normalized)) fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:path');
  return normalized;
}

function parseDocument(text, { maxEntries, now }) {
  let document;
  try { document = JSON.parse(text); } catch { fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT'); }
  if (!document || Array.isArray(document) || document.schemaVersion !== SCHEMA_VERSION || !Array.isArray(document.revocations)) {
    fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT');
  }
  if (document.revocations.length > maxEntries) fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT');

  const current = safeNow(now);
  const map = new Map();
  for (const entry of document.revocations) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT');
    const keys = Object.keys(entry).sort();
    if (keys.length !== 2 || keys[0] !== 'expiresAt' || keys[1] !== 'fingerprint') fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT');
    if (typeof entry.fingerprint !== 'string' || !FINGERPRINT_RE.test(entry.fingerprint)) fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT');
    if (!Number.isSafeInteger(entry.expiresAt) || entry.expiresAt < 0) fail('CLOUD_SESSION_REVOCATION_FILE_CORRUPT');
    if (entry.expiresAt > current) map.set(entry.fingerprint, entry.expiresAt);
  }
  return map;
}

function serialize(map) {
  const revocations = [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fingerprint, expiresAt]) => ({ fingerprint, expiresAt }));
  return `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, revocations })}\n`;
}

function safeStat(path) {
  try { return statSync(path); } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export function createCloudSessionFileRevocationStore({
  filePath,
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  now = DEFAULT_NOW
} = {}) {
  if (typeof now !== 'function') fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:now');
  const path = normalizeRevocationFilePath(filePath);
  const capacity = boundedInteger(maxEntries, DEFAULT_MAX_ENTRIES, 16, 100_000, 'maxEntries');
  const fileLimit = boundedInteger(maxFileBytes, DEFAULT_MAX_FILE_BYTES, 4096, 4 * 1024 * 1024, 'maxFileBytes');
  let cache = new Map();
  let lastMtimeMs = -1;
  let lastSize = -1;

  function load({ force = false } = {}) {
    const stat = safeStat(path);
    if (!stat) {
      cache = new Map();
      lastMtimeMs = -1;
      lastSize = -1;
      return cache;
    }
    if (!stat.isFile() || stat.size > fileLimit) fail('CLOUD_SESSION_REVOCATION_FILE_UNAVAILABLE');
    if (!force && stat.mtimeMs === lastMtimeMs && stat.size === lastSize) return cache;
    let text;
    try { text = readFileSync(path, 'utf8'); } catch { fail('CLOUD_SESSION_REVOCATION_FILE_UNAVAILABLE'); }
    if (Buffer.byteLength(text, 'utf8') > fileLimit) fail('CLOUD_SESSION_REVOCATION_FILE_UNAVAILABLE');
    cache = parseDocument(text, { maxEntries: capacity, now });
    lastMtimeMs = stat.mtimeMs;
    lastSize = stat.size;
    return cache;
  }

  function persist(map) {
    const text = serialize(map);
    if (Buffer.byteLength(text, 'utf8') > fileLimit) return false;
    const directory = dirname(path);
    const temporary = `${path}.tmp-${process.pid}`;
    let fd = null;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      fd = openSync(temporary, 'w', 0o600);
      writeFileSync(fd, text, { encoding: 'utf8' });
      closeSync(fd);
      fd = null;
      renameSync(temporary, path);
      const stat = statSync(path);
      cache = new Map(map);
      lastMtimeMs = stat.mtimeMs;
      lastSize = stat.size;
      return true;
    } catch {
      if (fd !== null) {
        try { closeSync(fd); } catch { /* best-effort cleanup */ }
      }
      try { if (existsSync(temporary)) unlinkSync(temporary); } catch { /* best-effort cleanup */ }
      return false;
    }
  }

  function prune(current = safeNow(now)) {
    const map = new Map(load());
    let changed = false;
    for (const [fingerprint, expiresAt] of map) {
      if (expiresAt <= current) {
        map.delete(fingerprint);
        changed = true;
      }
    }
    if (changed && !persist(map)) fail('CLOUD_SESSION_REVOCATION_FILE_UNAVAILABLE');
    return changed;
  }

  function isRevoked(fingerprint) {
    if (typeof fingerprint !== 'string' || !FINGERPRINT_RE.test(fingerprint)) return false;
    const map = load();
    const expiresAt = map.get(fingerprint);
    if (!Number.isSafeInteger(expiresAt)) return false;
    const current = safeNow(now);
    if (expiresAt <= current) {
      const next = new Map(map);
      next.delete(fingerprint);
      if (!persist(next)) fail('CLOUD_SESSION_REVOCATION_FILE_UNAVAILABLE');
      return false;
    }
    return true;
  }

  function revoke({ fingerprint, expiresAt } = {}) {
    if (typeof fingerprint !== 'string' || !FINGERPRINT_RE.test(fingerprint)) fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:fingerprint');
    if (!Number.isSafeInteger(expiresAt) || expiresAt < 0) fail('INVALID_CLOUD_SESSION_REVOCATION_FILE:expiresAt');
    const current = safeNow(now);
    if (expiresAt <= current) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });

    const map = new Map(load({ force: true }));
    for (const [key, expiry] of map) if (expiry <= current) map.delete(key);
    if (!map.has(fingerprint) && map.size >= capacity) {
      return Object.freeze({ ok: false, error: 'SESSION_REVOCATION_UNAVAILABLE' });
    }
    map.set(fingerprint, expiresAt);
    if (!persist(map)) return Object.freeze({ ok: false, error: 'SESSION_REVOCATION_UNAVAILABLE' });
    return Object.freeze({ ok: true });
  }

  load({ force: true });
  return Object.freeze({
    filePath: path,
    maxEntries: capacity,
    isRevoked,
    revoke,
    prune,
    size: () => load().size
  });
}

export const CLOUD_SESSION_FILE_REVOCATION_LIMITS = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  defaultMaxEntries: DEFAULT_MAX_ENTRIES,
  defaultMaxFileBytes: DEFAULT_MAX_FILE_BYTES
});
