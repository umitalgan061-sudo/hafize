import assert from 'node:assert/strict';
import { createModelProviderRouter, MODEL_PROVIDER_IDS } from '../lib/model-provider-router.mjs';

const calls = [];
const router = createModelProviderRouter({
  nvidiaComplete: async (payload, signal) => {
    calls.push(['nvidia', payload, signal]);
    return { id: 'nvidia-result' };
  },
  localComplete: async (payload, signal) => {
    calls.push(['local', payload, signal]);
    return { id: 'local-result' };
  },
  localEnabled: true
});

assert.deepEqual(MODEL_PROVIDER_IDS, ['nvidia', 'local']);
assert.equal(router.defaultProvider, 'nvidia');
assert.equal(router.resolve(), 'nvidia');
assert.equal(router.resolve(' NVIDIA '), 'nvidia');
assert.equal(router.resolve('local'), 'local');

const signal = new AbortController().signal;
assert.deepEqual(await router.complete({ payload: { model: 'm' }, signal }), {
  provider: 'nvidia', result: { id: 'nvidia-result' }
});
assert.deepEqual(await router.complete({ provider: 'local', payload: { model: 'm' }, signal }), {
  provider: 'local', result: { id: 'local-result' }
});
assert.equal(calls[0][0], 'nvidia');
assert.equal(calls[1][0], 'local');
assert.equal(calls[1][2], signal);

assert.throws(() => router.resolve('other'), /INVALID_MODEL_PROVIDER/);
assert.throws(() => router.resolve('local', { toolsRequired: true }), /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/);
assert.rejects(() => router.complete({ provider: 'local' }), /INVALID_PROVIDER_PAYLOAD/);

const disabled = createModelProviderRouter({ nvidiaComplete: async () => ({}), localEnabled: false });
assert.throws(() => disabled.resolve('local'), /LOCAL_PROVIDER_NOT_ENABLED/);
assert.throws(() => createModelProviderRouter({}), /INVALID_PROVIDER_ROUTER:nvidiaComplete/);
assert.throws(() => createModelProviderRouter({ nvidiaComplete: async () => ({}), localEnabled: 'yes' }), /INVALID_PROVIDER_ROUTER:localEnabled/);

console.log('model provider router tests passed');
