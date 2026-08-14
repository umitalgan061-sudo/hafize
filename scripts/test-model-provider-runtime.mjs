import assert from 'node:assert/strict';
import { createModelProviderRuntime } from '../lib/model-provider-runtime.mjs';

const calls = [];
const nvidiaComplete = async (payload, signal) => {
  calls.push({ provider: 'nvidia', payload, signal });
  return { id: 'nvidia-ok' };
};

const disabled = createModelProviderRuntime({ env: {}, nvidiaComplete });
assert.deepEqual(disabled.publicStatus(), { defaultProvider: 'nvidia', localEnabled: false });
assert.equal(disabled.resolve(), 'nvidia');
assert.equal((await disabled.complete({ payload: { model: 'nvidia/test' } })).provider, 'nvidia');
assert.equal(calls.length, 1);
assert.throws(() => disabled.resolve('local'), /LOCAL_PROVIDER_NOT_ENABLED/);

let localRequest = null;
const localFetch = async (url, init) => {
  localRequest = { url, init };
  return {
    ok: true,
    async text() {
      return JSON.stringify({
        model: 'llama-test',
        created_at: '2026-08-13T20:00:00Z',
        done: true,
        message: { role: 'assistant', content: 'yerel yanıt' }
      });
    }
  };
};

const enabled = createModelProviderRuntime({
  env: {
    HAFIZE_LOCAL_MODEL_ENABLED: 'true',
    HAFIZE_LOCAL_MODEL_BASE_URL: 'http://127.0.0.1:11434'
  },
  nvidiaComplete,
  fetchImpl: localFetch
});
assert.deepEqual(enabled.publicStatus(), { defaultProvider: 'nvidia', localEnabled: true });
assert.equal(enabled.resolve('local'), 'local');
const localResult = await enabled.complete({
  provider: 'local',
  payload: { model: 'llama-test', messages: [{ role: 'user', content: 'merhaba' }] }
});
assert.equal(localResult.provider, 'local');
assert.equal(localResult.result.choices[0].message.content, 'yerel yanıt');
assert.equal(localRequest.url, 'http://127.0.0.1:11434/api/chat');
assert.equal('authorization' in Object.fromEntries(Object.entries(localRequest.init.headers).map(([k, v]) => [k.toLowerCase(), v])), false);
assert.throws(() => enabled.resolve('local', { toolsRequired: true }), /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/);

for (const value of ['yes', 'enabled', 'TRUE ']) {
  if (value.trim().toLowerCase() === 'true') continue;
  assert.throws(
    () => createModelProviderRuntime({ env: { HAFIZE_LOCAL_MODEL_ENABLED: value }, nvidiaComplete }),
    /INVALID_PROVIDER_RUNTIME:localEnabled/
  );
}
assert.throws(
  () => createModelProviderRuntime({
    env: { HAFIZE_LOCAL_MODEL_ENABLED: 'true', HAFIZE_LOCAL_MODEL_BASE_URL: 'https://example.com' },
    nvidiaComplete,
    fetchImpl: localFetch
  }),
  /INVALID_LOCAL_PROVIDER:baseUrl/
);
assert.throws(() => createModelProviderRuntime({ env: {}, nvidiaComplete: null }), /INVALID_PROVIDER_RUNTIME:nvidiaComplete/);

console.log('model provider runtime tests passed');
