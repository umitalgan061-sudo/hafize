const SAFE_PROVIDER_ERRORS = new Map([
  ['INVALID_MODEL_PROVIDER', 400],
  ['INVALID_PROVIDER_PAYLOAD', 400],
  ['LOCAL_PROVIDER_TOOLS_UNSUPPORTED', 400],
  ['LOCAL_PROVIDER_NOT_ENABLED', 503],
  ['NVIDIA_NOT_CONFIGURED', 503],
  ['LOCAL_PROVIDER_CANCELLED', 499],
  ['LOCAL_PROVIDER_UNAVAILABLE', 502],
  ['LOCAL_PROVIDER_FAILED', 502],
  ['INVALID_LOCAL_PROVIDER_RESPONSE', 502],
  ['INVALID_LOCAL_PROVIDER_STREAM', 502],
  ['INVALID_PROVIDER_STREAM', 502],
  ['NVIDIA_CHAT_ERROR', 502],
  ['INVALID_NVIDIA_RESPONSE', 502]
]);
const PROVIDERS = new Set(['nvidia', 'local']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') fail('INVALID_MODEL_PROVIDER_SERVER_BOUNDARY:runtime');
  for (const name of ['complete', 'stream', 'listModels', 'resolve']) {
    if (typeof runtime[name] !== 'function') fail(`INVALID_MODEL_PROVIDER_SERVER_BOUNDARY:${name}`);
  }
  return runtime;
}

function normalizeSignal(signal) {
  if (signal == null) return null;
  if (!(signal instanceof AbortSignal)) fail('INVALID_MODEL_PROVIDER_SIGNAL');
  return signal;
}

function checkCancelled(signal) {
  if (signal?.aborted) return { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' };
  return null;
}

function normalizeToolsRequired(value) {
  if (value == null) return false;
  if (typeof value !== 'boolean') fail('INVALID_MODEL_PROVIDER_TOOLS_REQUIRED');
  return value;
}

function sanitizeError(error, signal) {
  if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'LOCAL_PROVIDER_CANCELLED') {
    return { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' };
  }
  const code = typeof error?.code === 'string'
    ? error.code
    : typeof error?.message === 'string'
      ? error.message
      : '';
  const mapped = SAFE_PROVIDER_ERRORS.get(code);
  if (!mapped) return { ok: false, status: 502, error: 'MODEL_PROVIDER_FAILED' };
  const explicit = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : mapped;
  return { ok: false, status: explicit, error: code === 'LOCAL_PROVIDER_CANCELLED' ? 'MODEL_PROVIDER_CANCELLED' : code };
}

function normalizeProvider(value) {
  if (!PROVIDERS.has(value)) fail('INVALID_MODEL_PROVIDER_RESULT');
  return value;
}

function normalizeModels(value) {
  if (!Array.isArray(value)) fail('INVALID_MODEL_PROVIDER_MODELS');
  const models = [];
  for (const item of value) {
    const model = typeof item === 'string' ? item.trim() : '';
    if (!model || model.length > 240 || /[\u0000-\u001f\u007f]/.test(model)) fail('INVALID_MODEL_PROVIDER_MODELS');
    models.push(model);
  }
  return [...new Set(models)].slice(0, 400);
}

function normalizeCompletion(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_MODEL_PROVIDER_COMPLETION');
  const message = value?.choices?.[0]?.message;
  if (!message || message.role !== 'assistant') fail('INVALID_MODEL_PROVIDER_COMPLETION');
  return value;
}

export function createModelProviderServerBoundary({ runtime } = {}) {
  const providerRuntime = requireRuntime(runtime);

  async function listModels({ signal } = {}) {
    const safeSignal = normalizeSignal(signal);
    const cancelled = checkCancelled(safeSignal);
    if (cancelled) return cancelled;
    try {
      const models = normalizeModels(await providerRuntime.listModels({ signal: safeSignal }));
      return { ok: true, status: 200, value: { models } };
    } catch (error) {
      return sanitizeError(error, safeSignal);
    }
  }

  async function complete(payload, { signal, toolsRequired } = {}) {
    const safeSignal = normalizeSignal(signal);
    const cancelled = checkCancelled(safeSignal);
    if (cancelled) return cancelled;
    const requiresTools = normalizeToolsRequired(toolsRequired);
    try {
      const result = await providerRuntime.complete({ payload, signal: safeSignal, toolsRequired: requiresTools });
      return {
        ok: true,
        status: 200,
        value: {
          provider: normalizeProvider(result?.provider),
          result: normalizeCompletion(result?.result)
        }
      };
    } catch (error) {
      return sanitizeError(error, safeSignal);
    }
  }

  async function stream(payload, { signal, toolsRequired } = {}) {
    const safeSignal = normalizeSignal(signal);
    const cancelled = checkCancelled(safeSignal);
    if (cancelled) return cancelled;
    const requiresTools = normalizeToolsRequired(toolsRequired);
    try {
      const result = await providerRuntime.stream({ payload, signal: safeSignal, toolsRequired: requiresTools });
      const provider = normalizeProvider(result?.provider);
      const body = result?.body;
      if (!body || typeof body[Symbol.asyncIterator] !== 'function') fail('INVALID_PROVIDER_STREAM');
      return { ok: true, status: 200, value: { provider, body } };
    } catch (error) {
      return sanitizeError(error, safeSignal);
    }
  }

  return Object.freeze({ listModels, complete, stream });
}
