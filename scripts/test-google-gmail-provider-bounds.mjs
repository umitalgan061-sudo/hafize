import assert from 'node:assert/strict';
import {
  GOOGLE_TOKEN_REFRESH_LIMITS,
  createGoogleTokenRefresh
} from '../lib/google-token-refresh.mjs';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';

const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const OWNER = 'owner_provider_bounds';
const encoder = new TextEncoder();

function streamBody(chunks, onCancel = () => {}) {
  let index = 0;
  return {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true };
          return { done: false, value: chunks[index++] };
        },
        async cancel() { onCancel(); },
        releaseLock() {}
      };
    }
  };
}

function tokenStore(record) {
  const saves = [];
  return {
    saves,
    async load() { return structuredClone(record); },
    async save({ tokenRecord }) { saves.push(structuredClone(tokenRecord)); }
  };
}

const refreshStore = tokenStore({
  accessToken: 'expired-access-token-0000000000',
  refreshToken: 'refresh-token-original-1234567890',
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
});
let refreshCancelled = 0;
const oversizedRefresh = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  tokenStore: refreshStore,
  requestTimeoutMs: 1000,
  fetchImpl: async () => ({
    ok: true,
    headers: { get() { return null; } },
    body: streamBody([
      new Uint8Array(Math.floor(GOOGLE_TOKEN_REFRESH_LIMITS.maxResponseBytes / 2) + 1),
      new Uint8Array(Math.floor(GOOGLE_TOKEN_REFRESH_LIMITS.maxResponseBytes / 2) + 1)
    ], () => { refreshCancelled += 1; })
  })
});
await assert.rejects(
  () => oversizedRefresh.refresh({ ownerId: OWNER }),
  (error) => error?.code === 'GOOGLE_TOKEN_REFRESH_FAILED:response-too-large'
);
assert.equal(refreshCancelled, 1);
assert.equal(refreshStore.saves.length, 0, 'oversized refresh response must never overwrite encrypted tokens');

let refreshTimeoutAborts = 0;
const timedRefreshStore = tokenStore({
  accessToken: 'expired-access-token-1111111111',
  refreshToken: 'refresh-token-timeout-1111111111',
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
});
const timedRefresh = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  tokenStore: timedRefreshStore,
  requestTimeoutMs: 10,
  fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      refreshTimeoutAborts += 1;
      reject(new Error('provider socket timeout detail'));
    }, { once: true });
  })
});
await assert.rejects(
  () => timedRefresh.refresh({ ownerId: OWNER }),
  (error) => error?.code === 'GOOGLE_TOKEN_REFRESH_FAILED:timeout'
);
assert.equal(refreshTimeoutAborts, 1);
assert.equal(timedRefreshStore.saves.length, 0);

const gmailRecord = {
  accessToken: 'fresh-gmail-access-token-2222222222',
  refreshToken: 'refresh-token-gmail-2222222222',
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 9_999_999
};
let gmailCancelled = 0;
const oversizedGmail = createGmailReadClient({
  tokenStore: { async load() { return structuredClone(gmailRecord); } },
  now: () => 1_000,
  maxJsonBytes: 1024,
  requestTimeoutMs: 1000,
  fetchImpl: async (_url, init) => {
    assert.equal(init.headers.authorization, `Bearer ${gmailRecord.accessToken}`);
    return {
      ok: true,
      headers: { get() { return null; } },
      body: streamBody([
        encoder.encode(`{"payload":"${'a'.repeat(700)}`),
        encoder.encode(`${'b'.repeat(700)}"}`)
      ], () => { gmailCancelled += 1; })
    };
  }
});
await assert.rejects(
  () => oversizedGmail.read({ ownerId: OWNER, operation: 'profile.get' }),
  (error) => error?.code === 'GMAIL_READ_FAILED:response-too-large'
);
assert.equal(gmailCancelled, 1, 'oversized Gmail stream must be cancelled before full buffering');

let gmailTimeoutAborts = 0;
const timedGmail = createGmailReadClient({
  tokenStore: { async load() { return structuredClone(gmailRecord); } },
  now: () => 1_000,
  requestTimeoutMs: 10,
  fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      gmailTimeoutAborts += 1;
      reject(new Error('raw Gmail network detail'));
    }, { once: true });
  })
});
await assert.rejects(
  () => timedGmail.read({ ownerId: OWNER, operation: 'profile.get' }),
  (error) => error?.code === 'GMAIL_READ_FAILED:timeout'
);
assert.equal(gmailTimeoutAborts, 1);

console.log('Google/Gmail provider boundary tests passed');
