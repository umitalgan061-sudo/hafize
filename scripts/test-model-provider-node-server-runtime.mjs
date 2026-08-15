import assert from 'node:assert/strict';
import { createModelProviderNodeServerRuntime } from '../lib/model-provider-node-server-runtime.mjs';

const calls = [];
const env = { NVIDIA_API_KEY: 'server-only', HAFIZE_LOCAL_PROVIDER_ENABLED: 'true' };
const fetchImpl = async () => { throw new Error('network should be injected through provider only'); };
const registry = { defaultAgent: 'minimal-engineer', agents: [{ id: 'minimal-engineer' }] };
const baseCompactor = { prepare() {}, thresholdTokens: 100, contextLimitTokens: 1000 };
const readJson = async () => ({ model: 'local:test' });
const sendJson = () => {};
const setSecurityHeaders = () => {};

const provider = {
  nvidiaConfigured: true,
  localConfigured: true,
  defaultProvider: 'nvidia',
  async complete(payload, options) {
    calls.push(['complete', payload, options]);
    return { ok: true, value: { provider: 'local', result: { choices: [{ message: { content: 'summary' } }] } } };
  },
  async stream() {
    return { ok: true, value: { provider: 'local', result: (async function* () { yield 'data: ok\n\n'; })() } };
  },
  async listModels() {
    return { ok: true, value: ['nvidia-a', 'local:test'] };
  }
};

let capturedProviderComplete = null;
let capturedContextCompactor = null;
let capturedPrepareChat = null;
let capturedHttpProvider = null;
let capturedNodeRuntime = null;

const runtime = createModelProviderNodeServerRuntime({
  env,
  fetchImpl,
  registry,
  baseCompactor,
  readJson,
  sendJson,
  setSecurityHeaders,
  createProvider(input) {
    assert.equal(input.env, env);
    assert.equal(input.fetchImpl, fetchImpl);
    calls.push(['provider']);
    return provider;
  },
  createProviderCompactor(input) {
    assert.equal(input.baseCompactor, baseCompactor);
    assert.equal(input.complete, provider.complete);
    capturedProviderComplete = input.complete;
    calls.push(['providerCompactor']);
    return {
      supportsLocalModels: true,
      thresholdTokens: 100,
      async prepare(messages, options) {
        calls.push(['compact', messages, options]);
        return { messages, meta: { compacted: false, beforeTokens: 10, afterTokens: 10 } };
      }
    };
  },
  createChatPreparer(input) {
    assert.equal(input.registry, registry);
    capturedContextCompactor = input.contextCompactor;
    calls.push(['chatPreparer']);
    return {
      async prepare(body, options) {
        calls.push(['prepareChat', body, options]);
        return { payload: { model: body.model, messages: [] }, headers: { 'X-Hafize-Trace-Id': 'trace' } };
      }
    };
  },
  createHttpApi(input) {
    capturedHttpProvider = input.provider;
    capturedPrepareChat = input.prepareChat;
    assert.equal(input.readJson, readJson);
    calls.push(['httpApi']);
    return {
      async handle(request) {
        calls.push(['httpHandle', request]);
        return { matched: true, kind: 'json', status: 200, body: { ok: true } };
      }
    };
  },
  createNodeRoute(input) {
    capturedNodeRuntime = input.runtime;
    assert.equal(input.sendJson, sendJson);
    assert.equal(input.setSecurityHeaders, setSecurityHeaders);
    calls.push(['nodeRoute']);
    return {
      async handle(request) {
        calls.push(['nodeHandle', request]);
        return input.runtime.handle(request);
      }
    };
  }
});

assert.equal(runtime.nvidiaConfigured, true);
assert.equal(runtime.localConfigured, true);
assert.equal(runtime.defaultProvider, 'nvidia');
assert.equal(runtime.contextCompactionConfigured, true);
assert.equal(typeof runtime.handle, 'function');
assert.equal('provider' in runtime, false);
assert.equal('complete' in runtime, false);
assert.equal(capturedHttpProvider, provider);
assert.equal(capturedProviderComplete, provider.complete);
assert.equal(capturedContextCompactor.supportsLocalModels, true);
assert.equal(capturedNodeRuntime instanceof Object, true);

const prepared = await capturedPrepareChat({ model: 'local:test' }, { signal: null });
assert.equal(prepared.payload.model, 'local:test');

const result = await runtime.handle({ method: 'GET', pathname: '/api/models' });
assert.deepEqual(result, { matched: true, kind: 'json', status: 200, body: { ok: true } });
assert.deepEqual(
  calls.filter(([name]) => ['provider', 'providerCompactor', 'chatPreparer', 'httpApi', 'nodeRoute'].includes(name)).map(([name]) => name),
  ['provider', 'providerCompactor', 'chatPreparer', 'httpApi', 'nodeRoute']
);

console.log('model provider node server runtime composition tests passed');
