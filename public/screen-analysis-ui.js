(function exposeHafizeScreenAnalysisUi(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else if (root.document) api.mountScreenAnalysisUi({ root });
})(typeof globalThis !== 'undefined' ? globalThis : self, function createScreenAnalysisUi() {
  'use strict';

  const DEFAULT_PROMPT = 'Bu ekran görüntüsünde gördüğün önemli şeyleri kısa ve somut biçimde açıkla.';

  function mountScreenAnalysisUi({ root = globalThis } = {}) {
    const document = root.document;
    const analyzeButton = document?.querySelector?.('#screenShareAnalyze');
    const result = document?.querySelector?.('#screenAnalysisResult');
    const status = document?.querySelector?.('#screenShareStatus');
    const removeButton = document?.querySelector?.('#screenShareRemove');
    const modelSelect = document?.querySelector?.('#modelSelect');
    const messageInput = document?.querySelector?.('#messageInput');
    const client = root.HafizeScreenAnalysisClient;
    if (!analyzeButton || !result || !status || !removeButton || !modelSelect || !client?.analyzeCapture) return null;

    let controller = null;
    let currentCapture = null;

    function resetResult() {
      controller?.abort?.();
      controller = null;
      result.textContent = '';
      result.hidden = true;
      analyzeButton.disabled = false;
    }

    async function analyze() {
      const capture = currentCapture;
      const model = typeof modelSelect.value === 'string' ? modelSelect.value.trim() : '';
      if (!capture) {
        status.textContent = 'Önce paylaşılacak bir ekran görüntüsü seç.';
        return;
      }
      if (!model) {
        status.textContent = 'Ekran analizi için önce bir NVIDIA modeli seç.';
        return;
      }

      controller?.abort?.();
      controller = new AbortController();
      analyzeButton.disabled = true;
      result.hidden = false;
      result.textContent = 'Hafize ekran görüntüsünü analiz ediyor…';
      const typedPrompt = typeof messageInput?.value === 'string' ? messageInput.value.trim() : '';
      try {
        const response = await client.analyzeCapture({
          capture,
          model,
          prompt: typedPrompt || DEFAULT_PROMPT,
          explicitUserIntent: true,
          signal: controller.signal
        });
        result.textContent = response.content;
        status.textContent = 'Analiz tamamlandı. Görüntü yalnız bu geçici işlem için gönderildi.';
      } catch (error) {
        if (error?.name === 'AbortError' || error?.message === 'SCREEN_ANALYSIS_CANCELLED') {
          result.textContent = 'Ekran analizi iptal edildi.';
        } else {
          result.textContent = 'Ekran analizi tamamlanamadı.';
        }
      } finally {
        analyzeButton.disabled = false;
        controller = null;
      }
    }

    analyzeButton.addEventListener('click', analyze);
    removeButton.addEventListener('click', () => { currentCapture = null; resetResult(); });
    root.addEventListener?.('hafize:screen-capture-ready', (event) => { currentCapture = event?.detail?.capture || null; resetResult(); });
    root.addEventListener?.('hafize:screen-capture-cleared', () => { currentCapture = null; resetResult(); });
    root.addEventListener?.('pagehide', () => controller?.abort?.(), { once: true });
    return Object.freeze({ analyze, resetResult });
  }

  return Object.freeze({ DEFAULT_PROMPT, mountScreenAnalysisUi });
});
