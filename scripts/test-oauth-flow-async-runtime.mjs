import assert from 'node:assert/strict';
import { createOAuthFlowAsyncRuntime } from '../lib/oauth-flow-async-runtime.mjs';

const issued = new Map();
let closeCalls = 0;
const store = {
  async issue(flow) { issued.set(flow.state, structuredClone(flow)); },
  async consume(state) {
    const flow = issued.get(state);
    if (!flow) throw new Error('OAUTH_FLOW_NOT_FOUND');
    issued.delete(state);
    return flow;
  },
  async close() { closeCalls += 1; }
};
const runtime = createOAuthFlowAsyncRuntime({ store });
const started = await runtime.start({
  provider: 'google', ownerId: 'owner_runtime_1',
  authorizationEndpoint: 'https://accounts.example.test/oauth/authorize', clientId: 'client-123',
  redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['gmail.readonly']
});
assert.equal('verifier' in started, false);
assert.equal('ownerId' in started, false);
const flow = issued.get(started.state);
assert.equal(flow.ownerId, 'owner_runtime_1');
const finished = await runtime.finish({ state: started.state, code: 'authorization-code-123' });
assert.equal(finished.ownerId, 'owner_runtime_1');
assert.equal(finished.verifier, flow.verifier);
assert.equal(finished.code, 'authorization-code-123');
await assert.rejects(() => runtime.finish({ state: started.state, code: 'again-again' }), /OAUTH_FLOW_NOT_FOUND/);
const deniedStart = await runtime.start({
  provider: 'google', ownerId: 'owner_runtime_2', authorizationEndpoint: 'https://accounts.example.test/oauth/authorize',
  clientId: 'client-123', redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['gmail.readonly']
});
const denied = await runtime.finish({ state: deniedStart.state, error: 'access_denied' });
assert.equal(denied.ownerId, 'owner_runtime_2');
assert.equal(denied.error, 'access_denied');
await assert.rejects(() => runtime.start({ provider: 'google', ownerId: '', authorizationEndpoint: 'https://accounts.example.test/oauth/authorize', clientId: 'x', redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['x'] }), /ownerId/);
await runtime.close();
assert.equal(closeCalls, 1);
console.log('owner-bound async OAuth flow runtime tests passed');
