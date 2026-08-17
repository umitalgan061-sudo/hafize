import { createHmac } from 'node:crypto';
import { createCloudSessionAuth, CLOUD_SESSION_COOKIE_NAME } from './cloud-session-auth.mjs';

const DEFAULT_MAX_REVOCATIONS = 4096;
const MAX_COOKIE_BYTES = 4096;
const FINGERPRINT_DOMAIN = 'hafize-session-revocation-v1\0';
const DEFAULT_NOW = () => Date.now();

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function safeNow(now) {
  const value = Number(now());
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_CLOUD_SESSION_REVOCATION:now');
  return value;
}

function normalizeMaxEntries(value) {
  const candidate = value == null ? DEFAULT_MAX_REVOCATIONS : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate < 16 || candidate > 100_000) {
    fail('INVALID_CLOUD_SESSION_REVOCATION:maxEntries');
  }
  return candidate;
}

function signingKeyBytes(value) {
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    fail('INVALID_CLOUD_SESSION_REVOCATION:signingKey');
  }
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 32 || bytes.length > 64 || bytes.toString('base64url') !== value) {
    fail('INVALID_CLOUD_SESSION_REVOCATION:signingKey');
  }
  return bytes;
}

function cookieHeader(headers) {
  if (!headers || typeof headers !== 'object') return '';
  const raw = headers.cookie ?? headers.Cookie;
  return typeof raw === 'string' && Buffer.byteLength(raw) <= MAX_COOKIE_BYTES ? raw : '';
}

export function readCloudSessionToken(headers) {
  const raw = cookieHeader(headers);
  if (!raw) return null;
  const prefix = `${CLOUD_SESSION_COOKIE_NAME}=`;
  const matches = raw
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(prefix.length);
  if (!token || /[\s;,]/.test(token) || Buffer.byteLength(token) > MAX_COOKIE_BYTES) return null;
  return token;
}

export function fingerprintCloudSessionToken(signingKey, token) {
  const key = signingKeyBytes(signingKey);
  if (typeof token !== 'string' || !token || Buffer.byteLength(token) > MAX_COOKIE_BYTES || /[\s;,]/.test(token)) {
    fail('INVALID_CLOUD_SESSION_REVOCATION:token');
  }
  return createHmac('sha256', key).update(FINGERPRINT_DOMAIN).update(token).digest('base64url');
}

export function createCloudSessionRevocationStore({
  maxEntries = DEFAULT_MAX_REVOCATIONS,
  now = DEFAULT_NOW
} = {}) {
  const capacity = normalizeMaxEntries(maxEntries);
  if (typeof now !== 'function') fail('INVALID_CLOUD_SESSION_REVOCATION:now');
  const revoked = new Map();

  function prune(current = safeNow(now)) {
    let removed = 0;
    for (const [fingerprint, expiresAt] of revoked) {
      if (expiresAt <= current) {
        revoked.delete(fingerprint);
        removed += 1;
      }
    }
    return removed;
  }

  function isRevoked(fingerprint) {
    if (typeof fingerprint !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(fingerprint)) return false;
    const expiresAt = revoked.get(fingerprint);
    if (!Number.isSafeInteger(expiresAt)) return false;
    const current = safeNow(now);
    if (expiresAt <= current) {
      revoked.delete(fingerprint);
      return false;
    }
    return true;
  }

  function revoke({ fingerprint, expiresAt } = {}) {
    if (typeof fingerprint !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(fingerprint)) {
      fail('INVALID_CLOUD_SESSION_REVOCATION:fingerprint');
    }
    if (!Number.isSafeInteger(expiresAt) || expiresAt < 0) {
      fail('INVALID_CLOUD_SESSION_REVOCATION:expiresAt');
    }
    const current = safeNow(now);
    if (expiresAt <= current) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    prune(current);
    if (!revoked.has(fingerprint) && revoked.size >= capacity) {
      return Object.freeze({ ok: false, error: 'SESSION_REVOCATION_UNAVAILABLE' });
    }
    revoked.set(fingerprint, expiresAt);
    return Object.freeze({ ok: true });
  }

  return Object.freeze({
    maxEntries: capacity,
    isRevoked,
    revoke,
    prune,
    size: () => revoked.size
  });
}

const SHARED_PROCESS_REVOCATION_STORE = createCloudSessionRevocationStore();

export function createRevocableCloudSessionAuth({
  signingKey,
  revocationStore,
  revocationMaxEntries = DEFAULT_MAX_REVOCATIONS,
  now = DEFAULT_NOW,
  ...authOptions
} = {}) {
  if (typeof now !== 'function') fail('INVALID_CLOUD_SESSION_REVOCATION:now');
  const base = createCloudSessionAuth({ ...authOptions, signingKey, now });
  const canUseSharedStore = revocationStore == null && now === DEFAULT_NOW && revocationMaxEntries === DEFAULT_MAX_REVOCATIONS;
  const store = revocationStore || (canUseSharedStore
    ? SHARED_PROCESS_REVOCATION_STORE
    : createCloudSessionRevocationStore({ maxEntries: revocationMaxEntries, now }));
  if (typeof store?.isRevoked !== 'function' || typeof store?.revoke !== 'function') {
    fail('INVALID_CLOUD_SESSION_REVOCATION:store');
  }

  function tokenFingerprint(headers) {
    const token = readCloudSessionToken(headers);
    if (!token) return null;
    return fingerprintCloudSessionToken(signingKey, token);
  }

  function authenticate({ headers } = {}) {
    const result = base.authenticate({ headers });
    if (!result.ok) return result;
    const fingerprint = tokenFingerprint(headers);
    if (!fingerprint || store.isRevoked(fingerprint)) {
      return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    }
    return result;
  }

  function revoke({ headers } = {}) {
    const current = authenticate({ headers });
    if (!current.ok) return current;
    const fingerprint = tokenFingerprint(headers);
    if (!fingerprint) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    return store.revoke({ fingerprint, expiresAt: current.expiresAt });
  }

  return Object.freeze({
    login: base.login,
    authenticate,
    revoke,
    logoutCookie: base.logoutCookie
  });
}

export const CLOUD_SESSION_REVOCATION_LIMITS = Object.freeze({
  defaultMaxEntries: DEFAULT_MAX_REVOCATIONS,
  maxCookieBytes: MAX_COOKIE_BYTES
});
