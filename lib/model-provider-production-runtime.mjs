import { createLocalProviderServerRuntime } from './local-provider-server-runtime.mjs';
import { createModelProviderServerBoundary } from './model-provider-server-boundary.mjs';

const DEFAULT_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

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

export function createModelProviderProductionRuntime({
  env = process.env,
  fetchImpl = globalThis.fetch,
  createLocalRuntime = createLocalProviderServerRuntime,
  createBoundary = createModelProviderServerBoundary
} = {}) {
  if (typeof fetchImpl !== 'function') fail('MODEL_PROVIDER_FETCH_UNAVAILABLE');
  if (typeof createLocalRuntime !== 'function' || typeof createBoundary !== 'function') fail('INVALID_MODEL_PROVIDER_PRODUCTION_RUNTIME');
  const apiKey = readEnv(env, 'NVIDIA_API_KEY');
  const nimBaseUrl = cleanNimBaseUrl(readEnv(env, 'NIM_BASE_URL'));
  const nvidiaConfigured = Boolean(apiKey);

  async function nvidiaFetch(pathname, init = {}) {
    if (!nvidiaConfigured) throw providerError('NVIDIA_NOT_CONFIGURED', 503);
    let response;
    try {
      response = await fetchImpl(`${nimBaseUrl}${pathname}`, {
        ...init,
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
    const response = await nvidiaFetch('/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw providerError('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502);
    let value;
    try { value = await response.json(); } catch { throw providerError('INVALID_NVIDIA_RESPONSE', 502); }
    return value;
  }

  async function nvidiaStream(payload, signal) {
    const response = await nvidiaFetch('/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload)
    });
    if (!response.ok || !response.body) throw providerError('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502);
    if (typeof response.body[Symbol.asyncIterator] !== 'function') throw providerError('INVALID_PROVIDER_STREAM', 502);
    return response.body;
  }

  async function nvidiaListModels(signal) {
    if (!nvidiaConfigured) return [];
    const response = await nvidiaFetch('/models', { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw providerError('NVIDIA_CHAT_ERROR', Number.isInteger(response.status) ? response.status : 502);
    let payload;
    try { payload = await response.json(); } catch { throw providerError('INVALID_NVIDIA_RESPONSE', 502); }
    return Array.isArray(payload?.data)
      ? payload.data.map((item) => item?.id).filter((id) => typeof id === 'string' && id.trim())
      : [];
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

export const MODEL_PROVIDER_PRODUCTION_DEFAULTS = Object.freeze({ nimBaseUrl: DEFAULT_NIM_BASE_URL });
