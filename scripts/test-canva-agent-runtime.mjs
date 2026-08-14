import assert from 'node:assert/strict';
import { CANVA_AGENT_RUNTIME_ENV, createCanvaAgentRuntime } from '../lib/canva-agent-runtime.mjs';

const key = Buffer.alloc(32, 7).toString('base64');
const authToken = 'a'.repeat(40);
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: key,
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 9).toString('base64'),
  HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/private/oauth'
};
const calls = [];
const tokenStore = { load() {}, save() {}, remove() {} };
const readClient = { read() {} };
const principal = Object.freeze({ authenticated: true, subject: 'user:123@example.com' });
const boundary = {
  async execute(args, context) {
    calls.push(['execute', args, context]);
    return { ok: true };
  }
};

const runtime = createCanvaAgentRuntime({
  env,
  fetchImpl: async () => {},
  createAuthenticator(input) {
    calls.push(['authenticator', input]);
    return {
      authenticate({ headers }) {
        calls.push(['authenticate', headers]);
        return headers?.authorization === `Bearer ${authToken}`
          ? { ok: true, principal }
          : { ok: false, error: 'AUTH_REQUIRED' };
      }
    };
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
assert.deepEqual(runtime.requestContext({ headers: {} }), { canvaReadTool: null, canvaReadAuthenticated: false });
const context = runtime.requestContext({ headers: { authorization: `Bearer ${authToken}` } });
assert.equal(context.canvaReadAuthenticated, true);
assert.equal(typeof context.canvaReadTool?.execute, 'function');
assert.equal('principal' in context, false);
assert.equal(JSON.stringify(context).includes('user:123@example.com'), false);
await context.canvaReadTool.execute({ operation: 'user.get' });
const executeCall = calls.find((item) => item[0] === 'execute');
assert.deepEqual(executeCall, ['execute', { operation: 'user.get' }, { principal }]);
assert.deepEqual(calls[0], ['authenticator', { token: authToken, subject: 'user:123@example.com' }]);
assert.deepEqual(calls[1], ['ownerKey', key]);
assert.equal(JSON.stringify(runtime.status()).includes(authToken), false);
assert.equal(JSON.stringify(runtime.status()).includes('user:123@example.com'), false);
assert.equal('authToken' in runtime, false);
assert.equal('ownerKey' in runtime, false);

const disabled = createCanvaAgentRuntime({ env: {} });
assert.equal(disabled.configured, false);
assert.deepEqual(disabled.requestContext(), { canvaReadTool: null, canvaReadAuthenticated: false });
assert.deepEqual(disabled.status(), { configured: false, access: 'disabled' });

for (const partial of [
  { HAFIZE_CONNECTOR_AUTH_TOKEN: authToken },
  { HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com' },
  { HAFIZE_CONNECTOR_OWNER_KEY_B64: key },
  { HAFIZE_CONNECTOR_AUTH_TOKEN: authToken, HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user:123@example.com' }
]) {
  assert.throws(() => createCanvaAgentRuntime({ env: partial }), /INVALID_CANVA_AGENT_RUNTIME:config/);
}
assert.throws(() => createCanvaAgentRuntime({ env: { ...env, HAFIZE_CONNECTOR_OWNER_KEY_B64: 'bad' } }), /HAFIZE_CONNECTOR_OWNER_KEY_B64/);
assert.throws(() => createCanvaAgentRuntime({ env, fetchImpl: null }), /INVALID_CANVA_AGENT_RUNTIME:fetch/);
assert.equal(CANVA_AGENT_RUNTIME_ENV.authToken, 'HAFIZE_CONNECTOR_AUTH_TOKEN');
console.log('canva agent runtime tests passed');
