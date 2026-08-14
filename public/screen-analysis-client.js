(function exposeHafizeScreenAnalysisClient(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizeScreenAnalysisClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createScreenAnalysisClient() {
  'use strict';

  const ENDPOINT = '/api/screen-analysis';
  const MAX_IMAGE_BYTES = 1024 * 1024;

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

  async function analyzeCapture({ capture, model, prompt, explicitUserIntent, fetchImpl = globalThis.fetch, FileReaderCtor } = {}) {
    if (explicitUserIntent !== true) throw new Error('SCREEN_ANALYSIS_CONFIRMATION_REQUIRED');
    if (!capture?.blob) throw new Error('SCREEN_CAPTURE_REQUIRED');
    if (typeof fetchImpl !== 'function') throw new Error('SCREEN_ANALYSIS_UNSUPPORTED');
    const cleanModel = typeof model === 'string' ? model.trim() : '';
    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!cleanModel || !cleanPrompt) throw new Error('SCREEN_ANALYSIS_INPUT_REQUIRED');

    const image = await blobToDataUrl(capture.blob, FileReaderCtor);
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ model: cleanModel, prompt: cleanPrompt, image, explicitUserIntent: true })
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'SCREEN_ANALYSIS_FAILED');
    if (typeof payload?.content !== 'string' || !payload.content.trim()) throw new Error('INVALID_SCREEN_ANALYSIS_RESPONSE');
    return Object.freeze({ content: payload.content.trim(), model: typeof payload.model === 'string' ? payload.model : cleanModel });
  }

  return Object.freeze({ ENDPOINT, MAX_IMAGE_BYTES, blobToDataUrl, analyzeCapture });
});
