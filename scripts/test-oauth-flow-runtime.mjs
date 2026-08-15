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
const started = await runtime.start({
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

const finished = await runtime.finish({ state: started.state, code: 'authorization-code-123' });
assert.equal(finished.ok, true);
assert.equal(finished.provider, 'example');
assert.equal(finished.verifier, flow.verifier);
assert.deepEqual(finished.scopes, ['identity.read']);
await assert.rejects(() => runtime.finish({ state: started.state, code: 'authorization-code-123' }), /OAUTH_FLOW_NOT_FOUND/);

const second = await runtime.start({
  provider: 'example', authorizationEndpoint: 'https://accounts.example.test/oauth/authorize',
  clientId: 'client-123', redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['identity.read']
});
const denied = await runtime.finish({ state: second.state, error: 'access_denied' });
assert.deepEqual(denied, { ok: false, provider: 'example', error: 'access_denied', errorDescription: null });
assert.equal(issued.size, 0);

let releaseIssue;
const issueGate = new Promise((resolve) => { releaseIssue = resolve; });
let persisted = false;
const gatedRuntime = createOAuthFlowRuntime({
  store: {
    async issue() { await issueGate; persisted = true; },
    async consume() { return { provider: 'example', verifier: 'v'.repeat(64), redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['identity.read'] }; }
  }
});
let startSettled = false;
const gatedStart = gatedRuntime.start({
  provider: 'example', authorizationEndpoint: 'https://accounts.example.test/oauth/authorize',
  clientId: 'client-123', redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['identity.read']
}).then((value) => { startSettled = true; return value; });
await Promise.resolve();
assert.equal(startSettled, false, 'authorization URL must not escape before durable issue completes');
releaseIssue();
await gatedStart;
assert.equal(persisted, true);

assert.throws(() => createOAuthFlowRuntime({ store: {} }), /INVALID_OAUTH_FLOW_RUNTIME/);

console.log('oauth flow runtime tests passed');
