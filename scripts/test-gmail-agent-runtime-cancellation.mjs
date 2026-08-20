import assert from 'node:assert/strict';
import { createGmailAgentRuntime } from '../lib/gmail-agent-runtime.mjs';

const key = Buffer.alloc(32, 31).toString('base64');
const authToken = 'a'.repeat(40);
const principal = Object.freeze({ authenticated: true, subject: 'user:runtime@example.com' });
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: principal.subject,
  HAFIZE_CONNECTOR_OWNER_KEY_B64: key,
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 27).toString('base64'),
  HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/private/oauth-runtime-cancel'
};

function makeRuntime(calls) {
  const tokenStore = { async load() { return null; }, async save() {}, async remove() {} };
  return createGmailAgentRuntime({
    env,
    fetchImpl: async () => { throw new Error('unexpected fetch'); },
    createSessionRuntime: () => ({ configured: false, authenticator: null }),
    createAuthenticator: () => ({
      authenticate({ headers }) {
        return headers?.authorization === `Bearer ${authToken}`
          ? { ok: true, principal }
          : { ok: false };
      }
    }),
    createOwnerResolver: () => ({ resolve: () => ({ ownerId: 'owner_runtime' }) }),
    createTokenStoreRuntime: () => tokenStore,
    createReadClient: () => ({ read() { throw new Error('read client should be behind boundary fixture'); } }),
    createBoundary: () => ({
      async execute(args, context) {
        calls.push({ args, context });
        if (context.signal?.aborted) {
          const error = new Error('GMAIL_READ_FAILED:cancelled');
          error.code = error.message;
          throw error;
        }
        return { profile: 'ok' };
      }
    })
  });
}

{
  const calls = [];
  const runtime = makeRuntime(calls);
  const context = runtime.requestContext({ headers: { authorization: `Bearer ${authToken}` } });
  assert.equal(context.gmailReadAuthenticated, true);
  const controller = new AbortController();
  const result = await context.gmailReadTool.execute({ operation: 'profile.get' }, { signal: controller.signal });
  assert.deepEqual(result, { profile: 'ok' });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, { operation: 'profile.get' });
  assert.equal(calls[0].context.principal, principal);
  assert.equal(calls[0].context.signal, controller.signal, 'runtime must preserve caller signal by identity');
  assert.equal(JSON.stringify(context).includes(principal.subject), false, 'principal remains server-side');
}

{
  const calls = [];
  const runtime = makeRuntime(calls);
  const context = runtime.requestContext({ headers: { authorization: `Bearer ${authToken}` } });
  await context.gmailReadTool.execute({ operation: 'profile.get' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.principal, principal);
  assert.equal(calls[0].context.signal, null, 'legacy callers without cancellation keep null signal');
}

{
  const calls = [];
  const runtime = makeRuntime(calls);
  const context = runtime.requestContext({ headers: { authorization: `Bearer ${authToken}` } });
  const controller = new AbortController();
  controller.abort('request-closed');
  await assert.rejects(
    context.gmailReadTool.execute({ operation: 'profile.get' }, { signal: controller.signal }),
    (error) => error?.code === 'GMAIL_READ_FAILED:cancelled'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.signal, controller.signal);
}

{
  const calls = [];
  const runtime = makeRuntime(calls);
  const anonymous = runtime.requestContext({ headers: {} });
  assert.deepEqual(anonymous, { gmailReadTool: null, gmailReadAuthenticated: false });
  assert.equal(calls.length, 0, 'unauthenticated requests cannot acquire Gmail read tool');
}

console.log('gmail agent runtime cancellation wiring tests passed');