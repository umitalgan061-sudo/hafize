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

for (const [name, value, expected] of [
  ['api_key', 'abcdef123456', true],
  ['accessToken', 'token-value', true],
  ['secret', 'x', true],
  ['token_count', '42', false],
  ['name', 'password', false]
]) assert.equal(isPlaintextCredentialField(name, value), expected);

// Sağlayıcı önekli anahtar adları (NVIDIA_API_KEY=...) da atamalı credential'dır.
for (const value of [
  'NVIDIA_API_KEY=should-not-enter-the-model',
  'GITHUB_TOKEN=abcdefghijkl',
  'google-client-secret: 9f8a7b6c5d4e'
]) assert.equal(containsPlaintextCredential(value), true, value);

// Çıplak "token" sözcüğü sıradan metni engellememelidir.
for (const value of [
  'token: sonraki adımda ne yapmalıyım',
  'Bu görevde token sayısını azalt.'
]) assert.equal(containsPlaintextCredential(value), false, value);

console.log('plaintext credential policy tests passed');
