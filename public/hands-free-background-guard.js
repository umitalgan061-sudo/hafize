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

  const HANDS_FREE_REVOKE_EVENT = 'hafize:hands-free-revoke';
  const REVOKED_ATTR = 'data-background-revoked';
  const REVOCATION_NOTICE = 'Eller serbest, uygulama arka plana geçtiği veya mikrofon izni kaldırıldığı için kapatıldı. Yeniden dinlemek için mikrofon iznini kontrol edip Eller serbest düğmesinden tekrar onay ver.';
  const MICROPHONE_PERMISSION_REASON = 'microphone-permission-withdrawn';
  const activeInstallations = new WeakMap();

  function isHandsFreeEnabled(toggle) {
    return toggle?.getAttribute?.('aria-pressed') === 'true';
  }

  function normalizePermissionState(value) {
    return value === 'granted' || value === 'prompt' || value === 'denied' ? value : 'unknown';
  }

  function createRevokeEvent(root, reason) {
    const detail = Object.freeze({
      source: 'hands-free-background-guard',
      reason: typeof reason === 'string' && reason ? reason : 'background'
    });
    if (typeof root?.CustomEvent === 'function') {
      return new root.CustomEvent(HANDS_FREE_REVOKE_EVENT, { detail });
    }
    return { type: HANDS_FREE_REVOKE_EVENT, detail };
  }

  function installHandsFreeBackgroundGuard(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#handsFreeToggle');
    const toast = documentRef?.querySelector?.('#toast') || null;
    if (!toggle) return null;
    if (activeInstallations.has(toggle)) throw new Error('HANDS_FREE_BACKGROUND_GUARD_ALREADY_INSTALLED');

    const baseline = Object.freeze({
      revokedPresent: Boolean(toggle.hasAttribute?.(REVOKED_ATTR)),
      revokedValue: toggle.getAttribute?.(REVOKED_ATTR) ?? null
    });
    let destroyed = false;
    let lastReason = '';
    let noticePending = false;
    let controller = null;
    let permissionStatus = null;
    let permissionState = 'unavailable';
    let permissionWatchGeneration = 0;

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

    function markRevocationFailure() {
      lastReason = 'revocation-failed';
      noticePending = false;
      toggle.setAttribute?.(REVOKED_ATTR, lastReason);
      return false;
    }

    function dispatchRevocation(reason) {
      if (typeof documentRef?.dispatchEvent === 'function') {
        documentRef.dispatchEvent(createRevokeEvent(root, reason));
        return true;
      }
      // Minimal non-DOM harness compatibility only. Real browsers expose dispatchEvent,
      // so production revocation never relies on synthesizing a user click.
      if (typeof toggle?.click === 'function') {
        toggle.click();
        return true;
      }
      return false;
    }

    function revoke(reason) {
      if (destroyed || !isHandsFreeEnabled(toggle)) return false;
      const requestedReason = typeof reason === 'string' && reason ? reason : 'background';
      try {
        if (!dispatchRevocation(requestedReason)) return markRevocationFailure();
      } catch {
        return markRevocationFailure();
      }
      if (isHandsFreeEnabled(toggle)) return markRevocationFailure();
      lastReason = requestedReason;
      toggle.setAttribute?.(REVOKED_ATTR, lastReason);
      noticePending = lastReason !== 'explicit-guard';
      return true;
    }

    function revokeForPermissionIfNeeded() {
      if (destroyed || permissionState === 'unavailable' || permissionState === 'unknown') return false;
      if (permissionState === 'granted' || !isHandsFreeEnabled(toggle)) return false;
      return revoke(MICROPHONE_PERMISSION_REASON);
    }

    function onPermissionChange() {
      if (destroyed || !permissionStatus) return;
      permissionState = normalizePermissionState(permissionStatus.state);
      revokeForPermissionIfNeeded();
    }

    function detachPermissionStatus() {
      if (permissionStatus) permissionStatus.removeEventListener?.('change', onPermissionChange);
      permissionStatus = null;
    }

    async function watchMicrophonePermission() {
      const permissions = root?.navigator?.permissions;
      if (typeof permissions?.query !== 'function') return false;
      const generation = ++permissionWatchGeneration;
      let status;
      try {
        status = await permissions.query({ name: 'microphone' });
      } catch {
        if (!destroyed && generation === permissionWatchGeneration) permissionState = 'unavailable';
        return false;
      }
      if (destroyed || generation !== permissionWatchGeneration) return false;
      detachPermissionStatus();
      permissionStatus = status || null;
      permissionState = normalizePermissionState(permissionStatus?.state);
      permissionStatus?.addEventListener?.('change', onPermissionChange);
      revokeForPermissionIfNeeded();
      return Boolean(permissionStatus);
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

    function onWindowBlur() {
      revoke('window-blur');
    }

    function onWindowFocus() {
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
      root?.addEventListener?.('blur', onWindowBlur, true);
      root?.addEventListener?.('focus', onWindowFocus, true);
      if (documentRef.hidden === true) revoke('hidden-at-install');
      void watchMicrophonePermission();
    } catch (error) {
      permissionWatchGeneration += 1;
      detachPermissionStatus();
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange, true);
      documentRef.removeEventListener?.('freeze', onFreeze, true);
      root?.removeEventListener?.('pagehide', onPageHide, true);
      root?.removeEventListener?.('pageshow', onPageShow, true);
      root?.removeEventListener?.('blur', onWindowBlur, true);
      root?.removeEventListener?.('focus', onWindowFocus, true);
      restoreRevokedAttribute();
      throw error;
    }

    controller = Object.freeze({
      isRevoked: () => !destroyed && Boolean(lastReason),
      hasPendingNotice: () => !destroyed && noticePending,
      getLastReason: () => destroyed ? '' : lastReason,
      getMicrophonePermissionState: () => destroyed ? 'unavailable' : permissionState,
      revoke: () => revoke('explicit-guard'),
      announce: announceRevocation,
      refreshMicrophonePermission: () => destroyed ? Promise.resolve(false) : watchMicrophonePermission(),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        noticePending = false;
        permissionWatchGeneration += 1;
        detachPermissionStatus();
        permissionState = 'unavailable';
        documentRef.removeEventListener?.('visibilitychange', onVisibilityChange, true);
        documentRef.removeEventListener?.('freeze', onFreeze, true);
        root?.removeEventListener?.('pagehide', onPageHide, true);
        root?.removeEventListener?.('pageshow', onPageShow, true);
        root?.removeEventListener?.('blur', onWindowBlur, true);
        root?.removeEventListener?.('focus', onWindowFocus, true);
        restoreRevokedAttribute();
        if (activeInstallations.get(toggle) === controller) activeInstallations.delete(toggle);
      }
    });
    activeInstallations.set(toggle, controller);
    return controller;
  }

  return Object.freeze({
    HANDS_FREE_REVOKE_EVENT,
    MICROPHONE_PERMISSION_REASON,
    REVOKED_ATTR,
    REVOCATION_NOTICE,
    createRevokeEvent,
    isHandsFreeEnabled,
    installHandsFreeBackgroundGuard,
    normalizePermissionState
  });
});