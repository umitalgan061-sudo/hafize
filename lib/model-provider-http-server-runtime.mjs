import { createModelProviderProductionRuntime } from './model-provider-production-runtime.mjs';
import { createModelProviderHttpApi } from './model-provider-http-api.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createModelProviderHttpServerRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  readJson,
  prepareChat,
  createProvider = createModelProviderProductionRuntime,
  createHttpApi = createModelProviderHttpApi
} = {}) {
  if (typeof createProvider !== 'function' || typeof createHttpApi !== 'function') {
    fail('INVALID_MODEL_PROVIDER_HTTP_SERVER_RUNTIME:factory');
  }
  if (typeof readJson !== 'function') fail('INVALID_MODEL_PROVIDER_HTTP_SERVER_RUNTIME:readJson');
  if (typeof prepareChat !== 'function') fail('INVALID_MODEL_PROVIDER_HTTP_SERVER_RUNTIME:prepareChat');

  const provider = createProvider({ env, fetchImpl });
  if (!provider || typeof provider.listModels !== 'function' || typeof provider.stream !== 'function') {
    fail('INVALID_MODEL_PROVIDER_HTTP_SERVER_RUNTIME:provider');
  }
  const api = createHttpApi({ provider, readJson, prepareChat });
  if (!api || typeof api.handle !== 'function') fail('INVALID_MODEL_PROVIDER_HTTP_SERVER_RUNTIME:httpApi');

  return Object.freeze({
    nvidiaConfigured: provider.nvidiaConfigured === true,
    localConfigured: provider.localConfigured === true,
    defaultProvider: provider.defaultProvider === 'local' ? 'local' : 'nvidia',
    handle: api.handle
  });
}
