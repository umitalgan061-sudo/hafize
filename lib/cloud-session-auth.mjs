import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = '__Host-hafize_session';
const VERSION = 1;
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_PASSWORD_BYTES = 512;
const MAX_COOKIE_BYTES = 4096;
const HASH_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, label, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\u0000\r\n]/.test(normalized)) fail(`INVALID_CLOUD_SESSION_AUTH:${label}`);
  return normalized;
}

function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`INVALID_CLOUD_SESSION_AUTH:${label}`);
  return value;
}

function decodeBase64Url(value, label, minBytes, maxBytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) fail(`INVALID_CLOUD_SESSION_AUTH:${label}`);
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < minBytes || bytes.length > maxBytes || bytes.toString('base64url') !== value) fail(`INVALID_CLOUD_SESSION_AUTH:${label}`);
  return bytes;
}

function parsePasswordHash(value) {
  const match = HASH_PATTERN.exec(typeof value === 'string' ? value : '');
  if (!match) fail('INVALID_CLOUD_SESSION_AUTH:passwordHash');
  const N = integer(Number(match[1]), 'passwordHash.N', 16_384, 1_048_576);
  const r = integer(Number(match[2]), 'passwordHash.r', 8, 32);
  const p = integer(Number(match[3]), 'passwordHash.p', 1, 8);
  if ((N & (N - 1)) !== 0) fail('INVALID_CLOUD_SESSION_AUTH:passwordHash.N');
  const salt = decodeBase64Url(match[4], 'passwordHash.salt', 16, 64);
  const digest = decodeBase64Url(match[5], 'passwordHash.digest', 32, 64);
  return Object.freeze({ N, r, p, salt, digest });
}

function parseSigningKey(value) {
  const key = decodeBase64Url(text(value, 'signingKey', 128), 'signingKey', 32, 64);
  return key;
}

function safeNow(now) {
  const value = Number(now());
  return integer(value, 'now', 0, Number.MAX_SAFE_INTEGER);
}

function passwordBytes(password) {
  if (typeof password !== 'string' || password.length < 12) fail('CLOUD_SESSION_LOGIN_REJECTED');
  const bytes = Buffer.from(password, 'utf8');
  if (bytes.length > MAX_PASSWORD_BYTES || /[\u0000\r\n]/.test(password)) fail('CLOUD_SESSION_LOGIN_REJECTED');
  return bytes;
}

function equalBytes(left, right) {
  if (left.length !== right.length) {
    const padded = Buffer.alloc(right.length);
    left.copy(padded, 0, 0, Math.min(left.length, right.length));
    timingSafeEqual(padded, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

function sign(key, encodedPayload) {
  return createHmac('sha256', key).update(`hafize-session-v${VERSION}\0${encodedPayload}`).digest('base64url');
}

function cookieValue(headers) {
  if (!headers || typeof headers !== 'object') return null;
  const raw = headers.cookie ?? headers.Cookie;
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_COOKIE_BYTES) return null;
  const matches = raw.split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(COOKIE_NAME.length + 1);
  return value && !/[\s;,]/.test(value) ? value : null;
}

function serializeCookie(token, maxAgeSeconds) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

export function createCloudSessionAuth({
  passwordHash,
  signingKey,
  subject,
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
  randomBytesImpl = randomBytes
} = {}) {
  const passwordConfig = parsePasswordHash(passwordHash);
  const key = parseSigningKey(signingKey);
  const principalSubject = text(subject, 'subject', 200);
  const sessionTtl = integer(ttlMs, 'ttlMs', 60_000, MAX_TTL_MS);
  if (typeof now !== 'function' || typeof randomBytesImpl !== 'function') fail('INVALID_CLOUD_SESSION_AUTH:dependencies');

  async function login({ password } = {}) {
    let supplied;
    try { supplied = passwordBytes(password); } catch { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); }
    let derived;
    try {
      derived = await scrypt(supplied, passwordConfig.salt, passwordConfig.digest.length, {
        N: passwordConfig.N,
        r: passwordConfig.r,
        p: passwordConfig.p,
        maxmem: Math.max(32 * 1024 * 1024, 128 * passwordConfig.N * passwordConfig.r + 1024 * 1024)
      });
    } catch { fail('CLOUD_SESSION_AUTH_UNAVAILABLE'); }
    if (!equalBytes(Buffer.from(derived), passwordConfig.digest)) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });

    const issuedAt = safeNow(now);
    const expiresAt = issuedAt + sessionTtl;
    if (!Number.isSafeInteger(expiresAt)) fail('INVALID_CLOUD_SESSION_AUTH:now');
    const nonce = Buffer.from(randomBytesImpl(18)).toString('base64url');
    if (!/^[A-Za-z0-9_-]{24}$/.test(nonce)) fail('CLOUD_SESSION_AUTH_UNAVAILABLE');
    const payload = Buffer.from(JSON.stringify({ v: VERSION, sub: principalSubject, iat: issuedAt, exp: expiresAt, n: nonce })).toString('base64url');
    const token = `${payload}.${sign(key, payload)}`;
    return Object.freeze({ ok: true, expiresAt, setCookie: serializeCookie(token, Math.ceil(sessionTtl / 1000)) });
  }

  function authenticate({ headers } = {}) {
    const token = cookieValue(headers);
    if (!token) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const parts = token.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const expected = Buffer.from(sign(key, parts[0]), 'utf8');
    const supplied = Buffer.from(parts[1], 'utf8');
    if (!equalBytes(supplied, expected)) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });

    let payload;
    try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); }
    if (!payload || payload.v !== VERSION || payload.sub !== principalSubject || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || typeof payload.n !== 'string') return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const current = safeNow(now);
    if (payload.iat > current || payload.exp <= current || payload.exp - payload.iat !== sessionTtl) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    return Object.freeze({ ok: true, principal: Object.freeze({ authenticated: true, subject: principalSubject }), expiresAt: payload.exp });
  }

  function logoutCookie() {
    return serializeCookie('', 0);
  }

  return Object.freeze({ login, authenticate, logoutCookie });
}

export const CLOUD_SESSION_COOKIE_NAME = COOKIE_NAME;
export const CLOUD_SESSION_LIMITS = Object.freeze({ defaultTtlMs: DEFAULT_TTL_MS, maxTtlMs: MAX_TTL_MS, maxPasswordBytes: MAX_PASSWORD_BYTES });
