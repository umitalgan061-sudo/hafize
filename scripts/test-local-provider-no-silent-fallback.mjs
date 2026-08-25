import assert from 'node:assert/strict';
import { createLocalProviderServerRuntime } from '../lib/local-provider-server-runtime.mjs';

let nvidiaCompletions = 0;
let nvidiaStreams = 0;
let localFetches = 0;
const runtime = createLocalProviderServerRuntime({
  env: { HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' },
  nvidiaComplete: async () => {
    nvidiaCompletions += 1;
    return { choices: [{ message: { role: 'assistant', content: 'nvidia' } }] };
  },
  nvidiaStream: async function* () {
    nvidiaStreams += 1;
    yield Buffer.from('nvidia');
  },
  nvidiaListModels: async () => ['meta/llama'],
  fetchImpl: async () => {
    localFetches += 1;
    const error = new Error('local offline');
    error.name = 'TypeError';
    throw error;
  }
});

assert.equal(runtime.defaultProvider, 'nvidia');
assert.equal(runtime.resolve(null, { model: 'meta/llama' }), 'nvidia');
assert.equal(runtime.resolve(null, { model: 'local:llama3' }), 'local');

const nvidia = await runtime.complete({
  payload: { model: 'meta/llama', messages: [{ role: 'user', content: 'x' }] },
  toolsRequired: false
});
assert.equal(nvidia.provider, 'nvidia');
assert.equal(nvidia.result.choices[0].message.content, 'nvidia');
assert.equal(nvidiaCompletions, 1);
assert.equal(localFetches, 0);

await assert.rejects(
  runtime.complete({
    payload: { model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] },
    toolsRequired: false
  }),
  (error) => error?.code === 'LOCAL_PROVIDER_UNAVAILABLE'
);
assert.equal(localFetches, 1);
assert.equal(nvidiaCompletions, 1, 'local failure must not silently fall back to NVIDIA');

await assert.rejects(
  runtime.complete({
    payload: { model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] },
    toolsRequired: true
  }),
  (error) => error?.code === 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED'
);
assert.equal(localFetches, 1, 'tool rejection happens before local network access');
assert.equal(nvidiaCompletions, 1, 'tool rejection must not fall back to NVIDIA');

await assert.rejects(
  runtime.stream({
    payload: { model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] },
    toolsRequired: false
  }),
  (error) => error?.code === 'LOCAL_PROVIDER_UNAVAILABLE'
);
assert.equal(nvidiaStreams, 0, 'local stream failure must not fall back to NVIDIA');

const models = await runtime.listModels();
assert.deepEqual(models, ['meta/llama']);
assert.equal(localFetches, 3, 'model discovery attempts local provider independently and fails soft');

console.log('local provider no-silent-fallback routing tests passed');
