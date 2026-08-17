(function exposeHafizeHandsFreeConsent(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeHandsFreeConsent = api;
  const install = () => api.installHandsFreeConsent(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeHandsFreeConsent() {
  'use strict';

  const CONSENT_TIMEOUT_MS = 15_000;
  const REVIEW_ID = 'handsFreeConsentReview';

  function createReview(documentRef) {
    const panel = documentRef.createElement('div');
    panel.id = REVIEW_ID;
    panel.className = 'hands-free-consent';
    panel.hidden = true;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Eller serbest mikrofon izni');

    const title = documentRef.createElement('strong');
    title.textContent = 'Mikrofon dinlemesini aç?';

    const copy = documentRef.createElement('p');
    copy.textContent = 'Hafize, yalnız bu oturumda “Hafize” uyandırma ifadesini dinler. Dinleme görünür kalır, 30 dakika sonra kapanır ve konuşman otomatik gönderilmez.';

    const actions = documentRef.createElement('div');
    actions.className = 'hands-free-consent-actions';

    const confirm = documentRef.createElement('button');
    confirm.type = 'button';
    confirm.className = 'hands-free-consent-confirm';
    confirm.textContent = 'Onayla ve dinlemeyi aç';

    const cancel = documentRef.createElement('button');
    cancel.type = 'button';
    cancel.className = 'hands-free-consent-cancel';
    cancel.textContent = 'Vazgeç';

    actions.append(confirm, cancel);
    panel.append(title, copy, actions);
    return Object.freeze({ panel, confirm, cancel });
  }

  function installHandsFreeConsent(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#handsFreeToggle');
    const indicator = documentRef?.querySelector?.('#handsFreeIndicator');
    if (!toggle || !indicator || typeof documentRef.createElement !== 'function') return null;
    if (documentRef.getElementById?.(REVIEW_ID)) return null;

    const review = createReview(documentRef);
    indicator.insertAdjacentElement?.('afterend', review.panel);
    if (!review.panel.parentNode) indicator.parentNode?.insertBefore?.(review.panel, indicator.nextSibling || null);

    let pending = false;
    let timeoutId = null;
    let bypass = false;
    let destroyed = false;

    function clearTimer() {
      if (timeoutId != null && typeof root?.clearTimeout === 'function') root.clearTimeout(timeoutId);
      timeoutId = null;
    }

    function render() {
      review.panel.hidden = !pending;
      toggle.setAttribute?.('data-consent-pending', String(pending));
      if (pending) toggle.setAttribute?.('aria-describedby', REVIEW_ID);
      else toggle.removeAttribute?.('aria-describedby');
    }

    function cancel({ focusToggle = false } = {}) {
      if (!pending) return false;
      pending = false;
      clearTimer();
      render();
      if (focusToggle && !documentRef.hidden) toggle.focus?.();
      return true;
    }

    function expire() {
      timeoutId = null;
      if (destroyed || !pending) return;
      pending = false;
      render();
      if (!documentRef.hidden) toggle.focus?.();
    }

    function begin() {
      if (destroyed || pending || toggle.disabled || toggle.getAttribute?.('aria-pressed') === 'true') return false;
      pending = true;
      render();
      if (typeof root?.setTimeout === 'function') timeoutId = root.setTimeout(expire, CONSENT_TIMEOUT_MS);
      review.confirm.focus?.();
      return true;
    }

    function onToggleCapture(event) {
      if (destroyed || bypass) return;
      if (toggle.getAttribute?.('aria-pressed') === 'true') {
        cancel();
        return;
      }
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      if (pending) cancel({ focusToggle: true });
      else begin();
    }

    function onConfirm(event) {
      event?.preventDefault?.();
      if (destroyed || !pending || toggle.disabled || toggle.getAttribute?.('aria-pressed') === 'true') {
        cancel({ focusToggle: true });
        return;
      }
      pending = false;
      clearTimer();
      render();
      bypass = true;
      try { toggle.click?.(); }
      finally { bypass = false; }
    }

    function onCancel(event) {
      event?.preventDefault?.();
      cancel({ focusToggle: true });
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !pending) return;
      event.preventDefault?.();
      cancel({ focusToggle: true });
    }

    function onVisibility() {
      if (documentRef.hidden) cancel();
    }

    toggle.addEventListener?.('click', onToggleCapture, true);
    review.confirm.addEventListener?.('click', onConfirm);
    review.cancel.addEventListener?.('click', onCancel);
    documentRef.addEventListener?.('keydown', onKeydown);
    documentRef.addEventListener?.('visibilitychange', onVisibility);
    render();

    return Object.freeze({
      isPending: () => pending,
      begin,
      cancel,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        cancel();
        clearTimer();
        toggle.removeEventListener?.('click', onToggleCapture, true);
        review.confirm.removeEventListener?.('click', onConfirm);
        review.cancel.removeEventListener?.('click', onCancel);
        documentRef.removeEventListener?.('keydown', onKeydown);
        documentRef.removeEventListener?.('visibilitychange', onVisibility);
        review.panel.remove?.();
      }
    });
  }

  return Object.freeze({ CONSENT_TIMEOUT_MS, REVIEW_ID, createReview, installHandsFreeConsent });
});
