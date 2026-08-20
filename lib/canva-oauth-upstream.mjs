const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 256 * 1024;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '').trim();
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return String(value ?? '').trim();
  }
  return '';
}

async function closeResponseBody(response) {
  try {
    if (typeof response?.body?.cancel === 'function') await response.body.cancel();
    else if (typeof response?.body?.getReader === 'function') {
      const reader = response.body.getReader();
      try { await reader.cancel(); } finally { try { reader.releaseLock?.(); } catch {} }
    }
  } catch {
    // Cleanup must never replace the original OAuth result/error.
  }
}

function validateDeclaredLength(response, maxBytes) {
  const raw = headerValue(response?.headers, 'content-length');
  if (!raw) return;
  if (!/^\d+$/.test(raw)) fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
  const bytes = Number(raw);
  if (!Number.isSafeInteger(bytes)) fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
  if (bytes > maxBytes) fail('CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE');
}

function validateJsonContentType(response) {
  const raw = headerValue(response?.headers, 'content-type');
  if (!raw) return;
  if (raw.split(';', 1)[0].trim().toLowerCase() !== 'application/json') fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
}

async function readBoundedJson(response, maxBytes) {
  validateDeclaredLength(response, maxBytes);
  validateJsonContentType(response);
  if (typeof response?.body?.getReader !== 'function') {
    if (typeof response?.json !== 'function') fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
    const payload = await response.json();
    let encoded;
    try { encoded = Buffer.from(JSON.stringify(payload), 'utf8'); } catch { fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE'); }
    if (encoded.length > maxBytes) fail('CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE');
    return payload;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let completed = false;
  try {
    while (true) {
      const item = await reader.read();
      if (item?.done) { completed = true; break; }
      const value = item?.value;
      if (!(value instanceof Uint8Array)) fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
      total += value.byteLength;
      if (total > maxBytes) fail('CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let parsed;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE'); }
    return parsed;
  } finally {
    if (!completed) try { await reader.cancel(); } catch {}
    try { reader.releaseLock?.(); } catch {}
  }
}

export function createCanvaOAuthUpstream({
  fetchImpl = globalThis.fetch,
  AbortControllerImpl = globalThis.AbortController,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES
} = {}) {
  if (typeof fetchImpl !== 'function') fail('INVALID_CANVA_OAUTH_UPSTREAM:fetch');
  if (typeof AbortControllerImpl !== 'function') fail('INVALID_CANVA_OAUTH_UPSTREAM:abortController');
  if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') fail('INVALID_CANVA_OAUTH_UPSTREAM:timer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) fail('INVALID_CANVA_OAUTH_UPSTREAM:timeoutMs');
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > MAX_RESPONSE_BYTES) fail('INVALID_CANVA_OAUTH_UPSTREAM:maxResponseBytes');

  async function postForm(endpoint, { authorization, body, signal, json = false } = {}) {
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://api.canva.com/')) fail('INVALID_CANVA_OAUTH_UPSTREAM:endpoint');
    if (typeof authorization !== 'string' || !authorization.startsWith('Basic ')) fail('INVALID_CANVA_OAUTH_UPSTREAM:authorization');
    if (typeof body !== 'string') fail('INVALID_CANVA_OAUTH_UPSTREAM:body');
    if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) fail('INVALID_CANVA_OAUTH_UPSTREAM:signal');
    if (signal?.aborted) fail('CANVA_OAUTH_UPSTREAM_CANCELLED');

    const controller = new AbortControllerImpl();
    let timedOut = false;
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener?.('abort', onAbort, { once: true });
    const timer = setTimeoutImpl(() => {
      timedOut = true;
      controller.abort('canva-oauth-timeout');
    }, timeoutMs);

    let response = null;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization,
          'content-type': 'application/x-www-form-urlencoded',
          ...(json ? { accept: 'application/json' } : {})
        },
        body,
        redirect: 'error',
        signal: controller.signal
      });
      if (!response?.ok) {
        await closeResponseBody(response);
        return Object.freeze({ ok: false, status: Number(response?.status) || 0, payload: null });
      }
      if (!json) {
        await closeResponseBody(response);
        return Object.freeze({ ok: true, status: Number(response.status) || 200, payload: null });
      }
      const payload = await readBoundedJson(response, maxResponseBytes);
      return Object.freeze({ ok: true, status: Number(response.status) || 200, payload });
    } catch (error) {
      if (timedOut) fail('CANVA_OAUTH_UPSTREAM_TIMEOUT');
      if (signal?.aborted) fail('CANVA_OAUTH_UPSTREAM_CANCELLED');
      if (error?.code === 'CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE' || error?.code === 'CANVA_OAUTH_UPSTREAM_RESPONSE_TOO_LARGE') throw error;
      throw error;
    } finally {
      clearTimeoutImpl(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
  }

  return Object.freeze({ postForm });
}

export {
  DEFAULT_TIMEOUT_MS as CANVA_OAUTH_UPSTREAM_TIMEOUT_MS,
  MAX_TIMEOUT_MS as CANVA_OAUTH_UPSTREAM_MAX_TIMEOUT_MS,
  DEFAULT_MAX_RESPONSE_BYTES as CANVA_OAUTH_UPSTREAM_MAX_RESPONSE_BYTES,
  closeResponseBody as closeCanvaOAuthResponseBody,
  readBoundedJson as readCanvaOAuthJson
};
