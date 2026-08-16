import assert from 'node:assert/strict';
import { createModelProviderServerBoundary } from '../lib/model-provider-server-boundary.mjs';

const encoder = new TextEncoder();
function streamOf(...chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
}

for (const runtime of [null, {}, { complete() {}, stream() {}, listModels() {} }]) {
  assert.throws(
    () => createModelProviderServerBoundary({ runtime }),
    /INVALID_MODEL_PROVIDER_SERVER_BOUNDARY/
  );
}

const calls = [];
const runtime = {
  resolve() { return 'nvidia'; },
  async listModels({ signal } = {}) {
    calls.push(['models', signal]);
    return ['nvidia/a', 'nvidia/a', 'local:qwen2.5'];
  },
  async complete({ payload, signal, toolsRequired }) {
    calls.push(['complete', payload, signal, toolsRequired]);
    return {
      provider: payload.model.startsWith('local:') ? 'local' : 'nvidia',
      result: { choices: [{ message: { role: 'assistant', content: 'ok' } }] }
    };
  },
  async stream({ payload, signal, toolsRequired }) {
    calls.push(['stream', payload, signal, toolsRequired]);
    return {
      provider: payload.model.startsWith('local:') ? 'local' : 'nvidia',
      body: streamOf('data: one\n\n', 'data: [DONE]\n\n')
    };
  }
};
const boundary = createModelProviderServerBoundary({ runtime });

const modelController = new AbortController();
assert.deepEqual(await boundary.listModels({ signal: modelController.signal }), {
  ok: true,
  status: 200,
  value: { models: ['nvidia/a', 'local:qwen2.5'] }
});
assert.equal(calls[0][1], modelController.signal);

const completionController = new AbortController();
const completionPayload = {
  model: 'local:qwen2.5',
  messages: [{ role: 'user', content: 'hello' }],
  stream: false,
  max_tokens: 100
};
const completion = await boundary.complete(completionPayload, {
  signal: completionController.signal,
  toolsRequired: false
});
assert.equal(completion.ok, true);
assert.equal(completion.value.provider, 'local');
assert.equal(completion.value.result.choices[0].message.content, 'ok');
assert.deepEqual(calls[1], ['complete', completionPayload, completionController.signal, false]);

const streamController = new AbortController();
const streamPayload = {
  model: 'nvidia/a',
  messages: [{ role: 'user', content: 'stream' }],
  stream: true
};
const streamed = await boundary.stream(streamPayload, {
  signal: streamController.signal,
  toolsRequired: true
});
assert.equal(streamed.ok, true);
assert.equal(streamed.value.provider, 'nvidia');
assert.equal(typeof streamed.value.body[Symbol.asyncIterator], 'function');
assert.deepEqual(calls[2], ['stream', streamPayload, streamController.signal, true]);

const chunks = [];
for await (const chunk of streamed.value.body) chunks.push(Buffer.from(chunk).toString('utf8'));
assert.deepEqual(chunks, ['data: one\n\n', 'data: [DONE]\n\n']);

for (const operation of [
  () => boundary.complete({}, { signal: {} }),
  () => boundary.stream({}, { toolsRequired: 'yes' })
]) {
  await assert.rejects(operation, /INVALID_MODEL_PROVIDER_(?:SIGNAL|TOOLS_REQUIRED)/);
}

const aborted = new AbortController();
aborted.abort();
const beforeAbort = calls.length;
assert.deepEqual(await boundary.listModels({ signal: aborted.signal }), {
  ok: false,
  status: 499,
  error: 'MODEL_PROVIDER_CANCELLED'
});
assert.deepEqual(await boundary.complete(completionPayload, { signal: aborted.signal }), {
  ok: false,
  status: 499,
  error: 'MODEL_PROVIDER_CANCELLED'
});
assert.deepEqual(await boundary.stream(streamPayload, { signal: aborted.signal }), {
  ok: false,
  status: 499,
  error: 'MODEL_PROVIDER_CANCELLED'
});
assert.equal(calls.length, beforeAbort);

console.log('model provider server boundary tests passed');
