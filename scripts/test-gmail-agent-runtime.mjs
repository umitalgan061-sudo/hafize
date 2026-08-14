import assert from 'node:assert/strict';
import { createGmailAgentRuntime, GMAIL_AGENT_RUNTIME_ENV } from '../lib/gmail-agent-runtime.mjs';

const key = Buffer.alloc(32, 13).toString('base64');
const authToken = 'b'.repeat(40);
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: key,
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 17).toString('base64'),
  HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/private/oauth'
};
const calls = [];
const tokenStore = { load() {}, save() {}, remove() {} };
const readClient = { read() {} };
const principal = Object.freeze({ authenticated: true, subject: 'user:123@example.com' });
const boundary = {
  async execute(args, context) {
    calls.push(['execute', args, context]);
    return { messages: [{ id: 'm1' }] };
  }
};

const runtime = createGmailAgentRuntime({
  env,
  fetchImpl: async () => {},
  createAuthenticator(input) {
    calls.push(['authenticator', input]);
    return { authenticate({ headers }) { return headers?.authorization === `Bearer ${authToken}` ? { ok: true, principal } : { ok: false }; } };
  },
  createOwnerResolver({ key: receivedKey }) {
    calls.push(['ownerKey', receivedKey.toString('base64')]);
    return { resolve() { return { ownerId: 'owner_test' }; } };
  },
  createTokenStoreRuntime(input) {
    calls.push(['tokenStore', input.env === env]);
    return tokenStore;
  },
  createReadClient(input) {
    calls.push(['readClient', input.tokenStore === tokenStore, typeof input.fetchImpl]);
    return readClient;
  },
  createBoundary(input) {
    calls.push(['boundary', input.readClient === readClient, typeof input.ownerResolver?.resolve]);
    return boundary;
  }
});

assert.equal(runtime.configured, true);
assert.deepEqual(runtime.status(), { configured: true, access: 'authenticated-read-only' });
assert.deepEqual(runtime.requestContext({ headers: {} }), { gmailReadTool: null, gmailReadAuthenticated: false });
const context = runtime.requestContext({ headers: { authorization: `Bearer ${authToken}` } });
assert.equal(context.gmailReadAuthenticated, true);
assert.equal(typeof context.gmailReadTool.execute, 'function');
assert.equal('principal' in context, false);
assert.equal(JSON.stringify(context).includes('user:123@example.com'), false);
const result = await context.gmailReadTool.execute({ operation: 'profile.get' });
assert.equal(result.messages[0].id, 'm1');
assert.equal(calls.at(-1)[2].principal, principal);
assert.equal(JSON.stringify(runtime.status()).includes(authToken), false);
assert.equal('authToken' in runtime, false);
assert.equal('ownerKey' in runtime, false);

const disabled = createGmailAgentRuntime({ env: {} });
assert.equal(disabled.configured, false);
assert.deepEqual(disabled.requestContext(), { gmailReadTool: null, gmailReadAuthenticated: false });
for (const partial of [
  { HAFIZE_CONNECTOR_AUTH_TOKEN: authToken },
  { HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com' },
  { HAFIZE_CONNECTOR_OWNER_KEY_B64: key }
]) assert.throws(() => createGmailAgentRuntime({ env: partial }), /INVALID_GMAIL_AGENT_RUNTIME:config/);
assert.throws(() => createGmailAgentRuntime({ env: { ...env, HAFIZE_CONNECTOR_OWNER_KEY_B64: 'bad' } }), /HAFIZE_CONNECTOR_OWNER_KEY_B64/);
assert.equal(GMAIL_AGENT_RUNTIME_ENV.authToken, 'HAFIZE_CONNECTOR_AUTH_TOKEN');
console.log('gmail agent runtime tests passed');