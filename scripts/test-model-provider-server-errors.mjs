import assert from 'node:assert/strict';
import { createModelProviderServerBoundary } from '../lib/model-provider-server-boundary.mjs';

function error(code, status, detail = 'secret provider detail /tmp/token') {
  const value = new Error(code);
  value.code = code;
  if (status) value.status = status;
  value.detail = detail;
  return value;
}

function boundaryFor(overrides = {}) {
  return createModelProviderServerBoundary({
    runtime: {
      resolve() { return 'nvidia'; },
      async listModels() { return ['nvidia/a']; },
      async complete() {
        return { provider: 'nvidia', result: { choices: [{ message: { role: 'assistant', content: 'ok' } }] } };
      },
      async stream() {
        return { provider: 'nvidia', body: new ReadableStream({ start(controller) { controller.close(); } }) };
      },
      ...overrides
    }
  });
}

const safeCases = [
  ['LOCAL_PROVIDER_NOT_ENABLED', 503],
  ['LOCAL_PROVIDER_TOOLS_UNSUPPORTED', 400],
  ['INVALID_MODEL_PROVIDER', 400],
  ['INVALID_PROVIDER_PAYLOAD', 400],
  ['NVIDIA_NOT_CONFIGURED', 503],
  ['LOCAL_PROVIDER_UNAVAILABLE', 502],
  ['INVALID_LOCAL_PROVIDER_RESPONSE', 502],
  ['INVALID_PROVIDER_STREAM', 502],
  ['INVALID_NVIDIA_RESPONSE', 502]
];

for (const [code, expectedStatus] of safeCases) {
  const boundary = boundaryFor({ async complete() { throw error(code); } });
  const result = await boundary.complete({ model: 'nvidia/a', messages: [] });
  assert.deepEqual(result, { ok: false, status: expectedStatus, error: code });
  assert.equal(JSON.stringify(result).includes('secret provider detail'), false);
  assert.equal(JSON.stringify(result).includes('/tmp/token'), false);
}

const nvidiaStatus = boundaryFor({ async complete() { throw error('NVIDIA_CHAT_ERROR', 429); } });
assert.deepEqual(await nvidiaStatus.complete({ model: 'nvidia/a', messages: [] }), {
  ok: false,
  status: 429,
  error: 'NVIDIA_CHAT_ERROR'
});

const unknown = boundaryFor({ async listModels() { throw new Error('raw filesystem /Users/name/.env'); } });
assert.deepEqual(await unknown.listModels(), {
  ok: false,
  status: 502,
  error: 'MODEL_PROVIDER_FAILED'
});

const badModels = boundaryFor({ async listModels() { return ['ok', '', 'bad\nmodel']; } });
assert.deepEqual(await badModels.listModels(), {
  ok: false,
  status: 502,
  error: 'MODEL_PROVIDER_FAILED'
});

for (const badCompletion of [null, {}, { choices: [] }, { choices: [{ message: { role: 'user', content: 'x' } }] }]) {
  const boundary = boundaryFor({ async complete() { return { provider: 'nvidia', result: badCompletion }; } });
  assert.deepEqual(await boundary.complete({ model: 'nvidia/a', messages: [] }), {
    ok: false,
    status: 502,
    error: 'MODEL_PROVIDER_FAILED'
  });
}

const badProvider = boundaryFor({
  async complete() {
    return { provider: 'attacker', result: { choices: [{ message: { role: 'assistant', content: 'x' } }] } };
  }
});
assert.deepEqual(await badProvider.complete({ model: 'nvidia/a', messages: [] }), {
  ok: false,
  status: 502,
  error: 'MODEL_PROVIDER_FAILED'
});

const badStream = boundaryFor({ async stream() { return { provider: 'local', body: {} }; } });
assert.deepEqual(await badStream.stream({ model: 'local:qwen', messages: [] }), {
  ok: false,
  status: 502,
  error: 'INVALID_PROVIDER_STREAM'
});

const aborted = new AbortController();
const abortBoundary = boundaryFor({
  async complete() {
    aborted.abort();
    throw new DOMException('provider aborted', 'AbortError');
  }
});
assert.deepEqual(await abortBoundary.complete({ model: 'nvidia/a', messages: [] }, { signal: aborted.signal }), {
  ok: false,
  status: 499,
  error: 'MODEL_PROVIDER_CANCELLED'
});

console.log('model provider server error sanitization tests passed');
