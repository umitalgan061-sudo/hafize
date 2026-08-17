import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createCloudSessionAuth } from './cloud-session-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { createCanvaReadClient } from './canva-read-client.mjs';
import { createCanvaReadToolBoundary } from './canva-read-tool-boundary.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const CLOUD_PASSWORD_HASH_ENV = 'HAFIZE_CLOUD_SESSION_PASSWORD_HASH';
const CLOUD_SIGNING_KEY_ENV = 'HAFIZE_CLOUD_SESSION_SIGNING_KEY';
const CLOUD_SUBJECT_ENV = 'HAFIZE_CLOUD_SESSION_SUBJECT';
const CLOUD_TTL_ENV = 'HAFIZE_CLOUD_SESSION_TTL_MS';
const EMPTY_CONTEXT = Object.freeze({ canvaReadTool: null, canvaReadAuthenticated: false });

function fail(field) {
  throw new Error(`INVALID_CANVA_AGENT_RUNTIME:${field}`);
}

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

function optionalCloudSessionAuthenticator(env, createCloudAuth) {
  const passwordHash = envText(env, CLOUD_PASSWORD_HASH_ENV);
  const signingKey = envText(env, CLOUD_SIGNING_KEY_ENV);
  const subject = envText(env, CLOUD_SUBJECT_ENV);
  const ttlRaw = envText(env, CLOUD_TTL_ENV);
  const configured = [passwordHash, signingKey, subject].filter(Boolean).length;
  if (configured === 0) return null;
  if (configured !== 3) fail('cloudSessionConfig');

  const options = { passwordHash, signingKey, subject };
  if (ttlRaw) {
    if (!/^\d+$/.test(ttlRaw)) fail(CLOUD_TTL_ENV);
    const ttlMs = Number(ttlRaw);
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 12 * 60 * 60 * 1000) fail(CLOUD_TTL_ENV);
    options.ttlMs = ttlMs;
  }
  const auth = requireFactory(createCloudAuth, 'createCloudAuth')(options);
  if (typeof auth?.authenticate !== 'function') fail('cloudSessionAuthenticator');
  return auth;
}

function validPrincipal(principal) {
  return Boolean(
    principal
    && principal.authenticated === true
    && typeof principal.subject === 'string'
    && principal.subject.trim()
    && principal.subject.length <= 200
  );
}

export function createCanvaAgentRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createAuthenticator = createBearerPrincipalAuthenticator,
  createCloudAuth = createCloudSessionAuth,
  createOwnerResolver = createConnectorOwnerResolver,
  createTokenStoreRuntime = createOAuthTokenStoreRuntime,
  createReadClient = createCanvaReadClient,
  createBoundary = createCanvaReadToolBoundary
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  const authToken = envText(env, AUTH_TOKEN_ENV);
  const authSubject = envText(env, AUTH_SUBJECT_ENV);
  const ownerKey = envText(env, OWNER_KEY_ENV);
  const configuredCount = [authToken, authSubject, ownerKey].filter(Boolean).length;

  if (configuredCount === 0) {
    return Object.freeze({
      configured: false,
      requestContext() { return EMPTY_CONTEXT; },
      async connectionStatus() { return Object.freeze({ ok: false, error: 'CANVA_NOT_CONFIGURED' }); },
      status() { return Object.freeze({ configured: false, access: 'disabled' }); }
    });
  }
  if (configuredCount !== 3) fail('config');
  if (typeof fetchImpl !== 'function') fail('fetch');

  const authenticator = requireFactory(createAuthenticator, 'createAuthenticator')({
    token: authToken,
    subject: authSubject
  });
  const cloudSessionAuthenticator = optionalCloudSessionAuthenticator(env, createCloudAuth);
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({
    key: decodeOwnerKey(ownerKey)
  });
  const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
  const readClient = requireFactory(createReadClient, 'createReadClient')({ tokenStore, fetchImpl });
  const boundary = requireFactory(createBoundary, 'createBoundary')({ readClient, ownerResolver });

  if (typeof authenticator?.authenticate !== 'function') fail('authenticator');
  if (typeof boundary?.execute !== 'function') fail('boundary');

  function readPrincipal(authResult, source) {
    if (!authResult?.ok) return null;
    if (!validPrincipal(authResult.principal)) fail(`${source}Principal`);
    return Object.freeze({
      authenticated: true,
      subject: authResult.principal.subject.trim()
    });
  }

  function authenticate(headers) {
    const bearerPrincipal = readPrincipal(authenticator.authenticate({ headers }), 'bearer');
    if (bearerPrincipal) return bearerPrincipal;
    if (!cloudSessionAuthenticator) return null;
    return readPrincipal(cloudSessionAuthenticator.authenticate({ headers }), 'cloudSession');
  }

  function requestContext({ headers } = {}) {
    const principal = authenticate(headers);
    if (!principal) return EMPTY_CONTEXT;
    const canvaReadTool = Object.freeze({
      execute(args) {
        return boundary.execute(args, { principal });
      }
    });
    return Object.freeze({ canvaReadTool, canvaReadAuthenticated: true });
  }

  async function connectionStatus({ headers } = {}) {
    const principal = authenticate(headers);
    if (!principal) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const ownership = ownerResolver.resolve(principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) fail('owner');
    const record = await tokenStore.load({ ownerId: ownership.ownerId, provider: 'canva' });
    return Object.freeze({ ok: true, linked: record !== null });
  }

  return Object.freeze({
    configured: true,
    requestContext,
    connectionStatus,
    status() {
      return Object.freeze({
        configured: true,
        access: cloudSessionAuthenticator ? 'authenticated-read-only-with-cloud-session' : 'authenticated-read-only'
      });
    }
  });
}

export const CANVA_AGENT_RUNTIME_ENV = Object.freeze({
  authToken: AUTH_TOKEN_ENV,
  authSubject: AUTH_SUBJECT_ENV,
  ownerKey: OWNER_KEY_ENV,
  cloudPasswordHash: CLOUD_PASSWORD_HASH_ENV,
  cloudSigningKey: CLOUD_SIGNING_KEY_ENV,
  cloudSubject: CLOUD_SUBJECT_ENV,
  cloudTtlMs: CLOUD_TTL_ENV
});