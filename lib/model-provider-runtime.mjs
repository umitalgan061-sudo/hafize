import { createLocalModelProvider } from './local-model-provider.mjs';
import { createModelProviderRouter } from './model-provider-router.mjs';

function parseEnabled(value) {
  if (value == null || value === '' || value === '0' || value === 'false') return false;
  if (value === '1' || value === 'true') return true;
  throw new Error('INVALID_PROVIDER_RUNTIME:localEnabled');
}

export function createModelProviderRuntime({
  env = process.env,
  nvidiaComplete,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof nvidiaComplete !== 'function') throw new Error('INVALID_PROVIDER_RUNTIME:nvidiaComplete');
  const localEnabled = parseEnabled(String(env?.HAFIZE_LOCAL_MODEL_ENABLED ?? '').trim().toLowerCase());
  const baseUrl = String(env?.HAFIZE_LOCAL_MODEL_BASE_URL || 'http://127.0.0.1:11434').trim();
  const local = localEnabled ? createLocalModelProvider({ baseUrl, fetchImpl }) : null;
  const router = createModelProviderRouter({
    nvidiaComplete,
    localComplete: local ? local.complete : null,
    localEnabled
  });
  return Object.freeze({
    complete: router.complete,
    resolve: router.resolve,
    publicStatus: () => Object.freeze({ defaultProvider: 'nvidia', localEnabled })
  });
}
