import assert from 'node:assert/strict';
import { createRedisOAuthFlowStore } from '../lib/redis-oauth-flow-store.mjs';

const state = 's'.repeat(43);
const ownerId = 'owner_abc-123';
let stored = null;
let evals = 0;
const client = {
  isReady: true,
  async eval(script, { arguments: args }) {
    evals += 1;
    if (script.includes('ZREMRANGEBYSCORE')) {
      stored = args[2];
      return 100_000;
    }
    const value = stored;
    stored = null;
    return value ?? false;
  },
  destroy() { this.isReady = false; }
};
const store = createRedisOAuthFlowStore({ client });
const flow = {
  state,
  verifier: 'v'.repeat(64),
  provider: 'google',
  redirectUri: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  scopes: ['openid', 'https://www.googleapis.com/auth/gmail.readonly'],
  ownerId
};
await store.issue(flow);
const payload = JSON.parse(stored);
assert.equal(payload.ownerId, ownerId, 'opaque owner binding must survive shared Redis storage');
assert.equal('state' in payload, false, 'raw OAuth state must not enter Redis payload');
const consumed = await store.consume(state);
assert.equal(consumed.ownerId, ownerId);
assert.deepEqual(consumed.scopes, flow.scopes);
await assert.rejects(() => store.consume(state), (error) => error?.code === 'OAUTH_FLOW_NOT_FOUND');
assert.equal(evals, 3);

let invalidEvals = 0;
const invalidStore = createRedisOAuthFlowStore({
  client: {
    isReady: true,
    async eval() { invalidEvals += 1; return 1; },
    destroy() { this.isReady = false; }
  }
});
await assert.rejects(() => invalidStore.issue({ ...flow, ownerId: '../other-owner' }), /INVALID_OAUTH_FLOW:ownerId/);
assert.equal(invalidEvals, 0, 'invalid owner binding must be rejected before Redis mutation');

console.log('Redis OAuth flow owner-binding tests passed');
