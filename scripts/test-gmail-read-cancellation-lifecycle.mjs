import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';

const NOW = 1_800_000_000_000;
const ACCESS_TOKEN = 'g'.repeat(48);
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function freshRecord(overrides = {}) {
  return {
    accessToken: ACCESS_TOKEN,
    refreshToken: 'refresh-secret-value',
    tokenType: 'Bearer',
    scopes: [READ_SCOPE],
    expiresAt: NOW + 300_000,
    ...overrides
  };
}

function okJson(value = { emailAddress: 'user@example.com' }) {
  return { ok: true, async json() { return value; } };
}

{
  let loads = 0;
  let fetches = 0;
  const controller = new AbortController();
  controller.abort('user-left');
  const client = createGmailReadClient({
    tokenStore: { async load() { loads += 1; return freshRecord(); } },
    fetchImpl: async () => { fetches += 1; return okJson(); },
    now: () => NOW
  });

  await assert.rejects(
    client.read({ ownerId: 'owner_preabort', operation: 'profile.get', signal: controller.signal }),
    (error) => error?.code === 'GMAIL_READ_FAILED:cancelled'
  );
  assert.equal(loads, 0, 'pre-abort must stop before token-store access');
  assert.equal(fetches, 0, 'pre-abort must stop before Gmail egress');
}

{
  let releaseLoad;
  let fetches = 0;
  const controller = new AbortController();
  const client = createGmailReadClient({
    tokenStore: {
      async load() {
        return await new Promise((resolve) => { releaseLoad = resolve; });
      }
    },
    fetchImpl: async () => { fetches += 1; return okJson(); },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_load', operation: 'profile.get', signal: controller.signal });
  await Promise.resolve();
  assert.equal(typeof releaseLoad, 'function');
  controller.abort('navigation');
  releaseLoad(freshRecord());

  await assert.rejects(pending, (error) => error?.code === 'GMAIL_READ_FAILED:cancelled');
  assert.equal(fetches, 0, 'abort while loading token must stop before Gmail egress');
}

{
  let loads = 0;
  let refreshCalls = 0;
  let releaseRefresh;
  let fetches = 0;
  const controller = new AbortController();
  const tokenStore = {
    async load() {
      loads += 1;
      return loads === 1
        ? freshRecord({ expiresAt: NOW + 1_000 })
        : freshRecord();
    }
  };
  const client = createGmailReadClient({
    tokenStore,
    refreshAccessToken: async ({ ownerId }) => {
      assert.equal(ownerId, 'owner_refresh');
      refreshCalls += 1;
      await new Promise((resolve) => { releaseRefresh = resolve; });
    },
    fetchImpl: async () => { fetches += 1; return okJson(); },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_refresh', operation: 'profile.get', signal: controller.signal });
  for (let i = 0; i < 5 && typeof releaseRefresh !== 'function'; i += 1) await Promise.resolve();
  assert.equal(refreshCalls, 1);
  controller.abort('caller-gone');
  releaseRefresh();

  await assert.rejects(pending, (error) => error?.code === 'GMAIL_READ_FAILED:cancelled');
  assert.equal(loads, 1, 'caller cancellation after shared refresh must stop before second token load');
  assert.equal(fetches, 0, 'caller cancellation after shared refresh must stop before Gmail egress');
}

{
  let capturedSignal = null;
  let fetchCalls = 0;
  const controller = new AbortController();
  const client = createGmailReadClient({
    tokenStore: { async load() { return freshRecord(); } },
    fetchImpl: async (_url, init) => {
      fetchCalls += 1;
      capturedSignal = init.signal;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_fetch', operation: 'profile.get', signal: controller.signal });
  for (let i = 0; i < 5 && !capturedSignal; i += 1) await Promise.resolve();
  assert.equal(fetchCalls, 1);
  assert.ok(capturedSignal);
  assert.equal(capturedSignal.aborted, false);
  controller.abort('stop-read');

  await assert.rejects(pending, (error) => error?.code === 'GMAIL_READ_FAILED:cancelled');
  assert.equal(capturedSignal.aborted, true, 'caller abort must propagate into provider fetch controller');
}

{
  const client = createGmailReadClient({
    tokenStore: { async load() { return freshRecord(); } },
    fetchImpl: async () => okJson(),
    now: () => NOW
  });
  for (const signal of [false, 'abort', {}, { aborted: false, addEventListener() {} }]) {
    await assert.rejects(
      client.read({ ownerId: 'owner_signal', operation: 'profile.get', signal }),
      /INVALID_GMAIL_READ:signal/
    );
  }
}

console.log('gmail read cancellation lifecycle tests passed');