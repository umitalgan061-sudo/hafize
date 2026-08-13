import assert from 'node:assert/strict';
import { normalizeOAuthCallback } from '../lib/oauth-callback-contract.mjs';

const state = 'z'.repeat(43);
assert.deepEqual(normalizeOAuthCallback({ code: 'auth-code-123', state }), {
  ok: true, state, code: 'auth-code-123'
});
assert.deepEqual(normalizeOAuthCallback({ error: 'access_denied', error_description: 'User cancelled', state }), {
  ok: false, state, error: 'access_denied', errorDescription: 'User cancelled'
});
for (const input of [
  { state, code: 'auth-code-123', error: 'x' },
  { state },
  { state: 'short', code: 'auth-code-123' },
  { state, code: 'short' },
  { state, code: 'auth-code-123', extra: true },
  { state, code: 'auth-code-123', error_description: 'unexpected' }
]) assert.throws(() => normalizeOAuthCallback(input), /INVALID_OAUTH_CALLBACK/);

console.log('oauth callback contract tests passed');
