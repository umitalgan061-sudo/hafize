(function exposeHafizeConversationDeleteConfirm(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationDeleteConfirm = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationDeleteConfirm() {
  'use strict';

  const FALLBACK_TITLE = 'Bu sohbet';
  const MAX_TITLE_CHARS = 120;

  function safeTitle(row) {
    const raw = row?.querySelector?.('.conversation-open')?.textContent;
    if (typeof raw !== 'string') return FALLBACK_TITLE;
    const title = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_CHARS);
    return title || FALLBACK_TITLE;
  }

  function shouldDeferToDraftGuard(target, input) {
    const row = target?.closest?.('.conversation-row');
    return Boolean(row?.classList?.contains('active') && typeof input?.value === 'string' && input.value.trim());
  }

  function createController({
    documentRef = globalThis.document,
    confirmImpl = globalThis.confirm
  } = {}) {
    if (!documentRef || typeof documentRef.addEventListener !== 'function') {
      throw new Error('INVALID_CONVERSATION_DELETE_CONFIRM_DOCUMENT');
    }
    if (typeof confirmImpl !== 'function') throw new Error('INVALID_CONVERSATION_DELETE_CONFIRM_FN');

    let mounted = false;

    function onCaptureClick(event) {
      if (event.defaultPrevented || typeof event.target?.closest !== 'function') return false;
      const button = event.target.closest('.conversation-delete');
      if (!button) return false;

      const input = documentRef.querySelector?.('#messageInput');
      if (shouldDeferToDraftGuard(button, input)) return false;

      const row = button.closest('.conversation-row');
      const title = safeTitle(row);
      const approved = confirmImpl(`“${title}” sohbeti silinsin mi? Bu işlem geri alınamaz.`);
      if (approved) return true;

      event.preventDefault();
      event.stopImmediatePropagation?.();
      button.focus?.();
      return false;
    }

    function mount() {
      if (mounted) return false;
      documentRef.addEventListener('click', onCaptureClick, true);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      documentRef.removeEventListener?.('click', onCaptureClick, true);
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, onCaptureClick });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    FALLBACK_TITLE,
    MAX_TITLE_CHARS,
    safeTitle,
    shouldDeferToDraftGuard,
    createController,
    mount
  });
});
