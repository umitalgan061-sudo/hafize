import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { createCanvaReadClient } from './canva-read-client.mjs';
import { createCanvaReadToolBoundary } from './canva-read-tool-boundary.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
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

export function createCanvaAgentRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createAuthenticator = createBearerPrincipalAuthenticator,
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
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({
    key: decodeOwnerKey(ownerKey)
  });
  const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
  const readClient = requireFactory(createReadClient, 'createReadClient')({ tokenStore, fetchImpl });
  const boundary = requireFactory(createBoundary, 'createBoundary')({ readClient, ownerResolver });

  if (typeof authenticator?.authenticate !== 'function') fail('authenticator');
  if (typeof boundary?.execute !== 'function') fail('boundary');

  function authenticate(headers) {
    const auth = authenticator.authenticate({ headers });
    if (!auth?.ok) return null;
    if (!auth.principal || auth.principal.authenticated !== true || typeof auth.principal.subject !== 'string') {
      fail('principal');
    }
    return auth.principal;
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
    status() { return Object.freeze({ configured: true, access: 'authenticated-read-only' }); }
  });
}

export const CANVA_AGENT_RUNTIME_ENV = Object.freeze({
  authToken: AUTH_TOKEN_ENV,
  authSubject: AUTH_SUBJECT_ENV,
  ownerKey: OWNER_KEY_ENV
});
