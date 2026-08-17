(function exposeHafizeScreenAnalysisUi(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else if (root.document) api.mountScreenAnalysisUi({ root });
})(typeof globalThis !== 'undefined' ? globalThis : self, function createScreenAnalysisUi() {
  'use strict';

  const DEFAULT_PROMPT = 'Bu ekran görüntüsünde gördüğün önemli şeyleri kısa ve somut biçimde açıkla.';
  const MAX_PROMPT_CHARS = 1200;
  const PROMPT_PREVIEW_CHARS = 240;

  function normalizePrompt(value) {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/\r\n?/g, '\n').trim();
    if (!clean || clean.length > MAX_PROMPT_CHARS || /[\0\u000b\u000c]/.test(clean)) return null;
    return clean;
  }

  function normalizeNvidiaModel(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > 200 || /[\r\n\0]/.test(clean) || clean.startsWith('local:')) return null;
    return clean;
  }

  function previewText(value, maxChars = PROMPT_PREVIEW_CHARS) {
    const clean = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!clean) return '';
    return clean.length <= maxChars ? clean : `${clean.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }

  function createReviewSnapshot({ capture, model, prompt } = {}) {
    const cleanModel = normalizeNvidiaModel(model);
    const cleanPrompt = normalizePrompt(prompt);
    const width = Number.isInteger(capture?.width) && capture.width > 0 ? capture.width : 0;
    const height = Number.isInteger(capture?.height) && capture.height > 0 ? capture.height : 0;
    if (!capture?.blob || !cleanModel || !cleanPrompt || !width || !height) return null;
    return Object.freeze({ capture, model: cleanModel, prompt: cleanPrompt, width, height });
  }

  function sameSnapshot(snapshot, { capture, model, prompt } = {}) {
    const next = createReviewSnapshot({ capture, model, prompt });
    return Boolean(snapshot && next
      && snapshot.capture === next.capture
      && snapshot.model === next.model
      && snapshot.prompt === next.prompt
      && snapshot.width === next.width
      && snapshot.height === next.height);
  }

  function ensureStyles(document) {
    if (!document?.head || document.querySelector?.('link[data-hafize-screen-analysis-consent-style]')) return false;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/screen-analysis-consent.css';
    link.setAttribute('data-hafize-screen-analysis-consent-style', '1');
    document.head.append(link);
    return true;
  }

  function mountScreenAnalysisUi({ root = globalThis } = {}) {
    const document = root.document;
    const analyzeButton = document?.querySelector?.('#screenShareAnalyze');
    const result = document?.querySelector?.('#screenAnalysisResult');
    const status = document?.querySelector?.('#screenShareStatus');
    const removeButton = document?.querySelector?.('#screenShareRemove');
    const modelSelect = document?.querySelector?.('#modelSelect');
    const previewPanel = document?.querySelector?.('#screenSharePreview');
    const client = root.HafizeScreenAnalysisClient;
    if (!analyzeButton || !result || !status || !removeButton || !modelSelect || !previewPanel || !client?.analyzeCapture) return null;

    ensureStyles(document);
    const originalButtonText = analyzeButton.textContent || 'Hafize ile analiz et';
    let controller = null;
    let currentCapture = null;
    let reviewSnapshot = null;
    let destroyed = false;

    const consent = document.createElement('section');
    consent.className = 'screen-analysis-consent';
    consent.setAttribute('aria-label', 'Ekran analizi gönderim kontrolü');

    const promptLabel = document.createElement('label');
    promptLabel.className = 'screen-analysis-prompt-label';
    promptLabel.setAttribute('for', 'screenAnalysisPrompt');
    promptLabel.textContent = 'Analiz talimatı';

    const promptInput = document.createElement('textarea');
    promptInput.id = 'screenAnalysisPrompt';
    promptInput.className = 'screen-analysis-prompt';
    promptInput.rows = 3;
    promptInput.maxLength = MAX_PROMPT_CHARS;
    promptInput.autocomplete = 'off';
    promptInput.spellcheck = true;
    promptInput.placeholder = DEFAULT_PROMPT;
    promptInput.setAttribute('aria-describedby', 'screenAnalysisPrivacy');

    const privacy = document.createElement('p');
    privacy.id = 'screenAnalysisPrivacy';
    privacy.className = 'screen-analysis-privacy';
    privacy.textContent = 'Sohbet kutusundaki taslak bu işleme dahil edilmez. Görüntü ve bu alan yalnız ikinci onaydan sonra NVIDIA ekran analizine gönderilir.';

    const review = document.createElement('div');
    review.className = 'screen-analysis-review';
    review.hidden = true;
    review.setAttribute('role', 'status');
    review.setAttribute('aria-live', 'polite');
    review.setAttribute('aria-atomic', 'true');

    const reviewTitle = document.createElement('strong');
    reviewTitle.textContent = 'Gönderim özeti';

    const reviewMeta = document.createElement('span');
    reviewMeta.className = 'screen-analysis-review-meta';

    const reviewPrompt = document.createElement('span');
    reviewPrompt.className = 'screen-analysis-review-prompt';

    const reviewNote = document.createElement('span');
    reviewNote.className = 'screen-analysis-review-note';
    reviewNote.textContent = 'Devam edersen seçtiğin görüntü ve yukarıdaki analiz talimatı NVIDIA servisine gönderilir.';

    review.append(reviewTitle, reviewMeta, reviewPrompt, reviewNote);
    consent.append(promptLabel, promptInput, privacy, review);
    previewPanel.append(consent);

    function effectivePrompt() {
      const typed = normalizePrompt(promptInput.value);
      if (promptInput.value.trim()) return typed;
      return DEFAULT_PROMPT;
    }

    function resetResult() {
      controller?.abort?.();
      controller = null;
      result.textContent = '';
      result.hidden = true;
      analyzeButton.disabled = false;
    }

    function invalidateReview({ announce = false } = {}) {
      reviewSnapshot = null;
      review.hidden = true;
      reviewMeta.textContent = '';
      reviewPrompt.textContent = '';
      analyzeButton.textContent = originalButtonText;
      analyzeButton.setAttribute('aria-label', 'Ekran analizini gözden geçir');
      analyzeButton.dataset.stage = 'review';
      if (announce && currentCapture) status.textContent = 'Gönderim ayrıntıları değişti; ekran analizini yeniden gözden geçir.';
    }

    function prepareReview() {
      const model = normalizeNvidiaModel(modelSelect.value);
      const prompt = effectivePrompt();
      if (!currentCapture) {
        status.textContent = 'Önce paylaşılacak bir ekran görüntüsü seç.';
        return false;
      }
      if (!model) {
        status.textContent = String(modelSelect.value || '').trim().startsWith('local:')
          ? 'Ekran analizi NVIDIA üzerinde çalışır; yerel model bu görüntü için kullanılamaz.'
          : 'Ekran analizi için önce bir NVIDIA modeli seç.';
        return false;
      }
      if (!prompt) {
        status.textContent = `Analiz talimatı boş olamaz ve ${MAX_PROMPT_CHARS} karakteri geçemez.`;
        promptInput.focus?.();
        return false;
      }

      const snapshot = createReviewSnapshot({ capture: currentCapture, model, prompt });
      if (!snapshot) {
        status.textContent = 'Ekran analizi gönderim özeti hazırlanamadı.';
        return false;
      }
      reviewSnapshot = snapshot;
      reviewMeta.textContent = `${snapshot.width}×${snapshot.height} görüntü · NVIDIA modeli: ${snapshot.model}`;
      reviewPrompt.textContent = `Talimat: ${previewText(snapshot.prompt)}`;
      review.hidden = false;
      analyzeButton.textContent = 'Onayla ve gönder';
      analyzeButton.setAttribute('aria-label', 'Ekran görüntüsünü ve analiz talimatını NVIDIA analizine gönder');
      analyzeButton.dataset.stage = 'confirm';
      status.textContent = 'Gönderim özetini kontrol et. Henüz hiçbir şey gönderilmedi.';
      return true;
    }

    async function executeReview() {
      const prompt = effectivePrompt();
      const model = normalizeNvidiaModel(modelSelect.value);
      if (!sameSnapshot(reviewSnapshot, { capture: currentCapture, model, prompt })) {
        invalidateReview({ announce: true });
        return;
      }

      const snapshot = reviewSnapshot;
      reviewSnapshot = null;
      controller?.abort?.();
      controller = new AbortController();
      analyzeButton.disabled = true;
      promptInput.disabled = true;
      modelSelect.disabled = true;
      result.hidden = false;
      result.textContent = 'Hafize ekran görüntüsünü analiz ediyor…';
      status.textContent = 'Onaylanan görüntü ve analiz talimatı gönderiliyor…';

      try {
        const response = await client.analyzeCapture({
          capture: snapshot.capture,
          model: snapshot.model,
          prompt: snapshot.prompt,
          explicitUserIntent: true,
          signal: controller.signal
        });
        result.textContent = response.content;
        status.textContent = 'Analiz tamamlandı. Görüntü ve analiz talimatı yalnız bu açık işlem için gönderildi.';
      } catch (error) {
        if (error?.name === 'AbortError' || error?.message === 'SCREEN_ANALYSIS_CANCELLED') {
          result.textContent = 'Ekran analizi iptal edildi.';
        } else if (error?.message === 'SCREEN_ANALYSIS_NVIDIA_MODEL_REQUIRED') {
          result.textContent = 'Ekran analizi için NVIDIA modeli gerekiyor.';
        } else {
          result.textContent = 'Ekran analizi tamamlanamadı.';
        }
      } finally {
        if (!destroyed) {
          analyzeButton.disabled = false;
          promptInput.disabled = false;
          modelSelect.disabled = false;
          invalidateReview();
        }
        controller = null;
      }
    }

    async function analyze() {
      if (analyzeButton.disabled) return;
      if (reviewSnapshot) return executeReview();
      prepareReview();
    }

    function onCaptureReady(event) {
      currentCapture = event?.detail?.capture || null;
      resetResult();
      invalidateReview();
      promptInput.value = '';
    }

    function onCaptureCleared() {
      currentCapture = null;
      resetResult();
      invalidateReview();
      promptInput.value = '';
    }

    function onPromptInput() {
      if (reviewSnapshot) invalidateReview({ announce: true });
    }

    function onModelChange() {
      if (reviewSnapshot) invalidateReview({ announce: true });
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !reviewSnapshot) return;
      event.preventDefault?.();
      invalidateReview();
      status.textContent = 'Ekran analizi gönderim onayı iptal edildi.';
      promptInput.focus?.();
    }

    function onPageHide() {
      controller?.abort?.();
    }

    analyzeButton.addEventListener('click', analyze);
    removeButton.addEventListener('click', onCaptureCleared);
    promptInput.addEventListener('input', onPromptInput);
    modelSelect.addEventListener('change', onModelChange);
    document.addEventListener?.('keydown', onKeydown);
    root.addEventListener?.('hafize:screen-capture-ready', onCaptureReady);
    root.addEventListener?.('hafize:screen-capture-cleared', onCaptureCleared);
    root.addEventListener?.('pagehide', onPageHide, { once: true });
    invalidateReview();

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      controller?.abort?.();
      controller = null;
      analyzeButton.removeEventListener('click', analyze);
      removeButton.removeEventListener('click', onCaptureCleared);
      promptInput.removeEventListener('input', onPromptInput);
      modelSelect.removeEventListener('change', onModelChange);
      document.removeEventListener?.('keydown', onKeydown);
      root.removeEventListener?.('hafize:screen-capture-ready', onCaptureReady);
      root.removeEventListener?.('hafize:screen-capture-cleared', onCaptureCleared);
      root.removeEventListener?.('pagehide', onPageHide);
      consent.remove?.();
      analyzeButton.textContent = originalButtonText;
      analyzeButton.removeAttribute?.('data-stage');
      analyzeButton.removeAttribute?.('aria-label');
      analyzeButton.disabled = false;
      modelSelect.disabled = false;
    }

    return Object.freeze({
      analyze,
      prepareReview,
      resetResult,
      invalidateReview,
      getReviewSnapshot: () => reviewSnapshot,
      destroy
    });
  }

  return Object.freeze({
    DEFAULT_PROMPT,
    MAX_PROMPT_CHARS,
    PROMPT_PREVIEW_CHARS,
    normalizePrompt,
    normalizeNvidiaModel,
    previewText,
    createReviewSnapshot,
    sameSnapshot,
    mountScreenAnalysisUi
  });
});