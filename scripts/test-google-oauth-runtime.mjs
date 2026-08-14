import assert from 'node:assert/strict';
import { createGoogleOAuthRuntime, GOOGLE_AUTHORIZATION_ENDPOINT } from '../lib/google-oauth-runtime.mjs';

const starts = [];
const finishes = [];
const flowRuntime = {
  start(input) {
    starts.push(input);
    return { authorizationUrl: 'https://accounts.google.com/authorize?state=test', state: 'state-test' };
  },
  finish(input) {
    finishes.push(input);
    return { ok: true, provider: 'google', code: input.code, verifier: 'server-only', redirectUri: 'https://hafize.example.test/oauth/google', scopes: ['openid'] };
  }
};

const runtime = createGoogleOAuthRuntime({
  clientId: 'client-id.apps.googleusercontent.com',
  redirectUri: 'https://hafize.example.test/oauth/google',
  flowRuntime
});
const started = runtime.start({ capabilities: ['identity', 'gmail.read'] });
assert.equal(started.state, 'state-test');
assert.equal('verifier' in started, false);
assert.deepEqual(started.capabilities, ['identity', 'gmail.read']);
assert.equal(started.requiresWriteApproval, false);
assert.equal(starts.length, 1);
assert.equal(starts[0].provider, 'google');
assert.equal(starts[0].authorizationEndpoint, GOOGLE_AUTHORIZATION_ENDPOINT);
assert.deepEqual(starts[0].scopes, ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly']);
assert.deepEqual(starts[0].extraParams, { access_type: 'offline', include_granted_scopes: 'true' });

const finished = runtime.finish({ state: 'state-test', code: 'code-test' });
assert.equal(finished.ok, true);
assert.equal(finishes.length, 1);

const mismatch = createGoogleOAuthRuntime({
  clientId: 'client-id', redirectUri: 'https://hafize.example.test/oauth/google',
  flowRuntime: { start: flowRuntime.start, finish: () => ({ ok: true, provider: 'canva' }) }
});
assert.throws(() => mismatch.finish({ state: 'x', code: 'y' }), /GOOGLE_OAUTH_FLOW_PROVIDER_MISMATCH/);
for (const invalid of [
  { clientId: '', redirectUri: 'https://hafize.example.test/oauth/google', flowRuntime },
  { clientId: 'id', redirectUri: 'http://hafize.example.test/oauth/google', flowRuntime },
  { clientId: 'id', redirectUri: 'https://user:pass@hafize.example.test/oauth/google', flowRuntime },
  { clientId: 'id', redirectUri: 'https://hafize.example.test/oauth/google#fragment', flowRuntime },
  { clientId: 'id', redirectUri: 'https://hafize.example.test/oauth/google', flowRuntime: {} }
]) assert.throws(() => createGoogleOAuthRuntime(invalid), /INVALID_GOOGLE_OAUTH_RUNTIME/);

console.log('google oauth runtime tests passed');
