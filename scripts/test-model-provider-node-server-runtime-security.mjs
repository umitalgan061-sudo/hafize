import assert from 'node:assert/strict';
import { createModelProviderNodeServerRuntime } from '../lib/model-provider-node-server-runtime.mjs';

const validProvider = {
  nvidiaConfigured: false,
  localConfigured: true,
  defaultProvider: 'local',
  complete() {},
  stream() {},
  listModels() {}
};
const base = {
  registry: { defaultAgent: 'minimal-engineer', agents: [] },
  baseCompactor: { prepare() {}, thresholdTokens: 10 },
  readJson() {},
  sendJson() {},
  setSecurityHeaders() {},
  createProvider: () => validProvider,
  createProviderCompactor: () => ({ supportsLocalModels: true, prepare() {} }),
  createChatPreparer: () => ({ prepare() {} }),
  createHttpApi: () => ({ handle() {} }),
  createNodeRoute: () => ({ handle() {} })
};

const local = createModelProviderNodeServerRuntime(base);
assert.equal(local.nvidiaConfigured, false);
assert.equal(local.localConfigured, true);
assert.equal(local.defaultProvider, 'local');
assert.equal('env' in local, false);
assert.equal('fetchImpl' in local, false);
assert.equal('readJson' in local, false);
assert.equal('sendJson' in local, false);

for (const [label, mutate, pattern] of [
  ['provider factory', (input) => { input.createProvider = null; }, /createProvider/],
  ['compactor factory', (input) => { input.createProviderCompactor = null; }, /createProviderCompactor/],
  ['preparer factory', (input) => { input.createChatPreparer = null; }, /createChatPreparer/],
  ['http factory', (input) => { input.createHttpApi = null; }, /createHttpApi/],
  ['node factory', (input) => { input.createNodeRoute = null; }, /createNodeRoute/],
  ['read json', (input) => { input.readJson = null; }, /readJson/],
  ['json writer', (input) => { input.sendJson = null; }, /sendJson/],
  ['security headers', (input) => { input.setSecurityHeaders = null; }, /setSecurityHeaders/]
]) {
  const input = { ...base };
  mutate(input);
  assert.throws(() => createModelProviderNodeServerRuntime(input), pattern, label);
}

for (const invalidProvider of [
  null,
  {},
  { complete() {}, stream() {} },
  { complete() {}, listModels() {} },
  { stream() {}, listModels() {} }
]) {
  assert.throws(
    () => createModelProviderNodeServerRuntime({ ...base, createProvider: () => invalidProvider }),
    /INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:provider/
  );
}

for (const invalidCompactor of [
  null,
  {},
  { prepare() {} },
  { supportsLocalModels: true }
]) {
  assert.throws(
    () => createModelProviderNodeServerRuntime({ ...base, createProviderCompactor: () => invalidCompactor }),
    /INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:contextCompactor/
  );
}

assert.throws(
  () => createModelProviderNodeServerRuntime({ ...base, createChatPreparer: () => ({}) }),
  /INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:chatPreparer/
);
assert.throws(
  () => createModelProviderNodeServerRuntime({ ...base, createHttpApi: () => ({}) }),
  /INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:httpApi/
);
assert.throws(
  () => createModelProviderNodeServerRuntime({ ...base, createNodeRoute: () => ({}) }),
  /INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:nodeRoute/
);

const secret = 'do-not-expose-provider-secret';
const isolated = createModelProviderNodeServerRuntime({
  ...base,
  env: { NVIDIA_API_KEY: secret },
  createProvider: () => ({ ...validProvider, secret })
});
assert.equal(JSON.stringify(isolated).includes(secret), false);
assert.deepEqual(Object.keys(isolated).sort(), [
  'contextCompactionConfigured',
  'defaultProvider',
  'handle',
  'localConfigured',
  'nvidiaConfigured'
]);

console.log('model provider node server runtime security tests passed');
