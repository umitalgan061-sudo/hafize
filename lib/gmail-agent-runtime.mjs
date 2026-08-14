import { createBearerPrincipalAuthenticator } from './server-auth.mjs';
import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { createOAuthTokenStoreRuntime } from './oauth-token-store-runtime.mjs';
import { createGmailReadClient } from './gmail-read-client.mjs';
import { createGmailReadToolBoundary } from './gmail-read-tool-boundary.mjs';
import { createGmailSendClient } from './gmail-send-client.mjs';
import { createGmailSendToolBoundary } from './gmail-send-tool-boundary.mjs';
import { createGmailSendApprovalService } from './gmail-send-approval.mjs';

const AUTH_TOKEN_ENV = 'HAFIZE_CONNECTOR_AUTH_TOKEN';
const AUTH_SUBJECT_ENV = 'HAFIZE_CONNECTOR_AUTH_SUBJECT';
const OWNER_KEY_ENV = 'HAFIZE_CONNECTOR_OWNER_KEY_B64';
const SEND_APPROVAL_KEY_ENV = 'HAFIZE_GMAIL_SEND_APPROVAL_KEY_B64';
const EMPTY_CONTEXT = Object.freeze({ gmailReadTool: null, gmailReadAuthenticated: false });

function fail(field) { throw new Error(`INVALID_GMAIL_AGENT_RUNTIME:${field}`); }
function envText(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}
function decodeKey(value, name) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(name);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(name);
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
  createBoundary = createGmailReadToolBoundary,
  createSendClient = createGmailSendClient,
  createSendBoundary = createGmailSendToolBoundary,
  createSendApproval = createGmailSendApprovalService
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  const authToken = envText(env, AUTH_TOKEN_ENV);
  const authSubject = envText(env, AUTH_SUBJECT_ENV);
  const ownerKey = envText(env, OWNER_KEY_ENV);
  const sendApprovalKey = envText(env, SEND_APPROVAL_KEY_ENV);
  const configuredCount = [authToken, authSubject, ownerKey].filter(Boolean).length;
  if (configuredCount === 0) {
    if (sendApprovalKey) fail('config');
    return Object.freeze({
      configured: false,
      sendConfigured: false,
      requestContext() { return EMPTY_CONTEXT; },
      async issueSendApproval() { return Object.freeze({ ok: false, error: 'GMAIL_NOT_CONFIGURED' }); },
      async connectionStatus() { return Object.freeze({ ok: false, error: 'GMAIL_NOT_CONFIGURED' }); },
      status() { return Object.freeze({ configured: false, access: 'disabled' }); }
    });
  }
  if (configuredCount !== 3) fail('config');
  if (typeof fetchImpl !== 'function') fail('fetch');

  const authenticator = requireFactory(createAuthenticator, 'createAuthenticator')({ token: authToken, subject: authSubject });
  const ownerResolver = requireFactory(createOwnerResolver, 'createOwnerResolver')({ key: decodeKey(ownerKey, OWNER_KEY_ENV) });
  const tokenStore = requireFactory(createTokenStoreRuntime, 'createTokenStoreRuntime')({ env });
  const readClient = requireFactory(createReadClient, 'createReadClient')({ tokenStore, fetchImpl });
  const readBoundary = requireFactory(createBoundary, 'createBoundary')({ readClient, ownerResolver });
  if (typeof authenticator?.authenticate !== 'function') fail('authenticator');
  if (typeof readBoundary?.execute !== 'function') fail('readBoundary');

  let sendBoundary = null;
  let sendApproval = null;
  if (sendApprovalKey) {
    const sendClient = requireFactory(createSendClient, 'createSendClient')({ tokenStore, fetchImpl });
    sendBoundary = requireFactory(createSendBoundary, 'createSendBoundary')({ sendClient, ownerResolver });
    sendApproval = requireFactory(createSendApproval, 'createSendApproval')({ secret: decodeKey(sendApprovalKey, SEND_APPROVAL_KEY_ENV) });
    if (typeof sendBoundary?.execute !== 'function' || typeof sendApproval?.issue !== 'function' || typeof sendApproval?.consume !== 'function') {
      fail('sendRuntime');
    }
  }

  function authenticate(headers) {
    const auth = authenticator.authenticate({ headers });
    if (!auth?.ok) return null;
    if (!auth.principal || auth.principal.authenticated !== true || typeof auth.principal.subject !== 'string') fail('principal');
    return auth.principal;
  }

  function resolveOwner(principal) {
    const ownership = ownerResolver.resolve(principal);
    if (!ownership || typeof ownership.ownerId !== 'string' || !ownership.ownerId) fail('owner');
    return ownership.ownerId;
  }

  function requestContext({ headers, gmailSendApprovalToken } = {}) {
    const principal = authenticate(headers);
    if (!principal) return EMPTY_CONTEXT;
    const readContext = {
      gmailReadAuthenticated: true,
      gmailReadTool: Object.freeze({ execute(args) { return readBoundary.execute(args, { principal }); } })
    };
    if (!sendApproval || typeof gmailSendApprovalToken !== 'string' || !gmailSendApprovalToken) {
      return Object.freeze(readContext);
    }
    const ownerId = resolveOwner(principal);
    return Object.freeze({
      ...readContext,
      gmailSendAuthenticated: true,
      gmailSendTool: Object.freeze({
        async execute(args) {
          sendApproval.consume({ token: gmailSendApprovalToken, ownerId, message: args });
          return sendBoundary.execute(args, { principal, approvalGranted: true });
        }
      })
    });
  }

  async function issueSendApproval({ headers, message, userConfirmed } = {}) {
    if (!sendApproval) return Object.freeze({ ok: false, error: 'GMAIL_SEND_NOT_CONFIGURED' });
    const principal = authenticate(headers);
    if (!principal) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const token = sendApproval.issue({ ownerId: resolveOwner(principal), message, userConfirmed });
    return Object.freeze({ ok: true, token });
  }

  async function connectionStatus({ headers } = {}) {
    const principal = authenticate(headers);
    if (!principal) return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
    const record = await tokenStore.load({ ownerId: resolveOwner(principal), provider: 'google' });
    return Object.freeze({ ok: true, linked: record !== null });
  }

  return Object.freeze({
    configured: true,
    sendConfigured: Boolean(sendApproval),
    requestContext,
    issueSendApproval,
    connectionStatus,
    status() {
      if (!sendApproval) return Object.freeze({ configured: true, access: 'authenticated-read-only' });
      return Object.freeze({ configured: true, sendConfigured: true, access: 'authenticated-read-and-approved-send' });
    }
  });
}

export const GMAIL_AGENT_RUNTIME_ENV = Object.freeze({
  authToken: AUTH_TOKEN_ENV,
  authSubject: AUTH_SUBJECT_ENV,
  ownerKey: OWNER_KEY_ENV,
  sendApprovalKey: SEND_APPROVAL_KEY_ENV
});