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
  const CONFIRM_WINDOW_MS = 8_000;
  const PENDING_TEXT = 'Sil?';

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
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef || typeof documentRef.addEventListener !== 'function') {
      throw new Error('INVALID_CONVERSATION_DELETE_CONFIRM_DOCUMENT');
    }
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
      throw new Error('INVALID_CONVERSATION_DELETE_CONFIRM_TIMER');
    }

    let mounted = false;
    let pending = null;
    let timer = null;

    function restorePending({ focus = false } = {}) {
      if (!pending) return false;
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
      const { button, text, ariaLabel, title } = pending;
      pending = null;
      button.textContent = text;
      if (ariaLabel == null) button.removeAttribute?.('aria-label');
      else button.setAttribute?.('aria-label', ariaLabel);
      if (title == null) button.removeAttribute?.('title');
      else button.setAttribute?.('title', title);
      button.removeAttribute?.('data-delete-pending');
      button.setAttribute?.('aria-pressed', 'false');
      if (focus) button.focus?.();
      return true;
    }

    function arm(button) {
      restorePending();
      const row = button.closest?.('.conversation-row');
      const conversationTitle = safeTitle(row);
      pending = {
        button,
        text: typeof button.textContent === 'string' ? button.textContent : '×',
        ariaLabel: button.getAttribute?.('aria-label') ?? null,
        title: button.getAttribute?.('title') ?? null
      };
      button.textContent = PENDING_TEXT;
      button.setAttribute?.('data-delete-pending', 'true');
      button.setAttribute?.('aria-pressed', 'true');
      button.setAttribute?.('aria-label', `${conversationTitle} sohbetini silmeyi onayla`);
      button.setAttribute?.('title', 'Silmek için tekrar dokun');
      button.focus?.();
      timer = setTimeoutImpl(() => restorePending(), CONFIRM_WINDOW_MS);
      timer?.unref?.();
      return true;
    }

    function onCaptureClick(event) {
      if (event.defaultPrevented || typeof event.target?.closest !== 'function') return false;
      const button = event.target.closest('.conversation-delete');
      if (!button) {
        restorePending();
        return false;
      }

      const input = documentRef.querySelector?.('#messageInput');
      if (shouldDeferToDraftGuard(button, input)) {
        restorePending();
        return false;
      }

      if (pending?.button === button) {
        restorePending();
        return true;
      }

      event.preventDefault();
      event.stopImmediatePropagation?.();
      arm(button);
      return false;
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !pending) return false;
      event.preventDefault?.();
      restorePending({ focus: true });
      return true;
    }

    function onFocusIn(event) {
      if (!pending || event?.target === pending.button) return false;
      restorePending();
      return true;
    }

    function onVisibilityChange() {
      if (documentRef.visibilityState === 'hidden') restorePending();
    }

    function mount() {
      if (mounted) return false;
      documentRef.addEventListener('click', onCaptureClick, true);
      documentRef.addEventListener('keydown', onKeydown, true);
      documentRef.addEventListener('focusin', onFocusIn, true);
      documentRef.addEventListener('visibilitychange', onVisibilityChange);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      restorePending();
      documentRef.removeEventListener?.('click', onCaptureClick, true);
      documentRef.removeEventListener?.('keydown', onKeydown, true);
      documentRef.removeEventListener?.('focusin', onFocusIn, true);
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange);
      mounted = false;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      onCaptureClick,
      onKeydown,
      onFocusIn,
      onVisibilityChange,
      cancel: (options) => restorePending(options),
      snapshot: () => Object.freeze({ pending: Boolean(pending), pendingTitle: pending ? safeTitle(pending.button.closest?.('.conversation-row')) : null })
    });
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
    CONFIRM_WINDOW_MS,
    PENDING_TEXT,
    safeTitle,
    shouldDeferToDraftGuard,
    createController,
    mount
  });
});