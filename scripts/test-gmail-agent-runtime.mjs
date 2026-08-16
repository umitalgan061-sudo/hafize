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
const tokenStore = {
  async load(input) {
    calls.push(['load', input]);
    return { accessToken: 'stored-server-side' };
  },
  save() {},
  remove() {}
};
const readClient = { read() {} };
const principal = Object.freeze({ authenticated: true, subject: 'user:123@example.com' });
const boundary = {
  async execute(args, context) {
    calls.push(['execute', args, context]);
    return { messages: [{ id: 'm1' }] };
  }
};

const commonFactories = {
  createOwnerResolver({ key: receivedKey }) {
    calls.push(['ownerKey', receivedKey.toString('base64')]);
    return {
      resolve(receivedPrincipal) {
        calls.push(['resolve', receivedPrincipal]);
        return { ownerId: 'owner_test' };
      }
    };
  },
  createTokenStoreRuntime(input) {
    calls.push(['tokenStore', input.env]);
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
};

const runtime = createGmailAgentRuntime({
  env,
  fetchImpl: async () => {},
  createSessionRuntime() {
    calls.push(['sessionRuntime', 'disabled']);
    return { configured: false, authenticator: null };
  },
  createAuthenticator(input) {
    calls.push(['authenticator', input]);
    return { authenticate({ headers }) { return headers?.authorization === `Bearer ${authToken}` ? { ok: true, principal } : { ok: false }; } };
  },
  ...commonFactories
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

assert.deepEqual(await runtime.connectionStatus({ headers: {} }), { ok: false, error: 'AUTH_REQUIRED' });
const linked = await runtime.connectionStatus({ headers: { authorization: `Bearer ${authToken}` } });
assert.deepEqual(linked, { ok: true, linked: true });
assert.deepEqual(calls.at(-2), ['resolve', principal]);
assert.deepEqual(calls.at(-1), ['load', { ownerId: 'owner_test', provider: 'google' }]);
assert.equal(JSON.stringify(linked).includes('stored-server-side'), false);
assert.equal(JSON.stringify(runtime.status()).includes(authToken), false);
assert.equal('authToken' in runtime, false);
assert.equal('ownerKey' in runtime, false);

const cloudPrincipal = Object.freeze({ authenticated: true, subject: 'cloud:user@example.com' });
const cloudEnv = {
  HAFIZE_CONNECTOR_OWNER_KEY_B64: key,
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 19).toString('base64'),
  HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/private/oauth-cloud'
};
let legacyAuthenticatorCreated = false;
const cloudRuntime = createGmailAgentRuntime({
  env: cloudEnv,
  fetchImpl: async () => {},
  createSessionRuntime({ env: receivedEnv }) {
    assert.equal(receivedEnv, cloudEnv);
    return {
      configured: true,
      authenticator: {
        authenticate({ headers }) {
          return headers?.cookie === '__Host-hafize_session=valid'
            ? { ok: true, principal: cloudPrincipal }
            : { ok: false };
        }
      }
    };
  },
  createAuthenticator() {
    legacyAuthenticatorCreated = true;
    throw new Error('legacy bearer authenticator must not be created for cloud-only Gmail runtime');
  },
  ...commonFactories
});

assert.equal(cloudRuntime.configured, true);
assert.equal(legacyAuthenticatorCreated, false);
assert.deepEqual(cloudRuntime.requestContext({ headers: {} }), { gmailReadTool: null, gmailReadAuthenticated: false });
const cloudContext = cloudRuntime.requestContext({ headers: { cookie: '__Host-hafize_session=valid' } });
assert.equal(cloudContext.gmailReadAuthenticated, true);
assert.equal(typeof cloudContext.gmailReadTool.execute, 'function');
await cloudContext.gmailReadTool.execute({ operation: 'profile.get' });
assert.equal(calls.at(-1)[2].principal, cloudPrincipal);
const cloudLinked = await cloudRuntime.connectionStatus({ headers: { cookie: '__Host-hafize_session=valid' } });
assert.deepEqual(cloudLinked, { ok: true, linked: true });
assert.deepEqual(calls.at(-2), ['resolve', cloudPrincipal]);
assert.deepEqual(calls.at(-1), ['load', { ownerId: 'owner_test', provider: 'google' }]);

const mixedRuntime = createGmailAgentRuntime({
  env,
  fetchImpl: async () => {},
  createSessionRuntime() {
    return { configured: true, authenticator: { authenticate: () => ({ ok: false }) } };
  },
  createAuthenticator() {
    return { authenticate: () => ({ ok: true, principal }) };
  },
  ...commonFactories
});
assert.equal(mixedRuntime.requestContext({ headers: {} }).gmailReadAuthenticated, true, 'legacy bearer may remain a server-side fallback when cloud session is absent from request');

const disabled = createGmailAgentRuntime({ env: {} });
assert.equal(disabled.configured, false);
assert.deepEqual(disabled.requestContext(), { gmailReadTool: null, gmailReadAuthenticated: false });
assert.deepEqual(await disabled.connectionStatus(), { ok: false, error: 'GMAIL_NOT_CONFIGURED' });
for (const partial of [
  { HAFIZE_CONNECTOR_AUTH_TOKEN: authToken },
  { HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com' },
  { HAFIZE_CONNECTOR_OWNER_KEY_B64: key }
]) assert.throws(() => createGmailAgentRuntime({ env: partial }), /INVALID_GMAIL_AGENT_RUNTIME:config/);
assert.throws(() => createGmailAgentRuntime({ env: { ...env, HAFIZE_CONNECTOR_OWNER_KEY_B64: 'bad' } }), /HAFIZE_CONNECTOR_OWNER_KEY_B64/);
assert.throws(() => createGmailAgentRuntime({
  env: cloudEnv,
  createSessionRuntime: () => ({ configured: true, authenticator: null })
}), /INVALID_GMAIL_AGENT_RUNTIME:cloudSession/);
assert.equal(GMAIL_AGENT_RUNTIME_ENV.authToken, 'HAFIZE_CONNECTOR_AUTH_TOKEN');
console.log('gmail agent runtime tests passed');
