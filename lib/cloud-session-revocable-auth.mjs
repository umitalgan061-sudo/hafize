import { createHmac } from 'node:crypto';
import { createCloudSessionAuth } from './cloud-session-auth.mjs';
import { CLOUD_SESSION_TOKEN_CONTRACT, readCloudSessionCookieToken } from './cloud-session-token-contract.mjs';

const DEFAULT_MAX_REVOCATIONS = 4096;
const FINGERPRINT_DOMAIN = 'hafize-session-revocation-v1\0';
const DEFAULT_NOW = () => Date.now();
const SHARED_PROCESS_REVOCATIONS = new Map();

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
    bytes.fill(0);
    fail('INVALID_CLOUD_SESSION_REVOCATION:signingKey');
  }
  return bytes;
}

export const readCloudSessionToken = readCloudSessionCookieToken;

export function fingerprintCloudSessionToken(signingKey, token) {
  const key = signingKeyBytes(signingKey);
  try {
    if (typeof token !== 'string' || !token || Buffer.byteLength(token) > CLOUD_SESSION_TOKEN_CONTRACT.maxTokenBytes || /[\s;,]/.test(token)) {
      fail('INVALID_CLOUD_SESSION_REVOCATION:token');
    }
    return createHmac('sha256', key).update(FINGERPRINT_DOMAIN).update(token).digest('base64url');
  } finally {
    key.fill(0);
  }
}

function createRevocationStore({ maxEntries, now, backingMap }) {
  const capacity = normalizeMaxEntries(maxEntries);
  if (typeof now !== 'function') fail('INVALID_CLOUD_SESSION_REVOCATION:now');
  if (!(backingMap instanceof Map)) fail('INVALID_CLOUD_SESSION_REVOCATION:backingMap');
  const revoked = backingMap;

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

export function createCloudSessionRevocationStore({
  maxEntries = DEFAULT_MAX_REVOCATIONS,
  now = DEFAULT_NOW
} = {}) {
  return createRevocationStore({ maxEntries, now, backingMap: new Map() });
}

function publicAuthResult(result) {
  if (!result?.ok) return result;
  return Object.freeze({ ok: true, principal: result.principal, expiresAt: result.expiresAt });
}

export function createRevocableCloudSessionAuth({
  signingKey,
  previousSigningKey,
  revocationStore,
  revocationMaxEntries = DEFAULT_MAX_REVOCATIONS,
  now = DEFAULT_NOW,
  ...authOptions
} = {}) {
  if (typeof now !== 'function') fail('INVALID_CLOUD_SESSION_REVOCATION:now');
  const previousKey = typeof previousSigningKey === 'string' && previousSigningKey.trim() ? previousSigningKey.trim() : '';
  const base = createCloudSessionAuth({
    ...authOptions,
    signingKey,
    ...(previousKey ? { previousSigningKey: previousKey } : {}),
    now
  });
  const store = revocationStore || createRevocationStore({
    maxEntries: revocationMaxEntries,
    now,
    backingMap: revocationMaxEntries === DEFAULT_MAX_REVOCATIONS ? SHARED_PROCESS_REVOCATIONS : new Map()
  });
  if (typeof store?.isRevoked !== 'function' || typeof store?.revoke !== 'function') {
    fail('INVALID_CLOUD_SESSION_REVOCATION:store');
  }

  function tokenFingerprint(headers, signingKeySlot) {
    const token = readCloudSessionCookieToken(headers);
    if (!token) return null;
    const fingerprintKey = signingKeySlot === 'previous' ? previousKey : signingKey;
    if (!fingerprintKey) return null;
    return fingerprintCloudSessionToken(fingerprintKey, token);
  }

  function authenticateInternal({ headers } = {}) {
    const result = base.authenticate({ headers });
    if (!result.ok) return result;
    const fingerprint = tokenFingerprint(headers, result.signingKeySlot);
    if (!fingerprint || store.isRevoked(fingerprint)) {
      return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    }
    return Object.freeze({ ...result, fingerprint });
  }

  function authenticate({ headers } = {}) {
    return publicAuthResult(authenticateInternal({ headers }));
  }

  function revoke({ headers } = {}) {
    const current = authenticateInternal({ headers });
    if (!current.ok) return current;
    return store.revoke({ fingerprint: current.fingerprint, expiresAt: current.expiresAt });
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
  maxCookieBytes: CLOUD_SESSION_TOKEN_CONTRACT.maxCookieHeaderBytes,
  maxTokenBytes: CLOUD_SESSION_TOKEN_CONTRACT.maxTokenBytes
});
