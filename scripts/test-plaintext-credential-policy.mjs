import assert from 'node:assert/strict';
import { containsPlaintextCredential, isPlaintextCredentialField } from '../lib/plaintext-credential-policy.mjs';

for (const value of [
  'Authorization: Bearer abcdefghijklmnop',
  'github_pat_1234567890abcdefghijABCDEFGHIJ',
  'ghp_1234567890abcdefghijklmnopqrstuvwx',
  'nvapi-1234567890abcdefghijklmnopqrstuv',
  'ya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  'token=ya29.A0ARrdaM_exampleGoogleOauthToken123456789~',
  '-----BEGIN PRIVATE KEY-----'
]) assert.equal(containsPlaintextCredential(value), true);

for (const value of [
  'GitHub PAT güvenliği hakkında konuşalım.',
  'OAuth access tokenlarını secret manager içinde tut.',
  'notya29.A0ARrdaM_exampleGoogleOauthToken123456789'
]) assert.equal(containsPlaintextCredential(value), false);

// Env-var biçimli atamalar da yakalanmalı; ancak sözcüğün içine gömülü
// benzer kelimeler yanlış pozitif üretmemeli.
for (const value of [
  'NVIDIA_API_KEY=should-not-enter-the-model',
  'HAFIZE_AUTH_TOKEN=abcdefghijkl',
  'MY_CLIENT_SECRET=abcdefghij',
  'export GOOGLE_ACCESS_TOKEN=abcdefghij'
]) assert.equal(containsPlaintextCredential(value), true, value);
for (const value of [
  'monkey=bananas',
  'discretion=important',
  'secretariat=1',
  'Toplantı saatini 14:00 olarak ayarla'
]) assert.equal(containsPlaintextCredential(value), false, value);

for (const [name, value, expected] of [
  ['api_key', 'abcdef123456', true],
  ['accessToken', 'token-value', true],
  ['secret', 'x', true],
  ['token_count', '42', false],
  ['name', 'password', false]
]) assert.equal(isPlaintextCredentialField(name, value), expected);

console.log('plaintext credential policy tests passed');
