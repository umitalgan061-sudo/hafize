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
  const activeInstallations = new WeakMap();

  function isHandsFreeEnabled(toggle) {
    return toggle?.getAttribute?.('aria-pressed') === 'true';
  }

  function installHandsFreeBackgroundGuard(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#handsFreeToggle');
    if (!toggle || typeof toggle.click !== 'function') return null;
    if (activeInstallations.has(toggle)) throw new Error('HANDS_FREE_BACKGROUND_GUARD_ALREADY_INSTALLED');

    const baseline = Object.freeze({
      revokedPresent: Boolean(toggle.hasAttribute?.(REVOKED_ATTR)),
      revokedValue: toggle.getAttribute?.(REVOKED_ATTR) ?? null
    });
    let destroyed = false;
    let lastReason = '';
    let controller = null;

    function restoreRevokedAttribute() {
      if (baseline.revokedPresent) toggle.setAttribute?.(REVOKED_ATTR, baseline.revokedValue ?? '');
      else toggle.removeAttribute?.(REVOKED_ATTR);
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
      return true;
    }

    function onVisibilityChange() {
      if (documentRef.hidden === true) revoke('hidden');
    }

    function onPageHide() {
      revoke('pagehide');
    }

    function onFreeze() {
      revoke('freeze');
    }

    try {
      documentRef.addEventListener?.('visibilitychange', onVisibilityChange, true);
      documentRef.addEventListener?.('freeze', onFreeze, true);
      root?.addEventListener?.('pagehide', onPageHide, true);
      if (documentRef.hidden === true) revoke('hidden-at-install');
    } catch (error) {
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange, true);
      documentRef.removeEventListener?.('freeze', onFreeze, true);
      root?.removeEventListener?.('pagehide', onPageHide, true);
      restoreRevokedAttribute();
      throw error;
    }

    controller = Object.freeze({
      isRevoked: () => !destroyed && Boolean(lastReason),
      getLastReason: () => destroyed ? '' : lastReason,
      revoke: () => revoke('explicit-guard'),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        documentRef.removeEventListener?.('visibilitychange', onVisibilityChange, true);
        documentRef.removeEventListener?.('freeze', onFreeze, true);
        root?.removeEventListener?.('pagehide', onPageHide, true);
        restoreRevokedAttribute();
        if (activeInstallations.get(toggle) === controller) activeInstallations.delete(toggle);
      }
    });
    activeInstallations.set(toggle, controller);
    return controller;
  }

  return Object.freeze({
    REVOKED_ATTR,
    isHandsFreeEnabled,
    installHandsFreeBackgroundGuard
  });
});