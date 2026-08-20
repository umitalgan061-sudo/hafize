const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const ERROR_PREFIX = /^[A-Z0-9_]{3,80}$/;

function fail(prefix, reason) {
  const error = new Error(`${prefix}:${reason}`);
  error.code = error.message;
  throw error;
}

function positiveInteger(value, field, max) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    const error = new Error(`INVALID_PROVIDER_JSON_FETCH:${field}`);
    error.code = error.message;
    throw error;
  }
  return value;
}

function validSignal(signal) {
  return signal == null || (typeof signal === 'object'
    && typeof signal.aborted === 'boolean'
    && typeof signal.addEventListener === 'function'
    && typeof signal.removeEventListener === 'function');
}

function responseLength(response) {
  const raw = response?.headers?.get?.('content-length');
  if (raw == null || raw === '') return null;
  if (!/^\d+$/.test(String(raw))) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

async function cancelResponseBody(response) {
  try {
    if (typeof response?.body?.cancel === 'function') {
      await response.body.cancel();
      return;
    }
    if (response?.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      try { await reader.cancel(); } finally { try { reader.releaseLock?.(); } catch {} }
    }
  } catch { /* cleanup must not mask the provider error */ }
}

async function readStream(response, maxBytes, prefix) {
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item?.done) break;
      if (!(item?.value instanceof Uint8Array)) fail(prefix, 'response');
      const chunk = Buffer.from(item.value);
      size += chunk.length;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* cancellation is best effort */ }
        fail(prefix, 'response-too-large');
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock?.(); } catch { /* already released */ }
  }
  return Buffer.concat(chunks, size).toString('utf8');
}

async function readJson(response, maxBytes, prefix) {
  const declared = responseLength(response);
  if (declared !== null && declared > maxBytes) fail(prefix, 'response-too-large');

  if (response?.body && typeof response.body.getReader === 'function') {
    const text = await readStream(response, maxBytes, prefix);
    try { return JSON.parse(text); } catch { fail(prefix, 'response'); }
  }

  if (typeof response?.text === 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) fail(prefix, 'response-too-large');
    try { return JSON.parse(text); } catch { fail(prefix, 'response'); }
  }

  // Test/embedded compatibility. Native Node fetch responses use the streamed path above.
  if (typeof response?.json === 'function') {
    let value;
    try { value = await response.json(); } catch { fail(prefix, 'response'); }
    let encoded;
    try { encoded = JSON.stringify(value); } catch { fail(prefix, 'response'); }
    if (Buffer.byteLength(encoded, 'utf8') > maxBytes) fail(prefix, 'response-too-large');
    return value;
  }

  fail(prefix, 'response');
}

export async function fetchBoundedProviderJson({
  fetchImpl,
  url,
  init = {},
  errorPrefix,
  maxBytes,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal = null
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('INVALID_PROVIDER_JSON_FETCH:fetch');
  if (typeof url !== 'string' || !url) throw new Error('INVALID_PROVIDER_JSON_FETCH:url');
  if (!ERROR_PREFIX.test(errorPrefix || '')) throw new Error('INVALID_PROVIDER_JSON_FETCH:errorPrefix');
  if (!validSignal(signal)) throw new Error('INVALID_PROVIDER_JSON_FETCH:signal');
  const safeMaxBytes = positiveInteger(maxBytes, 'maxBytes', MAX_RESPONSE_BYTES);
  const safeTimeoutMs = positiveInteger(timeoutMs, 'timeoutMs', MAX_TIMEOUT_MS);
  if (signal?.aborted) fail(errorPrefix, 'cancelled');

  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener?.('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, safeTimeoutMs);
  timer.unref?.();
  let response = null;

  try {
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) fail(errorPrefix, 'timeout');
      if (signal?.aborted) fail(errorPrefix, 'cancelled');
      if (error?.code?.startsWith?.(`${errorPrefix}:`)) throw error;
      fail(errorPrefix, 'network');
    }
    if (!response?.ok) {
      await cancelResponseBody(response);
      fail(errorPrefix, 'http');
    }
    try {
      return await readJson(response, safeMaxBytes, errorPrefix);
    } catch (error) {
      await cancelResponseBody(response);
      throw error;
    }
  } catch (error) {
    if (timedOut && !error?.code?.startsWith?.(`${errorPrefix}:`)) fail(errorPrefix, 'timeout');
    if (signal?.aborted && !error?.code?.startsWith?.(`${errorPrefix}:`)) fail(errorPrefix, 'cancelled');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

export const PROVIDER_JSON_FETCH_LIMITS = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  maxTimeoutMs: MAX_TIMEOUT_MS,
  maxResponseBytes: MAX_RESPONSE_BYTES
});
