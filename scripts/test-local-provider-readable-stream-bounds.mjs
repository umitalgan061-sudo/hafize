import assert from 'node:assert/strict';
import { createLocalOllamaProvider, LOCAL_PROVIDER_DEFAULTS } from '../lib/local-ollama-provider.mjs';

function makeHeaders(contentType = 'application/json') {
  return { get(name) { return String(name).toLowerCase() === 'content-type' ? contentType : null; } };
}

function bodyFrom(chunks, state) {
  return {
    getReader() {
      let index = 0;
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: chunks[index++] };
        },
        async cancel() { state.cancelled += 1; },
        releaseLock() { state.released += 1; }
      };
    }
  };
}

const validText = JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'streamed-json' } }] });
const validBytes = Buffer.from(validText, 'utf8');
const validState = { cancelled: 0, released: 0 };
const validProvider = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: makeHeaders(),
    body: bodyFrom([validBytes.subarray(0, 8), validBytes.subarray(8)], validState)
  })
});
const valid = await validProvider.complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] });
assert.equal(valid.choices[0].message.content, 'streamed-json');
assert.equal(validState.cancelled, 0);
assert.equal(validState.released, 1);

const oversizedState = { cancelled: 0, released: 0 };
const oversizedProvider = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: makeHeaders(),
    body: bodyFrom([
      Buffer.alloc(LOCAL_PROVIDER_DEFAULTS.maxCompletionJsonBytes, 0x20),
      Buffer.from('x')
    ], oversizedState)
  })
});
await assert.rejects(
  oversizedProvider.complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'LOCAL_PROVIDER_RESPONSE_TOO_LARGE'
);
assert.equal(oversizedState.cancelled, 1);
assert.equal(oversizedState.released, 1);

const invalidState = { cancelled: 0, released: 0 };
const invalidProvider = createLocalOllamaProvider({
  enabled: true,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    headers: makeHeaders(),
    body: bodyFrom(['not-bytes'], invalidState)
  })
});
await assert.rejects(
  invalidProvider.complete({ model: 'local:llama3', messages: [{ role: 'user', content: 'x' }] }),
  (error) => error?.code === 'INVALID_LOCAL_PROVIDER_RESPONSE'
);
assert.equal(invalidState.released, 1);

console.log('local provider ReadableStream JSON boundary tests passed');
