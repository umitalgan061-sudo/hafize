import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime, MODEL_PROVIDER_PRODUCTION_DEFAULTS } from '../lib/model-provider-production-runtime.mjs';

function boundaryFactory({ runtime }) {
  const safe = async (fn) => { try { return await fn(); } catch (error) { return { ok: false, status: error.status || 502, error: error.code || error.message }; } };
  return {
    listModels: ({ signal } = {}) => safe(async () => ({ ok: true, status: 200, value: { models: await runtime.listModels({ signal }) } })),
    complete: (payload, options = {}) => safe(async () => ({ ok: true, status: 200, value: await runtime.complete({ payload, signal: options.signal, toolsRequired: options.toolsRequired }) })),
    stream: (payload, options = {}) => safe(async () => ({ ok: true, status: 200, value: await runtime.stream({ payload, signal: options.signal, toolsRequired: options.toolsRequired }) }))
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
function headers(values = {}) {
  const normalized = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return { get(name) { return normalized.get(String(name).toLowerCase()) ?? null; } };
}
function jsonResponse(value, status = 200, extra = {}) {
  const encoded = JSON.stringify(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers({ 'content-type': 'application/json; charset=utf-8', ...(extra.headers || {}) }),
    async text() { return encoded; },
    async json() { return value; }
  };
}
function textResponse(text, status = 200, extra = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers({ 'content-type': 'application/json', ...(extra.headers || {}) }),
    async text() { return text; }
  };
}
function readerResponse(chunks, status = 200, extra = {}) {
  let index = 0;
  let cancelled = false;
  const reader = {
    async read() { return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true }; },
    async cancel() { cancelled = true; },
    releaseLock() {}
  };
  return {
    response: {
      ok: status >= 200 && status < 300,
      status,
      headers: headers({ 'content-type': 'application/json', ...(extra.headers || {}) }),
      body: { getReader() { return reader; } }
    },
    wasCancelled: () => cancelled
  };
}

const requests = [];
const streamBody = { async *[Symbol.asyncIterator]() { yield Buffer.from('data: x\n\n'); } };
const fetchImpl = async (url, init = {}) => {
  requests.push({ url: String(url), init });
  if (String(url).endsWith('/models')) {
    return jsonResponse({ data: [
      { id: 'nvidia/model-a' },
      { id: ' nvidia/model-b ' },
      { id: 'nvidia/model-a' },
      { id: '' },
      { id: 'bad\nmodel' },
      { id: 'x'.repeat(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelIdLength + 1) }
    ] });
  }
  if (init.headers?.Accept === 'text/event-stream') {
    return { ok: true, status: 200, headers: headers({ 'content-type': 'text/event-stream; charset=utf-8' }), body: streamBody };
  }
  return jsonResponse({ choices: [{ message: { role: 'assistant', content: 'nvidia-ok' } }] });
};
const options = { createLocalRuntime: routerFactory, createBoundary: boundaryFactory };
const runtime = createModelProviderProductionRuntime({ env: { NVIDIA_API_KEY: 'nvidia-test-key' }, fetchImpl, ...options });
assert.equal(runtime.nvidiaConfigured, true);
assert.equal(runtime.localConfigured, false);
assert.deepEqual(await runtime.listModels(), { ok: true, status: 200, value: { models: ['nvidia/model-a', 'nvidia/model-b'] } });
const completion = await runtime.complete({ model: 'nvidia/model-a', messages: [{ role: 'user', content: 'hi' }] });
assert.equal(completion.value.provider, 'nvidia');
assert.equal(completion.value.result.choices[0].message.content, 'nvidia-ok');
const streamed = await runtime.stream({ model: 'nvidia/model-a', messages: [], stream: true });
assert.equal(streamed.value.body, streamBody);
assert.equal(requests.every((request) => request.init.headers?.Authorization === 'Bearer nvidia-test-key'), true);
assert.equal(requests.every((request) => request.init.redirect === 'error'), true, 'NVIDIA credential requests must never auto-follow redirects');
assert.equal(requests.some((request) => request.init.headers?.Accept === 'application/json'), true);
assert.equal(requests.some((request) => request.init.headers?.Accept === 'text/event-stream'), true);

const disabled = createModelProviderProductionRuntime({ env: {}, fetchImpl, ...options });
assert.deepEqual(await disabled.listModels(), { ok: true, status: 200, value: { models: [] } });
assert.deepEqual(await disabled.complete({ model: 'nvidia/model-a', messages: [] }), { ok: false, status: 503, error: 'NVIDIA_NOT_CONFIGURED' });

const declaredTooLarge = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => textResponse('{}', 200, { headers: { 'content-length': MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxCompletionJsonBytes + 1 } }),
  ...options
});
assert.deepEqual(await declaredTooLarge.complete({ model: 'x', messages: [] }), {
  ok: false, status: 502, error: 'NVIDIA_RESPONSE_TOO_LARGE'
});

const oversizedChunk = Buffer.alloc(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxCompletionJsonBytes + 1, 0x20);
const streamedOversizeResponse = readerResponse([oversizedChunk]);
const streamedOversize = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => streamedOversizeResponse.response,
  ...options
});
assert.deepEqual(await streamedOversize.complete({ model: 'x', messages: [] }), {
  ok: false, status: 502, error: 'NVIDIA_RESPONSE_TOO_LARGE'
});
assert.equal(streamedOversizeResponse.wasCancelled(), true, 'oversized streamed JSON should cancel the reader');

const malformed = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => textResponse('{not-json'),
  ...options
});
assert.deepEqual(await malformed.complete({ model: 'x', messages: [] }), {
  ok: false, status: 502, error: 'INVALID_NVIDIA_RESPONSE'
});

const wrongCompletionType = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => textResponse('{"choices":[]}', 200, { headers: { 'content-type': 'text/html' } }),
  ...options
});
assert.deepEqual(await wrongCompletionType.complete({ model: 'x', messages: [] }), {
  ok: false, status: 502, error: 'INVALID_NVIDIA_RESPONSE_TYPE'
});

const modelListTooLarge = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => textResponse('{}', 200, { headers: { 'content-length': MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelsJsonBytes + 1 } }),
  ...options
});
assert.deepEqual(await modelListTooLarge.listModels(), {
  ok: false, status: 502, error: 'NVIDIA_RESPONSE_TOO_LARGE'
});

const wrongModelsType = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => textResponse('{"data":[]}', 200, { headers: { 'content-type': 'text/plain' } }),
  ...options
});
assert.deepEqual(await wrongModelsType.listModels(), {
  ok: false, status: 502, error: 'INVALID_NVIDIA_RESPONSE_TYPE'
});

const cappedModels = Array.from({ length: MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelCount + 10 }, (_, index) => ({ id: `model-${index}` }));
const cappedRuntime = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => jsonResponse({ data: cappedModels }),
  ...options
});
const capped = await cappedRuntime.listModels();
assert.equal(capped.ok, true);
assert.equal(capped.value.models.length, MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelCount);
assert.equal(capped.value.models.at(-1), `model-${MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelCount - 1}`);

const invalidStream = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => ({ ok: true, status: 200, headers: headers({ 'content-type': 'text/event-stream' }), body: {} }),
  ...options
});
assert.deepEqual(await invalidStream.stream({ model: 'x', messages: [], stream: true }), {
  ok: false, status: 502, error: 'INVALID_PROVIDER_STREAM'
});

const wrongStreamType = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => ({ ok: true, status: 200, headers: headers({ 'content-type': 'application/json' }), body: streamBody }),
  ...options
});
assert.deepEqual(await wrongStreamType.stream({ model: 'x', messages: [], stream: true }), {
  ok: false, status: 502, error: 'INVALID_NVIDIA_RESPONSE_TYPE'
});

const upstreamFailure = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'key' },
  fetchImpl: async () => ({ ok: false, status: 429, headers: headers({ 'content-type': 'application/json' }), async text() { return 'rate limited'; } }),
  ...options
});
assert.deepEqual(await upstreamFailure.complete({ model: 'x', messages: [] }), {
  ok: false, status: 429, error: 'NVIDIA_CHAT_ERROR'
});

assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxCompletionJsonBytes, 4 * 1024 * 1024);
assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelsJsonBytes, 1024 * 1024);
assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelCount, 4096);
assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.maxModelIdLength, 512);

console.log('model provider production runtime tests passed');
