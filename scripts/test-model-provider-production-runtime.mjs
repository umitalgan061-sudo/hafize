import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

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
function jsonResponse(value, status = 200) { return { ok: status >= 200 && status < 300, status, async json() { return value; } }; }
const requests = [];
const streamBody = { async *[Symbol.asyncIterator]() { yield Buffer.from('data: x\n\n'); } };
const fetchImpl = async (url, init = {}) => {
  requests.push({ url: String(url), init });
  if (String(url).endsWith('/models')) return jsonResponse({ data: [{ id: 'nvidia/model-a' }, { id: 'nvidia/model-b' }] });
  if (init.headers?.Accept === 'text/event-stream') return { ok: true, status: 200, body: streamBody };
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
const disabled = createModelProviderProductionRuntime({ env: {}, fetchImpl, ...options });
assert.deepEqual(await disabled.listModels(), { ok: true, status: 200, value: { models: [] } });
assert.deepEqual(await disabled.complete({ model: 'nvidia/model-a', messages: [] }), { ok: false, status: 503, error: 'NVIDIA_NOT_CONFIGURED' });
console.log('model provider production runtime tests passed');
