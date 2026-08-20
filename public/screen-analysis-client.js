(function exposeHafizeScreenAnalysisClient(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeScreenAnalysisClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createScreenAnalysisClient() {
  'use strict';

  const ENDPOINT = '/api/screen-analysis';
  const MAX_IMAGE_BYTES = 1024 * 1024;
  const MAX_PROMPT_CHARS = 4000;
  const REQUEST_TIMEOUT_MS = 45_000;

  function requestError(code) {
    const error = new Error(code);
    error.name = 'AbortError';
    error.code = code;
    return error;
  }

  function blobToDataUrl(blob, FileReaderCtor = globalThis.FileReader) {
    if (!(blob instanceof Blob) || blob.type !== 'image/jpeg' || blob.size <= 0 || blob.size > MAX_IMAGE_BYTES) {
      return Promise.reject(new Error('INVALID_SCREEN_CAPTURE'));
    }
    if (typeof FileReaderCtor !== 'function') return Promise.reject(new Error('SCREEN_ANALYSIS_UNSUPPORTED'));
    return new Promise((resolve, reject) => {
      const reader = new FileReaderCtor();
      reader.onerror = () => reject(new Error('SCREEN_ANALYSIS_ENCODE_FAILED'));
      reader.onload = () => {
        const value = typeof reader.result === 'string' ? reader.result : '';
        if (!value.startsWith('data:image/jpeg;base64,')) reject(new Error('SCREEN_ANALYSIS_ENCODE_FAILED'));
        else resolve(value);
      };
      reader.readAsDataURL(blob);
    });
  }

  function normalizeNvidiaModel(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > 200 || /[\r\n\0]/.test(clean) || clean.startsWith('local:')) return null;
    return clean;
  }

  function normalizePrompt(value) {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/\r\n?/g, '\n').trim();
    if (!clean || clean.length > MAX_PROMPT_CHARS || /[\0\u000b\u000c]/.test(clean)) return null;
    return clean;
  }

  function createRequestClient({
    fetchImpl = globalThis.fetch,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('SCREEN_ANALYSIS_UNSUPPORTED');
    if (typeof AbortControllerImpl !== 'function') throw new Error('SCREEN_ANALYSIS_ABORT_UNSUPPORTED');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('SCREEN_ANALYSIS_TIMER_UNSUPPORTED');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_SCREEN_ANALYSIS_TIMEOUT');

    return Object.freeze({
      async post(body, { signal } = {}) {
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_SCREEN_ANALYSIS_SIGNAL');
        }
        if (signal?.aborted) throw requestError('SCREEN_ANALYSIS_CANCELLED');

        const controller = new AbortControllerImpl();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener?.('abort', onAbort, { once: true });
        const timer = setTimeoutImpl(() => {
          timedOut = true;
          controller.abort('screen-analysis-timeout');
        }, timeoutMs);

        try {
          return await fetchImpl(ENDPOINT, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            body: JSON.stringify(body)
          });
        } catch (error) {
          if (timedOut) throw requestError('SCREEN_ANALYSIS_TIMEOUT');
          if (signal?.aborted) throw requestError('SCREEN_ANALYSIS_CANCELLED');
          throw error;
        } finally {
          clearTimeoutImpl(timer);
          signal?.removeEventListener?.('abort', onAbort);
        }
      }
    });
  }

  async function analyzeCapture({
    capture,
    model,
    prompt,
    explicitUserIntent,
    signal,
    fetchImpl = globalThis.fetch,
    FileReaderCtor,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (explicitUserIntent !== true) throw new Error('SCREEN_ANALYSIS_CONFIRMATION_REQUIRED');
    if (!capture?.blob) throw new Error('SCREEN_CAPTURE_REQUIRED');
    const cleanModel = normalizeNvidiaModel(model);
    const cleanPrompt = normalizePrompt(prompt);
    if (!cleanModel) throw new Error('SCREEN_ANALYSIS_NVIDIA_MODEL_REQUIRED');
    if (!cleanPrompt) throw new Error('SCREEN_ANALYSIS_INPUT_REQUIRED');
    if (signal?.aborted) throw requestError('SCREEN_ANALYSIS_CANCELLED');

    const image = await blobToDataUrl(capture.blob, FileReaderCtor);
    if (signal?.aborted) throw requestError('SCREEN_ANALYSIS_CANCELLED');

    const client = createRequestClient({
      fetchImpl,
      AbortControllerImpl,
      setTimeoutImpl,
      clearTimeoutImpl,
      timeoutMs
    });
    const response = await client.post({ model: cleanModel, prompt: cleanPrompt, image, explicitUserIntent: true }, { signal });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'SCREEN_ANALYSIS_FAILED');
    if (typeof payload?.content !== 'string' || !payload.content.trim()) throw new Error('INVALID_SCREEN_ANALYSIS_RESPONSE');
    return Object.freeze({ content: payload.content.trim(), model: typeof payload.model === 'string' ? payload.model : cleanModel });
  }

  return Object.freeze({
    ENDPOINT,
    MAX_IMAGE_BYTES,
    MAX_PROMPT_CHARS,
    REQUEST_TIMEOUT_MS,
    requestError,
    blobToDataUrl,
    normalizeNvidiaModel,
    normalizePrompt,
    createRequestClient,
    analyzeCapture
  });
});