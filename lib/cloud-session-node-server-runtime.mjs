import { createRevocableCloudSessionAuth } from './cloud-session-revocable-auth.mjs';
import { createCloudSessionHttpApi, CLOUD_SESSION_HTTP_PATHS } from './cloud-session-http-api.mjs';

const PASSWORD_HASH_ENV = 'HAFIZE_CLOUD_SESSION_PASSWORD_HASH';
const SIGNING_KEY_ENV = 'HAFIZE_CLOUD_SESSION_SIGNING_KEY';
const PREVIOUS_SIGNING_KEY_ENV = 'HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY';
const SUBJECT_ENV = 'HAFIZE_CLOUD_SESSION_SUBJECT';
const ORIGIN_ENV = 'HAFIZE_CLOUD_SESSION_ORIGIN';
const TTL_ENV = 'HAFIZE_CLOUD_SESSION_TTL_MS';
const SESSION_PATHS = new Set(Object.values(CLOUD_SESSION_HTTP_PATHS));
const DEFAULT_BODY_BYTES = 1024;
const DEFAULT_BODY_TIMEOUT_MS = 10_000;
const DEFAULT_LOGIN_ATTEMPTS = 5;
const DEFAULT_LOGIN_WINDOW_MS = 60_000;
const DEFAULT_MAX_RATE_KEYS = 4096;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function envText(env, name, max = 4096) {
  const value = typeof env?.[name] === 'string' ? env[name].trim() : '';
  if (value.length > max || /[\u0000\r\n]/.test(value)) fail(`INVALID_CLOUD_SESSION_SERVER:${name}`);
  return value;
}

function boundedInteger(value, fallback, min, max, field) {
  const candidate = value == null || value === '' ? fallback : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate < min || candidate > max) fail(`INVALID_CLOUD_SESSION_SERVER:${field}`);
  return candidate;
}

function error(code) {
  const value = new Error(code);
  value.code = code;
  return value;
}

function header(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return typeof value === 'string' ? value.trim() : '';
}

function requireJsonContentType(headers) {
  const raw = header(headers, 'content-type');
  if (!raw || raw.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw error('CLOUD_SESSION_UNSUPPORTED_MEDIA_TYPE');
}

function declaredLength(headers) {
  const raw = header(headers, 'content-length');
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) fail('INVALID_CLOUD_SESSION_SERVER:contentLength');
  const length = Number(raw);
  if (!Number.isSafeInteger(length)) fail('INVALID_CLOUD_SESSION_SERVER:contentLength');
  return length;
}

async function readBoundedJson(request, headers, { maxBytes, timeoutMs }) {
  requireJsonContentType(headers);
  const declared = declaredLength(headers);
  if (declared !== null && declared > maxBytes) throw error('CLOUD_SESSION_BODY_TOO_LARGE');
  if (!request || typeof request[Symbol.asyncIterator] !== 'function') fail('INVALID_CLOUD_SESSION_SERVER:request');

  const chunks = [];
  let size = 0;
  let rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  const timer = setTimeout(() => rejectDeadline(error('CLOUD_SESSION_BODY_TIMEOUT')), timeoutMs);
  timer.unref?.();
  const iterator = request[Symbol.asyncIterator]();
  try {
    while (true) {
      const item = await Promise.race([Promise.resolve().then(() => iterator.next()), deadline]);
      if (item?.done) break;
      const raw = item?.value;
      if (!(typeof raw === 'string' || Buffer.isBuffer(raw) || raw instanceof Uint8Array)) fail('INVALID_CLOUD_SESSION_SERVER:body');
      const chunk = Buffer.from(raw);
      size += chunk.length;
      if (size > maxBytes) throw error('CLOUD_SESSION_BODY_TOO_LARGE');
      chunks.push(chunk);
    }
  } catch (cause) {
    try { void iterator.return?.(); } catch { /* response closes unsafe request */ }
    try { request.resume?.(); } catch { /* response closes unsafe request */ }
    throw cause;
  } finally {
    clearTimeout(timer);
  }
  const text = Buffer.concat(chunks, size).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function peerKey(request) {
  const address = typeof request?.socket?.remoteAddress === 'string' ? request.socket.remoteAddress.trim() : '';
  return address && address.length <= 128 && !/[\u0000\r\n]/.test(address) ? address : 'unknown-peer';
}

function createLoginLimiter({ maxAttempts, windowMs, maxKeys, now }) {
  const buckets = new Map();

  function prune(current) {
    if (buckets.size < maxKeys) return;
    for (const [key, bucket] of buckets) {
      if (current - bucket.startedAt >= windowMs) buckets.delete(key);
    }
  }

  return function begin(request) {
    const current = Number(now());
    if (!Number.isSafeInteger(current) || current < 0) fail('INVALID_CLOUD_SESSION_SERVER:now');
    const key = peerKey(request);
    let bucket = buckets.get(key);
    if (!bucket || current - bucket.startedAt >= windowMs) {
      prune(current);
      if (!bucket && buckets.size >= maxKeys) return Object.freeze({ ok: false, retryAfterSeconds: Math.ceil(windowMs / 1000) });
      bucket = { startedAt: current, failures: 0, pending: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.failures + bucket.pending >= maxAttempts) {
      return Object.freeze({ ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (current - bucket.startedAt)) / 1000)) });
    }

    bucket.pending += 1;
    let completed = false;
    return Object.freeze({
      ok: true,
      complete({ authenticated } = {}) {
        if (completed) return false;
        completed = true;
        const active = buckets.get(key);
        if (!active) return false;
        active.pending = Math.max(0, active.pending - 1);
        if (authenticated === true) {
          buckets.delete(key);
          return true;
        }
        active.failures += 1;
        return true;
      }
    });
  };
}

function disabledRuntime() {
  return Object.freeze({
    configured: false,
    authenticator: null,
    async handle({ pathname } = {}) {
      if (!SESSION_PATHS.has(pathname)) return Object.freeze({ matched: false });
      return Object.freeze({ matched: true, status: 404, body: Object.freeze({ error: 'SESSION_AUTH_NOT_CONFIGURED' }), headers: Object.freeze({ 'cache-control': 'no-store' }) });
    }
  });
}

export function createCloudSessionNodeServerRuntime({
  env = process.env,
  now = () => Date.now(),
  createAuth = createRevocableCloudSessionAuth,
  createHttpApi = createCloudSessionHttpApi,
  loginAttempts = DEFAULT_LOGIN_ATTEMPTS,
  loginWindowMs = DEFAULT_LOGIN_WINDOW_MS,
  maxRateKeys = DEFAULT_MAX_RATE_KEYS,
  bodyMaxBytes = DEFAULT_BODY_BYTES,
  bodyTimeoutMs = DEFAULT_BODY_TIMEOUT_MS
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('INVALID_CLOUD_SESSION_SERVER:env');
  if (typeof now !== 'function' || typeof createAuth !== 'function' || typeof createHttpApi !== 'function') fail('INVALID_CLOUD_SESSION_SERVER:dependencies');

  const passwordHash = envText(env, PASSWORD_HASH_ENV);
  const signingKey = envText(env, SIGNING_KEY_ENV, 128);
  const previousSigningKey = envText(env, PREVIOUS_SIGNING_KEY_ENV, 128);
  const subject = envText(env, SUBJECT_ENV, 200);
  const allowedOrigin = envText(env, ORIGIN_ENV, 512);
  const ttlRaw = envText(env, TTL_ENV, 32);
  const fields = [passwordHash, signingKey, previousSigningKey, subject, allowedOrigin, ttlRaw];
  if (fields.every((value) => !value)) return disabledRuntime();
  if (!passwordHash || !signingKey || !subject || !allowedOrigin) fail('INVALID_CLOUD_SESSION_SERVER:partialConfig');

  const ttlMs = ttlRaw ? boundedInteger(ttlRaw, null, 60_000, 12 * 60 * 60 * 1000, TTL_ENV) : undefined;
  const attempts = boundedInteger(loginAttempts, DEFAULT_LOGIN_ATTEMPTS, 1, 100, 'loginAttempts');
  const windowMs = boundedInteger(loginWindowMs, DEFAULT_LOGIN_WINDOW_MS, 1000, 60 * 60 * 1000, 'loginWindowMs');
  const rateKeys = boundedInteger(maxRateKeys, DEFAULT_MAX_RATE_KEYS, 16, 100_000, 'maxRateKeys');
  const maxBytes = boundedInteger(bodyMaxBytes, DEFAULT_BODY_BYTES, 256, 8192, 'bodyMaxBytes');
  const timeoutMs = boundedInteger(bodyTimeoutMs, DEFAULT_BODY_TIMEOUT_MS, 10, 30_000, 'bodyTimeoutMs');
  const auth = createAuth({
    passwordHash,
    signingKey,
    ...(previousSigningKey ? { previousSigningKey } : {}),
    subject,
    ...(ttlMs ? { ttlMs } : {}),
    now
  });
  if (typeof auth?.login !== 'function' || typeof auth?.authenticate !== 'function' || typeof auth?.revoke !== 'function' || typeof auth?.logoutCookie !== 'function') fail('INVALID_CLOUD_SESSION_SERVER:auth');
  const limitLogin = createLoginLimiter({ maxAttempts: attempts, windowMs, maxKeys: rateKeys, now });
  const api = createHttpApi({
    auth,
    allowedOrigin,
    readJson: (request, headers) => readBoundedJson(request, headers, { maxBytes, timeoutMs }),
    loginGate: ({ request }) => limitLogin(request)
  });
  if (typeof api?.handle !== 'function') fail('INVALID_CLOUD_SESSION_SERVER:httpApi');

  return Object.freeze({
    configured: true,
    authenticator: auth,
    handle: (args) => api.handle(args)
  });
}

export const CLOUD_SESSION_SERVER_ENV = Object.freeze({
  passwordHash: PASSWORD_HASH_ENV,
  signingKey: SIGNING_KEY_ENV,
  previousSigningKey: PREVIOUS_SIGNING_KEY_ENV,
  subject: SUBJECT_ENV,
  origin: ORIGIN_ENV,
  ttlMs: TTL_ENV
});
