import assert from 'node:assert/strict';
import { getGoogleOAuthCapabilityScopes, normalizeGoogleOAuthRequest } from '../lib/google-oauth-policy.mjs';

const identity = normalizeGoogleOAuthRequest({ capabilities: ['identity'] });
assert.equal(identity.provider, 'google');
assert.deepEqual(identity.capabilities, ['identity']);
assert.deepEqual(identity.scopes, ['openid', 'email', 'profile']);
assert.equal(identity.requiresWriteApproval, false);

const read = normalizeGoogleOAuthRequest({ capabilities: ['gmail.read', 'identity'] });
assert.deepEqual(read.capabilities, ['identity', 'gmail.read']);
assert.deepEqual(read.scopes, ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly']);

const write = normalizeGoogleOAuthRequest({ capabilities: ['gmail.send'], explicitUserIntent: true });
assert.equal(write.requiresWriteApproval, true);
assert.deepEqual(write.scopes, ['https://www.googleapis.com/auth/gmail.send']);

for (const invalid of [
  {},
  { capabilities: [] },
  { capabilities: ['gmail.send'] },
  { capabilities: ['gmail.modify'], explicitUserIntent: false },
  { capabilities: ['gmail.read', 'gmail.read'] },
  { capabilities: ['gmail.delete'] },
  { capabilities: ['identity'], token: 'secret' }
]) {
  assert.throws(() => normalizeGoogleOAuthRequest(invalid), /INVALID_GOOGLE_OAUTH_POLICY/);
}

const scopeMap = getGoogleOAuthCapabilityScopes();
assert.deepEqual(scopeMap['gmail.modify'], ['https://www.googleapis.com/auth/gmail.modify']);
assert.equal(Object.isFrozen(scopeMap), true);
console.log('google oauth policy tests passed');
