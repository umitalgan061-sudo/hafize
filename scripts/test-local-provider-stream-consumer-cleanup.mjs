import assert from 'node:assert/strict';
import { createLocalOllamaProvider, LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';

const REQUEST = Object.freeze({
  model: 'local:qwen2.5:7b',
  messages: Object.freeze([{ role: 'user', content: 'stream' }])
});

function headers(contentType = 'text/event-stream') {
  return { get: (name) => name.toLowerCase() === 'content-type' ? contentType : null };
}

function providerFor(body) {
  return createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async () => ({ ok: true, status: 200, headers: headers(), body })
  });
}

function controlledBody(values, { returnThrows = false } = {}) {
  const state = { nextCalls: 0, returnCalls: 0 };
  const iterator = {
    async next() {
      state.nextCalls += 1;
      if (values.length === 0) return { done: true, value: undefined };
      return { done: false, value: values.shift() };
    },
    async return() {
      state.returnCalls += 1;
      if (returnThrows) throw new Error('upstream cleanup failed');
      return { done: true, value: undefined };
    }
  };
  return {
    state,
    body: {
      [Symbol.asyncIterator]() { return iterator; }
    }
  };
}

{
  const source = controlledBody([
    Buffer.from('data: one\n\n'),
    Buffer.from('data: two\n\n')
  ]);
  const bounded = await providerFor(source.body).stream(REQUEST);
  const iterator = bounded[Symbol.asyncIterator]();
  const first = await iterator.next();
  assert.equal(first.done, false);
  assert.equal(first.value.toString('utf8'), 'data: one\n\n');
  await iterator.return();
  assert.equal(source.state.returnCalls, 1, 'early consumer return propagates upstream exactly once');
  assert.equal(source.state.nextCalls, 1, 'no extra upstream read happens after consumer return');
}

{
  const source = controlledBody([Buffer.from('first'), Buffer.from('second')]);
  const bounded = await providerFor(source.body).stream(REQUEST);
  for await (const chunk of bounded) {
    assert.equal(chunk.toString(), 'first');
    break;
  }
  assert.equal(source.state.returnCalls, 1, 'for-await break closes the upstream iterator');
}

{
  const source = controlledBody([Buffer.from('only')]);
  const bounded = await providerFor(source.body).stream(REQUEST);
  const values = [];
  for await (const chunk of bounded) values.push(chunk.toString());
  assert.deepEqual(values, ['only']);
  assert.equal(source.state.returnCalls, 0, 'natural EOF must not issue redundant upstream cancellation');
  assert.equal(source.state.nextCalls, 2, 'natural EOF is observed explicitly');
}

{
  const source = controlledBody([Buffer.from('one')], { returnThrows: true });
  const bounded = await providerFor(source.body).stream(REQUEST);
  const iterator = bounded[Symbol.asyncIterator]();
  const first = await iterator.next();
  assert.equal(first.value.toString(), 'one');
  const result = await iterator.return('consumer-done');
  assert.equal(result.done, true, 'best-effort cleanup failure does not mask consumer return');
  assert.equal(source.state.returnCalls, 1);
}

{
  const state = { cancelCalls: 0, nextCalls: 0 };
  const body = {
    async cancel(reason) {
      state.cancelCalls += 1;
      assert.equal(reason, 'hafize-local-provider-consumer-closed');
    },
    [Symbol.asyncIterator]() {
      return {
        async next() {
          state.nextCalls += 1;
          return { done: false, value: Buffer.from('fallback') };
        }
      };
    }
  };
  const bounded = await providerFor(body).stream(REQUEST);
  const iterator = bounded[Symbol.asyncIterator]();
  await iterator.next();
  await iterator.return();
  assert.equal(state.cancelCalls, 1, 'body.cancel is used when iterator.return is unavailable');
}

{
  const source = controlledBody(['not-bytes']);
  const bounded = await providerFor(source.body).stream(REQUEST);
  await assert.rejects(
    async () => {
      for await (const _chunk of bounded) void _chunk;
    },
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_STREAM' && error?.status === 502
  );
  assert.equal(source.state.returnCalls, 1, 'validation failure releases the upstream iterator');
}

{
  const oversized = Buffer.alloc(LOCAL_PROVIDER_DEFAULTS.maxStreamChunkBytes + 1, 1);
  const source = controlledBody([oversized]);
  const bounded = await providerFor(source.body).stream(REQUEST);
  await assert.rejects(
    async () => {
      for await (const _chunk of bounded) void _chunk;
    },
    (error) => error?.code === 'LOCAL_PROVIDER_STREAM_CHUNK_TOO_LARGE' && error?.status === 502
  );
  assert.equal(source.state.returnCalls, 1, 'oversized chunk failure closes the upstream iterator');
}

{
  const chunkSize = 256 * 1024;
  const chunks = Array.from(
    { length: Math.ceil(LOCAL_PROVIDER_DEFAULTS.maxStreamBytes / chunkSize) + 1 },
    () => Buffer.alloc(chunkSize, 2)
  );
  const source = controlledBody(chunks);
  const bounded = await providerFor(source.body).stream(REQUEST);
  await assert.rejects(
    async () => {
      for await (const _chunk of bounded) void _chunk;
    },
    (error) => error?.code === 'LOCAL_PROVIDER_STREAM_TOO_LARGE' && error?.status === 502
  );
  assert.equal(source.state.returnCalls, 1, 'total byte cap failure closes the upstream iterator');
}

{
  let fetchSignal = null;
  let releasePending;
  const state = { returnCalls: 0 };
  const body = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return await new Promise((resolve) => { releasePending = resolve; });
        },
        async return() {
          state.returnCalls += 1;
          releasePending?.({ done: true, value: undefined });
          return { done: true, value: undefined };
        }
      };
    }
  };
  const provider = createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async (_url, options) => {
      fetchSignal = options.signal;
      return { ok: true, status: 200, headers: headers(), body };
    }
  });
  const controller = new AbortController();
  const bounded = await provider.stream(REQUEST, { signal: controller.signal });
  assert.equal(fetchSignal, controller.signal, 'stream request preserves caller cancellation signal');
  const iterator = bounded[Symbol.asyncIterator]();
  const pending = iterator.next();
  await Promise.resolve();
  controller.abort('user-cancelled');
  await assert.rejects(
    pending,
    (error) => error?.code === 'LOCAL_PROVIDER_CANCELLED' && error?.status === 499
  );
  assert.equal(state.returnCalls, 1, 'abort closes an upstream iterator even when next() is still pending');
}

console.log('local provider stream consumer cleanup tests passed');
