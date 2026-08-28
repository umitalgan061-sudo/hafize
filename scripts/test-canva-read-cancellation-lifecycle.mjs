import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';

const NOW = 2_000_000_000_000;
const ACCESS_TOKEN = 'canva_access_token_cancel_1234567890';
const RECORD = Object.freeze({
  accessToken: ACCESS_TOKEN,
  tokenType: 'Bearer',
  scopes: ['profile:read', 'design:meta:read'],
  expiresAt: NOW + 120_000
});

function successResponse(value = { ok: true }) {
  return {
    ok: true,
    status: 200,
    headers: { get() { return null; } },
    async json() { return value; }
  };
}

{
  let loadCalls = 0;
  let fetchCalls = 0;
  const controller = new AbortController();
  controller.abort(new Error('caller stopped'));
  const client = createCanvaReadClient({
    tokenStore: { async load() { loadCalls += 1; return RECORD; } },
    fetchImpl: async () => { fetchCalls += 1; return successResponse(); },
    now: () => NOW
  });
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get', signal: controller.signal }),
    /CANVA_READ_FAILED:cancelled/
  );
  assert.equal(loadCalls, 0);
  assert.equal(fetchCalls, 0);
}

{
  let resolveLoad;
  let fetchCalls = 0;
  const loadStarted = new Promise((resolve) => {
    resolveLoad = resolve;
  });
  let completeLoad;
  const pendingLoad = new Promise((resolve) => {
    completeLoad = resolve;
  });
  const controller = new AbortController();
  const client = createCanvaReadClient({
    tokenStore: {
      async load() {
        resolveLoad();
        return await pendingLoad;
      }
    },
    fetchImpl: async () => { fetchCalls += 1; return successResponse(); },
    now: () => NOW
  });
  const readPromise = client.read({ ownerId: 'owner_1', operation: 'user.get', signal: controller.signal });
  await loadStarted;
  controller.abort(new Error('navigation'));
  await assert.rejects(() => readPromise, /CANVA_READ_FAILED:cancelled/);
  assert.equal(fetchCalls, 0);
  completeLoad(RECORD);
  await Promise.resolve();
}

{
  let fetchSignal = null;
  let fetchStartedResolve;
  const fetchStarted = new Promise((resolve) => { fetchStartedResolve = resolve; });
  const controller = new AbortController();
  const client = createCanvaReadClient({
    tokenStore: { async load() { return RECORD; } },
    fetchImpl: async (_url, init) => {
      fetchSignal = init.signal;
      fetchStartedResolve();
      return await new Promise((_resolve, reject) => {
        const onAbort = () => {
          const error = new Error('provider request aborted');
          error.name = 'AbortError';
          reject(error);
        };
        init.signal.addEventListener('abort', onAbort, { once: true });
      });
    },
    now: () => NOW
  });
  const readPromise = client.read({ ownerId: 'owner_1', operation: 'user.get', signal: controller.signal });
  await fetchStarted;
  assert.equal(fetchSignal instanceof AbortSignal, true);
  assert.equal(fetchSignal.aborted, false);
  controller.abort(new Error('client disconnected'));
  await assert.rejects(() => readPromise, /CANVA_READ_FAILED:cancelled/);
  assert.equal(fetchSignal.aborted, true);
}

{
  const controller = new AbortController();
  let fetchSignal = null;
  const client = createCanvaReadClient({
    tokenStore: { async load() { return RECORD; } },
    fetchImpl: async (_url, init) => {
      fetchSignal = init.signal;
      return successResponse({ user: { id: 'u1' } });
    },
    now: () => NOW
  });
  const result = await client.read({ ownerId: 'owner_1', operation: 'user.get', signal: controller.signal });
  assert.equal(result.user.id, 'u1');
  assert.equal(fetchSignal.aborted, false);
  assert.equal(controller.signal.aborted, false);
}

{
  const principal = Object.freeze({ authenticated: true, subject: 'user:1@example.com' });
  const controller = new AbortController();
  const calls = [];
  const boundary = createCanvaReadToolBoundary({
    ownerResolver: { resolve(value) { assert.equal(value, principal); return { ownerId: 'owner_opaque_1' }; } },
    readClient: { async read(input) { calls.push(input); return { ok: true }; } }
  });
  await boundary.execute({ operation: 'user.get' }, { principal, signal: controller.signal });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ownerId, 'owner_opaque_1');
  assert.equal(calls[0].signal, controller.signal);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'signal'), true);

  calls.length = 0;
  await boundary.execute({ operation: 'user.get' }, { principal });
  assert.equal(calls.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0], 'signal'), false);
}

for (const invalidSignal of [
  {},
  { aborted: false },
  { aborted: false, addEventListener() {} }
]) {
  const client = createCanvaReadClient({
    tokenStore: { async load() { return RECORD; } },
    fetchImpl: async () => successResponse(),
    now: () => NOW
  });
  await assert.rejects(
    () => client.read({ ownerId: 'owner_1', operation: 'user.get', signal: invalidSignal }),
    /INVALID_CANVA_READ:signal/
  );
}

console.log('canva read cancellation lifecycle tests passed');
