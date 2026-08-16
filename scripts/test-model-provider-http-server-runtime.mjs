import assert from 'node:assert/strict';
import { createModelProviderHttpServerRuntime } from '../lib/model-provider-http-server-runtime.mjs';

const env = { NVIDIA_API_KEY: 'server-only', HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' };
const fetchImpl = async () => { throw new Error('not used'); };
const calls = [];
const provider = {
  nvidiaConfigured: true,
  localConfigured: true,
  defaultProvider: 'nvidia',
  async listModels({ signal }) {
    calls.push(['models', signal]);
    return { ok: true, status: 200, value: { models: ['nvidia/a', 'local:b'] } };
  },
  async stream(payload, options) {
    calls.push(['stream', payload, options]);
    return { ok: true, status: 200, value: { provider: 'local', body: (async function* () { yield Buffer.from('data: ok\n\n'); })() } };
  }
};
let providerArgs;
let prepareArgs;
const runtime = createModelProviderHttpServerRuntime({
  env,
  fetchImpl,
  readJson: async (request) => request.body,
  async prepareChat(body, context) {
    prepareArgs = [body, context];
    return { payload: { model: body.model, messages: [{ role: 'user', content: body.text }], stream: true } };
  },
  createProvider(args) { providerArgs = args; return provider; }
});

assert.equal(runtime.nvidiaConfigured, true);
assert.equal(runtime.localConfigured, true);
assert.equal(runtime.defaultProvider, 'nvidia');
assert.equal(providerArgs.env, env);
assert.equal(providerArgs.fetchImpl, fetchImpl);
assert.equal('provider' in runtime, false);

const models = await runtime.handle({ method: 'GET', pathname: '/api/models' });
assert.deepEqual(models.body.models, ['nvidia/a', 'local:b']);

const controller = new AbortController();
const chat = await runtime.handle({
  request: { body: { model: 'local:b', text: 'hello' } },
  method: 'POST', pathname: '/api/chat', headers: { 'x-request-id': 'r1' }, signal: controller.signal
});
assert.equal(chat.kind, 'stream');
assert.equal(chat.provider, 'local');
assert.deepEqual(prepareArgs[0], { model: 'local:b', text: 'hello' });
assert.equal(prepareArgs[1].signal, controller.signal);
assert.equal(prepareArgs[1].headers['x-request-id'], 'r1');
assert.equal(calls[1][2].signal, controller.signal);

for (const input of [
  {},
  { readJson() {}, prepareChat() {}, createProvider: null },
  { readJson() {}, prepareChat() {}, createProvider: () => ({}) },
  { readJson() {}, prepareChat() {}, createProvider: () => provider, createHttpApi: () => ({}) }
]) {
  assert.throws(() => createModelProviderHttpServerRuntime(input), /INVALID_MODEL_PROVIDER_HTTP_SERVER_RUNTIME/);
}

console.log('model provider http server runtime tests passed');
