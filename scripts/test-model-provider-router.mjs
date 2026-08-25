import assert from 'node:assert/strict';
import { createModelProviderRouter, MODEL_PROVIDER_IDS } from '../lib/model-provider-router.mjs';

async function* chunks(label) { yield Buffer.from(label); }
const calls = [];
const router = createModelProviderRouter({
  nvidiaComplete: async (payload, signal) => {
    calls.push(['nvidia-complete', payload, signal]);
    return { id: 'nvidia-result' };
  },
  nvidiaStream: async (payload, signal) => {
    calls.push(['nvidia-stream', payload, signal]);
    return chunks('nvidia');
  },
  nvidiaListModels: async (signal) => {
    calls.push(['nvidia-models', signal]);
    return ['nvidia/a', 'nvidia/a'];
  },
  localComplete: async (payload, { signal } = {}) => {
    calls.push(['local-complete', payload, signal]);
    return { id: 'local-result' };
  },
  localStream: async (payload, { signal } = {}) => {
    calls.push(['local-stream', payload, signal]);
    return chunks('local');
  },
  localListModels: async ({ signal } = {}) => {
    calls.push(['local-models', signal]);
    return ['local:qwen', 'local:llama'];
  },
  localEnabled: true
});

assert.deepEqual(MODEL_PROVIDER_IDS, ['nvidia', 'local']);
assert.equal(router.defaultProvider, 'nvidia');
assert.equal(router.resolve(), 'nvidia');
assert.equal(router.resolve(null, { model: 'local:qwen' }), 'local');
assert.equal(router.resolve(' NVIDIA '), 'nvidia');
assert.equal(router.resolve('local'), 'local');

const signal = new AbortController().signal;
assert.deepEqual(await router.complete({ payload: { model: 'nvidia/a' }, signal }), {
  provider: 'nvidia', result: { id: 'nvidia-result' }
});
assert.deepEqual(await router.complete({ payload: { model: 'local:qwen' }, signal }), {
  provider: 'local', result: { id: 'local-result' }
});
assert.equal(calls[1][2], signal);

const streamed = await router.stream({ payload: { model: 'local:qwen' }, signal });
assert.equal(streamed.provider, 'local');
const streamedChunks = [];
for await (const chunk of streamed.body) streamedChunks.push(chunk.toString());
assert.deepEqual(streamedChunks, ['local']);
assert.deepEqual(await router.listModels({ signal }), ['nvidia/a', 'local:qwen', 'local:llama']);

assert.throws(() => router.resolve('other'), /INVALID_MODEL_PROVIDER/);
assert.throws(() => router.resolve('local', { toolsRequired: true }), /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/);
await assert.rejects(() => router.complete({ provider: 'local' }), /INVALID_PROVIDER_PAYLOAD/);

const localCallsBeforeToolChecks = calls.filter(([kind]) => kind.startsWith('local-')).length;
const blockedLocalPayloads = [
  { model: 'local:qwen', tools: [{ type: 'function', function: { name: 'send_email' } }] },
  { model: 'local:qwen', tools: [] },
  { model: 'local:qwen', functions: [{ name: 'legacy_send' }] },
  { model: 'local:qwen', functions: [] },
  { model: 'local:qwen', tool_choice: 'auto' },
  { model: 'local:qwen', tool_choice: 'none' },
  { model: 'local:qwen', tool_choice: { type: 'function', function: { name: 'write_file' } } },
  { model: 'local:qwen', function_call: 'auto' },
  { model: 'local:qwen', function_call: 'none' },
  { model: 'local:qwen', function_call: { name: 'legacy_write' } }
];
for (const payload of blockedLocalPayloads) {
  await assert.rejects(
    () => router.complete({ provider: 'local', payload }),
    /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/
  );
  await assert.rejects(
    () => router.stream({ provider: 'local', payload }),
    /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/
  );
}
assert.equal(
  calls.filter(([kind]) => kind.startsWith('local-')).length,
  localCallsBeforeToolChecks,
  'blocked local tool payloads must never reach the local provider adapter'
);

assert.deepEqual(await router.complete({
  provider: 'nvidia',
  payload: { model: 'nvidia/a', tools: [{ type: 'function', function: { name: 'approved_tool' } }], tool_choice: 'auto' }
}), { provider: 'nvidia', result: { id: 'nvidia-result' } }, 'tool payloads remain available to NVIDIA where backend permissions approve them');

const disabled = createModelProviderRouter({
  nvidiaComplete: async () => ({}),
  nvidiaStream: async () => chunks('nvidia'),
  nvidiaListModels: async () => ['nvidia/a'],
  localEnabled: false
});
assert.throws(() => disabled.resolve('local'), /LOCAL_PROVIDER_NOT_ENABLED/);
assert.deepEqual(await disabled.listModels(), ['nvidia/a']);
assert.throws(() => createModelProviderRouter({}), /INVALID_PROVIDER_ROUTER:nvidiaComplete/);
assert.throws(() => createModelProviderRouter({
  nvidiaComplete: async () => ({}), nvidiaStream: async () => chunks('x'), nvidiaListModels: async () => [], localEnabled: 'yes'
}), /INVALID_PROVIDER_ROUTER:localEnabled/);

console.log('model provider router tests passed: NVIDIA default plus local provider tool payload default-deny verified');
