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
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/event-stream; charset=utf-8' : null },
      body
    };
  }
});

const stream = await provider.stream({
  model: 'local:qwen3',
  messages: [{ role: 'user', content: 'Merhaba' }]
});
const chunks = [];
for await (const chunk of stream) chunks.push(Buffer.from(chunk).toString('utf8'));
assert.deepEqual(chunks, [
  'data: {"choices":[{"delta":{"content":"mer"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":"haba"}}]}\n\n'
]);
assert.equal(calls.length, 1);
assert.equal(calls[0].init.headers.Accept, 'text/event-stream');
const payload = JSON.parse(calls[0].init.body);
assert.equal(payload.stream, true);
assert.equal(payload.model, 'qwen3');
assert.equal(Object.hasOwn(payload, 'tools'), false);
assert.equal(Object.hasOwn(payload, 'tool_choice'), false);

const callsBeforeToolRequest = calls.length;
await assert.rejects(
  () => provider.stream({
    model: 'local:qwen3',
    messages: [{ role: 'user', content: 'Merhaba' }],
    tools: [{ type: 'function', function: { name: 'read_only', parameters: { type: 'object', properties: {} } } }],
    tool_choice: 'auto'
  }),
  (error) => {
    assert.equal(error?.code, 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED');
    assert.equal(error?.status, 400);
    return true;
  }
);
assert.equal(calls.length, callsBeforeToolRequest, 'tool-bearing stream request must fail before upstream fetch');

const invalid = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl() {
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/event-stream' : null },
      body: null
    };
  }
});
await assert.rejects(
  () => invalid.stream({ model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }] }),
  /INVALID_LOCAL_PROVIDER_STREAM/
);

console.log('local Ollama streaming boundary tests passed: media type, bounded iteration, tool denial and invalid body verified');
