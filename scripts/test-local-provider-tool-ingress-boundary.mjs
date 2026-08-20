import assert from 'node:assert/strict';
import { createLocalOllamaProvider } from '../lib/local-ollama-provider.mjs';

const BASE_REQUEST = Object.freeze({
  model: 'local:qwen2.5:7b',
  messages: Object.freeze([{ role: 'user', content: 'Merhaba Hafize' }])
});

function expectCode(code) {
  return (error) => {
    assert.equal(error?.code, code);
    assert.equal(error?.status, 400);
    return true;
  };
}

function createNoNetworkProvider() {
  let calls = 0;
  const provider = createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async () => {
      calls += 1;
      throw new Error('network must not be reached');
    }
  });
  return { provider, calls: () => calls };
}

for (const tools of [[], null, undefined, [{ type: 'function', function: { name: 'anything' } }]]) {
  const { provider, calls } = createNoNetworkProvider();
  await assert.rejects(
    provider.complete({ ...BASE_REQUEST, tools }),
    expectCode('LOCAL_PROVIDER_TOOLS_UNSUPPORTED'),
    `complete must reject own tools field before fetch: ${String(tools)}`
  );
  assert.equal(calls(), 0);
}

for (const toolChoice of ['none', 'auto', null, undefined, { type: 'function', function: { name: 'anything' } }]) {
  const { provider, calls } = createNoNetworkProvider();
  await assert.rejects(
    provider.complete({ ...BASE_REQUEST, tool_choice: toolChoice }),
    expectCode('LOCAL_PROVIDER_TOOLS_UNSUPPORTED'),
    `complete must reject own tool_choice field before fetch: ${String(toolChoice)}`
  );
  assert.equal(calls(), 0);
}

{
  const { provider, calls } = createNoNetworkProvider();
  const request = Object.create({ tools: [{ type: 'function' }] });
  Object.assign(request, BASE_REQUEST);
  await assert.rejects(provider.complete(request), /network must not be reached/);
  assert.equal(calls(), 1, 'inherited properties are not treated as request payload fields');
}

{
  const { provider, calls } = createNoNetworkProvider();
  const streamPromise = provider.stream({ ...BASE_REQUEST, tools: [] });
  await assert.rejects(streamPromise, expectCode('LOCAL_PROVIDER_TOOLS_UNSUPPORTED'));
  assert.equal(calls(), 0, 'stream tool payload is rejected before opening an upstream response');
}

{
  let calls = 0;
  let captured = null;
  const provider = createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async (_url, options) => {
      calls += 1;
      captured = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        text: async () => JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Selam' } }]
        })
      };
    }
  });

  const result = await provider.complete(BASE_REQUEST);
  assert.equal(calls, 1);
  assert.equal(result.choices[0].message.content, 'Selam');
  assert.equal(captured.model, 'qwen2.5:7b');
  assert.equal(captured.stream, false);
  assert.equal(Object.hasOwn(captured, 'tools'), false);
  assert.equal(Object.hasOwn(captured, 'tool_choice'), false);
}

{
  let calls = 0;
  const provider = createLocalOllamaProvider({
    enabled: true,
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
        text: async () => JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'ok' } }]
        })
      };
    }
  });

  await assert.rejects(
    provider.complete({ ...BASE_REQUEST, unknown_tool_policy: 'auto' }),
    (error) => error?.code === 'INVALID_LOCAL_PROVIDER_FIELD'
  );
  assert.equal(calls, 0, 'unknown request fields remain fail-closed before fetch');
}

console.log('local provider tool ingress boundary tests passed');
