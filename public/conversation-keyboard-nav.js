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

  function isEditableTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
  }

  function visibleConversationButtons(list) {
    const buttons = Array.from(list?.querySelectorAll?.('.conversation-open') || []);
    return buttons.filter((button) => {
      const row = button.closest?.('.conversation-row');
      return !button.disabled && !button.hidden && !row?.hidden;
    });
  }

  function nextIndex(current, key, length) {
    if (!Number.isInteger(current) || !Number.isInteger(length) || length <= 0 || current < 0 || current >= length) return -1;
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

    function onKeyDown(event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      if (!SUPPORTED_KEYS.includes(event.key) || isEditableTarget(event.target)) return false;
      if (!event.target?.classList?.contains('conversation-open')) return false;

      const buttons = visibleConversationButtons(list);
      const current = buttons.indexOf(event.target);
      if (current < 0) return false;
      const targetIndex = nextIndex(current, event.key, buttons.length);
      const target = buttons[targetIndex];
      if (!target || target === event.target) return false;

      event.preventDefault();
      target.focus?.({ preventScroll: true });
      target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      return true;
    }

    function mount() {
      if (mounted) return false;
      list = documentRef.querySelector('#conversationList');
      if (!list || typeof list.addEventListener !== 'function') return false;
      list.addEventListener('keydown', onKeyDown);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      list?.removeEventListener?.('keydown', onKeyDown);
      list = null;
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, onKeyDown });
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
