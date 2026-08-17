import assert from 'node:assert/strict';
import { createModelProviderServerBoundary } from '../lib/model-provider-server-boundary.mjs';

function errorWith(code, status) {
  const error = new Error(`private provider detail for ${code}`);
  error.code = code;
  if (status !== undefined) error.status = status;
  return error;
}

function boundaryFor(error) {
  return createModelProviderServerBoundary({
    runtime: {
      resolve() { return 'local'; },
      async listModels() { throw error; },
      async complete() { throw error; },
      async stream() { throw error; }
    }
  });
}

for (const [code, expectedStatus] of [
  ['LOCAL_PROVIDER_TIMEOUT', 504],
  ['LOCAL_PROVIDER_RESPONSE_TOO_LARGE', 502],
  ['LOCAL_PROVIDER_STREAM_TOO_LARGE', 502],
  ['LOCAL_PROVIDER_STREAM_CHUNK_TOO_LARGE', 502],
  ['INVALID_LOCAL_PROVIDER_RESPONSE_TYPE', 502]
]) {
  const boundary = boundaryFor(errorWith(code, expectedStatus));
  const complete = await boundary.complete({ model: 'local:llama3' });
  assert.deepEqual(complete, { ok: false, status: expectedStatus, error: code });
  assert.equal(JSON.stringify(complete).includes('private provider detail'), false);
  assert.deepEqual(await boundary.stream({ model: 'local:llama3' }), { ok: false, status: expectedStatus, error: code });
  assert.deepEqual(await boundary.listModels(), { ok: false, status: expectedStatus, error: code });
}

const cancelled = boundaryFor(errorWith('LOCAL_PROVIDER_CANCELLED', 499));
assert.deepEqual(await cancelled.complete({ model: 'local:llama3' }), { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' });

const unknown = boundaryFor(errorWith('PRIVATE_OLLAMA_STACKTRACE', 599));
assert.deepEqual(await unknown.complete({ model: 'local:llama3' }), { ok: false, status: 502, error: 'MODEL_PROVIDER_FAILED' });

const maliciousStatus = boundaryFor(errorWith('LOCAL_PROVIDER_TIMEOUT', 299));
assert.deepEqual(await maliciousStatus.complete({ model: 'local:llama3' }), { ok: false, status: 504, error: 'LOCAL_PROVIDER_TIMEOUT' });

console.log('local provider boundary error tests passed');
