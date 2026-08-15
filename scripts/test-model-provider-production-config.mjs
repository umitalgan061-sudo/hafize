import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime, MODEL_PROVIDER_PRODUCTION_DEFAULTS } from '../lib/model-provider-production-runtime.mjs';

const captures = [];
function localFactory(options) {
  captures.push(options);
  return {
    configured: options.env?.HAFIZE_LOCAL_PROVIDER_ENABLED === 'true',
    defaultProvider: 'nvidia',
    async listModels() { return []; },
    async complete() { return { provider: 'nvidia', result: { choices: [{ message: { role: 'assistant', content: '' } }] } }; },
    async stream() { return { provider: 'nvidia', body: { async *[Symbol.asyncIterator]() {} } }; }
  };
}
function boundaryFactory({ runtime }) {
  return {
    async listModels() { return { ok: true, status: 200, value: { models: await runtime.listModels() } }; },
    async complete(payload) { return { ok: true, status: 200, value: await runtime.complete({ payload }) }; },
    async stream(payload) { return { ok: true, status: 200, value: await runtime.stream({ payload }) }; }
  };
}
const fetchImpl = async () => ({ ok: true, status: 200, async json() { return {}; } });
const runtime = createModelProviderProductionRuntime({
  env: { NIM_BASE_URL: 'https://example.test/v1///', HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' },
  fetchImpl, createLocalRuntime: localFactory, createBoundary: boundaryFactory
});
assert.equal(runtime.nvidiaConfigured, false);
assert.equal(runtime.localConfigured, true);
assert.equal(captures.length, 1);
assert.equal(captures[0].fetchImpl, fetchImpl);
assert.equal(captures[0].env.HAFIZE_LOCAL_PROVIDER_ENABLED, 'true');
assert.equal(MODEL_PROVIDER_PRODUCTION_DEFAULTS.nimBaseUrl, 'https://integrate.api.nvidia.com/v1');
assert.throws(() => createModelProviderProductionRuntime({ env: {}, fetchImpl: null }), /MODEL_PROVIDER_FETCH_UNAVAILABLE/);
assert.throws(() => createModelProviderProductionRuntime({ env: {}, fetchImpl, createLocalRuntime: null }), /INVALID_MODEL_PROVIDER_PRODUCTION_RUNTIME/);

console.log('model provider production config tests passed');
