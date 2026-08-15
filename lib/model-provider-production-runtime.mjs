import { createLocalProviderServerRuntime } from './local-provider-server-runtime.mjs';
import { createModelProviderServerBoundary } from './model-provider-server-boundary.mjs';

const DEFAULT_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MAX_COMPLETION_JSON_BYTES = 4 * 1024 * 1024;
const MAX_MODELS_JSON_BYTES = 1024 * 1024;
const MAX_MODEL_COUNT = 4096;
const MAX_MODEL_ID_LENGTH = 512;
const DEFAULT_JSON_TIMEOUT_MS = 30_000;
const MAX_JSON_TIMEOUT_MS = 120_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function readEnv(env, name) {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNimBaseUrl(value) {
  let url;
  try { url = new URL(value || DEFAULT_NIM_BASE_URL); } catch { fail('INVALID_NIM_BASE_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('INVALID_NIM_BASE_URL');
  return url.toString().replace(/\/+$/, '');
}

function providerError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function boundedTimeout(value) {
  if (value === undefined) return DEFAULT_JSON_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_JSON_TIMEOUT_MS) fail('INVALID_NVIDIA_JSON_TIMEOUT');
  return value;
}

function declaredLength(response) {
  const raw = response?.headers?.get?.('content-length');
  if (raw == null || raw === '') return null;
  if (!/^\d+$/.test(String(raw))) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function requireMediaType(response, expected) {
  const raw = response?.headers?.get?.('content-type');
  const mediaType = typeof raw === 'string' ? raw.split(';', 1)[0].trim().toLowerCase() : '';
  if (mediaType !== expected) throw providerError('INVALID_NVIDIA_RESPONSE_TYPE', 502);
}

async function readBoundedText(response, maxBytes) {
  const declared = declaredLength(response);
  if (declared !== null && declared > maxBytes) throw providerError('NVIDIA_RESPONSE_TOO_LARGE', 502);

  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item?.done) break;
        if (!(item?.value instanceof Uint8Array)) throw providerError('INVALID_NVIDIA_RESPONSE', 502);
        const chunk = Buffer.from(item.value);
        size += chunk.length;
        if (size > maxBytes) {
          try { await reader.cancel(); } catch { /* cancellation is best effort */ }
          throw providerError('NVIDIA_RESPONSE_TOO_LARGE', 502);
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
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw providerError('NVIDIA_RESPONSE_TOO_LARGE', 502);
    return text;
  }

  if (typeof response?.json === 'function') {
    let value;
    try { value = await response.json(); } catch { throw providerError('INVALID_NVIDIA_RESPONSE', 502); }
    let encoded;
    try { encoded = JSON.stringify(value); } catch { throw providerError('INVALID_NVIDIA_RESPONSE', 502); }
    if (Buffer.byteLength(encoded, 'utf8') > maxBytes) throw providerError('NVIDIA_RESPONSE_TOO_LARGE', 502);
    return encoded;
  }

  throw providerError('INVALID_NVIDIA_RESPONSE', 502);
}

async function readBoundedJson(response, maxBytes) {
  const text = await readBoundedText(response, maxBytes);
  try { return JSON.parse(text); } catch { throw providerError('INVALID_NVIDIA_RESPONSE', 502); }
}

function normalizeModelIds(payload) {
  if (!Array.isArray(payload?.data)) return [];
  const seen = new Set();
  const models = [];
  for (const item of payload.data) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (!id || id.length > MAX_MODEL_ID_LENGTH || /[\u0000\r\n]/.test(id) || seen.has(id)) continue;
    seen.add(id);
    models.push(id);
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
    if (timedOut) throw providerError('NVIDIA_CHAT_TIMEOUT', 504);
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.('abort', onParentAbort);
  }
}

export function createModelProviderProductionRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createLocalRuntime = createLocalProviderServerRuntime,
  createBoundary = createModelProviderServerBoundary,
  jsonTimeoutMs
} = {}) {
  if (typeof fetchImpl !== 'function') fail('MODEL_PROVIDER_FETCH_UNAVAILABLE');
  if (typeof createLocalRuntime !== 'function' || typeof createBoundary !== 'function') fail('INVALID_MODEL_PROVIDER_PRODUCTION_RUNTIME');
  const apiKey = readEnv(env, 'NVIDIA_API_KEY');
  const nimBaseUrl = cleanNimBaseUrl(readEnv(env, 'NIM_BASE_URL'));
  const nvidiaConfigured = Boolean(apiKey);
  const safeJsonTimeoutMs = boundedTimeout(jsonTimeoutMs);

  async function nvidiaFetch(pathname, init = {}) {
    if (!nvidiaConfigured) throw providerError('NVIDIA_NOT_CONFIGURED', 503);
    let response;
    try {
      response = await fetchImpl(`${nimBaseUrl}${pathname}`, {
        ...init,
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(init.headers || {})
        }
      });
    } catch (error) {
      if (init.signal?.aborted || error?.name === 'AbortError') throw error;
      throw providerError('NVIDIA_CHAT_ERROR', 502);
    }
    return response;
  }

  async function nvidiaComplete(payload, signal) {
    return withJsonDeadline(signal, safeJsonTimeoutMs, async (requestSignal) => {
      const response = await nvidiaFetch('/chat/completions', {
        method: 'POST', signal: requestSignal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw providerError('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502);
      requireMediaType(response, 'application/json');
      return readBoundedJson(response, MAX_COMPLETION_JSON_BYTES);
    });
  }

  async function nvidiaStream(payload, signal) {
    const response = await nvidiaFetch('/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload)
    });
    if (!response.ok || !response.body) throw providerError('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502);
    requireMediaType(response, 'text/event-stream');
    if (typeof response.body[Symbol.asyncIterator] !== 'function') throw providerError('INVALID_PROVIDER_STREAM', 502);
    return response.body;
  }

  async function nvidiaListModels(signal) {
    if (!nvidiaConfigured) return [];
    return withJsonDeadline(signal, safeJsonTimeoutMs, async (requestSignal) => {
      const response = await nvidiaFetch('/models', { signal: requestSignal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw providerError('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502);
      requireMediaType(response, 'application/json');
      return normalizeModelIds(await readBoundedJson(response, MAX_MODELS_JSON_BYTES));
    });
  }

  const runtime = createLocalRuntime({
    env,
    nvidiaComplete,
    nvidiaStream,
    nvidiaListModels,
    fetchImpl
  });
  const boundary = createBoundary({ runtime });

  return Object.freeze({
    nvidiaConfigured,
    localConfigured: runtime.configured,
    defaultProvider: runtime.defaultProvider,
    listModels: boundary.listModels,
    complete: boundary.complete,
    stream: boundary.stream
  });
}

export const MODEL_PROVIDER_PRODUCTION_DEFAULTS = Object.freeze({
  nimBaseUrl: DEFAULT_NIM_BASE_URL,
  maxCompletionJsonBytes: MAX_COMPLETION_JSON_BYTES,
  maxModelsJsonBytes: MAX_MODELS_JSON_BYTES,
  maxModelCount: MAX_MODEL_COUNT,
  maxModelIdLength: MAX_MODEL_ID_LENGTH,
  jsonTimeoutMs: DEFAULT_JSON_TIMEOUT_MS,
  maxJsonTimeoutMs: MAX_JSON_TIMEOUT_MS
});
