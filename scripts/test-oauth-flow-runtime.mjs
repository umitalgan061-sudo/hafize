import assert from 'node:assert/strict';
import { createOAuthFlowRuntime } from '../lib/oauth-flow-runtime.mjs';

const issued = new Map();
const store = {
  issue(flow) { issued.set(flow.state, flow); },
  consume(state) {
    const flow = issued.get(state);
    if (!flow) throw new Error('OAUTH_FLOW_NOT_FOUND');
    issued.delete(state);
    return flow;
  }
};
const runtime = createOAuthFlowRuntime({ store });
const started = runtime.start({
  provider: 'example',
  authorizationEndpoint: 'https://accounts.example.test/oauth/authorize',
  clientId: 'client-123',
  redirectUri: 'https://hafize.example.test/oauth/callback',
  scopes: ['identity.read']
});
assert.equal(typeof started.authorizationUrl, 'string');
assert.equal(typeof started.state, 'string');
assert.equal('verifier' in started, false);
const flow = issued.get(started.state);
assert.equal(flow.provider, 'example');
assert.equal(typeof flow.verifier, 'string');

const finished = runtime.finish({ state: started.state, code: 'authorization-code-123' });
assert.equal(finished.ok, true);
assert.equal(finished.provider, 'example');
assert.equal(finished.verifier, flow.verifier);
assert.deepEqual(finished.scopes, ['identity.read']);
assert.throws(() => runtime.finish({ state: started.state, code: 'authorization-code-123' }), /OAUTH_FLOW_NOT_FOUND/);

const second = runtime.start({
  provider: 'example', authorizationEndpoint: 'https://accounts.example.test/oauth/authorize',
  clientId: 'client-123', redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['identity.read']
});
const denied = runtime.finish({ state: second.state, error: 'access_denied' });
assert.deepEqual(denied, { ok: false, provider: 'example', error: 'access_denied', errorDescription: null });
assert.equal(issued.size, 0);
assert.throws(() => createOAuthFlowRuntime({ store: {} }), /INVALID_OAUTH_FLOW_RUNTIME/);

console.log('oauth flow runtime tests passed');
