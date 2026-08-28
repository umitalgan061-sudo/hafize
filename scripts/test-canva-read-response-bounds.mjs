import assert from 'node:assert/strict';
import { CANVA_READ_LIMITS, createCanvaReadClient } from '../lib/canva-read-client.mjs';

const NOW = 2_000_000_000_000;
const ACCESS_TOKEN = 'canva_access_token_bounds_1234567890';

function tokenStore() {
  return {
    async load() {
      return {
        accessToken: ACCESS_TOKEN,
        tokenType: 'Bearer',
        scopes: ['profile:read', 'design:meta:read'],
        expiresAt: NOW + 120_000
      };
    }
  };
}

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return normalized.get(String(name).toLowerCase()) ?? null; } };
}

function readerBody(chunks, { onCancel = () => {} } = {}) {
  let index = 0;
  let cancelled = false;
  return {
    getReader() {
      return {
        async read() {
          if (cancelled || index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[index++] };
        },
        async cancel() {
          cancelled = true;
          onCancel();
        },
        releaseLock() {}
      };
    },
    async cancel() {
      cancelled = true;
      onCancel();
    }
  };
}

function makeClient(fetchImpl, options = {}) {
  return createCanvaReadClient({
    tokenStore: tokenStore(),
    fetchImpl,
    now: () => NOW,
    ...options
  });
}

assert.equal(CANVA_READ_LIMITS.maxJsonBytes, 2 * 1024 * 1024);
assert.equal(CANVA_READ_LIMITS.defaultRequestTimeoutMs, 20_000);

{
  const calls = [];
  const body = readerBody([Buffer.from('{"design":{"id":"DAF42"}}', 'utf8')]);
  const client = makeClient(async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, headers: headers(), body };
  });
  const result = await client.read({ ownerId: 'owner_1', operation: 'design.get', params: { designId: 'DAF42' } });
  assert.equal(result.design.id, 'DAF42');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.canva.com/rest/v1/designs/DAF42');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers.accept, 'application/json');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${ACCESS_TOKEN}`);
  assert.equal(calls[0].init.signal instanceof AbortSignal, true);
}

{
  let bodyCancelled = 0;
  let readCalls = 0;
  const client = makeClient(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-length': '4096' }),
    body: {
      async cancel() { bodyCancelled += 1; },
      getReader() {
        readCalls += 1;
        throw new Error('reader must not be opened after oversized Content-Length');
      }
    }
  }), { maxJsonBytes: 1024 });
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get' }),
    /CANVA_READ_FAILED:response-too-large/
  );
  assert.equal(readCalls, 0);
  assert.equal(bodyCancelled, 1);
}

{
  let cancelled = 0;
  const body = readerBody([
    Buffer.from('{"data":"', 'utf8'),
    Buffer.from('x'.repeat(1100), 'utf8'),
    Buffer.from('"}', 'utf8')
  ], { onCancel: () => { cancelled += 1; } });
  const client = makeClient(async () => ({ ok: true, status: 200, headers: headers(), body }), { maxJsonBytes: 1024 });
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get' }),
    /CANVA_READ_FAILED:response-too-large/
  );
  assert.equal(cancelled, 1);
}

{
  let cancelled = 0;
  let jsonCalled = false;
  const client = makeClient(async () => ({
    ok: false,
    status: 429,
    headers: headers(),
    body: { async cancel() { cancelled += 1; } },
    async json() {
      jsonCalled = true;
      return { error: ACCESS_TOKEN };
    }
  }));
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get' }),
    /CANVA_READ_FAILED:http/
  );
  assert.equal(jsonCalled, false);
  assert.equal(cancelled, 1);
}

{
  let cancelled = 0;
  const body = readerBody([Buffer.from('{not-json}', 'utf8')], { onCancel: () => { cancelled += 1; } });
  const client = makeClient(async () => ({ ok: true, status: 200, headers: headers(), body }));
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get' }),
    /CANVA_READ_FAILED:response/
  );
  assert.equal(cancelled >= 1, true);
}

{
  const client = makeClient(async (_url, init) => await new Promise((_resolve, reject) => {
    const onAbort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    init.signal.addEventListener('abort', onAbort, { once: true });
  }), { requestTimeoutMs: 10 });
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get' }),
    /CANVA_READ_FAILED:timeout/
  );
}

{
  const client = makeClient(async () => ({
    ok: true,
    status: 200,
    headers: headers(),
    async json() { return { leaked: ACCESS_TOKEN }; }
  }));
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get' }),
    /CANVA_READ_FAILED:response/
  );
}

assert.throws(
  () => createCanvaReadClient({ tokenStore: tokenStore(), requestTimeoutMs: 0 }),
  /INVALID_CANVA_READ:requestTimeoutMs/
);
assert.throws(
  () => createCanvaReadClient({ tokenStore: tokenStore(), requestTimeoutMs: 120_001 }),
  /INVALID_CANVA_READ:requestTimeoutMs/
);

console.log('canva read bounded response tests passed');
