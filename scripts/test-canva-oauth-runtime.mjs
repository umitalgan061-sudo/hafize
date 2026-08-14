import assert from 'node:assert/strict';
import { CANVA_AUTHORIZATION_ENDPOINT, createCanvaOAuthRuntime } from '../lib/canva-oauth-runtime.mjs';

const starts = [];
const flowRuntime = {
  start(input) { starts.push(input); return { authorizationUrl: 'https://www.canva.com/api/oauth/authorize?x=1', state: 'state-1' }; },
  finish() { return { ok: true, provider: 'canva', code: 'code-1', verifier: 'server-only', redirectUri: 'https://hafize.example/oauth/canva', scopes: ['profile:read'] }; }
};
const runtime = createCanvaOAuthRuntime({ clientId: 'client-1', redirectUri: 'https://hafize.example/oauth/canva', flowRuntime });
const started = runtime.start({ capabilities: ['profile.read'] });
assert.equal(started.state, 'state-1');
assert.equal('verifier' in started, false);
assert.deepEqual(starts[0], {
  provider: 'canva',
  authorizationEndpoint: CANVA_AUTHORIZATION_ENDPOINT,
  clientId: 'client-1',
  redirectUri: 'https://hafize.example/oauth/canva',
  scopes: ['profile:read']
});
assert.equal(runtime.finish({ state: 'state-1', code: 'code-1' }).provider, 'canva');
assert.throws(() => runtime.start({ capabilities: ['asset.write'] }), /explicit_user_intent/);
assert.throws(() => createCanvaOAuthRuntime({ clientId: '', redirectUri: 'https://hafize.example/oauth/canva', flowRuntime }), /clientId/);
assert.throws(() => createCanvaOAuthRuntime({ clientId: 'x', redirectUri: 'http://hafize.example/callback', flowRuntime }), /redirectUri/);
assert.throws(() => createCanvaOAuthRuntime({ clientId: 'x', redirectUri: 'https://u:p@hafize.example/callback', flowRuntime }), /redirectUri/);
assert.throws(() => createCanvaOAuthRuntime({ clientId: 'x', redirectUri: 'https://hafize.example/callback#fragment', flowRuntime }), /redirectUri/);
const mismatch = createCanvaOAuthRuntime({ clientId: 'x', redirectUri: 'https://hafize.example/callback', flowRuntime: { start: flowRuntime.start, finish: () => ({ provider: 'google' }) } });
assert.throws(() => mismatch.finish({}), /CANVA_OAUTH_FLOW_PROVIDER_MISMATCH/);
console.log('canva oauth runtime tests passed');
