import assert from 'node:assert/strict';
import { createOAuthFlowRuntime } from '../lib/oauth-flow-runtime.mjs';
import { createCanvaOAuthRuntime } from '../lib/canva-oauth-runtime.mjs';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';

const records = new Map();
const flowStore = {
  async issue(record) {
    assert.equal(record.provider, 'canva');
    assert.equal(record.ownerId, 'owner:integration');
    assert.deepEqual(record.scopes, ['profile:read', 'design:meta:read']);
    const expiresAt = 1_900_000_000_000;
    records.set(record.state, { ...record, expiresAt });
    return { expiresAt };
  },
  async consume(state) {
    const record = records.get(state);
    if (!record) throw new Error('OAUTH_FLOW_NOT_FOUND');
    records.delete(state);
    return record;
  }
};

const oauth = createCanvaOAuthRuntime({
  clientId: 'integration-client',
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  flowRuntime: createOAuthFlowRuntime({ store: flowStore })
});

const started = await oauth.start(
  { capabilities: ['profile.read', 'design.meta.read'] },
  { ownerId: 'owner:integration' }
);
assert.equal(started.expiresAt, 1_900_000_000_000);
assert.equal(typeof started.state, 'string');
assert.equal(started.state.length >= 32, true);
const authorizationUrl = new URL(started.authorizationUrl);
assert.equal(authorizationUrl.origin, 'https://www.canva.com');
assert.equal(authorizationUrl.pathname, '/api/oauth/authorize');
assert.equal(authorizationUrl.searchParams.get('client_id'), 'integration-client');
assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'https://hafize.example/api/connectors/canva/oauth/callback');
assert.equal(authorizationUrl.searchParams.get('response_type'), 'code');
assert.equal(authorizationUrl.searchParams.get('state'), started.state);
assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
assert.equal(authorizationUrl.searchParams.get('scope'), 'profile:read design:meta:read');
assert.equal(authorizationUrl.searchParams.has('code_verifier'), false);
assert.equal(authorizationUrl.searchParams.has('ownerId'), false);
assert.equal(authorizationUrl.searchParams.has('owner_id'), false);

const finished = await oauth.finish({
  state: started.state,
  code: 'integration-code-12345678'
});
assert.equal(finished.ok, true);
assert.equal(finished.provider, 'canva');
assert.equal(finished.ownerId, 'owner:integration');
assert.equal(finished.code, 'integration-code-12345678');
assert.equal(typeof finished.verifier, 'string');
assert.equal(finished.verifier.length >= 43, true);
assert.deepEqual(finished.scopes, ['profile:read', 'design:meta:read']);
assert.equal(records.size, 0, 'OAuth state must be one-time consumed');

await assert.rejects(
  () => oauth.finish({ state: started.state, code: 'replay-code-12345678' }),
  /OAUTH_FLOW_NOT_FOUND/
);

const tokenSaves = [];
const network = [];
const tokenExchange = createCanvaTokenExchange({
  clientId: 'integration-client',
  clientSecret: 'server-only-secret',
  tokenStore: { async save(input) { tokenSaves.push(input); } },
  now: () => 1_750_000_000_000,
  fetchImpl: async (url, init) => {
    network.push({ url, init });
    return {
      ok: true,
      async json() {
        return {
          access_token: 'server-access-token',
          refresh_token: 'server-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'design:meta:read profile:read'
        };
      }
    };
  }
});

const exchanged = await tokenExchange.exchange({
  ownerId: finished.ownerId,
  code: finished.code,
  verifier: finished.verifier,
  redirectUri: finished.redirectUri,
  expectedScopes: finished.scopes
});
assert.equal(network.length, 1);
assert.equal(tokenSaves.length, 1);
assert.equal(tokenSaves[0].ownerId, 'owner:integration');
assert.equal(tokenSaves[0].provider, 'canva');
assert.deepEqual(tokenSaves[0].tokenRecord.scopes, ['design:meta:read', 'profile:read']);
assert.equal(exchanged.ownerId, 'owner:integration');
assert.deepEqual(exchanged.scopes, ['design:meta:read', 'profile:read']);

const publicFlowShape = JSON.stringify({
  authorizationUrl: started.authorizationUrl,
  state: started.state,
  expiresAt: started.expiresAt,
  capabilities: started.capabilities,
  requiresWriteApproval: started.requiresWriteApproval
});
for (const forbidden of ['server-only-secret', 'server-access-token', 'server-refresh-token', 'owner:integration']) {
  assert.equal(publicFlowShape.includes(forbidden), false, `${forbidden} must not enter public OAuth start payload`);
}

const mismatchSaves = [];
const mismatchExchange = createCanvaTokenExchange({
  clientId: 'integration-client',
  clientSecret: 'server-only-secret',
  tokenStore: { async save(input) { mismatchSaves.push(input); } },
  fetchImpl: async () => ({
    ok: true,
    async json() {
      return {
        access_token: 'attacker-access-token',
        refresh_token: 'attacker-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'profile:read design:meta:read asset:write'
      };
    }
  })
});
await assert.rejects(
  () => mismatchExchange.exchange({
    ownerId: finished.ownerId,
    code: finished.code,
    verifier: finished.verifier,
    redirectUri: finished.redirectUri,
    expectedScopes: finished.scopes
  }),
  /CANVA_TOKEN_EXCHANGE_SCOPE_MISMATCH/
);
assert.equal(mismatchSaves.length, 0, 'scope escalation response must not enter encrypted token store');

console.log('Canva OAuth owner/scope integration tests passed');
