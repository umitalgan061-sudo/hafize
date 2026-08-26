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
  const REVOCATION_NOTICE = 'Eller serbest, uygulama arka plana geçtiği, mikrofon izni kaldırıldığı veya kullanılabilir mikrofon kalmadığı için kapatıldı. Yeniden dinlemek için mikrofonu ve izni kontrol edip Eller serbest düğmesinden tekrar onay ver.';
  const MICROPHONE_PERMISSION_REASON = 'microphone-permission-withdrawn';
  const MICROPHONE_DEVICE_REASON = 'microphone-device-unavailable';
  const activeInstallations = new WeakMap();

  function isHandsFreeEnabled(toggle) {
    return toggle?.getAttribute?.('aria-pressed') === 'true';
  }

  function normalizePermissionState(value) {
    return value === 'granted' || value === 'prompt' || value === 'denied' ? value : 'unknown';
  }

  function hasAudioInput(devices) {
    if (!Array.isArray(devices)) return null;
    return devices.some((device) => device?.kind === 'audioinput');
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
    let deviceWatchGeneration = 0;
    let deviceAvailability = 'unavailable';
    let mediaDevicesListening = false;

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
      const revoked = revoke(MICROPHONE_PERMISSION_REASON);
      if (revoked) announceRevocation();
      return revoked;
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

    async function checkMicrophoneDeviceAvailability() {
      const mediaDevices = root?.navigator?.mediaDevices;
      if (typeof mediaDevices?.enumerateDevices !== 'function') {
        deviceAvailability = 'unavailable';
        return false;
      }
      if (!isHandsFreeEnabled(toggle)) {
        deviceAvailability = 'inactive';
        return false;
      }
      const generation = ++deviceWatchGeneration;
      let devices;
      try {
        devices = await mediaDevices.enumerateDevices();
      } catch {
        if (!destroyed && generation === deviceWatchGeneration) deviceAvailability = 'unavailable';
        return false;
      }
      if (destroyed || generation !== deviceWatchGeneration) return false;
      const available = hasAudioInput(devices);
      if (available == null) {
        deviceAvailability = 'unknown';
        return false;
      }
      deviceAvailability = available ? 'available' : 'missing';
      if (!available && isHandsFreeEnabled(toggle)) {
        const revoked = revoke(MICROPHONE_DEVICE_REASON);
        if (revoked) announceRevocation();
      }
      return available;
    }

    function onMediaDeviceChange() {
      if (destroyed || !isHandsFreeEnabled(toggle)) return;
      void checkMicrophoneDeviceAvailability();
    }

    function attachMediaDeviceWatch() {
      const mediaDevices = root?.navigator?.mediaDevices;
      if (
        mediaDevicesListening
        || typeof mediaDevices?.addEventListener !== 'function'
        || typeof mediaDevices?.enumerateDevices !== 'function'
      ) return false;
      mediaDevices.addEventListener('devicechange', onMediaDeviceChange);
      mediaDevicesListening = true;
      if (isHandsFreeEnabled(toggle)) void checkMicrophoneDeviceAvailability();
      return true;
    }

    function detachMediaDeviceWatch() {
      if (!mediaDevicesListening) return;
      root?.navigator?.mediaDevices?.removeEventListener?.('devicechange', onMediaDeviceChange);
      mediaDevicesListening = false;
      deviceWatchGeneration += 1;
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
      attachMediaDeviceWatch();
    } catch (error) {
      permissionWatchGeneration += 1;
      deviceWatchGeneration += 1;
      detachPermissionStatus();
      detachMediaDeviceWatch();
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
      getMicrophoneDeviceAvailability: () => destroyed ? 'unavailable' : deviceAvailability,
      revoke: () => revoke('explicit-guard'),
      announce: announceRevocation,
      refreshMicrophonePermission: () => destroyed ? Promise.resolve(false) : watchMicrophonePermission(),
      refreshMicrophoneDevices: () => destroyed ? Promise.resolve(false) : checkMicrophoneDeviceAvailability(),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        noticePending = false;
        permissionWatchGeneration += 1;
        deviceWatchGeneration += 1;
        detachPermissionStatus();
        detachMediaDeviceWatch();
        permissionState = 'unavailable';
        deviceAvailability = 'unavailable';
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
    MICROPHONE_DEVICE_REASON,
    MICROPHONE_PERMISSION_REASON,
    REVOKED_ATTR,
    REVOCATION_NOTICE,
    createRevokeEvent,
    hasAudioInput,
    isHandsFreeEnabled,
    installHandsFreeBackgroundGuard,
    normalizePermissionState
  });
});