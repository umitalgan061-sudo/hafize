// Request-time boundaries must reject a null argument with their own contract error.
// A raw TypeError escapes the documented INVALID_* / AUTH_REQUIRED shapes that callers
// and the default-deny tool runtime match on, so it is treated as a defect here.
import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createGmailReadToolBoundary } from '../lib/gmail-read-tool-boundary.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';
import { normalizeGmailSendRequest } from '../lib/gmail-send-contract.mjs';
import { createBearerPrincipalAuthenticator } from '../lib/server-auth.mjs';
import { normalizeMemoryRetrieval } from '../lib/memory-retrieval-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createModelProviderRouter } from '../lib/model-provider-router.mjs';
import { createOAuthTokenFileStore } from '../lib/oauth-token-file-store.mjs';
import { createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';
import { createCanvaTokenRevoke } from '../lib/canva-token-revoke.mjs';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';
import { createGoogleTokenExchange } from '../lib/google-token-exchange.mjs';
import { createCanvaAgentRuntime } from '../lib/canva-agent-runtime.mjs';
import { createGmailAgentRuntime } from '../lib/gmail-agent-runtime.mjs';

const tokenStore = { load: async () => null, save: async () => ({}), remove: async () => ({}) };
const okFetch = async () => ({ ok: true, json: async () => ({}) });
const ownerResolver = { resolve: () => ({ ownerId: 'owner_opaque' }) };
const secret = 'x'.repeat(48);

// Fails the assertion when a boundary leaks a TypeError instead of its own contract error.
async function rejectsWithContract(label, call) {
  let thrown = null;
  try {
    await call();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, `${label}: null argument must be rejected`);
  assert.equal(thrown instanceof TypeError, false, `${label}: leaked TypeError "${thrown.message}"`);
  assert.match(thrown.message, /^(INVALID_|AUTH_REQUIRED|GMAIL_|CANVA_|GOOGLE_|OAUTH_|SCHEDULE_)/, `${label}: ${thrown.message}`);
}

const gmailClient = createGmailReadClient({ tokenStore, fetchImpl: okFetch, now: () => Date.now() });
const canvaClient = createCanvaReadClient({ tokenStore, fetchImpl: okFetch, now: () => Date.now() });
const gmailReadTool = createGmailReadToolBoundary({ readClient: gmailClient, ownerResolver });
const canvaReadTool = createCanvaReadToolBoundary({ readClient: canvaClient, ownerResolver });
const gmailSendTool = createGmailSendToolBoundary({
  sendClient: { send: async () => ({ messageId: 'msg_1' }) },
  ownerResolver
});

await rejectsWithContract('gmailReadClient.read', () => gmailClient.read(null));
await rejectsWithContract('canvaReadClient.read', () => canvaClient.read(null));
await rejectsWithContract('gmailReadTool.execute', () => gmailReadTool.execute({ operation: 'profile.get' }, null));
await rejectsWithContract('canvaReadTool.execute', () => canvaReadTool.execute({ operation: 'user.get' }, null));

// A null options bag must not be read as "approval granted".
const sendArgs = { to: ['owner@example.com'], subject: 'Konu', text: 'Gövde', explicitUserIntent: true };
await rejectsWithContract('gmailSendTool.execute', () => gmailSendTool.execute(sendArgs, null));
await rejectsWithContract('normalizeGmailSendRequest', () => normalizeGmailSendRequest(sendArgs, null));
assert.throws(() => normalizeGmailSendRequest(sendArgs, null), /GMAIL_SEND_APPROVAL_REQUIRED/);

const refresh = createCanvaTokenRefresh({
  clientId: 'client-id', clientSecret: secret, tokenStore, fetchImpl: okFetch, now: () => Date.now()
});
const revoke = createCanvaTokenRevoke({ clientId: 'client-id', clientSecret: secret, tokenStore, fetchImpl: okFetch });
const canvaExchange = createCanvaTokenExchange({
  clientId: 'client-id', clientSecret: secret, tokenStore, fetchImpl: okFetch, now: () => Date.now()
});
const googleExchange = createGoogleTokenExchange({
  clientId: 'client-id', clientSecret: secret, tokenStore, fetchImpl: okFetch, now: () => Date.now()
});
await rejectsWithContract('canvaTokenRefresh.refresh', () => refresh.refresh(null));
await rejectsWithContract('canvaTokenRevoke.revoke', () => revoke.revoke(null));
await rejectsWithContract('canvaTokenExchange.exchange', () => canvaExchange.exchange(null));
await rejectsWithContract('googleTokenExchange.exchange', () => googleExchange.exchange(null));

// Every call below is rejected before any path is touched, so no directory is created.
const fileStore = createOAuthTokenFileStore({ directory: '/tmp/hafize-null-probe', key: Buffer.alloc(32, 7) });
await rejectsWithContract('oauthTokenFileStore.save', () => fileStore.save(null));
await rejectsWithContract('oauthTokenFileStore.load', () => fileStore.load(null));
await rejectsWithContract('oauthTokenFileStore.remove', () => fileStore.remove(null));

const router = createModelProviderRouter({
  nvidiaComplete: async () => ({}),
  localComplete: async () => ({}),
  localEnabled: false
});
await rejectsWithContract('modelProviderRouter.complete', () => router.complete(null));

// Boundaries that answer with a result object instead of throwing must still stay on contract.
const authenticator = createBearerPrincipalAuthenticator({ token: secret, subject: 'owner_opaque' });
assert.deepEqual(authenticator.authenticate(null), { ok: false, error: 'AUTH_REQUIRED' });

assert.deepEqual(normalizeMemoryRetrieval(null), { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:ownerId' });

const commands = createScheduleCommandBoundary({
  store: {
    add: async () => ({}), snapshot: async () => ({ entries: [] }), read: async () => null, cancel: async () => ({})
  },
  registry: { agents: [{ id: 'hafize-general' }] },
  createTraceId: () => '00000000-0000-4000-8000-000000000001'
});
assert.deepEqual(await commands.create(null), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(await commands.list(null), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(await commands.cancel(null), { ok: false, error: 'AUTH_REQUIRED' });

const api = createScheduleHttpApi({ authenticator, commands, readJson: async () => ({}) });
assert.deepEqual(await api.handle(null), { matched: false });

// A configured connector runtime must answer a null request with an unauthenticated
// context rather than crashing, so no tool is ever exposed without a principal.
const connectorEnv = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: secret,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'owner_opaque',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 3).toString('base64'),
  HAFIZE_OAUTH_TOKEN_STORAGE_DIR: '/tmp/hafize-null-probe',
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 5).toString('base64')
};
for (const [label, create] of [
  ['gmail', createGmailAgentRuntime],
  ['canva', createCanvaAgentRuntime]
]) {
  const runtime = create({ env: connectorEnv, fetchImpl: okFetch });
  assert.equal(runtime.configured, true, `${label}: runtime should be configured`);
  const context = runtime.requestContext(null);
  assert.equal(context[`${label}ReadAuthenticated`], false, `${label}: null request must not authenticate`);
  assert.equal(context[`${label}ReadTool`], null, `${label}: null request must not expose a tool`);
  assert.deepEqual(await runtime.connectionStatus(null), { ok: false, error: 'AUTH_REQUIRED' });
}

console.log('null argument boundary tests passed');
