import assert from 'node:assert/strict';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

let clock = 1_000;
const store = createOAuthFlowStore({ ttlMs: 500, maxFlows: 2, now: () => clock });
const flow = {
  state: 's'.repeat(43), verifier: 'v'.repeat(64), provider: 'google',
  redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['openid', 'email']
};
assert.deepEqual(store.issue(flow), { state: flow.state, expiresAt: 1_500 });
assert.equal(store.size(), 1);
const consumed = store.consume(flow.state);
assert.equal(consumed.verifier, flow.verifier);
assert.deepEqual(consumed.scopes, ['openid', 'email']);
assert.throws(() => store.consume(flow.state), /OAUTH_FLOW_NOT_FOUND/);

store.issue(flow);
assert.throws(() => store.issue(flow), /OAUTH_FLOW_STATE_COLLISION/);
clock = 1_501;
assert.throws(() => store.consume(flow.state), /OAUTH_FLOW_EXPIRED/);
assert.equal(store.size(), 0);

clock = 2_000;
store.issue({ ...flow, state: 'a'.repeat(43) });
store.issue({ ...flow, state: 'b'.repeat(43) });
assert.throws(() => store.issue({ ...flow, state: 'c'.repeat(43) }), /OAUTH_FLOW_STORE_FULL/);
assert.throws(() => store.issue({ ...flow, state: 'short' }), /INVALID_OAUTH_FLOW:state/);
assert.throws(() => store.issue({ ...flow, extra: true }), /INVALID_OAUTH_FLOW:field/);

console.log('oauth flow store tests passed');
