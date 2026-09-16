const PROVIDERS = new Set(['nvidia', 'local']);

/**
 * @param {string} code
 * @returns {never}
 */
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

/** @param {unknown} value */
function normalizeRequestedProvider(value) {
  if (value == null || value === '') return 'nvidia';
  if (typeof value !== 'string') fail('INVALID_MODEL_PROVIDER');
  const provider = value.trim().toLowerCase();
  if (!PROVIDERS.has(provider)) fail('INVALID_MODEL_PROVIDER');
  return provider;
}

/**
 * Sağlayıcı seçimini tek yerde toplar; araç gerektiren istekler yerel
 * sağlayıcıya düşmez.
 *
 * @param {{ nvidiaComplete?: Function; localComplete?: Function | null; localEnabled?: boolean }} [options]
 */
export function createModelProviderRouter({
  nvidiaComplete,
  localComplete = null,
  localEnabled = false
} = {}) {
  if (typeof nvidiaComplete !== 'function') fail('INVALID_PROVIDER_ROUTER:nvidiaComplete');
  if (localComplete != null && typeof localComplete !== 'function') fail('INVALID_PROVIDER_ROUTER:localComplete');
  if (typeof localEnabled !== 'boolean') fail('INVALID_PROVIDER_ROUTER:localEnabled');

  /**
   * @param {unknown} value
   * @param {{ toolsRequired?: boolean }} [options]
   */
  function resolve(value, { toolsRequired = false } = {}) {
    const provider = normalizeRequestedProvider(value);
    if (provider === 'local') {
      if (!localEnabled || typeof localComplete !== 'function') fail('LOCAL_PROVIDER_NOT_ENABLED');
      if (toolsRequired) fail('LOCAL_PROVIDER_TOOLS_UNSUPPORTED');
    }
    return provider;
  }

  /**
   * @param {{ provider?: string; payload?: unknown; signal?: AbortSignal; toolsRequired?: boolean }} [input]
   */
  async function complete({ provider, payload, signal, toolsRequired = false } = {}) {
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
