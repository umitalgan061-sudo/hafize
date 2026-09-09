import assert from 'node:assert/strict';
import { containsPlaintextCredential, isPlaintextCredentialField } from '../lib/plaintext-credential-policy.mjs';

for (const value of [
  'Authorization: Bearer abcdefghijklmnop',
  'github_pat_1234567890abcdefghijABCDEFGHIJ',
  'ghp_1234567890abcdefghijklmnopqrstuvwx',
  'nvapi-1234567890abcdefghijklmnopqrstuv',
  'ya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  'token=ya29.A0ARrdaM_exampleGoogleOauthToken123456789~',
  '-----BEGIN PRIVATE KEY-----',
  // Vendor-prefixed environment assignments are the most common leak shape.
  'NVIDIA_API_KEY=should-not-enter-the-model',
  'export GITHUB_ACCESS_TOKEN="0123456789abcdef"',
  'google_refresh_token: 0123456789abcdef',
  'hafizeClientSecret=0123456789abcdef'
]) assert.equal(containsPlaintextCredential(value), true, value);

for (const value of [
  'GitHub PAT güvenliği hakkında konuşalım.',
  'OAuth access tokenlarını secret manager içinde tut.',
  'notya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  'next_page_token: 42',
  'API key rotasyonunu haftalık yap.'
]) assert.equal(containsPlaintextCredential(value), false, value);

for (const [name, value, expected] of [
  ['api_key', 'abcdef123456', true],
  ['accessToken', 'token-value', true],
  ['secret', 'x', true],
  ['token_count', '42', false],
  ['name', 'password', false],
  ['nvidia_api_key', 'abcdef123456', true],
  ['googleRefreshToken', 'abcdef123456', true],
  ['NVIDIA_API_KEY', 'abcdef123456', true],
  ['api_key', '', false],
  ['secret_owner', 'ada', false],
  ['tokenizer', 'bpe', false]
]) assert.equal(isPlaintextCredentialField(name, value), expected, String(name));

console.log('plaintext credential policy tests passed');
