const PROVIDERS = new Set(['nvidia', 'local']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeRequestedProvider(value) {
  if (value == null || value === '') return 'nvidia';
  if (typeof value !== 'string') fail('INVALID_MODEL_PROVIDER');
  const provider = value.trim().toLowerCase();
  if (!PROVIDERS.has(provider)) fail('INVALID_MODEL_PROVIDER');
  return provider;
}

export function createModelProviderRouter({
  nvidiaComplete,
  localComplete = null,
  localEnabled = false
} = {}) {
  if (typeof nvidiaComplete !== 'function') fail('INVALID_PROVIDER_ROUTER:nvidiaComplete');
  if (localComplete != null && typeof localComplete !== 'function') fail('INVALID_PROVIDER_ROUTER:localComplete');
  if (typeof localEnabled !== 'boolean') fail('INVALID_PROVIDER_ROUTER:localEnabled');

  function resolve(value, { toolsRequired = false } = {}) {
    const provider = normalizeRequestedProvider(value);
    if (provider === 'local') {
      if (!localEnabled || typeof localComplete !== 'function') fail('LOCAL_PROVIDER_NOT_ENABLED');
      if (toolsRequired) fail('LOCAL_PROVIDER_TOOLS_UNSUPPORTED');
    }
    return provider;
  }

  async function complete(request) {
    const { provider, payload, signal, toolsRequired = false } = request ?? {};
    const selected = resolve(provider, { toolsRequired });
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_PROVIDER_PAYLOAD');
    const result = selected === 'local'
      ? await localComplete(payload, signal)
      : await nvidiaComplete(payload, signal);
    return { provider: selected, result };
  }

  return Object.freeze({ resolve, complete, defaultProvider: 'nvidia', localEnabled });
}

export const MODEL_PROVIDER_IDS = Object.freeze([...PROVIDERS]);
