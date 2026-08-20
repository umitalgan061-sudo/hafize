const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
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

export function createCanvaOAuthUpstream({
  fetchImpl = globalThis.fetch,
  AbortControllerImpl = globalThis.AbortController,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== 'function') fail('INVALID_CANVA_OAUTH_UPSTREAM:fetch');
  if (typeof AbortControllerImpl !== 'function') fail('INVALID_CANVA_OAUTH_UPSTREAM:abortController');
  if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') fail('INVALID_CANVA_OAUTH_UPSTREAM:timer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) fail('INVALID_CANVA_OAUTH_UPSTREAM:timeoutMs');

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
      if (typeof response.json !== 'function') {
        await closeResponseBody(response);
        fail('CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE');
      }
      const payload = await response.json();
      return Object.freeze({ ok: true, status: Number(response.status) || 200, payload });
    } catch (error) {
      if (timedOut) fail('CANVA_OAUTH_UPSTREAM_TIMEOUT');
      if (signal?.aborted) fail('CANVA_OAUTH_UPSTREAM_CANCELLED');
      if (error?.code === 'CANVA_OAUTH_UPSTREAM_INVALID_RESPONSE') throw error;
      throw error;
    } finally {
      clearTimeoutImpl(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
  }

  return Object.freeze({ postForm });
}

export { DEFAULT_TIMEOUT_MS as CANVA_OAUTH_UPSTREAM_TIMEOUT_MS, MAX_TIMEOUT_MS as CANVA_OAUTH_UPSTREAM_MAX_TIMEOUT_MS, closeResponseBody as closeCanvaOAuthResponseBody };
