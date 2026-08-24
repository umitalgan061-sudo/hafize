import assert from 'node:assert/strict';
import { containsPlaintextCredential } from '../lib/plaintext-credential-policy.mjs';

for (const value of [
  'ya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  'ya29.A0ARrdaM_exampleGoogleOauthToken123456789-',
  'token=ya29.A0ARrdaM_exampleGoogleOauthToken123456789~'
]) {
  assert.equal(containsPlaintextCredential(value), true, `Google OAuth token must be blocked: ${value}`);
}

for (const value of [
  'OAuth access tokenlarını secret manager içinde tut.',
  'Google OAuth ya29 token biçimini tartışiyoruz.',
  'notya29.A0ARrdaM_exampleGoogleOauthToken123456789'
]) {
  assert.equal(containsPlaintextCredential(value), false, `non-credential text must remain allowed: ${value}`);
}

console.log('plaintext credential policy tests passed');
