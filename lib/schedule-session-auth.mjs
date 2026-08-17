import { createRevocableCloudSessionAuth } from './cloud-session-revocable-auth.mjs';

const PASSWORD_HASH_ENV = 'HAFIZE_CLOUD_SESSION_PASSWORD_HASH';
const SIGNING_KEY_ENV = 'HAFIZE_CLOUD_SESSION_SIGNING_KEY';
const PREVIOUS_SIGNING_KEY_ENV = 'HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY';
const SUBJECT_ENV = 'HAFIZE_CLOUD_SESSION_SUBJECT';
const ORIGIN_ENV = 'HAFIZE_CLOUD_SESSION_ORIGIN';
const TTL_ENV = 'HAFIZE_CLOUD_SESSION_TTL_MS';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function envText(env, name, max) {
  const value = typeof env?.[name] === 'string' ? env[name].trim() : '';
  if (value.length > max || /[\u0000\r\n]/.test(value)) fail(`INVALID_SCHEDULE_SESSION_AUTH:${name}`);
  return value;
}

function optionalTtl(value) {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) fail(`INVALID_SCHEDULE_SESSION_AUTH:${TTL_ENV}`);
  const ttlMs = Number(value);
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 12 * 60 * 60 * 1000) {
    fail(`INVALID_SCHEDULE_SESSION_AUTH:${TTL_ENV}`);
  }
  return ttlMs;
}

function validOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail(`INVALID_SCHEDULE_SESSION_AUTH:${ORIGIN_ENV}`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail(`INVALID_SCHEDULE_SESSION_AUTH:${ORIGIN_ENV}`);
  }
  return url.origin;
}

function requestOrigin(headers) {
  if (!headers || typeof headers !== 'object') return '';
  const raw = headers.origin ?? headers.Origin;
  return typeof raw === 'string' ? raw.trim() : '';
}

export function createOptionalScheduleSessionAuthenticator({
  env = process.env,
  createAuth = createRevocableCloudSessionAuth,
  sharedAuthenticator = null
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('INVALID_SCHEDULE_SESSION_AUTH:env');
  if (typeof createAuth !== 'function') fail('INVALID_SCHEDULE_SESSION_AUTH:createAuth');
  if (sharedAuthenticator != null && typeof sharedAuthenticator?.authenticate !== 'function') {
    fail('INVALID_SCHEDULE_SESSION_AUTH:sharedAuthenticator');
  }

  const passwordHash = envText(env, PASSWORD_HASH_ENV, 4096);
  const signingKey = envText(env, SIGNING_KEY_ENV, 128);
  const previousSigningKey = envText(env, PREVIOUS_SIGNING_KEY_ENV, 128);
  const subject = envText(env, SUBJECT_ENV, 200);
  const origin = envText(env, ORIGIN_ENV, 512);
  const ttlRaw = envText(env, TTL_ENV, 32);
  const configured = [passwordHash, signingKey, previousSigningKey, subject, origin, ttlRaw].some(Boolean);
  if (!configured) {
    if (sharedAuthenticator != null) fail('INVALID_SCHEDULE_SESSION_AUTH:sharedWithoutConfig');
    return null;
  }
  if (!passwordHash || !signingKey || !subject || !origin) fail('INVALID_SCHEDULE_SESSION_AUTH:partialConfig');

  const allowedOrigin = validOrigin(origin);
  const ttlMs = optionalTtl(ttlRaw);
  const auth = sharedAuthenticator || createAuth({
    passwordHash,
    signingKey,
    ...(previousSigningKey ? { previousSigningKey } : {}),
    subject,
    ...(ttlMs ? { ttlMs } : {})
  });
  if (typeof auth?.authenticate !== 'function') fail('INVALID_SCHEDULE_SESSION_AUTH:auth');
  return Object.freeze({
    authenticate: (input) => auth.authenticate(input),
    allowedOrigin
  });
}

export function authenticateSchedulePrincipal({
  primaryAuthenticator,
  sessionAuthenticator,
  headers,
  requireSessionOrigin = false
} = {}) {
  if (typeof primaryAuthenticator?.authenticate !== 'function') fail('INVALID_SCHEDULE_SESSION_AUTH:primaryAuthenticator');
  if (sessionAuthenticator != null && typeof sessionAuthenticator?.authenticate !== 'function') {
    fail('INVALID_SCHEDULE_SESSION_AUTH:sessionAuthenticator');
  }
  if (typeof requireSessionOrigin !== 'boolean') fail('INVALID_SCHEDULE_SESSION_AUTH:requireSessionOrigin');

  let primary;
  try { primary = primaryAuthenticator.authenticate({ headers }); } catch { primary = null; }
  if (primary?.ok && primary.principal) return primary;

  if (requireSessionOrigin && sessionAuthenticator) {
    if (typeof sessionAuthenticator.allowedOrigin !== 'string' || requestOrigin(headers) !== sessionAuthenticator.allowedOrigin) {
      return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    }
  }
  let session;
  try { session = sessionAuthenticator?.authenticate({ headers }); } catch { session = null; }
  if (session?.ok && session.principal) return session;
  return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
}

export const SCHEDULE_SESSION_AUTH_ENV = Object.freeze({
  passwordHash: PASSWORD_HASH_ENV,
  signingKey: SIGNING_KEY_ENV,
  previousSigningKey: PREVIOUS_SIGNING_KEY_ENV,
  subject: SUBJECT_ENV,
  origin: ORIGIN_ENV,
  ttlMs: TTL_ENV
});
