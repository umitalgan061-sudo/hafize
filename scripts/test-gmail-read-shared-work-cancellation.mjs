import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';

const NOW = 1_800_000_000_000;
const ACCESS_TOKEN = 'g'.repeat(48);
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function record(expiresAt = NOW + 300_000) {
  return {
    accessToken: ACCESS_TOKEN,
    refreshToken: 'refresh-secret-value',
    tokenType: 'Bearer',
    scopes: [READ_SCOPE],
    expiresAt
  };
}

function okFetch() {
  return async () => ({ ok: true, async json() { return { emailAddress: 'user@example.com' }; } });
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
    fetchImpl: async (...args) => { fetches += 1; return okFetch()(...args); },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_prompt_load', operation: 'profile.get', signal: controller.signal });
  await Promise.resolve();
  assert.equal(typeof releaseLoad, 'function');
  controller.abort('request-ended');

  await assert.rejects(pending, (error) => error?.code === 'GMAIL_READ_FAILED:cancelled');
  assert.equal(fetches, 0, 'cancelled caller is released before unresolved token load completes');
  releaseLoad(record());
  await Promise.resolve();
  assert.equal(fetches, 0, 'late token completion cannot revive cancelled Gmail read');
}

{
  let loadCalls = 0;
  let refreshCalls = 0;
  let releaseRefresh;
  let refreshSettled = false;
  let fetches = 0;
  const controller = new AbortController();
  const client = createGmailReadClient({
    tokenStore: {
      async load() {
        loadCalls += 1;
        return loadCalls === 1 ? record(NOW + 1_000) : record();
      }
    },
    refreshAccessToken: async () => {
      refreshCalls += 1;
      await new Promise((resolve) => { releaseRefresh = resolve; });
      refreshSettled = true;
    },
    fetchImpl: async (...args) => { fetches += 1; return okFetch()(...args); },
    now: () => NOW
  });

  const pending = client.read({ ownerId: 'owner_prompt_refresh', operation: 'profile.get', signal: controller.signal });
  for (let i = 0; i < 8 && typeof releaseRefresh !== 'function'; i += 1) await Promise.resolve();
  assert.equal(refreshCalls, 1);
  assert.equal(refreshSettled, false);
  controller.abort('caller-gone');

  await assert.rejects(pending, (error) => error?.code === 'GMAIL_READ_FAILED:cancelled');
  assert.equal(refreshSettled, false, 'caller no longer waits for shared refresh completion');
  assert.equal(loadCalls, 1, 'cancelled caller does not perform post-refresh token load');
  assert.equal(fetches, 0);

  releaseRefresh();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(refreshSettled, true, 'shared refresh is allowed to finish for other callers');
  assert.equal(fetches, 0, 'late shared refresh completion cannot revive cancelled read');
}

{
  const listeners = new Set();
  let addCount = 0;
  let removeCount = 0;
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      assert.equal(type, 'abort');
      addCount += 1;
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'abort');
      removeCount += 1;
      listeners.delete(listener);
    }
  };
  const client = createGmailReadClient({
    tokenStore: { async load() { return record(); } },
    fetchImpl: okFetch(),
    now: () => NOW
  });

  const result = await client.read({ ownerId: 'owner_cleanup', operation: 'profile.get', signal });
  assert.equal(result.emailAddress, 'user@example.com');
  assert.equal(listeners.size, 0, 'all caller abort listeners are removed after success');
  assert.equal(addCount, removeCount);
  assert.ok(addCount >= 2, 'token wait and provider fetch both register bounded cancellation listeners');
}

{
  const listeners = new Set();
  let removeCount = 0;
  const signal = {
    aborted: false,
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { if (listeners.delete(listener)) removeCount += 1; }
  };
  const client = createGmailReadClient({
    tokenStore: { async load() { throw new Error('store unavailable'); } },
    fetchImpl: okFetch(),
    now: () => NOW
  });

  await assert.rejects(
    client.read({ ownerId: 'owner_store_error', operation: 'profile.get', signal }),
    /store unavailable/
  );
  assert.equal(listeners.size, 0, 'token-store rejection cannot leak caller abort listener');
  assert.equal(removeCount, 1);
}

console.log('gmail read shared work cancellation tests passed');