(function exposeHafizeConversationKeyboardNav(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationKeyboardNav = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationKeyboardNav() {
  'use strict';

  const SUPPORTED_KEYS = Object.freeze(['ArrowUp', 'ArrowDown', 'Home', 'End']);
  const ACTIVE_DOCUMENTS = new WeakSet();

  function isEditableTarget(target) {
    if (!target || typeof target !== 'object') return false;
    try {
      const tag = String(target.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
    } catch {
      return true;
    }
  }

  function visibleConversationButtons(list) {
    let buttons;
    try {
      buttons = Array.from(list?.querySelectorAll?.('.conversation-open') || []);
    } catch {
      return [];
    }
    return buttons.filter((button) => {
      try {
        const row = button?.closest?.('.conversation-row');
        return Boolean(button) && !button.disabled && !button.hidden && !row?.hidden;
      } catch {
        return false;
      }
    });
  }

  function nextIndex(current, key, length) {
    if (!Number.isInteger(current) || !Number.isInteger(length) || length <= 0) return -1;
    if (key === 'Home') return 0;
    if (key === 'End') return length - 1;
    if (key === 'ArrowUp') return Math.max(0, current - 1);
    if (key === 'ArrowDown') return Math.min(length - 1, current + 1);
    return current;
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_CONVERSATION_KEYBOARD_NAV_DOCUMENT');
    }

    let list = null;
    let mounted = false;
    let generation = 0;
    let installedListener = null;

    function ownsDocument() {
      return mounted && ACTIVE_DOCUMENTS.has(documentRef);
    }

    function hasCurrentList() {
      if (!ownsDocument() || !list) return false;
      try {
        return documentRef.querySelector('#conversationList') === list;
      } catch {
        return false;
      }
    }

    function handleKeyDown(event) {
      if (!hasCurrentList() || !event || typeof event !== 'object') return false;
      try {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        if (!SUPPORTED_KEYS.includes(event.key) || isEditableTarget(event.target)) return false;
        if (!event.target?.classList?.contains?.('conversation-open')) return false;

        const buttons = visibleConversationButtons(list);
        const current = buttons.indexOf(event.target);
        if (current < 0) return false;
        const targetIndex = nextIndex(current, event.key, buttons.length);
        const target = buttons[targetIndex];
        if (!target || target === event.target || typeof target.focus !== 'function') return false;

        try {
          target.focus({ preventScroll: true });
        } catch {
          return false;
        }
        event.preventDefault?.();
        try {
          target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        } catch {
          // Focus movement already succeeded; scrolling is best effort.
        }
        return true;
      } catch {
        return false;
      }
    }

    function mount() {
      if (mounted || ACTIVE_DOCUMENTS.has(documentRef)) return false;
      let candidate;
      try {
        candidate = documentRef.querySelector('#conversationList');
      } catch {
        return false;
      }
      if (!candidate || typeof candidate.addEventListener !== 'function' || typeof candidate.removeEventListener !== 'function') {
        return false;
      }

      const installGeneration = generation + 1;
      const listener = (event) => {
        if (!mounted || generation !== installGeneration || installedListener !== listener) return false;
        return handleKeyDown(event);
      };

      ACTIVE_DOCUMENTS.add(documentRef);
      try {
        candidate.addEventListener('keydown', listener);
      } catch {
        ACTIVE_DOCUMENTS.delete(documentRef);
        return false;
      }

      list = candidate;
      generation = installGeneration;
      installedListener = listener;
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      const oldList = list;
      const oldListener = installedListener;
      mounted = false;
      generation += 1;
      installedListener = null;
      list = null;
      ACTIVE_DOCUMENTS.delete(documentRef);
      try {
        oldList?.removeEventListener?.('keydown', oldListener);
      } catch {
        // Ownership is already released; teardown remains fail-closed.
      }
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      onKeyDown: handleKeyDown,
      isMounted: () => ownsDocument(),
      hasCurrentList
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
    SUPPORTED_KEYS,
    isEditableTarget,
    visibleConversationButtons,
    nextIndex,
    createController,
    mount
  });
});
