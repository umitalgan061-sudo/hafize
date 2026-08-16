import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

function localFactory(options) {
  return {
    configured: false, defaultProvider: 'nvidia',
    listModels: ({ signal } = {}) => options.nvidiaListModels(signal),
    async complete({ payload, signal }) { return { provider: 'nvidia', result: await options.nvidiaComplete(payload, signal) }; },
    async stream({ payload, signal }) { return { provider: 'nvidia', body: await options.nvidiaStream(payload, signal) }; }
  };
}
function boundaryFactory({ runtime }) {
  const sanitize = async (fn) => {
    try { return { ok: true, status: 200, value: await fn() }; }
    catch (error) { return { ok: false, status: error.status || 502, error: error.code || 'MODEL_PROVIDER_FAILED' }; }
  };
  return {
    listModels: ({ signal } = {}) => sanitize(async () => ({ models: await runtime.listModels({ signal }) })),
    complete: (payload, options = {}) => sanitize(() => runtime.complete({ payload, signal: options.signal })),
    stream: (payload, options = {}) => sanitize(() => runtime.stream({ payload, signal: options.signal }))
  };
}
const injected = { createLocalRuntime: localFactory, createBoundary: boundaryFactory };
for (const badUrl of [
  'http://integrate.api.nvidia.com/v1',
  'https://user:pass@integrate.api.nvidia.com/v1',
  'https://integrate.api.nvidia.com/v1?token=x',
  'not a url'
]) {
  assert.throws(
    () => createModelProviderProductionRuntime({ env: { NIM_BASE_URL: badUrl }, fetchImpl: async () => {}, ...injected }),
    /INVALID_NIM_BASE_URL/
  );
}
const failing = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'super-secret-token' },
  fetchImpl: async () => ({ ok: false, status: 401, async json() { throw new Error('/private/provider/body'); } }),
  ...injected
});
const result = await failing.complete({ model: 'nvidia/a', messages: [] });
assert.deepEqual(result, { ok: false, status: 401, error: 'NVIDIA_CHAT_ERROR' });
assert.equal(JSON.stringify(result).includes('super-secret-token'), false);
assert.equal(JSON.stringify(result).includes('/private/provider/body'), false);
const source = await readFile(new URL('../lib/model-provider-production-runtime.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(source, /shell\s*:\s*true|child_process|exec\(|spawn\(/);
assert.doesNotMatch(source, /localStorage|sessionStorage|document\.|window\./);
assert.match(source, /Authorization: `Bearer \$\{apiKey\}`/);
console.log('model provider production security tests passed');
