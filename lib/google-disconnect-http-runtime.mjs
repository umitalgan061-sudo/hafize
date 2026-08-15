import { createClient as createRedisClientDefault } from 'redis';
import { createCloudSessionNodeServerRuntime } from './cloud-session-node-server-runtime.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createGoogleRefreshLease } from './google-refresh-lease.mjs';
import { createGoogleTokenRevoke } from './google-token-revoke.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';

const DISCONNECT_PATH = '/api/connectors/gmail/disconnect';
const ORIGIN_ENV = 'HAFIZE_CLOUD_SESSION_ORIGIN';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const REFRESH_REDIS_ENV = 'HAFIZE_GOOGLE_REFRESH_REDIS_URL';
const MAX_BODY_BYTES = 1024;
const BODY_TIMEOUT_MS = 10_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function envText(env, name, max = 4096) {
  const raw = typeof env?.[name] === 'string' ? env[name].trim() : '';
  if (raw.length > max || /[\u0000\r\n]/.test(raw)) fail(`INVALID_GOOGLE_DISCONNECT_HTTP:${name}`);
  return raw;
}

function normalizeOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail(`INVALID_GOOGLE_DISCONNECT_HTTP:${ORIGIN_ENV}`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    fail(`INVALID_GOOGLE_DISCONNECT_HTTP:${ORIGIN_ENV}`);
  }
  return url.origin;
}

function decodeOwnerKey(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(`INVALID_GOOGLE_DISCONNECT_HTTP:${OWNER_KEY_ENV}`);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(`INVALID_GOOGLE_DISCONNECT_HTTP:${OWNER_KEY_ENV}`);
  return key;
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return typeof value === 'string' ? value.trim() : '';
}

function requireJsonContentType(headers) {
  const value = headerValue(headers, 'content-type');
  if (!value || value.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    fail('GOOGLE_DISCONNECT_UNSUPPORTED_MEDIA_TYPE');
  }
}

function declaredLength(headers) {
  const raw = headerValue(headers, 'content-length');
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) fail('INVALID_GOOGLE_DISCONNECT_HTTP:contentLength');
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) fail('INVALID_GOOGLE_DISCONNECT_HTTP:contentLength');
  return value;
}

async function readBody(request, headers) {
  requireJsonContentType(headers);
  const declared = declaredLength(headers);
  if (declared !== null && declared > MAX_BODY_BYTES) fail('GOOGLE_DISCONNECT_BODY_TOO_LARGE');
  if (!request || typeof request[Symbol.asyncIterator] !== 'function') fail('INVALID_GOOGLE_DISCONNECT_HTTP:request');

  const chunks = [];
  let size = 0;
  let rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  const timer = setTimeout(() => failInto(rejectDeadline, 'GOOGLE_DISCONNECT_BODY_TIMEOUT'), BODY_TIMEOUT_MS);
  timer.unref?.();
  const iterator = request[Symbol.asyncIterator]();
  try {
    while (true) {
      const item = await Promise.race([Promise.resolve().then(() => iterator.next()), deadline]);
      if (item?.done) break;
      const value = item?.value;
      if (!(typeof value === 'string' || Buffer.isBuffer(value) || value instanceof Uint8Array)) {
        fail('INVALID_GOOGLE_DISCONNECT_HTTP:body');
      }
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > MAX_BODY_BYTES) fail('GOOGLE_DISCONNECT_BODY_TOO_LARGE');
      chunks.push(chunk);
    }
  } catch (error) {
    try { void iterator.return?.(); } catch { /* connection closes on unsafe request */ }
    try { request.resume?.(); } catch { /* connection closes on unsafe request */ }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = Buffer.concat(chunks, size).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function failInto(reject, code) {
  reject(Object.assign(new Error(code), { code }));
}

function requireExplicitIntent(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') fail('GOOGLE_DISCONNECT_INTENT_REQUIRED');
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'explicitUserIntent' || body.explicitUserIntent !== true) {
    fail('GOOGLE_DISCONNECT_INTENT_REQUIRED');
  }
}

function result(status, body, headers = undefined) {
  return Object.freeze({ matched: true, status, body: Object.freeze(body), headers });
}

function publicError(error) {
  const code = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
  if (error instanceof SyntaxError) return result(400, { error: 'INVALID_JSON' });
  if (code === 'AUTH_REQUIRED') return result(401, { error: 'AUTH_REQUIRED' });
  if (code === 'GOOGLE_DISCONNECT_ORIGIN_REQUIRED') return result(403, { error: 'ORIGIN_REQUIRED' });
  if (code === 'GOOGLE_DISCONNECT_INTENT_REQUIRED' || code.startsWith('INVALID_GOOGLE_DISCONNECT_HTTP:')) {
    return result(400, { error: 'INVALID_DISCONNECT_REQUEST' });
  }
  if (code === 'GOOGLE_DISCONNECT_UNSUPPORTED_MEDIA_TYPE') return result(415, { error: 'UNSUPPORTED_MEDIA_TYPE' });
  if (code === 'GOOGLE_DISCONNECT_BODY_TOO_LARGE') {
    return result(413, { error: 'BODY_TOO_LARGE' }, Object.freeze({ Connection: 'close' }));
  }
  if (code === 'GOOGLE_DISCONNECT_BODY_TIMEOUT') {
    return result(408, { error: 'REQUEST_TIMEOUT' }, Object.freeze({ Connection: 'close' }));
  }
  if (code === 'GOOGLE_TOKEN_REVOKE_UPSTREAM_TIMEOUT') return result(504, { error: 'GOOGLE_REVOKE_UPSTREAM_TIMEOUT' });
  if (code === 'GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED') return result(502, { error: 'GOOGLE_REVOKE_UPSTREAM_FAILED' });
  if (code === 'GOOGLE_REFRESH_LEASE_BUSY' || code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE' ||
      code === 'GOOGLE_REFRESH_LEASE_LOST' || code === 'OAUTH_TOKEN_STORE_READ_FAILED' ||
      code === 'OAUTH_TOKEN_STORE_DELETE_FAILED') {
    return result(503, { error: 'GOOGLE_DISCONNECT_TEMPORARILY_UNAVAILABLE' });
  }
  return result(500, { error: 'GOOGLE_DISCONNECT_INTERNAL_ERROR' });
}

function disabledRuntime() {
  return Object.freeze({
    configured: false,
    async handle({ pathname } = {}) {
      if (pathname !== DISCONNECT_PATH) return Object.freeze({ matched: false });
      return result(404, { error: 'GOOGLE_DISCONNECT_NOT_CONFIGURED' });
    },
    async close() {}
  });
}

export function createGoogleDisconnectHttpRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createRedisClient = createRedisClientDefault,
  createSessionRuntime = createCloudSessionNodeServerRuntime,
  createOwnerResolver = createConnectorOwnerResolver,
  createTokenStoreRuntime = createOAuthTokenStoreRuntime,
  createRefreshLease = createGoogleRefreshLease,
  createTokenRevoke = createGoogleTokenRevoke
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('INVALID_GOOGLE_DISCONNECT_HTTP:env');
  if (typeof fetchImpl !== 'function') fail('INVALID_GOOGLE_DISCONNECT_HTTP:fetch');
  const sessionRuntime = createSessionRuntime({ env });
  if (!sessionRuntime?.configured) return disabledRuntime();
  if (typeof sessionRuntime.authenticator?.authenticate !== 'function') fail('INVALID_GOOGLE_DISCONNECT_HTTP:session');

  const allowedOrigin = normalizeOrigin(envText(env, ORIGIN_ENV, 512));
  const ownerKey = decodeOwnerKey(envText(env, OWNER_KEY_ENV, 64));
  const ownerResolver = createOwnerResolver({ key: ownerKey });
  const tokenStore = createTokenStoreRuntime({ env });
  if (typeof ownerResolver?.resolve !== 'function' || typeof tokenStore?.load !== 'function' || typeof tokenStore?.remove !== 'function') {
    fail('INVALID_GOOGLE_DISCONNECT_HTTP:composition');
  }

  const refreshRedisUrl = envText(env, REFRESH_REDIS_ENV);
  const refreshLease = refreshRedisUrl
    ? createRefreshLease({ redisUrl: refreshRedisUrl, createClient: createRedisClient })
    : null;
  if (refreshLease && (typeof refreshLease.acquire !== 'function' || typeof refreshLease.close !== 'function')) {
    fail('INVALID_GOOGLE_DISCONNECT_HTTP:refreshLease');
  }
  const tokenRevoke = createTokenRevoke({ tokenStore, refreshLease, fetchImpl });
  if (typeof tokenRevoke?.disconnect !== 'function') fail('INVALID_GOOGLE_DISCONNECT_HTTP:tokenRevoke');

  function authenticate(headers) {
    const auth = sessionRuntime.authenticator.authenticate({ headers });
    if (!auth?.ok) fail('AUTH_REQUIRED');
    if (!auth.principal || auth.principal.authenticated !== true || typeof auth.principal.subject !== 'string') {
      fail('INVALID_GOOGLE_DISCONNECT_HTTP:principal');
    }
    return auth.principal;
  }

  async function handle({ request, method, pathname, url, headers } = {}) {
    if (pathname !== DISCONNECT_PATH) return Object.freeze({ matched: false });
    try {
      if (method !== 'POST') return result(405, { error: 'METHOD_NOT_ALLOWED' }, Object.freeze({ Allow: 'POST' }));
      if (!(url instanceof URL) || url.pathname !== DISCONNECT_PATH || [...url.searchParams].length) {
        fail('INVALID_GOOGLE_DISCONNECT_HTTP:url');
      }
      if (headerValue(headers, 'origin') !== allowedOrigin) fail('GOOGLE_DISCONNECT_ORIGIN_REQUIRED');
      const principal = authenticate(headers);
      const ownership = ownerResolver.resolve(principal);
      const ownerId = typeof ownership?.ownerId === 'string' ? ownership.ownerId.trim() : '';
      if (!ownerId) fail('INVALID_GOOGLE_DISCONNECT_HTTP:owner');
      const body = await readBody(request, headers);
      requireExplicitIntent(body);
      const disconnected = await tokenRevoke.disconnect({ ownerId, explicitUserIntent: true });
      return result(200, {
        linked: false,
        disconnected: true,
        alreadyDisconnected: disconnected.alreadyDisconnected === true
      });
    } catch (error) {
      return publicError(error);
    }
  }

  let closePromise = null;
  function close() {
    if (closePromise) return closePromise;
    closePromise = Promise.resolve()
      .then(() => refreshLease?.close())
      .catch(() => fail('GOOGLE_DISCONNECT_HTTP_CLOSE_FAILED'));
    return closePromise;
  }

  return Object.freeze({ configured: true, handle, close });
}

export const GOOGLE_DISCONNECT_HTTP_PATH = DISCONNECT_PATH;
export const GOOGLE_DISCONNECT_HTTP_LIMITS = Object.freeze({
  maxBodyBytes: MAX_BODY_BYTES,
  bodyTimeoutMs: BODY_TIMEOUT_MS
});
