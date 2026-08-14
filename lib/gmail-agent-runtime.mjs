import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { createGmailReadClient } from './gmail-read-client.mjs';
import { createGmailReadToolBoundary } from './gmail-read-tool-boundary.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
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
  createAuthenticator = createBearerPrincipalAuthenticator,
  createOwnerResolver = createConnectorOwnerResolver,
  createTokenStoreRuntime = createOAuthTokenStoreRuntime,
  createReadClient = createGmailReadClient,
  createBoundary = createGmailReadToolBoundary
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
      status() { return Object.freeze({ configured: false, access: 'disabled' }); }
    });
  }
  if (configuredCount !== 3) fail('config');
  if (typeof fetchImpl !== 'function') fail('fetch');

  const authenticator = requireFactory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject });
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({ key: decodeOwnerKey(ownerKey) });
  const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
  const readClient = requireFactory(createReadClient, 'createReadClient')({ tokenStore, fetchImpl });
  const boundary = requireFactory(createBoundary, 'createBoundary')({ readClient, ownerResolver });
  if (typeof authenticator?.authenticate !== 'function') fail('authenticator');
  if (typeof boundary?.execute !== 'function') fail('boundary');

  function requestContext({ headers } = {}) {
    const auth = authenticator.authenticate({ headers });
    if (!auth?.ok) return EMPTY_CONTEXT;
    if (!auth.principal || auth.principal.authenticated !== true || typeof auth.principal.subject !== 'string') fail('principal');
    const principal = auth.principal;
    return Object.freeze({
      gmailReadAuthenticated: true,
      gmailReadTool: Object.freeze({ execute(args) { return boundary.execute(args, { principal }); } })
    });
  }

  return Object.freeze({
    configured: true,
    requestContext,
    status() { return Object.freeze({ configured: true, access: 'authenticated-read-only' }); }
  });
}

export const GMAIL_AGENT_RUNTIME_ENV = Object.freeze({ authToken: AUTH_TOKEN_ENV, authSubject: AUTH_SUBJECT_ENV, ownerKey: OWNER_KEY_ENV });