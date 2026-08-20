import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';

const NOW = 1_800_000_000_000;
const ACCESS_TOKEN = 'g'.repeat(48);
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function tokenStore() {
  return {
    async load() {
      return {
        accessToken: ACCESS_TOKEN,
        refreshToken: 'refresh-secret-value',
        tokenType: 'Bearer',
        scopes: [READ_SCOPE],
        expiresAt: NOW + 300_000
      };
    }
  };
}

function clientFor(fetchImpl, options = {}) {
  return createGmailReadClient({
    tokenStore: tokenStore(),
    fetchImpl,
    now: () => NOW,
    ...options
  });
}

{
  let cancelCalls = 0;
  const client = clientFor(async (_url, init) => {
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.accept, 'application/json');
    assert.equal(init.headers.authorization, `Bearer ${ACCESS_TOKEN}`);
    return {
      ok: false,
      status: 503,
      body: { async cancel() { cancelCalls += 1; } }
    };
  });
  await assert.rejects(
    client.read({ ownerId: 'owner_http', operation: 'profile.get' }),
    /GMAIL_READ_FAILED:http/
  );
  assert.equal(cancelCalls, 1, 'HTTP rejection body is closed exactly once');
}

{
  let cancelCalls = 0;
  const client = clientFor(async () => ({
    ok: true,
    headers: { get(name) { return name === 'content-length' ? '4096' : null; } },
    body: { async cancel() { cancelCalls += 1; } }
  }), { maxJsonBytes: 1024 });
  await assert.rejects(
    client.read({ ownerId: 'owner_large', operation: 'profile.get' }),
    /GMAIL_READ_FAILED:response-too-large/
  );
  assert.equal(cancelCalls, 1, 'declared oversized response is closed without parsing');
}

{
  let cancelCalls = 0;
  let releaseCalls = 0;
  const encoded = new TextEncoder().encode('{not-json');
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1;
      return this.reads === 1 ? { done: false, value: encoded } : { done: true };
    },
    async cancel() { cancelCalls += 1; },
    releaseLock() { releaseCalls += 1; }
  };
  const body = {
    getReader() { return reader; }
  };
  const client = clientFor(async () => ({
    ok: true,
    headers: { get() { return null; } },
    body
  }));
  await assert.rejects(
    client.read({ ownerId: 'owner_bad_json', operation: 'profile.get' }),
    /GMAIL_READ_FAILED:response/
  );
  assert.equal(releaseCalls, 2, 'stream reader lock is released by parse path and cleanup path');
  assert.equal(cancelCalls, 1, 'malformed JSON response receives best-effort cancellation');
}

{
  let cancelCalls = 0;
  let releaseCalls = 0;
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1;
      return this.reads === 1
        ? { done: false, value: new Uint8Array(1100) }
        : { done: true };
    },
    async cancel() { cancelCalls += 1; },
    releaseLock() { releaseCalls += 1; }
  };
  const body = { getReader() { return reader; } };
  const client = clientFor(async () => ({ ok: true, headers: { get() { return null; } }, body }), { maxJsonBytes: 1024 });
  await assert.rejects(
    client.read({ ownerId: 'owner_stream_large', operation: 'profile.get' }),
    /GMAIL_READ_FAILED:response-too-large/
  );
  assert.ok(cancelCalls >= 1, 'incremental byte overflow cancels upstream reader');
  assert.ok(releaseCalls >= 1, 'incremental byte overflow releases reader lock');
}

{
  let capturedSignal = null;
  const client = clientFor(async (_url, init) => {
    capturedSignal = init.signal;
    return await new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  }, { requestTimeoutMs: 5 });

  await assert.rejects(
    client.read({ ownerId: 'owner_timeout', operation: 'profile.get' }),
    /GMAIL_READ_FAILED:timeout/
  );
  assert.equal(capturedSignal?.aborted, true, 'Gmail timeout aborts provider request');
}

{
  const client = clientFor(async () => ({
    ok: true,
    async json() { return { emailAddress: 'user@example.com', messagesTotal: 7 }; }
  }));
  const result = await client.read({ ownerId: 'owner_success', operation: 'profile.get' });
  assert.deepEqual(result, { emailAddress: 'user@example.com', messagesTotal: 7 });
  result.messagesTotal = 99;
  const next = await client.read({ ownerId: 'owner_success', operation: 'profile.get' });
  assert.equal(next.messagesTotal, 7, 'returned provider object is cloned before exposure');
}

console.log('gmail read upstream response lifecycle tests passed');