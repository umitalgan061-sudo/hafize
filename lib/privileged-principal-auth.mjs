import { createRevocableCloudSessionAuth } from './cloud-session-revocable-auth.mjs';
import { createBearerPrincipalAuthenticator } from './server-auth.mjs';

const CLOUD_FIELDS = Object.freeze([
  'HAFIZE_CLOUD_SESSION_PASSWORD_HASH',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  'HAFIZE_CLOUD_SESSION_SUBJECT',
  'HAFIZE_CLOUD_SESSION_ORIGIN'
]);
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000;
const MIN_TTL_MS = 60_000;
const MAX_TTL_MS = 12 * 60 * 60 * 1000;

function fail(field) {
  const error = new Error(`INVALID_PRIVILEGED_PRINCIPAL_AUTH:${field}`);
  error.code = error.message;
  throw error;
}

function envText(env, name, max = 4096) {
  const value = typeof env?.[name] === 'string' ? env[name].trim() : '';
  if (value.length > max || /[\u0000\r\n]/.test(value)) fail(name);
  return value;
}

function normalizeOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail('cloudOrigin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('cloudOrigin');
  return url.origin;
}

function requestOrigin(headers) {
  if (!headers || typeof headers !== 'object') return '';
  const raw = headers.origin ?? headers.Origin;
  return typeof raw === 'string' ? raw.trim() : '';
}

function principalOk(result) {
  return result?.ok === true
    && result.principal?.authenticated === true
    && typeof result.principal.subject === 'string'
    && result.principal.subject.length > 0
    && result.principal.subject.length <= 200;
}

function createOptionalBearer(env, { tokenEnv, subjectEnv }) {
  const token = envText(env, tokenEnv);
  const subject = envText(env, subjectEnv, 200);
  if (!token && !subject) return null;
  if (!token || !subject) fail('bearerConfig');
  try {
    return createBearerPrincipalAuthenticator({ token, subject });
  } catch {
    fail('bearerConfig');
  }
}

function readCloudConfig(env) {
  const values = CLOUD_FIELDS.map((name) => envText(env, name, name.endsWith('ORIGIN') ? 512 : name.endsWith('SUBJECT') ? 200 : 4096));
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) fail('cloudConfig');

  const ttlRaw = envText(env, 'HAFIZE_CLOUD_SESSION_TTL_MS', 32);
  let ttlMs = DEFAULT_TTL_MS;
  if (ttlRaw) {
    const parsed = Number(ttlRaw);
    if (!Number.isSafeInteger(parsed) || parsed < MIN_TTL_MS || parsed > MAX_TTL_MS) fail('cloudTtl');
    ttlMs = parsed;
  }
  return Object.freeze({ values, ttlMs, origin: normalizeOrigin(values[3]) });
}

function createOptionalCloud(env, injectedAuthenticator) {
  const config = readCloudConfig(env);
  if (!config) {
    if (injectedAuthenticator != null) fail('cloudAuthenticatorWithoutConfig');
    return null;
  }
  if (injectedAuthenticator != null) {
    if (typeof injectedAuthenticator?.authenticate !== 'function') fail('cloudAuthenticator');
    return Object.freeze({ authenticator: injectedAuthenticator, origin: config.origin });
  }
  try {
    const authenticator = createRevocableCloudSessionAuth({
      passwordHash: config.values[0],
      signingKey: config.values[1],
      subject: config.values[2],
      ttlMs: config.ttlMs
    });
    return Object.freeze({ authenticator, origin: config.origin });
  } catch {
    fail('cloudConfig');
  }
}

export function createPrivilegedPrincipalAuthenticator({
  env = process.env,
  tokenEnv,
  subjectEnv,
  allowCloudSession = true,
  cloudSessionAuthenticator = null
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  if (typeof tokenEnv !== 'string' || !/^[A-Z0-9_]{3,80}$/.test(tokenEnv)) fail('tokenEnv');
  if (typeof subjectEnv !== 'string' || !/^[A-Z0-9_]{3,80}$/.test(subjectEnv)) fail('subjectEnv');
  if (typeof allowCloudSession !== 'boolean') fail('allowCloudSession');
  if (!allowCloudSession && cloudSessionAuthenticator != null) fail('cloudAuthenticator');

  const bearer = createOptionalBearer(env, { tokenEnv, subjectEnv });
  const cloud = allowCloudSession ? createOptionalCloud(env, cloudSessionAuthenticator) : null;
  if (!bearer && !cloud) return null;

  function authenticate({ headers } = {}) {
    if (bearer) {
      const result = bearer.authenticate({ headers });
      if (principalOk(result)) return result;
    }
    if (cloud) {
      if (requestOrigin(headers) !== cloud.origin) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
      const result = cloud.authenticator.authenticate({ headers });
      if (principalOk(result)) return result;
    }
    return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  }

  return Object.freeze({
    authenticate,
    modes: Object.freeze({ bearer: Boolean(bearer), cloudSession: Boolean(cloud) })
  });
}

export const PRIVILEGED_PRINCIPAL_AUTH_LIMITS = Object.freeze({
  defaultTtlMs: DEFAULT_TTL_MS,
  minTtlMs: MIN_TTL_MS,
  maxTtlMs: MAX_TTL_MS
});
