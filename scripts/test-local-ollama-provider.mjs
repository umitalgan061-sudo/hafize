import assert from 'node:assert/strict';
import {
  createLocalOllamaProvider,
  isLocalProviderModel,
  LOCAL_PROVIDER_DEFAULTS
} from '../lib/local-ollama-provider.mjs';

assert.equal(LOCAL_PROVIDER_DEFAULTS.baseUrl, 'http://127.0.0.1:11434/v1');
assert.equal(LOCAL_PROVIDER_DEFAULTS.modelPrefix, 'local:');
assert.equal(isLocalProviderModel('local:qwen3'), true);
assert.equal(isLocalProviderModel(' qwen3 '), false);

const disabled = createLocalOllamaProvider({ enabled: false, fetchImpl: async () => { throw new Error('must not run'); } });
assert.equal(disabled.configured, false);
await assert.rejects(
  () => disabled.complete({ model: 'local:qwen3', messages: [{ role: 'user', content: 'hi' }] }),
  /LOCAL_PROVIDER_NOT_ENABLED/
);
assert.deepEqual(await disabled.listModels(), []);

for (const baseUrl of [
  'https://127.0.0.1:11434/v1',
  'http://192.168.1.20:11434/v1',
  'http://example.com:11434/v1',
  'http://user:pass@localhost:11434/v1',
  'http://localhost:11434/v1?token=x'
]) {
  assert.throws(() => createLocalOllamaProvider({ enabled: true, baseUrl, fetchImpl: async () => null }));
}

const calls = [];
const provider = createLocalOllamaProvider({
  enabled: 'true',
  baseUrl: 'http://localhost:11434/v1/',
  async fetchImpl(url, init = {}) {
    calls.push({ url, init });
    if (String(url).endsWith('/models')) {
      return {
        ok: true,
        async json() {
          return { data: [{ id: 'qwen3' }, { id: 'gemma3' }, { id: '' }, { nope: true }] };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          id: 'chatcmpl-local',
          choices: [{ index: 0, message: { role: 'assistant', content: 'local answer' }, finish_reason: 'stop' }]
        };
      }
    };
  }
});
assert.equal(provider.configured, true);

const response = await provider.complete({
  model: 'local:qwen3',
  messages: [
    { role: 'system', content: 'backend policy' },
    { role: 'user', content: 'merhaba' }
  ],
  max_tokens: 999999,
  temperature: 5,
  top_p: -2,
  stream: true
});
assert.equal(response.choices[0].message.content, 'local answer');
assert.equal(calls[0].url, 'http://localhost:11434/v1/chat/completions');
assert.equal(calls[0].init.method, 'POST');
assert.equal('Authorization' in calls[0].init.headers, false);
const request = JSON.parse(calls[0].init.body);
assert.equal(request.model, 'qwen3');
assert.equal(request.stream, false);
assert.equal(request.max_tokens, 32768);
assert.equal(request.temperature, 2);
assert.equal(request.top_p, 0);
assert.equal(request.messages[0].role, 'system');

assert.deepEqual(await provider.listModels(), ['local:qwen3', 'local:gemma3']);
assert.equal(calls[1].url, 'http://localhost:11434/v1/models');

const toolCalls = [];
const toolsProvider = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl(url, init) {
    toolCalls.push(JSON.parse(init.body));
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'safe_read', arguments: '{}' } }] } }]
        };
      }
    };
  }
});
await toolsProvider.complete({
  model: 'local:qwen3',
  messages: [{ role: 'user', content: 'read' }],
  tools: [{ type: 'function', function: { name: 'safe_read', description: 'read', parameters: { type: 'object', properties: {} } } }],
  tool_choice: 'auto'
});
assert.equal(toolCalls[0].tools[0].function.name, 'safe_read');
assert.equal(toolCalls[0].tool_choice, 'auto');

for (const input of [
  { model: 'qwen3', messages: [{ role: 'user', content: 'x' }] },
  { model: 'local:', messages: [{ role: 'user', content: 'x' }] },
  { model: 'local:qwen3', messages: [] },
  { model: 'local:qwen3', messages: [{ role: 'developer', content: 'x' }] },
  { model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }], apiKey: 'secret' }
]) {
  await assert.rejects(() => provider.complete(input));
}

const badJson = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl() { return { ok: true, async json() { throw new Error('/private/path'); } }; }
});
await assert.rejects(() => badJson.complete({ model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }] }), /INVALID_LOCAL_PROVIDER_RESPONSE/);

const providerFailure = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl() { return { ok: false, status: 500, async json() { return { secret: 'do not expose' }; } }; }
});
await assert.rejects(() => providerFailure.complete({ model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }] }), (error) => {
  assert.equal(error.code, 'LOCAL_PROVIDER_FAILED');
  assert.equal(error.message.includes('secret'), false);
  return true;
});

const controller = new AbortController();
const abortProvider = createLocalOllamaProvider({
  enabled: true,
  async fetchImpl(_url, { signal }) {
    controller.abort();
    signal.throwIfAborted();
  }
});
await assert.rejects(
  () => abortProvider.complete({ model: 'local:qwen3', messages: [{ role: 'user', content: 'x' }] }, { signal: controller.signal }),
  /LOCAL_PROVIDER_CANCELLED/
);

console.log('local Ollama provider boundary tests passed');
