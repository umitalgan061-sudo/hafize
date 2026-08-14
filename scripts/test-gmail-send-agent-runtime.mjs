import assert from 'node:assert/strict';
import { createGmailAgentRuntime, GMAIL_AGENT_RUNTIME_ENV } from '../lib/gmail-agent-runtime.mjs';

const authToken = 'b'.repeat(40);
const ownerKey = Buffer.alloc(32, 13).toString('base64');
const approvalKey = Buffer.alloc(32, 19).toString('base64');
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: ownerKey,
  HAFIZE_GMAIL_SEND_APPROVAL_KEY_B64: approvalKey,
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 17).toString('base64'),
  HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/private/oauth'
};
const principal = Object.freeze({ authenticated: true, subject: 'user:123@example.com' });
const calls = [];
const tokenStore = { async load() { return null; }, save() {}, remove() {} };
const readClient = { read() {} };
const sendClient = { send() {} };
const readBoundary = { async execute(args, context) { return { args, context }; } };
const sendBoundary = {
  async execute(args, context) {
    calls.push(['send.execute', args, context]);
    return { sent: true, messageId: 'm1' };
  }
};
const approval = {
  issue(input) {
    calls.push(['approval.issue', input]);
    if (input.userConfirmed !== true) throw new Error('GMAIL_SEND_USER_CONFIRMATION_REQUIRED');
    return 'approval-token';
  },
  consume(input) {
    calls.push(['approval.consume', input]);
    if (input.token !== 'approval-token') throw new Error('INVALID_GMAIL_SEND_APPROVAL_TOKEN');
    return { approved: true };
  }
};

const runtime = createGmailAgentRuntime({
  env,
  fetchImpl: async () => {},
  createAuthenticator() {
    return {
      authenticate({ headers }) {
        return headers?.authorization === `Bearer ${authToken}` ? { ok: true, principal } : { ok: false };
      }
    };
  },
  createOwnerResolver({ key }) {
    assert.equal(key.toString('base64'), ownerKey);
    return { resolve(value) { assert.equal(value, principal); return { ownerId: 'owner_test' }; } };
  },
  createTokenStoreRuntime() { return tokenStore; },
  createReadClient(input) { assert.equal(input.tokenStore, tokenStore); return readClient; },
  createBoundary(input) { assert.equal(input.readClient, readClient); return readBoundary; },
  createSendClient(input) { assert.equal(input.tokenStore, tokenStore); return sendClient; },
  createSendBoundary(input) { assert.equal(input.sendClient, sendClient); return sendBoundary; },
  createSendApproval({ secret }) { assert.equal(secret.toString('base64'), approvalKey); return approval; }
});

assert.equal(runtime.configured, true);
assert.equal(runtime.sendConfigured, true);
assert.deepEqual(runtime.status(), {
  configured: true,
  sendConfigured: true,
  access: 'authenticated-read-and-approved-send'
});
assert.deepEqual(await runtime.issueSendApproval({ headers: {}, message: {}, userConfirmed: true }), { ok: false, error: 'AUTH_REQUIRED' });
const message = { to: ['a@example.com'], subject: 'x', text: 'y', explicitUserIntent: true };
assert.deepEqual(await runtime.issueSendApproval({
  headers: { authorization: `Bearer ${authToken}` },
  message,
  userConfirmed: true
}), { ok: true, token: 'approval-token' });

const readOnlyContext = runtime.requestContext({ headers: { authorization: `Bearer ${authToken}` } });
assert.equal(readOnlyContext.gmailReadAuthenticated, true);
assert.equal(readOnlyContext.gmailSendAuthenticated, false);
assert.equal(readOnlyContext.gmailSendTool, null);

const sendContext = runtime.requestContext({
  headers: { authorization: `Bearer ${authToken}` },
  gmailSendApprovalToken: 'approval-token'
});
assert.equal(sendContext.gmailSendAuthenticated, true);
assert.equal(typeof sendContext.gmailSendTool.execute, 'function');
assert.equal(JSON.stringify(sendContext).includes('approval-token'), false);
assert.equal(JSON.stringify(sendContext).includes(principal.subject), false);
assert.deepEqual(await sendContext.gmailSendTool.execute(message), { sent: true, messageId: 'm1' });
assert.deepEqual(calls.at(-2), ['approval.consume', { token: 'approval-token', ownerId: 'owner_test', message }]);
assert.equal(calls.at(-1)[0], 'send.execute');
assert.equal(calls.at(-1)[2].principal, principal);
assert.equal(calls.at(-1)[2].approvalGranted, true);

const readOnlyRuntime = createGmailAgentRuntime({
  ...arguments,
  env: { ...env, HAFIZE_GMAIL_SEND_APPROVAL_KEY_B64: undefined },
  fetchImpl: async () => {},
  createAuthenticator: () => ({ authenticate: () => ({ ok: true, principal }) }),
  createOwnerResolver: () => ({ resolve: () => ({ ownerId: 'owner_test' }) }),
  createTokenStoreRuntime: () => tokenStore,
  createReadClient: () => readClient,
  createBoundary: () => readBoundary
});
assert.equal(readOnlyRuntime.sendConfigured, false);
assert.deepEqual(await readOnlyRuntime.issueSendApproval({}), { ok: false, error: 'GMAIL_SEND_NOT_CONFIGURED' });
assert.equal(GMAIL_AGENT_RUNTIME_ENV.sendApprovalKey, 'HAFIZE_GMAIL_SEND_APPROVAL_KEY_B64');

console.log('gmail send agent runtime tests passed');