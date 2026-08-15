import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createOAuthFlowAsyncRuntime } from './oauth-flow-async-runtime.mjs';
import { createOAuthFlowStoreRuntime } from './oauth-flow-store-runtime.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { normalizeGoogleOAuthRequest } from './google-oauth-policy.mjs';
import { GOOGLE_AUTHORIZATION_ENDPOINT } from './google-oauth-runtime.mjs';
import { createGoogleTokenExchange } from './google-token-exchange.mjs';

const START_PATH = '/api/connectors/gmail/oauth/start';
const CALLBACK_PATH = '/api/connectors/gmail/oauth/callback';
const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const CLIENT_ID_ENV = 'HAFIZE_GOOGLE_OAUTH_CLIENT_ID';
const CLIENT_SECRET_ENV = 'HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET';
const REDIRECT_URI_ENV = 'HAFIZE_GOOGLE_OAUTH_REDIRECT_URI';
const FLOW_REDIS_ENV = 'HAFIZE_OAUTH_FLOW_REDIS_URL';
const FORBIDDEN_CALLBACK_FIELDS = new Set(['owner', 'ownerId', 'subject', 'token', 'access_token', 'authorization']);
const CALLBACK_FIELDS = ['state', 'code', 'error', 'error_description'];

function fail(field) { throw new Error(`INVALID_GOOGLE_OAUTH_SERVER_RUNTIME:${field}`); }
function envText(env, name) { return typeof env[name] === 'string' ? env[name].trim() : ''; }
function decodeOwnerKey(value) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(OWNER_KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(OWNER_KEY_ENV);
  return key;
}
function requireFactory(value, name) {
  if (typeof value !== 'function') fail(name);
  return value;
}
function disabledRuntime() {
  return Object.freeze({
    configured: false,
    async handle({ pathname } = {}) {
      return Object.freeze({ matched: pathname === START_PATH || pathname === CALLBACK_PATH, status: 404, body: { error: 'NOT_FOUND' } });
    },
    async close() {}
  });
}
function callbackInput(url) {
  if (!url?.searchParams || typeof url.searchParams.getAll !== 'function') fail('url');
  for (const field of FORBIDDEN_CALLBACK_FIELDS) {
    if (url.searchParams.has(field)) throw new Error('INVALID_OAUTH_CALLBACK:identity_field');
  }
  const input = {};
  for (const field of CALLBACK_FIELDS) {
    const values = url.searchParams.getAll(field);
    if (values.length > 1) throw new Error(`INVALID_OAUTH_CALLBACK:duplicate_${field}`);
    if (values.length === 1) input[field] = values[0];
  }
  return input;
}
function mapFlowError(error) {
  const code = String(error?.code || error?.message || '');
  if (code.startsWith('INVALID_OAUTH_CALLBACK') || code === 'OAUTH_FLOW_NOT_FOUND' || code === 'OAUTH_FLOW_EXPIRED') {
    return { status: 400, error: 'INVALID_OAUTH_CALLBACK' };
  }
  return { status: 503, error: 'OAUTH_FLOW_UNAVAILABLE' };
}

export function createGoogleOAuthNodeServerRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createAuthenticator = createBearerPrincipalAuthenticator,
  createOwnerResolver = createConnectorOwnerResolver,
  createFlowStoreRuntime = createOAuthFlowStoreRuntime,
  createFlowRuntime = createOAuthFlowAsyncRuntime,
  createTokenStoreRuntime = createOAuthTokenStoreRuntime,
  createTokenExchange = createGoogleTokenExchange
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  const authToken = envText(env, AUTH_TOKEN_ENV);
  const authSubject = envText(env, AUTH_SUBJECT_ENV);
  const ownerKey = envText(env, OWNER_KEY_ENV);
  const clientId = envText(env, CLIENT_ID_ENV);
  const clientSecret = envText(env, CLIENT_SECRET_ENV);
  const redirectUri = envText(env, REDIRECT_URI_ENV);
  const flowRedisUrl = envText(env, FLOW_REDIS_ENV);
  const oauthValues = [clientId, clientSecret, redirectUri, flowRedisUrl];
  if (!oauthValues.some(Boolean)) return disabledRuntime();
  if (!clientId || !redirectUri || !flowRedisUrl || !authToken || !authSubject || !ownerKey) fail('config');
  if (typeof fetchImpl !== 'function') fail('fetch');

  const authenticator = requireFactory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject });
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({ key: decodeOwnerKey(ownerKey) });
  const flowStore = requireFactory(createFlowStoreRuntime, 'createFlowStoreRuntime')({ env });
  const flowRuntime = requireFactory(createFlowRuntime, 'createFlowRuntime')({ store: flowStore });
  const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
  if (tokenStore?.status?.()?.storage !== 'encrypted-redis') fail('tokenStorage');
  const tokenExchange = requireFactory(createTokenExchange, 'createTokenExchange')({
    clientId,
    clientSecret: clientSecret || null,
    tokenStore,
    fetchImpl
  });
  if (typeof authenticator?.authenticate !== 'function' || typeof ownerResolver?.resolve !== 'function' ||
      typeof flowRuntime?.start !== 'function' || typeof flowRuntime?.finish !== 'function' ||
      typeof tokenExchange?.exchange !== 'function') fail('composition');
  const policy = normalizeGoogleOAuthRequest({ capabilities: ['gmail.read'] });
  let closePromise = null;

  async function handle({ method, pathname, url, headers } = {}) {
    if (pathname !== START_PATH && pathname !== CALLBACK_PATH) return Object.freeze({ matched: false });
    if (pathname === START_PATH) {
      if (method !== 'POST') return Object.freeze({ matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } });
      const auth = authenticator.authenticate({ headers });
      if (!auth?.ok || auth.principal?.authenticated !== true) {
        return Object.freeze({ matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } });
      }
      const ownership = ownerResolver.resolve(auth.principal);
      try {
        const started = await flowRuntime.start({
          provider: 'google', ownerId: ownership.ownerId,
          authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
          clientId, redirectUri, scopes: policy.scopes,
          extraParams: { access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent' }
        });
        return Object.freeze({ matched: true, status: 200, body: { authorizationUrl: started.authorizationUrl } });
      } catch {
        return Object.freeze({ matched: true, status: 503, body: { error: 'OAUTH_FLOW_UNAVAILABLE' } });
      }
    }

    if (method !== 'GET') return Object.freeze({ matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } });
    let finished;
    try { finished = await flowRuntime.finish(callbackInput(url)); }
    catch (error) {
      const mapped = mapFlowError(error);
      return Object.freeze({ matched: true, status: mapped.status, body: { error: mapped.error } });
    }
    if (finished.provider !== 'google') return Object.freeze({ matched: true, status: 400, body: { error: 'OAUTH_PROVIDER_MISMATCH' } });
    if (!finished.ok) return Object.freeze({ matched: true, status: 400, body: { error: 'OAUTH_DENIED' } });
    try {
      const linked = await tokenExchange.exchange({
        ownerId: finished.ownerId,
        code: finished.code,
        verifier: finished.verifier,
        redirectUri: finished.redirectUri
      });
      return Object.freeze({
        matched: true, status: 200,
        body: { linked: true, provider: 'google', scopes: [...linked.scopes], expiresAt: linked.expiresAt }
      });
    } catch {
      return Object.freeze({ matched: true, status: 502, body: { error: 'GOOGLE_TOKEN_EXCHANGE_FAILED' } });
    }
  }

  function close() {
    if (closePromise) return closePromise;
    closePromise = Promise.allSettled([flowRuntime.close?.(), tokenStore.close?.()]).then((results) => {
      if (results.some((result) => result.status === 'rejected')) throw new Error('GOOGLE_OAUTH_SERVER_RUNTIME_CLOSE_FAILED');
    });
    return closePromise;
  }

  return Object.freeze({ configured: true, handle, close });
}

export const GOOGLE_OAUTH_HTTP_PATHS = Object.freeze({ start: START_PATH, callback: CALLBACK_PATH });
export const GOOGLE_OAUTH_SERVER_ENV = Object.freeze({
  authToken: AUTH_TOKEN_ENV, authSubject: AUTH_SUBJECT_ENV, ownerKey: OWNER_KEY_ENV,
  clientId: CLIENT_ID_ENV, clientSecret: CLIENT_SECRET_ENV, redirectUri: REDIRECT_URI_ENV, flowRedisUrl: FLOW_REDIS_ENV
});
