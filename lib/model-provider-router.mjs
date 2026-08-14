const PROVIDERS = new Set(['nvidia', 'local']);
const LOCAL_MODEL_PREFIX = 'local:';

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function normalizeRequestedProvider(value, model) {
  if (value == null || value === '') {
    return typeof model === 'string' && model.trim().startsWith(LOCAL_MODEL_PREFIX) ? 'local' : 'nvidia';
  }
  if (typeof value !== 'string') fail('INVALID_MODEL_PROVIDER');
  const provider = value.trim().toLowerCase();
  if (!PROVIDERS.has(provider)) fail('INVALID_MODEL_PROVIDER');
  return provider;
}

function requireFunction(value, label, optional = false) {
  if (value == null && optional) return null;
  if (typeof value !== 'function') fail(`INVALID_PROVIDER_ROUTER:${label}`);
  return value;
}

function normalizeModels(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean))].slice(0, 400);
}

export function createModelProviderRouter({
  nvidiaComplete,
  nvidiaStream,
  nvidiaListModels,
  localComplete = null,
  localStream = null,
  localListModels = null,
  localEnabled = false
} = {}) {
  const completeNvidia = requireFunction(nvidiaComplete, 'nvidiaComplete');
  const streamNvidia = requireFunction(nvidiaStream, 'nvidiaStream');
  const listNvidia = requireFunction(nvidiaListModels, 'nvidiaListModels');
  const completeLocal = requireFunction(localComplete, 'localComplete', true);
  const streamLocal = requireFunction(localStream, 'localStream', true);
  const listLocal = requireFunction(localListModels, 'localListModels', true);
  if (typeof localEnabled !== 'boolean') fail('INVALID_PROVIDER_ROUTER:localEnabled');

  function resolve(value, { model, toolsRequired = false } = {}) {
    const provider = normalizeRequestedProvider(value, model);
    if (provider === 'local') {
      if (!localEnabled || !completeLocal || !streamLocal) fail('LOCAL_PROVIDER_NOT_ENABLED', 503);
      if (toolsRequired) fail('LOCAL_PROVIDER_TOOLS_UNSUPPORTED', 400);
    }
    return provider;
  }

  async function complete({ provider, payload, signal, toolsRequired = false } = {}) {
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_PROVIDER_PAYLOAD');
    const selected = resolve(provider, { model: payload.model, toolsRequired });
    const result = selected === 'local'
      ? await completeLocal(payload, { signal })
      : await completeNvidia(payload, signal);
    return { provider: selected, result };
  }

  async function stream({ provider, payload, signal, toolsRequired = false } = {}) {
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_PROVIDER_PAYLOAD');
    const selected = resolve(provider, { model: payload.model, toolsRequired });
    const body = selected === 'local'
      ? await streamLocal(payload, { signal })
      : await streamNvidia(payload, signal);
    if (!body || typeof body[Symbol.asyncIterator] !== 'function') fail('INVALID_PROVIDER_STREAM', 502);
    return { provider: selected, body };
  }

  async function listModels({ signal } = {}) {
    const nvidia = normalizeModels(await listNvidia(signal));
    if (!localEnabled || !listLocal) return nvidia;
    let local = [];
    try { local = normalizeModels(await listLocal({ signal })); } catch { local = []; }
    return normalizeModels([...nvidia, ...local]);
  }

  return Object.freeze({ resolve, complete, stream, listModels, defaultProvider: 'nvidia', localEnabled });
}

export const MODEL_PROVIDER_IDS = Object.freeze([...PROVIDERS]);
