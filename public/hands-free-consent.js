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
  const activeInstallations = new WeakMap();

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

  function canReview(documentRef, root, toggle) {
    return Boolean(
      toggle
      && !toggle.disabled
      && documentRef?.hidden !== true
      && root?.isSecureContext === true
      && toggle.getAttribute?.('aria-pressed') !== 'true'
    );
  }

  function isTrustedActivation(event) {
    return Boolean(event && event.isTrusted === true);
  }

  function readNow(root) {
    const value = root?.Date?.now?.();
    return Number.isFinite(value) ? value : Date.now();
  }

  function snapshotAttribute(element, name) {
    const present = Boolean(element?.hasAttribute?.(name));
    return Object.freeze({ present, value: present ? element.getAttribute(name) : null });
  }

  function restoreAttribute(element, name, snapshot) {
    if (!element || !snapshot) return;
    if (snapshot.present) element.setAttribute?.(name, snapshot.value ?? '');
    else element.removeAttribute?.(name);
  }

  function snapshotToggle(toggle) {
    return Object.freeze({
      disabled: Boolean(toggle.disabled),
      title: toggle.title,
      consentPending: snapshotAttribute(toggle, 'data-consent-pending'),
      consentBlocked: snapshotAttribute(toggle, 'data-consent-blocked'),
      describedBy: snapshotAttribute(toggle, 'aria-describedby')
    });
  }

  function restoreToggle(toggle, baseline) {
    toggle.disabled = baseline.disabled;
    toggle.title = baseline.title;
    restoreAttribute(toggle, 'data-consent-pending', baseline.consentPending);
    restoreAttribute(toggle, 'data-consent-blocked', baseline.consentBlocked);
    restoreAttribute(toggle, 'aria-describedby', baseline.describedBy);
  }

  function installBlockedConsent(toggle, baseline, reason) {
    toggle.disabled = true;
    toggle.title = 'Eller serbest mikrofon onayı güvenli biçimde başlatılamadı.';
    toggle.setAttribute?.('data-consent-pending', 'false');
    toggle.setAttribute?.('data-consent-blocked', reason);
    restoreAttribute(toggle, 'aria-describedby', baseline.describedBy);

    let destroyed = false;
    let controller = null;
    controller = Object.freeze({
      isPending: () => false,
      isBlocked: () => !destroyed,
      getBlockReason: () => destroyed ? '' : reason,
      begin: () => false,
      cancel: () => false,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        restoreToggle(toggle, baseline);
        if (activeInstallations.get(toggle) === controller) activeInstallations.delete(toggle);
      }
    });
    activeInstallations.set(toggle, controller);
    return controller;
  }

  function installHandsFreeConsent(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#handsFreeToggle');
    const indicator = documentRef?.querySelector?.('#handsFreeIndicator');
    if (!toggle || !indicator || typeof documentRef.createElement !== 'function') return null;
    if (activeInstallations.has(toggle)) throw new Error('HANDS_FREE_CONSENT_ALREADY_INSTALLED');

    const baseline = snapshotToggle(toggle);
    if (documentRef.getElementById?.(REVIEW_ID)) {
      return installBlockedConsent(toggle, baseline, 'review-collision');
    }
    if (typeof root?.setTimeout !== 'function' || typeof root?.clearTimeout !== 'function') {
      return installBlockedConsent(toggle, baseline, 'timer-unavailable');
    }

    const review = createReview(documentRef);
    indicator.insertAdjacentElement?.('afterend', review.panel);
    if (!review.panel.parentNode) indicator.parentNode?.insertBefore?.(review.panel, indicator.nextSibling || null);
    if (!review.panel.parentNode) {
      review.panel.remove?.();
      return installBlockedConsent(toggle, baseline, 'review-mount-failed');
    }

    let pending = false;
    let timeoutId = null;
    let expiresAt = 0;
    let bypass = false;
    let destroyed = false;
    let controller = null;

    function clearTimer() {
      if (timeoutId != null) root.clearTimeout(timeoutId);
      timeoutId = null;
      expiresAt = 0;
    }

    function render() {
      if (destroyed) return;
      review.panel.hidden = !pending;
      toggle.setAttribute?.('data-consent-pending', String(pending));
      toggle.removeAttribute?.('data-consent-blocked');
      if (pending) toggle.setAttribute?.('aria-describedby', REVIEW_ID);
      else restoreAttribute(toggle, 'aria-describedby', baseline.describedBy);
    }

    function cancel({ focusToggle = false } = {}) {
      if (destroyed || !pending) return false;
      pending = false;
      clearTimer();
      render();
      if (focusToggle && !documentRef.hidden) toggle.focus?.();
      return true;
    }

    function expire() {
      timeoutId = null;
      expiresAt = 0;
      if (destroyed || !pending) return;
      pending = false;
      render();
      if (!documentRef.hidden) toggle.focus?.();
    }

    function begin() {
      if (destroyed || pending || !canReview(documentRef, root, toggle)) return false;
      const deadline = readNow(root) + CONSENT_TIMEOUT_MS;
      let nextTimer = null;
      try { nextTimer = root.setTimeout(expire, CONSENT_TIMEOUT_MS); }
      catch { return false; }
      if (nextTimer == null) return false;
      expiresAt = deadline;
      timeoutId = nextTimer;
      pending = true;
      render();
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
      if (!isTrustedActivation(event)) return;
      if (pending) cancel({ focusToggle: true });
      else begin();
    }

    function onConfirm(event) {
      event?.preventDefault?.();
      if (!isTrustedActivation(event)) return;
      if (destroyed || !pending || !canReview(documentRef, root, toggle)) {
        cancel({ focusToggle: true });
        return;
      }
      if (!expiresAt || readNow(root) >= expiresAt) {
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

    function removeBindings() {
      toggle.removeEventListener?.('click', onToggleCapture, true);
      review.confirm.removeEventListener?.('click', onConfirm);
      review.cancel.removeEventListener?.('click', onCancel);
      documentRef.removeEventListener?.('keydown', onKeydown);
      documentRef.removeEventListener?.('visibilitychange', onVisibility);
    }

    try {
      toggle.addEventListener?.('click', onToggleCapture, true);
      review.confirm.addEventListener?.('click', onConfirm);
      review.cancel.addEventListener?.('click', onCancel);
      documentRef.addEventListener?.('keydown', onKeydown);
      documentRef.addEventListener?.('visibilitychange', onVisibility);
      render();
    } catch (error) {
      destroyed = true;
      clearTimer();
      removeBindings();
      review.panel.remove?.();
      restoreToggle(toggle, baseline);
      throw error;
    }

    controller = Object.freeze({
      isPending: () => !destroyed && pending,
      isBlocked: () => false,
      getBlockReason: () => '',
      begin,
      cancel,
      destroy() {
        if (destroyed) return;
        clearTimer();
        pending = false;
        destroyed = true;
        removeBindings();
        restoreToggle(toggle, baseline);
        review.panel.remove?.();
        if (activeInstallations.get(toggle) === controller) activeInstallations.delete(toggle);
      }
    });
    activeInstallations.set(toggle, controller);
    return controller;
  }

  return Object.freeze({
    CONSENT_TIMEOUT_MS,
    REVIEW_ID,
    canReview,
    createReview,
    isTrustedActivation,
    readNow,
    installHandsFreeConsent
  });
});