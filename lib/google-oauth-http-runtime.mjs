import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createGoogleOAuthRuntime } from './google-oauth-runtime.mjs';
import { createGoogleTokenExchange } from './google-token-exchange.mjs';
import { createOAuthFlowRuntime } from './oauth-flow-runtime.mjs';
import { normalizeOAuthFlowOwnerId } from './oauth-flow-store.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { createRedisOAuthFlowStoreRuntime } from './redis-oauth-flow-store-runtime.mjs';

const START_PATH = '/api/connectors/gmail/oauth/start';
const CALLBACK_PATH = '/api/connectors/gmail/oauth/callback';
const REDIRECT_URI_ENV = 'HAFIZE_GOOGLE_OAUTH_REDIRECT_URI';
const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const GOOGLE_CLIENT_ID_ENV = 'HAFIZE_GOOGLE_OAUTH_CLIENT_ID';
const GOOGLE_CLIENT_SECRET_ENV = 'HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET';
const OAUTH_REDIS_ENV = 'HAFIZE_OAUTH_REDIS_URL';
const CALLBACK_FIELDS = new Set(['code', 'state', 'error', 'error_description']);
const PRODUCTION_CAPABILITIES = new Set(['identity', 'gmail.read']);
const MAX_START_BODY_BYTES = 8 * 1024;
const MAX_CALLBACK_QUERY_BYTES = 4 * 1024;
const DEFAULT_START_BODY_TIMEOUT_MS = 10_000;
const MAX_START_BODY_TIMEOUT_MS = 30_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function envText(env, name) {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function requireText(env, name, max = 4096) {
  const value = envText(env, name);
  if (!value || value.length > max || /[\u0000\r\n]/.test(value)) fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${name}`);
  return value;
}

function positiveInteger(value, fallback, max, field) {
  if (value == null) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > max) fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${field}`);
  return value;
}

function decodeOwnerKey(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${OWNER_KEY_ENV}`);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${OWNER_KEY_ENV}`);
  return key;
}

function normalizeConfiguredRedirectUri(value) {
  let url;
  try { url = new URL(value); } catch { fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${REDIRECT_URI_ENV}`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search || url.pathname !== CALLBACK_PATH) {
    fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${REDIRECT_URI_ENV}`);
  }
  return url.toString();
}

function requireFactory(value, field) {
  if (typeof value !== 'function') fail(`INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:${field}`);
  return value;
}

function result(status, body, headers = undefined) {
  return Object.freeze({ matched: true, status, body: Object.freeze(body), headers });
}

function disabledRuntime() {
  return Object.freeze({
    configured: false,
    async handle({ pathname } = {}) {
      if (pathname !== START_PATH && pathname !== CALLBACK_PATH) return Object.freeze({ matched: false });
      return result(404, { error: 'GOOGLE_OAUTH_NOT_CONFIGURED' });
    },
    status() { return Object.freeze({ configured: false }); },
    async close() {}
  });
}

function enforceProductionCapabilities(body) {
  if (!body || Array.isArray(body) || typeof body !== 'object') return;
  if (!Array.isArray(body.capabilities)) return;
  if (body.capabilities.some((capability) => !PRODUCTION_CAPABILITIES.has(capability))) {
    fail('GOOGLE_OAUTH_HTTP_SCOPE_NOT_ALLOWED');
  }
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return typeof direct === 'string' ? direct.trim() : '';
}

function requireJsonContentType(headers) {
  const raw = headerValue(headers, 'content-type');
  if (!raw || raw.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    fail('GOOGLE_OAUTH_HTTP_UNSUPPORTED_MEDIA_TYPE');
  }
}

function declaredBodyLength(headers) {
  const raw = headerValue(headers, 'content-length');
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:contentLength');
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:contentLength');
  return value;
}

async function readStartJson(request, headers, fallbackReadJson, timeoutMs) {
  requireJsonContentType(headers);
  const declared = declaredBodyLength(headers);
  if (declared !== null && declared > MAX_START_BODY_BYTES) fail('GOOGLE_OAUTH_HTTP_BODY_TOO_LARGE');
  if (!request || typeof request[Symbol.asyncIterator] !== 'function') return fallbackReadJson(request);

  const chunks = [];
  let size = 0;
  let rejectDeadline;
  const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
  const timer = setTimeout(() => {
    const error = new Error('GOOGLE_OAUTH_HTTP_BODY_TIMEOUT');
    error.code = error.message;
    rejectDeadline(error);
  }, timeoutMs);

  const iterator = request[Symbol.asyncIterator]();
  try {
    while (true) {
      const item = await Promise.race([Promise.resolve().then(() => iterator.next()), deadline]);
      if (item?.done) break;
      const raw = item?.value;
      if (!(typeof raw === 'string' || Buffer.isBuffer(raw) || raw instanceof Uint8Array)) {
        fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:body');
      }
      const chunk = Buffer.from(raw);
      size += chunk.length;
      if (size > MAX_START_BODY_BYTES) fail('GOOGLE_OAUTH_HTTP_BODY_TOO_LARGE');
      chunks.push(chunk);
    }
  } catch (error) {
    try { void iterator.return?.(); } catch { /* connection is closed by response policy */ }
    try { request.resume?.(); } catch { /* connection is closed by response policy */ }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = Buffer.concat(chunks, size).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function parseCallbackUrl(url) {
  if (!(url instanceof URL) || url.pathname !== CALLBACK_PATH) fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:url');
  if (Buffer.byteLength(url.search, 'utf8') > MAX_CALLBACK_QUERY_BYTES) fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:callback');
  const values = {};
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (!CALLBACK_FIELDS.has(key) || seen.has(key)) fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:callback');
    seen.add(key);
    values[key] = value;
  }
  return values;
}

function publicError(error) {
  const code = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
  if (error instanceof SyntaxError) return result(400, { error: 'INVALID_JSON' });
  if (code === 'AUTH_REQUIRED') return result(401, { error: 'AUTH_REQUIRED' });
  if (code === 'GOOGLE_OAUTH_HTTP_BODY_TOO_LARGE' || code === 'BODY_TOO_LARGE') {
    return result(413, { error: 'BODY_TOO_LARGE' }, Object.freeze({ Connection: 'close' }));
  }
  if (code === 'GOOGLE_OAUTH_HTTP_BODY_TIMEOUT') {
    return result(408, { error: 'REQUEST_TIMEOUT' }, Object.freeze({ Connection: 'close' }));
  }
  if (code === 'GOOGLE_OAUTH_HTTP_UNSUPPORTED_MEDIA_TYPE') return result(415, { error: 'UNSUPPORTED_MEDIA_TYPE' });
  if (code === 'GOOGLE_OAUTH_HTTP_SCOPE_NOT_ALLOWED') return result(403, { error: 'OAUTH_SCOPE_NOT_ALLOWED' });
  if (code === 'GOOGLE_TOKEN_EXCHANGE_REFRESH_TOKEN_REQUIRED') {
    return result(409, { linked: false, error: 'GOOGLE_OAUTH_REAUTH_REQUIRED' });
  }
  if (code.startsWith('INVALID_GOOGLE_OAUTH_POLICY:') ||
      code.startsWith('INVALID_OAUTH_CALLBACK:') ||
      code.startsWith('INVALID_OAUTH_FLOW:') ||
      code.startsWith('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:') ||
      code === 'OAUTH_FLOW_NOT_FOUND' || code === 'OAUTH_FLOW_EXPIRED' || code === 'GOOGLE_OAUTH_FLOW_PROVIDER_MISMATCH') {
    return result(400, { error: 'INVALID_OAUTH_REQUEST' });
  }
  if (code === 'OAUTH_FLOW_STORE_FULL' || code === 'OAUTH_FLOW_STORE_UNAVAILABLE') {
    return result(503, { error: 'OAUTH_TEMPORARILY_UNAVAILABLE' });
  }
  if (code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:timeout') return result(504, { error: 'GOOGLE_OAUTH_UPSTREAM_TIMEOUT' });
  if (code.startsWith('GOOGLE_TOKEN_EXCHANGE_FAILED:') || code === 'GOOGLE_TOKEN_EXCHANGE_SCOPE_ESCALATION') {
    return result(502, { error: 'GOOGLE_OAUTH_UPSTREAM_FAILED' });
  }
  return result(500, { error: 'GOOGLE_OAUTH_INTERNAL_ERROR' });
}

export async function createGoogleOAuthHttpRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  readJson,
  createAuthenticator = createBearerPrincipalAuthenticator,
  createOwnerResolver = createConnectorOwnerResolver,
  createTokenStoreRuntime = createOAuthTokenStoreRuntime,
  createFlowStoreRuntime = createRedisOAuthFlowStoreRuntime,
  createFlowRuntime = createOAuthFlowRuntime,
  createOAuthRuntime = createGoogleOAuthRuntime,
  createTokenExchange = createGoogleTokenExchange,
  startBodyTimeoutMs = DEFAULT_START_BODY_TIMEOUT_MS
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:env');
  const configuredRedirect = envText(env, REDIRECT_URI_ENV);
  if (!configuredRedirect) return disabledRuntime();
  if (typeof readJson !== 'function') fail('INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:readJson');
  if (typeof fetchImpl !== 'function') fail('INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:fetch');
  const bodyTimeout = positiveInteger(startBodyTimeoutMs, DEFAULT_START_BODY_TIMEOUT_MS, MAX_START_BODY_TIMEOUT_MS, 'startBodyTimeoutMs');

  const clientId = requireText(env, GOOGLE_CLIENT_ID_ENV, 512);
  const clientSecret = envText(env, GOOGLE_CLIENT_SECRET_ENV) || null;
  const redirectUri = normalizeConfiguredRedirectUri(configuredRedirect);
  const authToken = requireText(env, AUTH_TOKEN_ENV);
  const authSubject = requireText(env, AUTH_SUBJECT_ENV, 200);
  const ownerKey = decodeOwnerKey(requireText(env, OWNER_KEY_ENV, 64));
  requireText(env, OAUTH_REDIS_ENV);

  const authenticator = requireFactory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject });
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({ key: ownerKey });
  if (typeof authenticator?.authenticate !== 'function') fail('INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:authenticator');
  if (typeof ownerResolver?.resolve !== 'function') fail('INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:ownerResolver');

  let flowStoreRuntime = null;
  try {
    const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
    if (typeof tokenStore?.save !== 'function') throw new Error('invalid token store');
    flowStoreRuntime = await requireFactory(createFlowStoreRuntime, 'createFlowStoreRuntime')({ env });
    if (!flowStoreRuntime?.configured || typeof flowStoreRuntime.store?.issue !== 'function' ||
        typeof flowStoreRuntime.store?.consume !== 'function' || typeof flowStoreRuntime.close !== 'function') {
      throw new Error('oauth redis runtime unavailable');
    }
    const flowRuntime = requireFactory(createFlowRuntime, 'createFlowRuntime')({ store: flowStoreRuntime.store });
    const oauthRuntime = requireFactory(createOAuthRuntime, 'createOAuthRuntime')({ clientId, redirectUri, flowRuntime });
    const tokenExchange = requireFactory(createTokenExchange, 'createTokenExchange')({
      clientId,
      clientSecret,
      tokenStore,
      fetchImpl
    });
    if (typeof oauthRuntime?.start !== 'function' || typeof oauthRuntime?.finish !== 'function' ||
        typeof tokenExchange?.exchange !== 'function') throw new Error('invalid oauth composition');

    function authenticate(headers) {
      const auth = authenticator.authenticate({ headers });
      if (!auth?.ok) fail('AUTH_REQUIRED');
      if (!auth.principal || auth.principal.authenticated !== true || typeof auth.principal.subject !== 'string') {
        throw new Error('invalid principal');
      }
      return auth.principal;
    }

    async function handleStart({ request, url, headers }) {
      if (!(url instanceof URL) || url.pathname !== START_PATH || [...url.searchParams].length) {
        fail('INVALID_GOOGLE_OAUTH_HTTP_REQUEST:url');
      }
      const principal = authenticate(headers);
      const ownership = ownerResolver.resolve(principal);
      const ownerId = normalizeOAuthFlowOwnerId(ownership?.ownerId, { required: true });
      const body = await readStartJson(request, headers, readJson, bodyTimeout);
      enforceProductionCapabilities(body);
      const started = await oauthRuntime.start(body, { ownerId });
      return result(200, {
        authorizationUrl: started.authorizationUrl,
        expiresAt: started.expiresAt,
        capabilities: started.capabilities,
        requiresWriteApproval: started.requiresWriteApproval
      });
    }

    async function handleCallback({ url }) {
      const callback = parseCallbackUrl(url);
      const finished = await oauthRuntime.finish(callback);
      if (!finished.ok) return result(400, { linked: false, error: 'OAUTH_PROVIDER_DENIED' });
      const ownerId = normalizeOAuthFlowOwnerId(finished.ownerId, { required: true });
      await tokenExchange.exchange({
        ownerId,
        code: finished.code,
        verifier: finished.verifier,
        redirectUri: finished.redirectUri,
        expectedScopes: finished.scopes,
        requireRefreshToken: true
      });
      return result(200, { linked: true });
    }

    async function handle({ request, method, pathname, url, headers } = {}) {
      if (pathname !== START_PATH && pathname !== CALLBACK_PATH) return Object.freeze({ matched: false });
      try {
        if (pathname === START_PATH) {
          if (method !== 'POST') return result(405, { error: 'METHOD_NOT_ALLOWED' }, Object.freeze({ Allow: 'POST' }));
          return await handleStart({ request, url, headers });
        }
        if (method !== 'GET') return result(405, { error: 'METHOD_NOT_ALLOWED' }, Object.freeze({ Allow: 'GET' }));
        return await handleCallback({ url });
      } catch (error) {
        return publicError(error);
      }
    }

    let closePromise = null;
    function close() {
      if (closePromise) return closePromise;
      closePromise = Promise.resolve()
        .then(() => flowStoreRuntime.close())
        .catch(() => { fail('GOOGLE_OAUTH_HTTP_RUNTIME_CLOSE_FAILED'); });
      return closePromise;
    }

    return Object.freeze({
      configured: true,
      handle,
      status() { return Object.freeze({ configured: true, provider: 'google', callbackPath: CALLBACK_PATH }); },
      close
    });
  } catch {
    try { await flowStoreRuntime?.close?.(); } catch { /* startup error remains sanitized */ }
    fail('GOOGLE_OAUTH_HTTP_RUNTIME_STARTUP_FAILED');
  }
}

export const GOOGLE_OAUTH_HTTP_PATHS = Object.freeze({ start: START_PATH, callback: CALLBACK_PATH });
export const GOOGLE_OAUTH_HTTP_ENV = Object.freeze({ redirectUri: REDIRECT_URI_ENV });
export const GOOGLE_OAUTH_HTTP_LIMITS = Object.freeze({
  maxStartBodyBytes: MAX_START_BODY_BYTES,
  maxCallbackQueryBytes: MAX_CALLBACK_QUERY_BYTES,
  defaultStartBodyTimeoutMs: DEFAULT_START_BODY_TIMEOUT_MS,
  maxStartBodyTimeoutMs: MAX_START_BODY_TIMEOUT_MS
});
