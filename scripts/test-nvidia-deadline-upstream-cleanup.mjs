import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return map.get(String(name).toLowerCase()) ?? null; } };
}

function createRuntime(fetchImpl, { jsonTimeoutMs = 25, streamTimeoutMs = 1_000 } = {}) {
  return createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-only-key' },
    fetchImpl,
    jsonTimeoutMs,
    streamTimeoutMs,
    createLocalRuntime({ nvidiaComplete, nvidiaStream, nvidiaListModels }) {
      return { configured: false, defaultProvider: 'nvidia', nvidiaComplete, nvidiaStream, nvidiaListModels };
    },
    createBoundary({ runtime }) {
      return { complete: runtime.nvidiaComplete, stream: runtime.nvidiaStream, listModels: runtime.nvidiaListModels };
    }
  });
}

async function withEventLoopLease(work) {
  const lease = setInterval(() => {}, 1_000);
  try {
    return await work();
  } finally {
    clearInterval(lease);
  }
}

function abortError(message = 'aborted') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function pendingJsonResponse(signal, state) {
  return {
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'application/json' }),
    body: {
      getReader() {
        return {
          async read() {
            state.readCalls += 1;
            if (signal.aborted) throw abortError();
            return await new Promise((_resolve, reject) => {
              const onAbort = () => {
                signal.removeEventListener('abort', onAbort);
                reject(abortError());
              };
              signal.addEventListener('abort', onAbort, { once: true });
            });
          },
          async cancel(reason) {
            state.cancelCalls += 1;
            state.cancelReason = reason;
          },
          releaseLock() { state.releaseCalls += 1; }
        };
      }
    }
  };
}

{
  const state = { readCalls: 0, cancelCalls: 0, releaseCalls: 0, signal: null, cancelReason: null };
  const runtime = createRuntime(async (_url, options) => {
    state.signal = options.signal;
    return pendingJsonResponse(options.signal, state);
  }, { jsonTimeoutMs: 15 });

  await withEventLoopLease(() => assert.rejects(
    runtime.complete({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'NVIDIA_CHAT_TIMEOUT' && error?.status === 504
  ));
  assert.equal(state.readCalls, 1);
  assert.equal(state.signal.aborted, true, 'deadline aborts the NVIDIA fetch signal');
  assert.equal(state.cancelCalls, 1, 'deadline read failure explicitly cancels the body reader');
  assert.equal(state.cancelReason?.name, 'AbortError');
  assert.equal(state.releaseCalls, 1, 'deadline cleanup releases the reader lock');
}

{
  const state = { readCalls: 0, cancelCalls: 0, releaseCalls: 0, signal: null, cancelReason: null };
  const parent = new AbortController();
  const runtime = createRuntime(async (_url, options) => {
    state.signal = options.signal;
    return pendingJsonResponse(options.signal, state);
  }, { jsonTimeoutMs: 5_000 });

  const pending = runtime.complete({ model: 'nvidia/test', messages: [] }, parent.signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  parent.abort('user-cancelled');
  await assert.rejects(pending, (error) => error?.name === 'AbortError');
  assert.equal(state.signal.aborted, true, 'parent cancellation propagates to NVIDIA request');
  assert.equal(state.cancelCalls, 1, 'parent cancellation closes active body reader');
  assert.equal(state.releaseCalls, 1);
}

{
  const state = { readCalls: 0, cancelCalls: 0, releaseCalls: 0, signal: null, cancelReason: null };
  const runtime = createRuntime(async (_url, options) => {
    state.signal = options.signal;
    return pendingJsonResponse(options.signal, state);
  }, { jsonTimeoutMs: 15 });

  await withEventLoopLease(() => assert.rejects(
    runtime.listModels(),
    (error) => error?.code === 'NVIDIA_CHAT_TIMEOUT' && error?.status === 504
  ));
  assert.equal(state.signal.aborted, true);
  assert.equal(state.cancelCalls, 1, 'model-list deadline closes active reader too');
  assert.equal(state.releaseCalls, 1);
}

{
  const state = { returnCalls: 0, nextCalls: 0, signal: null };
  const runtime = createRuntime(async (_url, options) => {
    state.signal = options.signal;
    const body = {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            state.nextCalls += 1;
            if (options.signal.aborted) throw abortError();
            return await new Promise((_resolve, reject) => {
              const onAbort = () => {
                options.signal.removeEventListener('abort', onAbort);
                reject(abortError());
              };
              options.signal.addEventListener('abort', onAbort, { once: true });
            });
          },
          async return() {
            state.returnCalls += 1;
            return { done: true, value: undefined };
          }
        };
      }
    };
    return {
      ok: true,
      status: 200,
      headers: headers({ 'content-type': 'text/event-stream' }),
      body
    };
  }, { streamTimeoutMs: 1_000 });

  const stream = await runtime.stream({ model: 'nvidia/test', messages: [], stream: true });
  const startedAt = Date.now();
  await withEventLoopLease(() => assert.rejects(
    async () => { for await (const _chunk of stream) { /* pending until deadline */ } },
    (error) => error?.code === 'NVIDIA_STREAM_TIMEOUT' && error?.status === 504
  ));
  assert.ok(Date.now() - startedAt >= 500, 'stream deadline is not an immediate synthetic failure');
  assert.equal(state.signal.aborted, true, 'stream deadline aborts NVIDIA request signal');
  assert.equal(state.nextCalls, 1);
  assert.equal(state.returnCalls, 1, 'failed pending iteration invokes upstream iterator return');
}

{
  const parent = new AbortController();
  const state = { returnCalls: 0, signal: null };
  const runtime = createRuntime(async (_url, options) => {
    state.signal = options.signal;
    return {
      ok: true,
      status: 200,
      headers: headers({ 'content-type': 'text/event-stream' }),
      body: {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (options.signal.aborted) throw abortError();
              return await new Promise((_resolve, reject) => {
                options.signal.addEventListener('abort', () => reject(abortError()), { once: true });
              });
            },
            async return() { state.returnCalls += 1; return { done: true, value: undefined }; }
          };
        }
      }
    };
  }, { streamTimeoutMs: 5_000 });

  const stream = await runtime.stream({ model: 'nvidia/test', messages: [], stream: true }, parent.signal);
  const consuming = (async () => { for await (const _chunk of stream) { /* pending */ } })();
  await new Promise((resolve) => setTimeout(resolve, 0));
  parent.abort('user-cancelled');
  await assert.rejects(consuming, (error) => error?.name === 'AbortError');
  assert.equal(state.signal.aborted, true, 'parent cancellation propagates during SSE consumption');
  assert.equal(state.returnCalls, 1, 'cancelled SSE iteration closes upstream iterator');
}

console.log('nvidia deadline upstream cleanup tests passed');
