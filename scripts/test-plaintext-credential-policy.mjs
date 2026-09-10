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
  ['name', 'password', false],
  // Ön ekli ortam değişkeni / alan adları da credential sayılır.
  ['nvidiaApiKey', 'nv-value', true],
  ['GOOGLE_REFRESH_TOKEN', 'refresh-value', true],
  ['client_secret', 'cs-value', true],
  ['keyboard', 'qwerty', false],
  ['content', 'plain text', false]
]) assert.equal(isPlaintextCredentialField(name, value), expected);

// Ön ekli atamalar: `NVIDIA_API_KEY=...` gibi biçimler de yakalanmalı.
for (const value of [
  'NVIDIA_API_KEY=should-not-enter-the-model',
  'OPENAI_API_KEY: sk-abcdefghijklmnop',
  'X_CLIENT_SECRET=abcdefghij'
]) assert.equal(containsPlaintextCredential(value), true);

// Anahtar kelimeyi yalnız içinde barındıran sıradan metin engellenmez.
for (const value of [
  'monkey=bananas',
  'keyboard=mekanik'
]) assert.equal(containsPlaintextCredential(value), false);

console.log('plaintext credential policy tests passed');
