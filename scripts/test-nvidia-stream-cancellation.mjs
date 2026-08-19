import assert from 'node:assert/strict';
import {
  createModelProviderProductionRuntime,
  MODEL_PROVIDER_PRODUCTION_DEFAULTS
} from '../lib/model-provider-production-runtime.mjs';

function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return normalized.get(String(name).toLowerCase()) ?? null; } };
}

function boundaryFactory({ runtime }) {
  const safe = async (fn) => {
    try { return await fn(); }
    catch (error) { return { ok: false, status: error.status || 502, error: error.code || error.message }; }
  };
  return {
    listModels: ({ signal } = {}) => safe(async () => ({ ok: true, status: 200, value: { models: await runtime.listModels({ signal }) } })),
    complete: (payload, options = {}) => safe(async () => ({ ok: true, status: 200, value: await runtime.complete({ payload, signal: options.signal }) })),
    stream: (payload, options = {}) => safe(async () => ({ ok: true, status: 200, value: await runtime.stream({ payload, signal: options.signal }) }))
  };
}

function routerFactory({ nvidiaComplete, nvidiaStream, nvidiaListModels }) {
  return {
    configured: false,
    defaultProvider: 'nvidia',
    listModels: ({ signal } = {}) => nvidiaListModels(signal),
    async complete({ payload, signal }) { return { provider: 'nvidia', result: await nvidiaComplete(payload, signal) }; },
    async stream({ payload, signal }) { return { provider: 'nvidia', body: await nvidiaStream(payload, signal) }; }
  };
}

function streamResponse(body, extraHeaders = {}) {
  return {
    ok: true,
    status: 200,
    headers: headers({ 'content-type': 'text/event-stream', ...extraHeaders }),
    body
  };
}

const options = { createLocalRuntime: routerFactory, createBoundary: boundaryFactory };

{
  let requestSignal = null;
  let bodyClosed = false;
  const body = {
    async *[Symbol.asyncIterator]() {
      try {
        yield Buffer.from('data: first\n\n');
        await new Promise(() => {});
      } finally {
        bodyClosed = true;
      }
    }
  };
  const runtime = createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-key' },
    fetchImpl: async (_url, init = {}) => {
      requestSignal = init.signal;
      return streamResponse(body);
    },
    ...options
  });
  const response = await runtime.stream({ model: 'model', messages: [], stream: true });
  assert.equal(response.ok, true);
  const iterator = response.value.body[Symbol.asyncIterator]();
  const first = await iterator.next();
  assert.equal(Buffer.from(first.value).toString('utf8'), 'data: first\n\n');
  assert.equal(requestSignal.aborted, false);
  await iterator.return();
  assert.equal(requestSignal.aborted, true, 'consumer early-return must cancel the owned NVIDIA request');
  assert.equal(requestSignal.reason?.code, 'NVIDIA_STREAM_CANCELLED');
  assert.equal(bodyClosed, true, 'consumer return must close the upstream iterator');
}

{
  let requestSignal = null;
  const body = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.alloc(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxStreamChunkBytes + 1);
    }
  };
  const runtime = createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-key' },
    fetchImpl: async (_url, init = {}) => {
      requestSignal = init.signal;
      return streamResponse(body);
    },
    ...options
  });
  const response = await runtime.stream({ model: 'model', messages: [], stream: true });
  await assert.rejects(
    response.value.body[Symbol.asyncIterator]().next(),
    (error) => error?.code === 'NVIDIA_STREAM_CHUNK_TOO_LARGE'
  );
  assert.equal(requestSignal.aborted, true, 'stream validation failure must cancel the owned NVIDIA request');
  assert.equal(requestSignal.reason?.code, 'NVIDIA_STREAM_CHUNK_TOO_LARGE');
}

{
  let requestSignal = null;
  const runtime = createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-key' },
    fetchImpl: async (_url, init = {}) => {
      requestSignal = init.signal;
      return streamResponse(
        { async *[Symbol.asyncIterator]() { yield Buffer.from('never'); } },
        { 'content-length': MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxStreamBytes + 1 }
      );
    },
    ...options
  });
  const response = await runtime.stream({ model: 'model', messages: [], stream: true });
  assert.deepEqual(response, { ok: false, status: 502, error: 'NVIDIA_STREAM_TOO_LARGE' });
  assert.equal(requestSignal.aborted, true, 'oversized declared stream must be rejected before consumption');
  assert.equal(requestSignal.reason?.code, 'NVIDIA_STREAM_TOO_LARGE');
}

{
  let requestSignal = null;
  const caller = new AbortController();
  const body = {
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('data: waiting\n\n');
      await new Promise(() => {});
    }
  };
  const runtime = createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-key' },
    fetchImpl: async (_url, init = {}) => {
      requestSignal = init.signal;
      return streamResponse(body);
    },
    ...options
  });
  const response = await runtime.stream({ model: 'model', messages: [], stream: true }, { signal: caller.signal });
  const iterator = response.value.body[Symbol.asyncIterator]();
  await iterator.next();
  const reason = new Error('caller-stop');
  caller.abort(reason);
  assert.equal(requestSignal.aborted, true);
  assert.equal(requestSignal.reason, reason, 'caller cancellation reason must propagate to the owned NVIDIA request');
  await iterator.return();
}

process.stdout.write('NVIDIA stream cancellation tests passed\n');
