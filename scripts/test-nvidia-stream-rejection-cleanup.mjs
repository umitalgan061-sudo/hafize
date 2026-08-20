import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return map.get(String(name).toLowerCase()) ?? null; } };
}

function runtimeFor(fetchImpl, options = {}) {
  return createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-only-key' },
    fetchImpl,
    streamTimeoutMs: 5_000,
    createLocalRuntime({ nvidiaComplete, nvidiaStream, nvidiaListModels }) {
      return { configured: false, defaultProvider: 'nvidia', nvidiaComplete, nvidiaStream, nvidiaListModels };
    },
    createBoundary({ runtime }) {
      return { complete: runtime.nvidiaComplete, stream: runtime.nvidiaStream, listModels: runtime.nvidiaListModels };
    },
    ...options
  });
}

function cancellableBody({ iterable = false, cancelThrows = false } = {}) {
  const state = { cancelCalls: 0, returnCalls: 0, reasons: [] };
  const body = {
    async cancel(reason) {
      state.cancelCalls += 1;
      state.reasons.push(reason);
      if (cancelThrows) throw new Error('cancel failed');
    }
  };
  if (iterable) {
    body[Symbol.asyncIterator] = function iteratorFactory() {
      return {
        async next() { return { done: true, value: undefined }; },
        async return() { state.returnCalls += 1; return { done: true, value: undefined }; }
      };
    };
  }
  return { state, body };
}

{
  const fixture = cancellableBody({ iterable: true });
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
  assert.equal(fixture.state.cancelCalls, 1, 'non-2xx SSE body is explicitly cancelled');
  assert.equal(fixture.state.reasons[0]?.code, 'NVIDIA_CHAT_ERROR');
}

{
  const fixture = cancellableBody({ iterable: true });
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'application/json' }),
    body: fixture.body
  }));
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [], stream: true }),
    (error) => error?.code === 'INVALID_NVIDIA_RESPONSE_TYPE'
  );
  assert.equal(fixture.state.cancelCalls, 1, 'wrong SSE content type closes response body');
}

{
  const fixture = cancellableBody({ iterable: true });
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({
      'content-type': 'text/event-stream',
      'content-length': 8 * 1024 * 1024 + 1
    }),
    body: fixture.body
  }));
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [], stream: true }),
    (error) => error?.code === 'NVIDIA_STREAM_TOO_LARGE'
  );
  assert.equal(fixture.state.cancelCalls, 1, 'declared oversized SSE body closes before iteration');
}

{
  const fixture = cancellableBody();
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/event-stream' }),
    body: fixture.body
  }));
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [], stream: true }),
    (error) => error?.code === 'INVALID_PROVIDER_STREAM'
  );
  assert.equal(fixture.state.cancelCalls, 1, 'non-iterable SSE body is cancelled');
}

{
  const fixture = cancellableBody({ iterable: true, cancelThrows: true });
  const runtime = runtimeFor(async () => ({
    ok: false,
    status: 503,
    headers: headers({ 'content-type': 'text/event-stream' }),
    body: fixture.body
  }));
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [], stream: true }),
    (error) => {
      assert.equal(error.code, 'NVIDIA_CHAT_ERROR');
      assert.equal(error.status, 503);
      assert.notEqual(error.message, 'cancel failed');
      return true;
    }
  );
  assert.equal(fixture.state.cancelCalls, 1, 'cleanup failure does not replace provider failure');
}

{
  const state = { entered: 0, finalized: 0 };
  const body = {
    async *[Symbol.asyncIterator]() {
      try {
        state.entered += 1;
        yield new Uint8Array(Buffer.from('data: one\n\n'));
        yield new Uint8Array(Buffer.from('data: two\n\n'));
      } finally {
        state.finalized += 1;
      }
    }
  };
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/event-stream' }),
    body
  }));
  const stream = await runtime.stream({ model: 'nvidia/test', messages: [], stream: true });
  const seen = [];
  for await (const chunk of stream) {
    seen.push(chunk.toString('utf8'));
    break;
  }
  assert.deepEqual(seen, ['data: one\n\n']);
  assert.equal(state.entered, 1);
  assert.equal(state.finalized, 1, 'consumer break closes upstream async iterator');
}

{
  const state = { finalized: 0 };
  const tooLarge = new Uint8Array(512 * 1024 + 1);
  const body = {
    async *[Symbol.asyncIterator]() {
      try { yield tooLarge; }
      finally { state.finalized += 1; }
    }
  };
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/event-stream' }),
    body
  }));
  const stream = await runtime.stream({ model: 'nvidia/test', messages: [], stream: true });
  await assert.rejects(
    async () => { for await (const _chunk of stream) { /* no-op */ } },
    (error) => error?.code === 'NVIDIA_STREAM_CHUNK_TOO_LARGE'
  );
  assert.equal(state.finalized, 1, 'chunk validation failure closes upstream iterator');
}

{
  const state = { finalized: 0 };
  const chunk = new Uint8Array(512 * 1024);
  const body = {
    async *[Symbol.asyncIterator]() {
      try {
        for (let index = 0; index < 17; index += 1) yield chunk;
      } finally { state.finalized += 1; }
    }
  };
  const runtime = runtimeFor(async () => ({
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/event-stream' }),
    body
  }));
  const stream = await runtime.stream({ model: 'nvidia/test', messages: [], stream: true });
  await assert.rejects(
    async () => { for await (const _chunk of stream) { /* drain */ } },
    (error) => error?.code === 'NVIDIA_STREAM_TOO_LARGE'
  );
  assert.equal(state.finalized, 1, 'aggregate byte overflow closes upstream iterator');
}

console.log('nvidia stream rejection cleanup tests passed');
