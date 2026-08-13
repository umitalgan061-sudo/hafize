import assert from 'node:assert/strict';
import {
  buildOAuthAuthorizationUrl,
  createOAuthState,
  createPkceChallenge,
  createPkceVerifier
} from '../lib/oauth-pkce.mjs';

const verifier = createPkceVerifier({ random: () => Buffer.alloc(48, 7) });
assert.equal(verifier.length, 64);
assert.match(verifier, /^[A-Za-z0-9._~-]+$/);
const state = createOAuthState({ random: () => Buffer.alloc(32, 9) });
assert.equal(state.length, 43);
const challenge = createPkceChallenge(verifier);
assert.equal(challenge.length, 43);

const authUrl = new URL(buildOAuthAuthorizationUrl({
  authorizationEndpoint: 'https://accounts.example.test/oauth2/auth?ignored=1',
  clientId: 'client-123',
  redirectUri: 'https://hafize.example.test/oauth/callback',
  scopes: ['openid', 'email'],
  state,
  codeChallenge: challenge,
  extraParams: { access_type: 'offline' }
}));
assert.equal(authUrl.searchParams.get('response_type'), 'code');
assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
assert.equal(authUrl.searchParams.get('scope'), 'openid email');
assert.equal(authUrl.searchParams.get('access_type'), 'offline');
assert.equal(authUrl.searchParams.has('ignored'), false);

for (const bad of [
  () => createPkceVerifier({ random: () => Buffer.alloc(8) }),
  () => createOAuthState({ random: () => Buffer.alloc(8) }),
  () => createPkceChallenge('short'),
  () => buildOAuthAuthorizationUrl({ authorizationEndpoint: 'http://x.test', clientId: 'x', redirectUri: 'https://y.test', scopes: ['a'], state, codeChallenge: challenge }),
  () => buildOAuthAuthorizationUrl({ authorizationEndpoint: 'https://x.test', clientId: 'x', redirectUri: 'https://y.test', scopes: ['a', 'a'], state, codeChallenge: challenge }),
  () => buildOAuthAuthorizationUrl({ authorizationEndpoint: 'https://x.test', clientId: 'x', redirectUri: 'https://y.test', scopes: ['a'], state, codeChallenge: challenge, extraParams: { state: 'override' } }),
  () => buildOAuthAuthorizationUrl({ authorizationEndpoint: 'https://x.test', clientId: 'x', redirectUri: 'https://y.test', scopes: ['a'], state, codeChallenge: challenge, secret: 'nope' })
]) assert.throws(bad, /OAUTH_PKCE/);

console.log('oauth pkce tests passed');
