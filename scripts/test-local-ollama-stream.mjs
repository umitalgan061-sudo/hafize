import assert from 'node:assert/strict';
import { createLocalOllamaProvider } from '../lib/local-ollama-provider.mjs';

const calls = [];
const body = {
  async *[Symbol.asyncIterator]() {
    yield Buffer.from('data: {"choices":[{"delta":{"content":"mer"}}]}\n\n');
    yield Buffer.from('data: {"choices":[{"delta":{"content":"haba"}}]}\n\n');
  }
};
const provider = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl(url, init) {
    calls.push({ url, init });
    return {
      ok: true,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/event-stream' : null },
      body
    };
  }
});

const stream = await provider.stream({
  model: 'local:qwen3',
  messages: [{ role: 'user', content: 'Merhaba' }]
});
assert.notEqual(stream, body);
assert.equal(typeof stream[Symbol.asyncIterator], 'function');
assert.equal(calls.length, 1);
assert.equal(calls[0].init.headers.Accept, 'text/event-stream');
const payload = JSON.parse(calls[0].init.body);
assert.equal(payload.stream, true);
assert.equal(payload.model, 'qwen3');

await assert.rejects(
  () => provider.stream({
    model: 'local:qwen3',
    messages: [{ role: 'user', content: 'read' }],
    tools: [{ type: 'function', function: { name: 'read_only', parameters: { type: 'object', properties: {} } } }],
    tool_choice: 'auto'
  }),
  (error) => error?.code === 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED' && error?.status === 400
);
assert.equal(calls.length, 1);

const invalid = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl() {
    return {
      ok: true,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/event-stream' : null },
      body: null
    };
  }
});
await assert.rejects(
  () => invalid.stream({ model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }] }),
  /INVALID_LOCAL_PROVIDER_STREAM/
);

console.log('local Ollama streaming boundary tests passed');
