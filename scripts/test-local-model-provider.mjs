import assert from 'node:assert/strict';
import { createLocalModelProvider } from '../lib/local-model-provider.mjs';

let captured;
const provider = createLocalModelProvider({
  fetchImpl: async (url, init) => {
    captured = { url, headers: init.headers, body: JSON.parse(init.body) };
    return {
      ok: true,
      text: async () => JSON.stringify({
        model: 'llama3.2:3b', done: true,
        message: { role: 'assistant', content: 'Yerel yanıt' }
      })
    };
  }
});

const result = await provider.complete({
  model: 'llama3.2:3b',
  messages: [{ role: 'user', content: 'Merhaba' }],
  temperature: 3,
  top_p: -1,
  max_tokens: 9000
});
assert.equal(provider.kind, 'local');
assert.equal(provider.baseUrl, 'http://127.0.0.1:11434');
assert.equal(captured.url, 'http://127.0.0.1:11434/api/chat');
assert.deepEqual(captured.body.options, { temperature: 2, top_p: 0, num_predict: 8192 });
assert.equal('Authorization' in captured.headers, false);
assert.equal(result.choices[0].message.content, 'Yerel yanıt');
assert.equal(result.choices[0].finish_reason, 'stop');

assert.throws(
  () => createLocalModelProvider({ baseUrl: 'file:///tmp/local', fetchImpl: async () => ({}) }),
  /INVALID_LOCAL_PROVIDER:baseUrl/
);
await assert.rejects(
  () => provider.complete({ model: '../bad', messages: [{ role: 'user', content: 'x' }] }),
  /INVALID_LOCAL_PROVIDER:model/
);
await assert.rejects(
  () => provider.complete({ model: 'llama3', messages: [{ role: 'tool', content: 'x' }] }),
  /INVALID_LOCAL_PROVIDER:messages.role/
);

const malformed = createLocalModelProvider({
  fetchImpl: async () => ({ ok: true, text: async () => '{}' })
});
await assert.rejects(
  () => malformed.complete({ model: 'llama3', messages: [{ role: 'user', content: 'x' }] }),
  /INVALID_LOCAL_PROVIDER_RESPONSE/
);

console.log('local model provider tests passed');
