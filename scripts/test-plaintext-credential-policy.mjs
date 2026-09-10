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
  // Provider-prefixed names must not defeat detection.
  'NVIDIA_API_KEY=should-never-leak',
  'GITHUB_ACCESS_TOKEN: 0123456789abcdef',
  'HAFIZE_CLIENT_SECRET="0123456789abcdef"'
]) assert.equal(containsPlaintextCredential(value), true);

for (const value of [
  'GitHub PAT güvenliği hakkında konuşalım.',
  'OAuth access tokenlarını secret manager içinde tut.',
  'notya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  'API anahtarı: ortam değişkeninden okunur',
  'monkeypassword nedir?'
]) assert.equal(containsPlaintextCredential(value), false);

for (const [name, value, expected] of [
  ['api_key', 'abcdef123456', true],
  ['accessToken', 'token-value', true],
  ['secret', 'x', true],
  ['token_count', '42', false],
  ['name', 'password', false]
]) assert.equal(isPlaintextCredentialField(name, value), expected);

console.log('plaintext credential policy tests passed');
