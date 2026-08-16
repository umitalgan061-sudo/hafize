(function exposeHafizeNetworkStatus(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeNetworkStatus = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeNetworkStatus() {
  'use strict';

  const STATUS_ID = 'hafizeNetworkStatus';
  const STYLE_ID = 'hafize-network-status-style';
  const ONLINE_NOTICE_MS = 2200;
  const STYLE_TEXT = `
.network-status{display:inline-flex;align-items:center;gap:6px;min-height:28px;border:1px solid var(--line,#ddd);border-radius:999px;padding:4px 9px;color:var(--muted,#777);font-size:11px;line-height:1.2;white-space:nowrap}
.network-status[hidden]{display:none}
.network-status::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.72}
.network-status[data-state="offline"]{color:#a33;background:color-mix(in srgb,#a33 8%,transparent);border-color:color-mix(in srgb,#a33 28%,var(--line,#ddd))}
.network-status[data-state="restored"]{color:#267a45;background:color-mix(in srgb,#267a45 8%,transparent);border-color:color-mix(in srgb,#267a45 28%,var(--line,#ddd))}
@media (max-width:700px){.network-status{max-width:148px;overflow:hidden;text-overflow:ellipsis}.network-status[data-state="offline"]{max-width:180px}}
`;

  function readOnline(navigatorRef) {
    return navigatorRef?.onLine !== false;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    rootRef = globalThis,
    documentRef = globalThis.document,
    navigatorRef = globalThis.navigator,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!rootRef || typeof rootRef.addEventListener !== 'function' || typeof rootRef.removeEventListener !== 'function') {
      throw new Error('INVALID_NETWORK_STATUS_ROOT');
    }
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_NETWORK_STATUS_DOCUMENT');
    }
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
      throw new Error('INVALID_NETWORK_STATUS_TIMER');
    }

    let mounted = false;
    let node = null;
    let restoreTimer = null;
    let wasOffline = false;

    function clearRestoreTimer() {
      if (restoreTimer === null) return;
      clearTimeoutImpl(restoreTimer);
      restoreTimer = null;
    }

    function createStatusNode() {
      const topbar = documentRef.querySelector('.topbar');
      if (!topbar) return null;
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return existing;
      const status = documentRef.createElement('span');
      status.id = STATUS_ID;
      status.className = 'network-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      status.hidden = true;
      const spacer = topbar.querySelector?.('.top-spacer');
      if (spacer && typeof topbar.insertBefore === 'function') topbar.insertBefore(status, spacer);
      else topbar.append?.(status);
      return status;
    }

    function showOffline() {
      if (!node) return false;
      clearRestoreTimer();
      wasOffline = true;
      node.hidden = false;
      node.dataset.state = 'offline';
      node.textContent = 'Çevrimdışı · yanıt gönderilemez';
      node.setAttribute?.('title', 'Bağlantı geri geldiğinde yeniden gönderebilirsin.');
      return true;
    }

    function showOnline({ initial = false } = {}) {
      if (!node) return false;
      clearRestoreTimer();
      if (initial || !wasOffline) {
        node.hidden = true;
        node.dataset.state = 'online';
        node.textContent = '';
        return true;
      }
      wasOffline = false;
      node.hidden = false;
      node.dataset.state = 'restored';
      node.textContent = 'Bağlantı geri geldi';
      node.setAttribute?.('title', 'Ağ bağlantısı yeniden kullanılabilir.');
      restoreTimer = setTimeoutImpl(() => {
        restoreTimer = null;
        if (!node || !readOnline(navigatorRef)) return;
        node.hidden = true;
        node.dataset.state = 'online';
        node.textContent = '';
      }, ONLINE_NOTICE_MS);
      return true;
    }

    function sync({ initial = false } = {}) {
      return readOnline(navigatorRef) ? showOnline({ initial }) : showOffline();
    }

    function handleOffline() {
      return showOffline();
    }

    function handleOnline() {
      return showOnline();
    }

    function mount() {
      if (mounted) return true;
      node = createStatusNode();
      if (!node) return false;
      installStyles(documentRef);
      wasOffline = !readOnline(navigatorRef);
      sync({ initial: true });
      rootRef.addEventListener('offline', handleOffline);
      rootRef.addEventListener('online', handleOnline);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      clearRestoreTimer();
      rootRef.removeEventListener('offline', handleOffline);
      rootRef.removeEventListener('online', handleOnline);
      node?.remove?.();
      node = null;
      mounted = false;
    }

    return Object.freeze({ mount, destroy, sync, showOffline, showOnline, handleOffline, handleOnline });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ STATUS_ID, STYLE_ID, ONLINE_NOTICE_MS, readOnline, installStyles, createController, mount });
});
