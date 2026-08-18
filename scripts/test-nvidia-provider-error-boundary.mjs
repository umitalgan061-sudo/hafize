import assert from 'node:assert/strict';
import { createModelProviderServerBoundary } from '../lib/model-provider-server-boundary.mjs';

function providerError(code, status) {
  const error = new Error(`private detail for ${code}`);
  error.code = code;
  if (status !== undefined) error.status = status;
  error.stack = `PRIVATE_STACK:${code}`;
  return error;
}

function runtimeThrowing(code, status) {
  const throwError = async () => {
    throw providerError(code, status);
  };
  return {
    resolve() { return 'nvidia'; },
    complete: throwError,
    stream: throwError,
    listModels: throwError
  };
}

const safeCases = [
  ['NVIDIA_CHAT_TIMEOUT', 504],
  ['NVIDIA_STREAM_TIMEOUT', 504],
  ['NVIDIA_RESPONSE_TOO_LARGE', 502],
  ['NVIDIA_STREAM_TOO_LARGE', 502],
  ['NVIDIA_STREAM_CHUNK_TOO_LARGE', 502],
  ['INVALID_NVIDIA_RESPONSE_TYPE', 502],
  ['INVALID_NVIDIA_RESPONSE', 502],
  ['NVIDIA_CHAT_ERROR', 502]
];

for (const [code, status] of safeCases) {
  const boundary = createModelProviderServerBoundary({ runtime: runtimeThrowing(code) });
  const complete = await boundary.complete({ model: 'nvidia/test' });
  assert.deepEqual(complete, { ok: false, status, error: code });
  assert.equal(JSON.stringify(complete).includes('private detail'), false);
  assert.equal(JSON.stringify(complete).includes('PRIVATE_STACK'), false);

  const stream = await boundary.stream({ model: 'nvidia/test' });
  assert.deepEqual(stream, { ok: false, status, error: code });
  assert.equal(JSON.stringify(stream).includes('private detail'), false);

  const models = await boundary.listModels();
  assert.deepEqual(models, { ok: false, status, error: code });
}

{
  const boundary = createModelProviderServerBoundary({
    runtime: runtimeThrowing('NVIDIA_STREAM_TIMEOUT', 599)
  });
  const result = await boundary.stream({ model: 'nvidia/test' });
  assert.deepEqual(result, { ok: false, status: 599, error: 'NVIDIA_STREAM_TIMEOUT' });
}

{
  const boundary = createModelProviderServerBoundary({
    runtime: runtimeThrowing('PRIVATE_PROVIDER_DATABASE_PASSWORD=secret', 418)
  });
  const result = await boundary.complete({ model: 'nvidia/test' });
  assert.deepEqual(result, { ok: false, status: 502, error: 'MODEL_PROVIDER_FAILED' });
  assert.equal(JSON.stringify(result).includes('secret'), false);
}

{
  const boundary = createModelProviderServerBoundary({
    runtime: runtimeThrowing('UNKNOWN_NVIDIA_INTERNAL_ERROR')
  });
  const result = await boundary.stream({ model: 'nvidia/test' });
  assert.deepEqual(result, { ok: false, status: 502, error: 'MODEL_PROVIDER_FAILED' });
}

{
  const controller = new AbortController();
  controller.abort(new Error('user cancelled'));
  let called = false;
  const boundary = createModelProviderServerBoundary({
    runtime: {
      resolve() { return 'nvidia'; },
      async complete() { called = true; return {}; },
      async stream() { called = true; return {}; },
      async listModels() { called = true; return []; }
    }
  });
  assert.deepEqual(
    await boundary.complete({}, { signal: controller.signal }),
    { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' }
  );
  assert.deepEqual(
    await boundary.stream({}, { signal: controller.signal }),
    { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' }
  );
  assert.deepEqual(
    await boundary.listModels({ signal: controller.signal }),
    { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' }
  );
  assert.equal(called, false);
}

{
  const controller = new AbortController();
  const boundary = createModelProviderServerBoundary({
    runtime: {
      resolve() { return 'nvidia'; },
      async complete() { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); },
      async stream() { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); },
      async listModels() { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }
    }
  });
  const result = await boundary.stream({}, { signal: controller.signal });
  assert.deepEqual(result, { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' });
}

process.stdout.write('NVIDIA provider error boundary tests passed\n');
