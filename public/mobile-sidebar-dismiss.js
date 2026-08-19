(function exposeHafizeMobileSidebarDismiss(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeMobileSidebarDismiss = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMobileSidebarDismiss() {
  'use strict';

  const BACKDROP_ID = 'sidebarBackdrop';
  const STYLE_ID = 'hafize-mobile-sidebar-dismiss-style';
  const MOBILE_MAX = 900;
  const STYLE_TEXT = `
.sidebar-backdrop{position:fixed;inset:0;z-index:19;border:0;background:rgba(22,25,23,.28);backdrop-filter:blur(2px);padding:0}
.sidebar-backdrop[hidden]{display:none}
@media (min-width:901px){.sidebar-backdrop{display:none!important}}
`;

  function isMobile(windowRef) {
    const width = Number(windowRef?.innerWidth);
    return Number.isFinite(width) && width <= MOBILE_MAX;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return null;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return style;
  }

  function createController({ documentRef = globalThis.document, windowRef = globalThis.window } = {}) {
    if (!documentRef || !windowRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_SIDEBAR_DISMISS_ENV');
    let sidebar = null;
    let toggle = null;
    let backdrop = null;
    let ownedBackdrop = null;
    let ownedStyle = null;
    let backdropWasHidden = null;
    let toggleAriaExpanded = null;
    let toggleHadAriaExpanded = false;
    let mounted = false;

    function openState() {
      return Boolean(sidebar?.classList?.contains('open'));
    }

    function sync() {
      if (!mounted) return false;
      const visible = isMobile(windowRef) && openState();
      if (backdrop) backdrop.hidden = !visible;
      toggle?.setAttribute?.('aria-expanded', String(openState()));
      return visible;
    }

    function close({ restoreFocus = false } = {}) {
      if (!mounted) return false;
      if (!sidebar || !openState()) { sync(); return false; }
      sidebar.classList.remove('open');
      sync();
      if (restoreFocus) toggle?.focus?.();
      return true;
    }

    function onKeydown(event) {
      if (!mounted || event?.key !== 'Escape' || event.defaultPrevented || !isMobile(windowRef) || !openState()) return;
      event.preventDefault?.();
      close({ restoreFocus: true });
    }

    function onResize() {
      if (!mounted) return;
      if (!isMobile(windowRef)) close();
      else sync();
    }

    function onBackdropClick() {
      if (!mounted) return;
      close({ restoreFocus: true });
    }

    function createBackdrop() {
      const existing = documentRef.querySelector(`#${BACKDROP_ID}`);
      if (existing) return { node: existing, owned: false };
      const button = documentRef.createElement('button');
      button.id = BACKDROP_ID;
      button.type = 'button';
      button.className = 'sidebar-backdrop';
      button.hidden = true;
      button.setAttribute('aria-label', 'Menüyü kapat');
      documentRef.body?.append?.(button);
      return { node: button, owned: true };
    }

    function restoreToggleState() {
      if (!toggle) return;
      if (toggleHadAriaExpanded) toggle.setAttribute?.('aria-expanded', toggleAriaExpanded);
      else toggle.removeAttribute?.('aria-expanded');
    }

    function mount() {
      if (mounted) return true;
      sidebar = documentRef.querySelector('#sidebar');
      toggle = documentRef.querySelector('#sidebarToggle');
      if (!sidebar || !toggle || !documentRef.body) return false;

      const style = installStyles(documentRef);
      const resolvedBackdrop = createBackdrop();
      if (!resolvedBackdrop?.node || typeof resolvedBackdrop.node.addEventListener !== 'function') {
        style?.remove?.();
        sidebar = null;
        toggle = null;
        return false;
      }

      ownedStyle = style;
      backdrop = resolvedBackdrop.node;
      ownedBackdrop = resolvedBackdrop.owned ? backdrop : null;
      backdropWasHidden = Boolean(backdrop.hidden);
      toggleHadAriaExpanded = Boolean(toggle.hasAttribute?.('aria-expanded'));
      toggleAriaExpanded = toggleHadAriaExpanded ? toggle.getAttribute?.('aria-expanded') : null;

      backdrop.addEventListener('click', onBackdropClick);
      documentRef.addEventListener?.('keydown', onKeydown);
      windowRef.addEventListener?.('resize', onResize);
      toggle.addEventListener('click', sync);
      mounted = true;
      sync();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      documentRef.removeEventListener?.('keydown', onKeydown);
      windowRef.removeEventListener?.('resize', onResize);
      toggle?.removeEventListener?.('click', sync);
      backdrop?.removeEventListener?.('click', onBackdropClick);
      restoreToggleState();
      if (ownedBackdrop) ownedBackdrop.remove?.();
      else if (backdrop) backdrop.hidden = backdropWasHidden;
      ownedStyle?.remove?.();
      sidebar = null;
      toggle = null;
      backdrop = null;
      ownedBackdrop = null;
      ownedStyle = null;
      backdropWasHidden = null;
      toggleAriaExpanded = null;
      toggleHadAriaExpanded = false;
      return true;
    }

    return Object.freeze({ mount, destroy, sync, close, openState });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; }
    catch { return null; }
  }

  return Object.freeze({ BACKDROP_ID, STYLE_ID, MOBILE_MAX, isMobile, installStyles, createController, mount });
});