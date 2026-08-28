import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

let captured = null;
function localRuntimeFactory(options) {
  captured = options;
  return {
    configured: true,
    defaultProvider: 'nvidia',
    async listModels({ signal } = {}) {
      const nvidia = await options.nvidiaListModels(signal);
      return [...nvidia, 'local:llama3.2'];
    },
    async complete({ payload, signal, toolsRequired }) {
      if (payload.model.startsWith('local:')) {
        if (toolsRequired) { const e = new Error('LOCAL_PROVIDER_TOOLS_UNSUPPORTED'); e.code = e.message; e.status = 400; throw e; }
        return { provider: 'local', result: { choices: [{ message: { role: 'assistant', content: 'local-ok' } }] } };
      }
      return { provider: 'nvidia', result: await options.nvidiaComplete(payload, signal) };
    },
    async stream() { throw new Error('not used'); }
  };
}
function boundaryFactory({ runtime }) {
  async function wrap(fn) { try { return { ok: true, status: 200, value: await fn() }; } catch (e) { return { ok: false, status: e.status || 502, error: e.code || e.message }; } }
  return {
    listModels: ({ signal } = {}) => wrap(async () => ({ models: await runtime.listModels({ signal }) })),
    complete: (payload, opts = {}) => wrap(() => runtime.complete({ payload, signal: opts.signal, toolsRequired: opts.toolsRequired })),
    stream: (payload, opts = {}) => wrap(() => runtime.stream({ payload, signal: opts.signal, toolsRequired: opts.toolsRequired }))
  };
}
const fetchImpl = async (url) => {
  assert.match(String(url), /integrate\.api\.nvidia\.com/);
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'application/json' : null },
    async json() { return { data: [{ id: 'nvidia/a' }] }; }
  };
};
const runtime = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'secret', HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' }, fetchImpl,
  createLocalRuntime: localRuntimeFactory, createBoundary: boundaryFactory
});
assert.equal(runtime.localConfigured, true);
assert.equal(typeof captured.fetchImpl, 'function');
assert.deepEqual(await runtime.listModels(), { ok: true, status: 200, value: { models: ['nvidia/a', 'local:llama3.2'] } });
const local = await runtime.complete({ model: 'local:llama3.2', messages: [] });
assert.equal(local.value.provider, 'local');
assert.deepEqual(await runtime.complete({ model: 'local:llama3.2', messages: [] }, { toolsRequired: true }), {
  ok: false, status: 400, error: 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED'
});
console.log('model provider local production composition tests passed');
