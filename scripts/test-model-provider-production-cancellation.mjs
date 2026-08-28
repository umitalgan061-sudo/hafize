import assert from 'node:assert/strict';
import { createModelProviderProductionRuntime } from '../lib/model-provider-production-runtime.mjs';

let fetchCalls = 0;
let seenSignal = null;
function localFactory(options) {
  return {
    configured: false, defaultProvider: 'nvidia',
    listModels: ({ signal } = {}) => options.nvidiaListModels(signal),
    async complete({ payload, signal }) { return { provider: 'nvidia', result: await options.nvidiaComplete(payload, signal) }; },
    async stream({ payload, signal }) { return { provider: 'nvidia', body: await options.nvidiaStream(payload, signal) }; }
  };
}
function boundaryFactory({ runtime }) {
  function cancelled(signal) { return signal?.aborted ? { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' } : null; }
  async function wrap(signal, fn) {
    const before = cancelled(signal);
    if (before) return before;
    try { return { ok: true, status: 200, value: await fn() }; }
    catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') return { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' };
      return { ok: false, status: error.status || 502, error: error.code || 'MODEL_PROVIDER_FAILED' };
    }
  }
  return {
    listModels: ({ signal } = {}) => wrap(signal, async () => ({ models: await runtime.listModels({ signal }) })),
    complete: (payload, { signal } = {}) => wrap(signal, () => runtime.complete({ payload, signal })),
    stream: (payload, { signal } = {}) => wrap(signal, () => runtime.stream({ payload, signal }))
  };
}
const runtime = createModelProviderProductionRuntime({
  env: { NVIDIA_API_KEY: 'token' },
  fetchImpl: async (_url, init = {}) => {
    fetchCalls += 1;
    seenSignal = init.signal;
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => String(name).toLowerCase() === 'content-type' ? 'application/json' : null },
      async json() { return { choices: [{ message: { role: 'assistant', content: 'ok' } }] }; }
    };
  },
  createLocalRuntime: localFactory,
  createBoundary: boundaryFactory
});

const preAborted = new AbortController();
preAborted.abort();
assert.deepEqual(await runtime.complete({ model: 'nvidia/a', messages: [] }, { signal: preAborted.signal }), {
  ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED'
});
assert.equal(fetchCalls, 0);

const controller = new AbortController();
const result = await runtime.complete({ model: 'nvidia/a', messages: [] }, { signal: controller.signal });
assert.equal(result.ok, true);
assert.equal(seenSignal instanceof AbortSignal, true);
assert.equal(seenSignal.aborted, false);

console.log('model provider production cancellation tests passed');
