import { createModelProviderProductionRuntime } from './model-provider-production-runtime.mjs';
import { createModelProviderContextCompactor } from './model-provider-context-compaction.mjs';
import { createModelProviderChatPreparer } from './model-provider-chat-preparation.mjs';
import { createModelProviderHttpApi } from './model-provider-http-api.mjs';
import { createModelProviderNodeHttpRoute } from './model-provider-node-http-route.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireFunction(value, label) {
  if (typeof value !== 'function') fail(`INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:${label}`);
  return value;
}

function requireProvider(value) {
  if (
    !value
    || typeof value.complete !== 'function'
    || typeof value.stream !== 'function'
    || typeof value.listModels !== 'function'
  ) {
    fail('INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:provider');
  }
  return value;
}

function requireHandle(value, label) {
  if (!value || typeof value.handle !== 'function') {
    fail(`INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:${label}`);
  }
  return value;
}

export function createModelProviderNodeServerRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  registry,
  baseCompactor,
  readJson,
  sendJson,
  setSecurityHeaders,
  createProvider = createModelProviderProductionRuntime,
  createProviderCompactor = createModelProviderContextCompactor,
  createChatPreparer = createModelProviderChatPreparer,
  createHttpApi = createModelProviderHttpApi,
  createNodeRoute = createModelProviderNodeHttpRoute
} = {}) {
  const providerFactory = requireFunction(createProvider, 'createProvider');
  const providerCompactorFactory = requireFunction(createProviderCompactor, 'createProviderCompactor');
  const chatPreparerFactory = requireFunction(createChatPreparer, 'createChatPreparer');
  const httpApiFactory = requireFunction(createHttpApi, 'createHttpApi');
  const nodeRouteFactory = requireFunction(createNodeRoute, 'createNodeRoute');
  requireFunction(readJson, 'readJson');
  requireFunction(sendJson, 'sendJson');
  requireFunction(setSecurityHeaders, 'setSecurityHeaders');

  const provider = requireProvider(providerFactory({ env, fetchImpl }));
  const contextCompactor = providerCompactorFactory({
    baseCompactor,
    complete: provider.complete
  });
  if (
    !contextCompactor
    || typeof contextCompactor.prepare !== 'function'
    || contextCompactor.supportsLocalModels !== true
  ) {
    fail('INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:contextCompactor');
  }

  const chatPreparer = createChatPreparer({ registry, contextCompactor });
  if (!chatPreparer || typeof chatPreparer.prepare !== 'function') {
    fail('INVALID_MODEL_PROVIDER_NODE_SERVER_RUNTIME:chatPreparer');
  }

  const httpApi = requireHandle(httpApiFactory({
    provider,
    readJson,
    prepareChat: chatPreparer.prepare
  }), 'httpApi');
  const route = requireHandle(nodeRouteFactory({
    runtime: httpApi,
    sendJson,
    setSecurityHeaders
  }), 'nodeRoute');

  return Object.freeze({
    nvidiaConfigured: provider.nvidiaConfigured === true,
    localConfigured: provider.localConfigured === true,
    defaultProvider: provider.defaultProvider === 'local' ? 'local' : 'nvidia',
    contextCompactionConfigured: true,
    handle: route.handle
  });
}
