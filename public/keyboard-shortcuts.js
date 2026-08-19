(function exposeHafizeKeyboardShortcuts(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeKeyboardShortcuts = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeKeyboardShortcuts() {
  'use strict';

  const SHORTCUTS = Object.freeze({
    focusComposer: 'mod+k',
    focusComposerSlash: '/',
    focusConversationSearch: 'mod+shift+f',
    focusFirstConversationSearchResult: 'arrowdown',
    openSoleConversationSearchResult: 'enter',
    stopResponse: 'escape'
  });

  function isEditableTarget(target) {
    if (!target || typeof target !== 'object') return false;
    const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (target.isContentEditable === true) return true;
    return Boolean(target.closest?.('[contenteditable="true"]'));
  }

  function hasModifier(event) {
    return Boolean(event?.altKey || event?.ctrlKey || event?.metaKey);
  }

  function isPlainSlash(event) {
    return event?.key === '/' && !hasModifier(event) && !event?.shiftKey;
  }

  function isModK(event) {
    return String(event?.key || '').toLowerCase() === 'k'
      && Boolean(event?.ctrlKey || event?.metaKey)
      && !event?.altKey
      && !event?.shiftKey;
  }

  function isConversationSearchShortcut(event) {
    return String(event?.key || '').toLowerCase() === 'f'
      && Boolean(event?.ctrlKey || event?.metaKey)
      && !event?.altKey
      && event?.shiftKey === true;
  }

  function isEscape(event) {
    return event?.key === 'Escape' && !hasModifier(event) && !event?.shiftKey;
  }

  function isSearchInput(target) {
    return target?.id === 'conversationSearchInput';
  }

  function isSearchResultFocusShortcut(event) {
    return event?.key === 'ArrowDown'
      && isSearchInput(event?.target)
      && !hasModifier(event)
      && !event?.shiftKey;
  }

  function isSoleSearchResultOpenShortcut(event) {
    return event?.key === 'Enter'
      && isSearchInput(event?.target)
      && !hasModifier(event)
      && !event?.shiftKey;
  }

  function visibleConversationOpeners(documentRef) {
    const rows = Array.from(documentRef?.querySelectorAll?.('#conversationList .conversation-row') || []);
    const openers = [];
    for (const row of rows) {
      if (!row || row.hidden === true) continue;
      const opener = row.querySelector?.('.conversation-open');
      if (!opener || opener.hidden === true || opener.disabled === true) continue;
      if (typeof opener.focus !== 'function') continue;
      openers.push(opener);
    }
    return openers;
  }

  function createController({ documentRef = globalThis.document } = {}) {
    if (!documentRef || typeof documentRef.addEventListener !== 'function' || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_KEYBOARD_SHORTCUT_DOCUMENT');
    }
    let mounted = false;

    function nodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        searchInput: documentRef.querySelector('#conversationSearchInput'),
        sendButton: documentRef.querySelector('#sendBtn')
      });
    }

    function focusComposer(event) {
      const { input } = nodes();
      if (!input || input.disabled === true || typeof input.focus !== 'function') return false;
      event?.preventDefault?.();
      input.focus();
      if (typeof input.setSelectionRange === 'function' && typeof input.value === 'string') {
        const end = input.value.length;
        try { input.setSelectionRange(end, end); } catch { /* unsupported input type */ }
      }
      return true;
    }

    function focusConversationSearch(event) {
      const { searchInput } = nodes();
      if (!searchInput || searchInput.disabled === true || typeof searchInput.focus !== 'function') return false;
      event?.preventDefault?.();
      searchInput.focus();
      if (typeof searchInput.select === 'function') {
        try { searchInput.select(); } catch { /* selection is optional */ }
      }
      return true;
    }

    function focusFirstConversationSearchResult(event) {
      const [first] = visibleConversationOpeners(documentRef);
      if (!first) return false;
      event?.preventDefault?.();
      first.focus();
      return true;
    }

    function openSoleConversationSearchResult(event) {
      const { searchInput } = nodes();
      if (!searchInput || searchInput !== event?.target || !String(searchInput.value || '').trim()) return false;
      const openers = visibleConversationOpeners(documentRef);
      if (openers.length !== 1 || typeof openers[0].click !== 'function') return false;
      event?.preventDefault?.();
      openers[0].click();
      return true;
    }

    function stopResponse(event) {
      const { sendButton } = nodes();
      if (!sendButton?.classList?.contains?.('streaming') || typeof sendButton.click !== 'function') return false;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      sendButton.click();
      return true;
    }

    function handleKeydown(event) {
      if (!event || event.defaultPrevented || event.repeat) return false;
      if (isEscape(event)) return stopResponse(event);
      if (isConversationSearchShortcut(event)) return focusConversationSearch(event);
      if (isSearchResultFocusShortcut(event)) return focusFirstConversationSearchResult(event);
      if (isSoleSearchResultOpenShortcut(event)) return openSoleConversationSearchResult(event);
      if (isModK(event)) return focusComposer(event);
      if (!isPlainSlash(event) || isEditableTarget(event.target)) return false;
      return focusComposer(event);
    }

    function mount() {
      if (mounted) return true;
      documentRef.addEventListener('keydown', handleKeydown);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      documentRef.removeEventListener?.('keydown', handleKeydown);
      mounted = false;
    }

    return Object.freeze({
      mount,
      destroy,
      handleKeydown,
      focusComposer,
      focusConversationSearch,
      focusFirstConversationSearchResult,
      openSoleConversationSearchResult,
      stopResponse
    });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      controller.mount();
      return controller;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    SHORTCUTS,
    isEditableTarget,
    isPlainSlash,
    isModK,
    isConversationSearchShortcut,
    isSearchInput,
    isSearchResultFocusShortcut,
    isSoleSearchResultOpenShortcut,
    visibleConversationOpeners,
    isEscape,
    createController,
    mount
  });
});
