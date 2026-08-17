const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';
const MODEL_PREFIX = 'local:';
const MAX_MODEL_LENGTH = 160;
const MAX_MODEL_COUNT = 200;
const MAX_COMPLETION_JSON_BYTES = 4 * 1024 * 1024;
const MAX_MODELS_JSON_BYTES = 1024 * 1024;
const MAX_STREAM_BYTES = 8 * 1024 * 1024;
const MAX_STREAM_CHUNK_BYTES = 512 * 1024;
const DEFAULT_JSON_TIMEOUT_MS = 30_000;
const MAX_JSON_TIMEOUT_MS = 120_000;
const ALLOWED_FIELDS = new Set([
  'model', 'messages', 'stream', 'max_tokens', 'temperature', 'top_p', 'tools', 'tool_choice'
]);

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function normalizeEnabled(value) {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || DEFAULT_BASE_URL));
  } catch {
    fail('INVALID_LOCAL_PROVIDER_BASE_URL');
  }
  if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) {
    fail('INVALID_LOCAL_PROVIDER_BASE_URL');
  }
  const host = url.hostname.toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) fail('LOCAL_PROVIDER_MUST_BE_LOOPBACK');
  return url.toString().replace(/\/+$/, '');
}

function normalizeModel(value) {
  const model = typeof value === 'string' ? value.trim() : '';
  if (!model.startsWith(MODEL_PREFIX)) fail('LOCAL_PROVIDER_MODEL_PREFIX_REQUIRED');
  const localModel = model.slice(MODEL_PREFIX.length).trim();
  if (!localModel || localModel.length > MAX_MODEL_LENGTH || /[\u0000-\u001f\u007f]/.test(localModel)) {
    fail('INVALID_LOCAL_PROVIDER_MODEL');
  }
  return localModel;
}

function normalizePayload(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_LOCAL_PROVIDER_REQUEST');
  if (Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) fail('INVALID_LOCAL_PROVIDER_FIELD');
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 200) {
    fail('INVALID_LOCAL_PROVIDER_MESSAGES');
  }
  const messages = input.messages.map((message) => {
    if (!message || Array.isArray(message) || typeof message !== 'object') fail('INVALID_LOCAL_PROVIDER_MESSAGES');
    if (!['system', 'user', 'assistant', 'tool'].includes(message.role) || typeof message.content !== 'string') {
      fail('INVALID_LOCAL_PROVIDER_MESSAGES');
    }
    if (message.content.length > 100_000) fail('INVALID_LOCAL_PROVIDER_MESSAGES');
    const normalized = { role: message.role, content: message.content };
    if (message.role === 'tool') {
      if (typeof message.tool_call_id !== 'string' || !message.tool_call_id.trim()) fail('INVALID_LOCAL_PROVIDER_MESSAGES');
      normalized.tool_call_id = message.tool_call_id.trim();
    }
    return normalized;
  });
  const payload = {
    model: normalizeModel(input.model),
    messages,
    stream: input.stream === true
  };
  if (Number.isInteger(input.max_tokens)) payload.max_tokens = Math.min(Math.max(input.max_tokens, 1), 32_768);
  if (typeof input.temperature === 'number' && Number.isFinite(input.temperature)) {
    payload.temperature = Math.min(Math.max(input.temperature, 0), 2);
  }
  if (typeof input.top_p === 'number' && Number.isFinite(input.top_p)) payload.top_p = Math.min(Math.max(input.top_p, 0), 1);
  if (Array.isArray(input.tools) && input.tools.length) payload.tools = input.tools;
  if (input.tool_choice === 'auto' || input.tool_choice === 'none') payload.tool_choice = input.tool_choice;
  return payload;
}

function sanitizeJsonResponse(payload) {
  const message = payload?.choices?.[0]?.message;
  if (!message || message.role !== 'assistant') fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502);
  return payload;
}

function boundedTimeout(value) {
  if (value === undefined) return DEFAULT_JSON_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_JSON_TIMEOUT_MS) fail('INVALID_LOCAL_PROVIDER_JSON_TIMEOUT');
  return value;
}

function mediaType(response) {
  const raw = response?.headers?.get?.('content-type');
  return typeof raw === 'string' ? raw.split(';', 1)[0].trim().toLowerCase() : '';
}

function requireMediaType(response, expected) {
  if (mediaType(response) !== expected) fail('INVALID_LOCAL_PROVIDER_RESPONSE_TYPE', 502);
}

function declaredLength(response) {
  const raw = response?.headers?.get?.('content-length');
  if (raw == null || raw === '') return null;
  if (!/^\d+$/.test(String(raw))) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

async function readBoundedText(response, maxBytes) {
  const declared = declaredLength(response);
  if (declared !== null && declared > maxBytes) fail('LOCAL_PROVIDER_RESPONSE_TOO_LARGE', 502);

  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item?.done) break;
        if (!(item?.value instanceof Uint8Array)) fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502);
        const chunk = Buffer.from(item.value);
        size += chunk.length;
        if (size > maxBytes) {
          try { await reader.cancel(); } catch { /* cancellation is best effort */ }
          fail('LOCAL_PROVIDER_RESPONSE_TOO_LARGE', 502);
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock?.(); } catch { /* already released */ }
    }
    return Buffer.concat(chunks, size).toString('utf8');
  }

  if (typeof response?.text === 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) fail('LOCAL_PROVIDER_RESPONSE_TOO_LARGE', 502);
    return text;
  }

  if (typeof response?.json === 'function') {
    let value;
    try { value = await response.json(); } catch { fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502); }
    let encoded;
    try { encoded = JSON.stringify(value); } catch { fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502); }
    if (Buffer.byteLength(encoded, 'utf8') > maxBytes) fail('LOCAL_PROVIDER_RESPONSE_TOO_LARGE', 502);
    return encoded;
  }

  fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502);
}

async function readBoundedJson(response, maxBytes) {
  const text = await readBoundedText(response, maxBytes);
  try { return JSON.parse(text); } catch { fail('INVALID_LOCAL_PROVIDER_RESPONSE', 502); }
}

function normalizeListedModels(payload) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const seen = new Set();
  const models = [];
  for (const item of items) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (!id || id.length > MAX_MODEL_LENGTH || /[\u0000-\u001f\u007f]/.test(id) || seen.has(id)) continue;
    seen.add(id);
    models.push(`${MODEL_PREFIX}${id}`);
    if (models.length >= MAX_MODEL_COUNT) break;
  }
  return models;
}

async function withJsonDeadline(parentSignal, timeoutMs, execute) {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) onParentAbort();
  else parentSignal?.addEventListener?.('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();
  try {
    return await execute(controller.signal);
  } catch (error) {
    if (timedOut) fail('LOCAL_PROVIDER_TIMEOUT', 504);
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.('abort', onParentAbort);
  }
}

function createBoundedStream(body) {
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      let totalBytes = 0;
      for await (const value of body) {
        if (!(value instanceof Uint8Array)) fail('INVALID_LOCAL_PROVIDER_STREAM', 502);
        const chunk = Buffer.from(value);
        if (chunk.length > MAX_STREAM_CHUNK_BYTES) fail('LOCAL_PROVIDER_STREAM_CHUNK_TOO_LARGE', 502);
        totalBytes += chunk.length;
        if (totalBytes > MAX_STREAM_BYTES) fail('LOCAL_PROVIDER_STREAM_TOO_LARGE', 502);
        yield chunk;
      }
    }
  });
}

async function request(fetchImpl, apiBase, pathname, init, signal) {
  let response;
  try {
    response = await fetchImpl(`${apiBase}${pathname}`, {
      ...init,
      signal,
      redirect: 'error'
    });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') fail('LOCAL_PROVIDER_CANCELLED', 499);
    fail('LOCAL_PROVIDER_UNAVAILABLE', 502);
  }
  if (!response?.ok) fail('LOCAL_PROVIDER_FAILED', Number.isInteger(response?.status) ? response.status : 502);
  return response;
}

export function isLocalProviderModel(model) {
  return typeof model === 'string' && model.trim().startsWith(MODEL_PREFIX);
}

export function createLocalOllamaProvider({
  enabled = false,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  jsonTimeoutMs
} = {}) {
  const configured = normalizeEnabled(enabled);
  const apiBase = normalizeBaseUrl(baseUrl);
  const safeJsonTimeoutMs = boundedTimeout(jsonTimeoutMs);
  if (typeof fetchImpl !== 'function') fail('LOCAL_PROVIDER_FETCH_UNAVAILABLE', 503);

  async function complete(input, { signal } = {}) {
    if (!configured) fail('LOCAL_PROVIDER_NOT_ENABLED', 503);
    const payload = normalizePayload({ ...input, stream: false });
    return withJsonDeadline(signal, safeJsonTimeoutMs, async (requestSignal) => {
      const response = await request(fetchImpl, apiBase, '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      }, requestSignal);
      requireMediaType(response, 'application/json');
      return sanitizeJsonResponse(await readBoundedJson(response, MAX_COMPLETION_JSON_BYTES));
    });
  }

  async function stream(input, { signal } = {}) {
    if (!configured) fail('LOCAL_PROVIDER_NOT_ENABLED', 503);
    const payload = normalizePayload({ ...input, stream: true });
    const response = await request(fetchImpl, apiBase, '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload)
    }, signal);
    requireMediaType(response, 'text/event-stream');
    if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') {
      fail('INVALID_LOCAL_PROVIDER_STREAM', 502);
    }
    return createBoundedStream(response.body);
  }

  async function listModels({ signal } = {}) {
    if (!configured) return [];
    try {
      return await withJsonDeadline(signal, safeJsonTimeoutMs, async (requestSignal) => {
        const response = await request(fetchImpl, apiBase, '/models', {
          method: 'GET',
          headers: { Accept: 'application/json' }
        }, requestSignal);
        requireMediaType(response, 'application/json');
        return normalizeListedModels(await readBoundedJson(response, MAX_MODELS_JSON_BYTES));
      });
    } catch (error) {
      if (signal?.aborted || error?.code === 'LOCAL_PROVIDER_CANCELLED') throw error;
      return [];
    }
  }

  return Object.freeze({ configured, complete, stream, listModels });
}

export const LOCAL_PROVIDER_DEFAULTS = Object.freeze({
  baseUrl: DEFAULT_BASE_URL,
  modelPrefix: MODEL_PREFIX,
  maxModelLength: MAX_MODEL_LENGTH,
  maxModelCount: MAX_MODEL_COUNT,
  maxCompletionJsonBytes: MAX_COMPLETION_JSON_BYTES,
  maxModelsJsonBytes: MAX_MODELS_JSON_BYTES,
  maxStreamBytes: MAX_STREAM_BYTES,
  maxStreamChunkBytes: MAX_STREAM_CHUNK_BYTES,
  jsonTimeoutMs: DEFAULT_JSON_TIMEOUT_MS,
  maxJsonTimeoutMs: MAX_JSON_TIMEOUT_MS
});
