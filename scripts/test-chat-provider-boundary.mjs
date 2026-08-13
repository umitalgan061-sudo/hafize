import assert from 'node:assert/strict';
import { createChatProviderBoundary } from '../lib/chat-provider-boundary.mjs';

const resolveCalls = [];
const completeCalls = [];
const runtime = {
  resolve(provider, options) {
    resolveCalls.push({ provider, options });
    const selected = provider == null || provider === '' ? 'nvidia' : provider;
    if (selected === 'local' && options?.toolsRequired) throw new Error('LOCAL_PROVIDER_TOOLS_UNSUPPORTED');
    if (!['nvidia', 'local'].includes(selected)) throw new Error('INVALID_MODEL_PROVIDER');
    return selected;
  },
  async complete(input) {
    completeCalls.push(input);
    return { provider: input.provider, result: { choices: [{ message: { role: 'assistant', content: 'ok' } }] } };
  }
};

const boundary = createChatProviderBoundary({ runtime });
assert.deepEqual(boundary.resolve({}), {
  provider: 'nvidia',
  agentMode: false,
  toolsRequired: false,
  responseMode: 'stream'
});
assert.deepEqual(boundary.resolve({ provider: 'local' }), {
  provider: 'local',
  agentMode: false,
  toolsRequired: false,
  responseMode: 'buffered'
});
assert.deepEqual(resolveCalls[1], { provider: 'local', options: { toolsRequired: false } });

assert.throws(
  () => boundary.resolve({ provider: 'local', toolsRequired: true }),
  /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/
);
assert.throws(
  () => boundary.resolve({ provider: 'local', agentMode: true }),
  /LOCAL_PROVIDER_TOOLS_UNSUPPORTED/
);
assert.throws(() => boundary.resolve({ provider: 'other' }), /INVALID_MODEL_PROVIDER/);
assert.throws(() => boundary.resolve({ provider: 'local', extra: true }), /INVALID_CHAT_PROVIDER_BOUNDARY:field/);
assert.throws(() => boundary.resolve({ provider: 'local', agentMode: 'false' }), /INVALID_CHAT_PROVIDER_BOUNDARY:agentMode/);
assert.throws(() => createChatProviderBoundary({ runtime: {} }), /INVALID_CHAT_PROVIDER_BOUNDARY:runtime/);

const payload = { model: 'llama-test', messages: [{ role: 'user', content: 'merhaba' }] };
const signal = new AbortController().signal;
const local = await boundary.completeLocal({ provider: 'local', payload, signal });
assert.equal(local.choices[0].message.content, 'ok');
assert.equal(completeCalls.length, 1);
assert.deepEqual(completeCalls[0], { provider: 'local', payload, signal, toolsRequired: false });
assert.throws(() => boundary.completeLocal({ provider: 'nvidia', payload }), /LOCAL_PROVIDER_REQUIRED/);

const badBoundary = createChatProviderBoundary({
  runtime: {
    resolve: () => 'local',
    complete: async () => ({ provider: 'nvidia', result: {} })
  }
});
await assert.rejects(
  () => badBoundary.completeLocal({ provider: 'local', payload }),
  /INVALID_LOCAL_PROVIDER_RESULT/
);

console.log('chat provider boundary tests passed');
