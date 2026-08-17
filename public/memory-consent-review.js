(function exposeHafizeMemoryConsentReview(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMemoryConsentReview = api;
  const install = () => api.install(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMemoryConsentReview() {
  'use strict';

  const MAX_CONTENT_CHARS = 4000;
  const MAX_PREVIEW_CHARS = 240;
  const DELETE_CONFIRM_MS = 8000;
  const MEMORY_ID = /^memory_[A-Za-z0-9_-]{8,80}$/;
  const KINDS = Object.freeze(['identity', 'preference', 'project', 'note']);
  const LABELS = Object.freeze({ identity: 'Kimlik', preference: 'Tercih', project: 'Proje', note: 'Not' });

  function normalizeKind(value) {
    return typeof value === 'string' && KINDS.includes(value) ? value : null;
  }

  function normalizeContent(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_CONTENT_CHARS) return null;
    return clean;
  }

  function buildReviewSnapshot(kind, content) {
    const safeKind = normalizeKind(kind);
    const safeContent = normalizeContent(content);
    if (!safeKind || !safeContent) return null;
    return Object.freeze({
      kind: safeKind,
      content: safeContent,
      preview: safeContent.length > MAX_PREVIEW_CHARS
        ? `${safeContent.slice(0, MAX_PREVIEW_CHARS - 1)}…`
        : safeContent,
      characters: safeContent.length
    });
  }

  function sameSnapshot(snapshot, kind, content) {
    const next = buildReviewSnapshot(kind, content);
    return Boolean(snapshot && next && snapshot.kind === next.kind && snapshot.content === next.content);
  }

  function normalizeMemoryId(value) {
    return typeof value === 'string' && MEMORY_ID.test(value) ? value : null;
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-memory-consent-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/memory-consent-review.css';
    link.setAttribute('data-hafize-memory-consent-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function install(documentRef, root) {
    if (!documentRef?.body || !root) return null;
    const form = documentRef.querySelector?.('#memoryWriteForm');
    const kind = documentRef.querySelector?.('#memoryWriteKind');
    const content = documentRef.querySelector?.('#memoryContent');
    const results = documentRef.querySelector?.('#memoryResults');
    const status = documentRef.querySelector?.('#memoryStatus');
    if (!form || !kind || !content || !results || !status) return null;
    if (form.querySelector?.('[data-hafize-memory-review]')) return null;

    ensureStyles(documentRef);
    let reviewSnapshot = null;
    let bypassWriteOnce = false;
    let pendingDeleteButton = null;
    let deleteTimer = null;
    let destroyed = false;

    const review = documentRef.createElement('section');
    review.className = 'memory-consent-review';
    review.dataset.hafizeMemoryReview = '1';
    review.hidden = true;
    review.setAttribute('aria-labelledby', 'memoryConsentReviewTitle');

    const heading = documentRef.createElement('strong');
    heading.id = 'memoryConsentReviewTitle';
    heading.textContent = 'Belleğe kaydetmeden önce kontrol et';

    const meta = documentRef.createElement('p');
    meta.className = 'memory-consent-meta';
    const preview = documentRef.createElement('p');
    preview.className = 'memory-consent-preview';

    const actions = documentRef.createElement('div');
    actions.className = 'memory-consent-actions';
    const cancel = documentRef.createElement('button');
    cancel.type = 'button';
    cancel.className = 'memory-consent-cancel';
    cancel.textContent = 'Vazgeç';
    const confirm = documentRef.createElement('button');
    confirm.type = 'button';
    confirm.className = 'memory-consent-confirm';
    confirm.textContent = 'Onayla ve kaydet';
    actions.append(cancel, confirm);
    review.append(heading, meta, preview, actions);
    form.append(review);

    function announce(text, state = 'idle') {
      status.textContent = text;
      status.dataset.state = state;
    }

    function closeReview({ focusContent = false, announceCancel = false } = {}) {
      reviewSnapshot = null;
      review.hidden = true;
      review.removeAttribute('data-kind');
      meta.textContent = '';
      preview.textContent = '';
      if (announceCancel) announce('Bellek kaydı onayı iptal edildi.', 'idle');
      if (focusContent) content.focus?.();
    }

    function openReview(snapshot) {
      reviewSnapshot = snapshot;
      review.hidden = false;
      review.dataset.kind = snapshot.kind;
      meta.textContent = `${LABELS[snapshot.kind]} · ${snapshot.characters} karakter`;
      preview.textContent = snapshot.preview;
      announce('Bellek kaydı henüz yapılmadı. İçeriği kontrol edip ayrıca onayla.', 'warning');
      confirm.focus?.();
    }

    function resetDelete({ focus = false } = {}) {
      if (deleteTimer !== null) root.clearTimeout?.(deleteTimer);
      deleteTimer = null;
      const button = pendingDeleteButton;
      pendingDeleteButton = null;
      if (!button) return;
      button.classList?.remove?.('memory-delete-confirming');
      button.removeAttribute?.('data-confirming');
      button.textContent = 'Sil';
      button.setAttribute?.('aria-label', 'Bu bellek kaydını sil');
      if (focus) button.focus?.();
    }

    function armDelete(button) {
      resetDelete();
      pendingDeleteButton = button;
      button.classList?.add?.('memory-delete-confirming');
      button.dataset.confirming = 'true';
      button.textContent = 'Tekrar tıkla: sil';
      button.setAttribute?.('aria-label', 'Bellek kaydını silmeyi onaylamak için tekrar tıkla');
      announce('Silme işlemi henüz yapılmadı. 8 saniye içinde aynı düğmeye tekrar basarak onayla.', 'warning');
      deleteTimer = root.setTimeout?.(() => {
        resetDelete();
        announce('Bellek silme onayı zaman aşımına uğradı.', 'idle');
      }, DELETE_CONFIRM_MS) ?? null;
    }

    function onSubmitCapture(event) {
      if (destroyed) return;
      if (bypassWriteOnce) {
        bypassWriteOnce = false;
        closeReview();
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      const snapshot = buildReviewSnapshot(kind.value, content.value);
      if (!snapshot) {
        announce('Kaydetmek istediğin geçerli bellek içeriğini önce kontrol et.', 'error');
        content.focus?.();
        return;
      }
      openReview(snapshot);
    }

    function onConfirm() {
      if (!reviewSnapshot) return;
      if (!sameSnapshot(reviewSnapshot, kind.value, content.value)) {
        closeReview({ focusContent: true });
        announce('Bellek içeriği değişti. Güncel metni yeniden gözden geçir.', 'warning');
        return;
      }
      bypassWriteOnce = true;
      form.requestSubmit?.();
    }

    function onInputChange() {
      if (!reviewSnapshot) return;
      if (!sameSnapshot(reviewSnapshot, kind.value, content.value)) {
        closeReview();
        announce('Bellek taslağı değişti; kaydetmeden önce yeniden gözden geçir.', 'warning');
      }
    }

    function onDeleteCapture(event) {
      const button = event.target?.closest?.('.memory-delete-btn');
      if (!button || !results.contains?.(button)) return;
      const memoryId = normalizeMemoryId(button.dataset?.memoryId);
      if (!memoryId) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return;
      }
      if (pendingDeleteButton === button && button.dataset?.confirming === 'true') {
        resetDelete();
        return;
      }
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      armDelete(button);
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape') return;
      if (!review.hidden) {
        event.preventDefault?.();
        closeReview({ focusContent: true, announceCancel: true });
        return;
      }
      if (pendingDeleteButton) {
        event.preventDefault?.();
        resetDelete({ focus: true });
        announce('Bellek silme onayı iptal edildi.', 'idle');
      }
    }

    form.addEventListener('submit', onSubmitCapture, true);
    kind.addEventListener('change', onInputChange);
    content.addEventListener('input', onInputChange);
    cancel.addEventListener('click', () => closeReview({ focusContent: true, announceCancel: true }));
    confirm.addEventListener('click', onConfirm);
    results.addEventListener('click', onDeleteCapture, true);
    documentRef.addEventListener?.('keydown', onKeydown);

    return Object.freeze({
      getReview: () => reviewSnapshot,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        resetDelete();
        form.removeEventListener?.('submit', onSubmitCapture, true);
        kind.removeEventListener?.('change', onInputChange);
        content.removeEventListener?.('input', onInputChange);
        confirm.removeEventListener?.('click', onConfirm);
        results.removeEventListener?.('click', onDeleteCapture, true);
        documentRef.removeEventListener?.('keydown', onKeydown);
        review.remove?.();
      }
    });
  }

  return Object.freeze({
    MAX_CONTENT_CHARS,
    MAX_PREVIEW_CHARS,
    DELETE_CONFIRM_MS,
    KINDS,
    normalizeKind,
    normalizeContent,
    buildReviewSnapshot,
    sameSnapshot,
    normalizeMemoryId,
    install
  });
});
