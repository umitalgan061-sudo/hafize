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
    return { ok: true, body };
  }
});

const stream = await provider.stream({
  model: 'local:qwen3',
  messages: [{ role: 'user', content: 'Merhaba' }],
  tools: [{ type: 'function', function: { name: 'read_only', parameters: { type: 'object', properties: {} } } }],
  tool_choice: 'auto'
});
assert.equal(stream, body);
assert.equal(calls.length, 1);
assert.equal(calls[0].init.headers.Accept, 'text/event-stream');
const payload = JSON.parse(calls[0].init.body);
assert.equal(payload.stream, true);
assert.equal(payload.model, 'qwen3');
assert.equal(payload.tools[0].function.name, 'read_only');

const invalid = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl() { return { ok: true, body: null }; }
});
await assert.rejects(
  () => invalid.stream({ model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }] }),
  /INVALID_LOCAL_PROVIDER_STREAM/
);

console.log('local Ollama streaming boundary tests passed');
