import { createClient as createRedisClientDefault } from 'redis';
import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { createGoogleRefreshLease } from './google-refresh-lease.mjs';
import { createGoogleTokenRefresh } from './google-token-refresh.mjs';
import { createGmailReadClient } from './gmail-read-client.mjs';
import { createGmailReadToolBoundary } from './gmail-read-tool-boundary.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const GOOGLE_CLIENT_ID_ENV = 'HAFIZE_GOOGLE_OAUTH_CLIENT_ID';
const GOOGLE_CLIENT_SECRET_ENV = 'HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET';
const GOOGLE_REFRESH_REDIS_ENV = 'HAFIZE_GOOGLE_REFRESH_REDIS_URL';
const EMPTY_CONTEXT = Object.freeze({ gmailReadTool: null, gmailReadAuthenticated: false });

function fail(field) { throw new Error(`INVALID_GMAIL_AGENT_RUNTIME:${field}`); }
function envText(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}
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

export function createGmailAgentRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createRedisClient = createRedisClientDefault,
  createAuthenticator = createBearerPrincipalAuthenticator,
  createOwnerResolver = createConnectorOwnerResolver,
  createTokenStoreRuntime = createOAuthTokenStoreRuntime,
  createRefreshLease = createGoogleRefreshLease,
  createTokenRefresh = createGoogleTokenRefresh,
  createReadClient = createGmailReadClient,
  createBoundary = createGmailReadToolBoundary
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  const authToken = envText(env, AUTH_TOKEN_ENV);
  const authSubject = envText(env, AUTH_SUBJECT_ENV);
  const ownerKey = envText(env, OWNER_KEY_ENV);
  const googleClientId = envText(env, GOOGLE_CLIENT_ID_ENV);
  const googleClientSecret = envText(env, GOOGLE_CLIENT_SECRET_ENV);
  const googleRefreshRedisUrl = envText(env, GOOGLE_REFRESH_REDIS_ENV);
  const configuredCount = [authToken, authSubject, ownerKey].filter(Boolean).length;
  if (configuredCount === 0) {
    return Object.freeze({
      configured: false,
      requestContext() { return EMPTY_CONTEXT; },
      async connectionStatus() { return Object.freeze({ ok: false, error: 'GMAIL_NOT_CONFIGURED' }); },
      status() { return Object.freeze({ configured: false, access: 'disabled' }); },
      async close() {}
    });
  }
  if (configuredCount !== 3) fail('config');
  if (googleClientSecret && !googleClientId) fail('googleOAuthConfig');
  if (Boolean(googleClientId) !== Boolean(googleRefreshRedisUrl)) fail('googleRefreshCoordination');
  if (typeof fetchImpl !== 'function') fail('fetch');

  const authenticator = requireFactory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject });
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({ key: decodeOwnerKey(ownerKey) });
  const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
  const refreshLease = googleClientId
    ? requireFactory(createRefreshLease, 'createRefreshLease')({
        redisUrl: googleRefreshRedisUrl,
        createClient: requireFactory(createRedisClient, 'createRedisClient')
      })
    : null;
  if (refreshLease && (typeof refreshLease.acquire !== 'function' || typeof refreshLease.close !== 'function')) fail('refreshLease');
  const tokenRefresh = googleClientId
    ? requireFactory(createTokenRefresh, 'createTokenRefresh')({
        clientId: googleClientId,
        clientSecret: googleClientSecret || null,
        tokenStore,
        refreshLease,
        fetchImpl
      })
    : null;
  if (tokenRefresh && typeof tokenRefresh.refresh !== 'function') fail('tokenRefresh');
  const readClient = requireFactory(createReadClient, 'createReadClient')({
    tokenStore,
    refreshAccessToken: tokenRefresh ? (input) => tokenRefresh.refresh(input) : null,
    fetchImpl
  });
  const boundary = requireFactory(createBoundary, 'createBoundary')({ readClient, ownerResolver });
  if (typeof authenticator?.authenticate !== 'function') fail('authenticator');
  if (typeof boundary?.execute !== 'function') fail('boundary');

  function authenticate(headers) {
    const auth = authenticator.authenticate({ headers });
    if (!auth?.ok) return null;
    if (!auth.principal || auth.principal.authenticated !== true || typeof auth.principal.subject !== 'string') fail('principal');
    return auth.principal;
  }

  function requestContext({ headers } = {}) {
    const principal = authenticate(headers);
    if (!principal) return EMPTY_CONTEXT;
    return Object.freeze({
      gmailReadAuthenticated: true,
      gmailReadTool: Object.freeze({ execute(args) { return boundary.execute(args, { principal }); } })
    });
  }

  async function connectionStatus({ headers } = {}) {
    const principal = authenticate(headers);
    if (!principal) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const ownership = ownerResolver.resolve(principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) fail('owner');
    const record = await tokenStore.load({ ownerId: ownership.ownerId, provider: 'google' });
    return Object.freeze({ ok: true, linked: record !== null });
  }

  async function close() {
    await refreshLease?.close();
  }

  return Object.freeze({
    configured: true,
    requestContext,
    connectionStatus,
    status() { return Object.freeze({ configured: true, access: 'authenticated-read-only' }); },
    close
  });
}

export const GMAIL_AGENT_RUNTIME_ENV = Object.freeze({
  authToken: AUTH_TOKEN_ENV,
  authSubject: AUTH_SUBJECT_ENV,
  ownerKey: OWNER_KEY_ENV,
  googleClientId: GOOGLE_CLIENT_ID_ENV,
  googleClientSecret: GOOGLE_CLIENT_SECRET_ENV,
  googleRefreshRedisUrl: GOOGLE_REFRESH_REDIS_ENV
});
