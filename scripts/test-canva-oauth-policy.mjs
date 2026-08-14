import assert from 'node:assert/strict';
import { getCanvaOAuthCapabilityScopes, normalizeCanvaOAuthRequest } from '../lib/canva-oauth-policy.mjs';

const read = normalizeCanvaOAuthRequest({ capabilities: ['design.content.read', 'profile.read'] });
assert.deepEqual(read, {
  provider: 'canva',
  capabilities: ['profile.read', 'design.content.read'],
  scopes: ['profile:read', 'design:content:read'],
  requiresWriteApproval: false
});

const write = normalizeCanvaOAuthRequest({
  capabilities: ['design.content.write', 'asset.write', 'asset.read'],
  explicitUserIntent: true
});
assert.deepEqual(write.capabilities, ['asset.read', 'asset.write', 'design.content.write']);
assert.deepEqual(write.scopes, ['asset:read', 'asset:write', 'design:content:write']);
assert.equal(write.requiresWriteApproval, true);

assert.throws(() => normalizeCanvaOAuthRequest({ capabilities: ['asset.write'] }), /explicit_user_intent/);
assert.throws(() => normalizeCanvaOAuthRequest({ capabilities: ['design.content.write'], explicitUserIntent: false }), /explicit_user_intent/);
assert.throws(() => normalizeCanvaOAuthRequest({ capabilities: ['asset.read', 'asset.read'] }), /duplicate_capability/);
assert.throws(() => normalizeCanvaOAuthRequest({ capabilities: ['unknown'] }), /capability/);
assert.throws(() => normalizeCanvaOAuthRequest({ capabilities: ['profile.read'], clientSecret: 'nope' }), /unknown_field:clientSecret/);
assert.throws(() => normalizeCanvaOAuthRequest({ capabilities: [] }), /capabilities/);
assert.equal(getCanvaOAuthCapabilityScopes()['profile.read'][0], 'profile:read');
console.log('canva oauth policy tests passed');
