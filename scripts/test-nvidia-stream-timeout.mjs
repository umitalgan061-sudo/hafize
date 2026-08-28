import assert from 'node:assert/strict';
import {
  createModelProviderProductionRuntime,
  MODEL_PROVIDER_PRODUCTION_DEFAULTS
} from '../lib/model-provider-production-runtime.mjs';

function headers(contentType) {
  return {
    get(name) {
      return String(name).toLowerCase() === 'content-type' ? contentType : null;
    }
  };
}

function createHarness(fetchImpl, { streamTimeoutMs = 1000 } = {}) {
  return createModelProviderProductionRuntime({
    env: { NVIDIA_API_KEY: 'test-only-key' },
    fetchImpl,
    streamTimeoutMs,
    createLocalRuntime({ nvidiaComplete, nvidiaStream, nvidiaListModels }) {
      return {
        configured: false,
        defaultProvider: 'nvidia',
        complete: nvidiaComplete,
        stream: nvidiaStream,
        listModels: nvidiaListModels
      };
    },
    createBoundary({ runtime }) {
      return runtime;
    }
  });
}

function abortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

function streamWaitingForAbort(signal, { firstChunk = null } = {}) {
  return {
    async *[Symbol.asyncIterator]() {
      if (firstChunk) yield Buffer.from(firstChunk);
      await new Promise((resolve, reject) => {
        const onAbort = () => reject(abortError());
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      });
    }
  };
}

assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.streamTimeoutMs, 300_000);
assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxStreamTimeoutMs, 600_000);
assert.throws(
  () => createHarness(async () => null, { streamTimeoutMs: 999 }),
  /INVALID_NVIDIA_STREAM_TIMEOUT/
);
assert.throws(
  () => createHarness(async () => null, { streamTimeoutMs: 600_001 }),
  /INVALID_NVIDIA_STREAM_TIMEOUT/
);

{
  let requestSignal = null;
  const runtime = createHarness(async (_url, init) => {
    requestSignal = init.signal;
    return {
      ok: true,
      status: 200,
      headers: headers('text/event-stream; charset=utf-8'),
      body: {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('data: {"x":1}\n\n');
          yield Buffer.from('data: [DONE]\n\n');
        }
      }
    };
  });
  const stream = await runtime.stream({ model: 'nvidia/test', messages: [] });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk.toString('utf8'));
  assert.deepEqual(chunks, ['data: {"x":1}\n\n', 'data: [DONE]\n\n']);
  assert.ok(requestSignal);
  assert.equal(requestSignal.aborted, false);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(requestSignal.aborted, false, 'normal completion must clear the stream deadline');
}

{
  let requestSignal = null;
  const runtime = createHarness(async (_url, init) => {
    requestSignal = init.signal;
    return {
      ok: true,
      status: 200,
      headers: headers('text/event-stream'),
      body: streamWaitingForAbort(init.signal, { firstChunk: 'data: {"partial":true}\n\n' })
    };
  });
  const stream = await runtime.stream({ model: 'nvidia/test', messages: [] });
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  assert.equal(first.done, false);
  assert.equal(first.value.toString('utf8'), 'data: {"partial":true}\n\n');
  const started = Date.now();
  const eventLoopLease = setInterval(() => {}, 1_000);
  try {
    await assert.rejects(iterator.next(), (error) => {
      assert.equal(error?.code, 'NVIDIA_STREAM_TIMEOUT');
      assert.equal(error?.status, 504);
      return true;
    });
  } finally {
    clearInterval(eventLoopLease);
  }
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 700 && elapsed < 2500, `timeout elapsed ${elapsed}ms`);
  assert.equal(requestSignal.aborted, true);
}

{
  const parent = new AbortController();
  let requestSignal = null;
  const runtime = createHarness(async (_url, init) => {
    requestSignal = init.signal;
    return {
      ok: true,
      status: 200,
      headers: headers('text/event-stream'),
      body: streamWaitingForAbort(init.signal)
    };
  });
  const stream = await runtime.stream({ model: 'nvidia/test', messages: [] }, parent.signal);
  const iterator = stream[Symbol.asyncIterator]();
  const pending = iterator.next();
  parent.abort(new Error('caller-cancelled'));
  await assert.rejects(pending, (error) => error?.name === 'AbortError');
  assert.equal(requestSignal.aborted, true);
  assert.equal(requestSignal.reason?.message, 'caller-cancelled');
}

{
  const parent = new AbortController();
  parent.abort(new Error('pre-aborted'));
  let observedSignal = null;
  const runtime = createHarness(async (_url, init) => {
    observedSignal = init.signal;
    throw abortError();
  });
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [] }, parent.signal),
    (error) => error?.name === 'AbortError'
  );
  assert.equal(observedSignal.aborted, true);
}

{
  let observedSignal = null;
  const runtime = createHarness(async (_url, init) => {
    observedSignal = init.signal;
    return {
      ok: false,
      status: 503,
      headers: headers('application/json'),
      body: streamWaitingForAbort(init.signal)
    };
  });
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'NVIDIA_CHAT_ERROR' && error?.status === 503
  );
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(observedSignal.aborted, false, 'HTTP failure must dispose the deadline timer');
}

{
  let observedSignal = null;
  const runtime = createHarness(async (_url, init) => {
    observedSignal = init.signal;
    return {
      ok: true,
      status: 200,
      headers: headers('application/json'),
      body: streamWaitingForAbort(init.signal)
    };
  });
  await assert.rejects(
    runtime.stream({ model: 'nvidia/test', messages: [] }),
    (error) => error?.code === 'INVALID_NVIDIA_RESPONSE_TYPE'
  );
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(observedSignal.aborted, false, 'media-type failure must dispose the deadline timer');
}

process.stdout.write('NVIDIA stream timeout tests passed\n');
