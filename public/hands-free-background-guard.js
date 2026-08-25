(function exposeHafizeHandsFreeBackgroundGuard(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeHandsFreeBackgroundGuard = api;
  const install = () => api.installHandsFreeBackgroundGuard(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeHandsFreeBackgroundGuard() {
  'use strict';

  const REVOKED_ATTR = 'data-background-revoked';
  const REVOCATION_NOTICE = 'Eller serbest, uygulama arka plana geçtiği için kapatıldı. Yeniden dinlemek için Eller serbest düğmesinden tekrar onay ver.';
  const activeInstallations = new WeakMap();

  function isHandsFreeEnabled(toggle) {
    return toggle?.getAttribute?.('aria-pressed') === 'true';
  }

  function installHandsFreeBackgroundGuard(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#handsFreeToggle');
    const toast = documentRef?.querySelector?.('#toast') || null;
    if (!toggle || typeof toggle.click !== 'function') return null;
    if (activeInstallations.has(toggle)) throw new Error('HANDS_FREE_BACKGROUND_GUARD_ALREADY_INSTALLED');

    const baseline = Object.freeze({
      revokedPresent: Boolean(toggle.hasAttribute?.(REVOKED_ATTR)),
      revokedValue: toggle.getAttribute?.(REVOKED_ATTR) ?? null
    });
    let destroyed = false;
    let lastReason = '';
    let noticePending = false;
    let controller = null;

    function restoreRevokedAttribute() {
      if (baseline.revokedPresent) toggle.setAttribute?.(REVOKED_ATTR, baseline.revokedValue ?? '');
      else toggle.removeAttribute?.(REVOKED_ATTR);
    }

    function announceRevocation() {
      if (destroyed || !noticePending || documentRef.hidden === true || !toast) return false;
      noticePending = false;
      toast.textContent = REVOCATION_NOTICE;
      toast.classList?.remove?.('hidden');
      return true;
    }

    function revoke(reason) {
      if (destroyed || !isHandsFreeEnabled(toggle)) return false;
      lastReason = typeof reason === 'string' && reason ? reason : 'background';
      toggle.click();
      if (isHandsFreeEnabled(toggle)) {
        lastReason = 'revocation-failed';
        toggle.setAttribute?.(REVOKED_ATTR, lastReason);
        return false;
      }
      toggle.setAttribute?.(REVOKED_ATTR, lastReason);
      noticePending = lastReason !== 'explicit-guard';
      return true;
    }

    function onVisibilityChange() {
      if (documentRef.hidden === true) revoke('hidden');
      else announceRevocation();
    }

    function onPageHide() {
      revoke('pagehide');
    }

    function onPageShow() {
      announceRevocation();
    }

    function onFreeze() {
      revoke('freeze');
    }

    try {
      documentRef.addEventListener?.('visibilitychange', onVisibilityChange, true);
      documentRef.addEventListener?.('freeze', onFreeze, true);
      root?.addEventListener?.('pagehide', onPageHide, true);
      root?.addEventListener?.('pageshow', onPageShow, true);
      if (documentRef.hidden === true) revoke('hidden-at-install');
    } catch (error) {
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange, true);
      documentRef.removeEventListener?.('freeze', onFreeze, true);
      root?.removeEventListener?.('pagehide', onPageHide, true);
      root?.removeEventListener?.('pageshow', onPageShow, true);
      restoreRevokedAttribute();
      throw error;
    }

    controller = Object.freeze({
      isRevoked: () => !destroyed && Boolean(lastReason),
      hasPendingNotice: () => !destroyed && noticePending,
      getLastReason: () => destroyed ? '' : lastReason,
      revoke: () => revoke('explicit-guard'),
      announce: announceRevocation,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        noticePending = false;
        documentRef.removeEventListener?.('visibilitychange', onVisibilityChange, true);
        documentRef.removeEventListener?.('freeze', onFreeze, true);
        root?.removeEventListener?.('pagehide', onPageHide, true);
        root?.removeEventListener?.('pageshow', onPageShow, true);
        restoreRevokedAttribute();
        if (activeInstallations.get(toggle) === controller) activeInstallations.delete(toggle);
      }
    });
    activeInstallations.set(toggle, controller);
    return controller;
  }

  return Object.freeze({
    REVOKED_ATTR,
    REVOCATION_NOTICE,
    isHandsFreeEnabled,
    installHandsFreeBackgroundGuard
  });
});