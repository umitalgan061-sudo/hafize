import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return map.get(String(name).toLowerCase()) ?? null; } };
}

function runtimeFor(fetchImpl) {
  return createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-only-key' },
    fetchImpl,
    createLocalRuntime({ nvidiaComplete, nvidiaStream, nvidiaListModels }) {
      return { configured: false, defaultProvider: 'nvidia', nvidiaComplete, nvidiaStream, nvidiaListModels };
    },
    createBoundary({ runtime }) {
      return { complete: runtime.nvidiaComplete, stream: runtime.nvidiaStream, listModels: runtime.nvidiaListModels };
    }
  });
}

function returnOnlyBody({ returnThrows = false } = {}) {
  const state = { factoryCalls: 0, returnCalls: 0, nextCalls: 0 };
  return {
    state,
    body: {
      [Symbol.asyncIterator]() {
        state.factoryCalls += 1;
        return {
          async next() { state.nextCalls += 1; return { done: true, value: undefined }; },
          async return() {
            state.returnCalls += 1;
            if (returnThrows) throw new Error('return cleanup failed');
            return { done: true, value: undefined };
          }
        };
      }
    }
  };
}

{
  const fixture = returnOnlyBody();
  const runtime = runtimeFor(async () => ({
    ok: false,
    status: 401,
    headers: headers({ 'content-type': 'application/json' }),
    body: fixture.body
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'NVIDIA_CHAT_ERROR' && error?.status === 401
  );
  assert.equal(fixture.state.factoryCalls, 1, 'cleanup can acquire an async iterator when body.cancel is unavailable');
  assert.equal(fixture.state.returnCalls, 1, 'completion rejection closes return-only upstream body');
  assert.equal(fixture.state.nextCalls, 0, 'cleanup never consumes rejected payload content');
}

{
  const fixture = returnOnlyBody();
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/plain' }),
    body: fixture.body
  }));

  await assert.rejects(runtime.listModels(), (error) => error?.code === 'INVALID_NVIDIA_RESPONSE_TYPE');
  assert.equal(fixture.state.returnCalls, 1, 'model-list media rejection closes return-only body');
  assert.equal(fixture.state.nextCalls, 0);
}

{
  const fixture = returnOnlyBody({ returnThrows: true });
  const runtime = runtimeFor(async () => ({
    ok: false,
    status: 500,
    headers: headers({ 'content-type': 'application/json' }),
    body: fixture.body
  }));

  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => {
      assert.equal(error.code, 'NVIDIA_CHAT_ERROR');
      assert.equal(error.status, 500);
      assert.notEqual(error.message, 'return cleanup failed');
      return true;
    }
  );
  assert.equal(fixture.state.returnCalls, 1, 'best-effort iterator return is still attempted');
}

{
  const fixture = returnOnlyBody();
  const runtime = runtimeFor(async () => ({
    ok: false,
    status: 429,
    headers: headers({ 'content-type': 'text/event-stream' }),
    body: fixture.body
  }));

  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [], stream: true }),
    (error) => error?.code === 'NVIDIA_CHAT_ERROR' && error?.status === 429
  );
  assert.equal(fixture.state.returnCalls, 1, 'rejected stream uses iterator-return cleanup fallback');
  assert.equal(fixture.state.nextCalls, 0);
}

{
  const runtime = runtimeFor(async () => ({
    ok: false,
    status: 503,
    headers: headers({ 'content-type': 'application/json' }),
    body: null
  }));
  await assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'NVIDIA_CHAT_ERROR' && error?.status === 503
  );
}

{
  let request = null;
  const payload = { model: 'nvidia/test', messages: [{ role: 'user', content: 'hello' }] };
  const runtime = runtimeFor(async (url, options) => {
    request = { url, options };
    const encoded = Buffer.from(JSON.stringify({ choices: [] }));
    let done = false;
    return {
      ok: true,
      status: 200,
      headers: headers({ 'content-type': 'application/json' }),
      body: {
        getReader() {
          return {
            async read() {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: new Uint8Array(encoded) };
            },
            releaseLock() {}
          };
        }
      }
    };
  });

  await runtime.complete(payload);
  assert.equal(request.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
  assert.equal(request.options.redirect, 'error', 'NVIDIA request refuses redirect-based credential forwarding');
  assert.equal(request.options.headers.Authorization, 'Bearer test-only-key');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), payload);
}

console.log('nvidia response cleanup fallback tests passed');
