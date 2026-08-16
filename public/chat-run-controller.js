(function exposeHafizeChatRunController(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeChatRunController = api;

  const documentRef = root.document;
  function loadShellEnhancement(globalName, path, marker) {
    if (!documentRef?.head || root[globalName] || documentRef.querySelector(`script[${marker}]`)) return;
    const script = documentRef.createElement('script');
    script.src = path;
    script.defer = true;
    script.setAttribute(marker, '1');
    documentRef.head.append(script);
  }
  loadShellEnhancement('HafizeMessageCopy', '/message-copy.js', 'data-hafize-message-copy');
  loadShellEnhancement('HafizeMessageEdit', '/message-edit.js', 'data-hafize-message-edit');
  loadShellEnhancement('HafizeKeyboardShortcuts', '/keyboard-shortcuts.js', 'data-hafize-keyboard-shortcuts');
  loadShellEnhancement('HafizeConversationSearch', '/conversation-search.js', 'data-hafize-conversation-search');
  loadShellEnhancement('HafizeScrollToLatest', '/scroll-to-latest.js', 'data-hafize-scroll-to-latest');
  loadShellEnhancement('HafizeComposerLimitFeedback', '/composer-limit-feedback.js', 'data-hafize-composer-limit-feedback');
  loadShellEnhancement('HafizeMobileSidebarDismiss', '/mobile-sidebar-dismiss.js', 'data-hafize-mobile-sidebar-dismiss');
  loadShellEnhancement('HafizeDraftClearUndo', '/draft-clear-undo.js', 'data-hafize-draft-clear-undo');
  loadShellEnhancement('HafizeDraftNavigationGuard', '/draft-navigation-guard.js', 'data-hafize-draft-navigation-guard');
  loadShellEnhancement('HafizeConversationKeyboardNav', '/conversation-keyboard-nav.js', 'data-hafize-conversation-keyboard-nav');
  loadShellEnhancement('HafizeConversationDeleteConfirm', '/conversation-delete-confirm.js', 'data-hafize-conversation-delete-confirm');
  loadShellEnhancement('HafizeShortcutHelp', '/shortcut-help.js', 'data-hafize-shortcut-help');
  loadShellEnhancement('HafizeNetworkStatus', '/network-status.js', 'data-hafize-network-status');
  loadShellEnhancement('HafizeConversationCopy', '/conversation-copy.js', 'data-hafize-conversation-copy');
  loadShellEnhancement('HafizeInChatFind', '/in-chat-find.js', 'data-hafize-in-chat-find');
  loadShellEnhancement('HafizeSafeMarkdown', '/safe-markdown-render.js', 'data-hafize-safe-markdown');
  loadShellEnhancement('HafizeCodeBlockCopy', '/code-block-copy.js', 'data-hafize-code-block-copy');
  loadShellEnhancement('HafizeCodeWrapToggle', '/code-wrap-toggle.js', 'data-hafize-code-wrap-toggle');
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeChatRunControllerApi() {
  'use strict';

  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  function createChatRunController({ AbortControllerImpl = globalThis.AbortController } = {}) {
    if (typeof AbortControllerImpl !== 'function') fail('CHAT_RUN_ABORT_UNAVAILABLE');

    let active = null;
    let generation = 0;

    function snapshot() {
      return Object.freeze({
        active: active !== null,
        generation: active?.generation ?? generation,
        aborted: Boolean(active?.controller.signal.aborted)
      });
    }

    function begin() {
      if (active !== null) fail('CHAT_RUN_ALREADY_ACTIVE');
      generation += 1;
      const controller = new AbortControllerImpl();
      if (!controller?.signal || typeof controller.abort !== 'function') fail('CHAT_RUN_ABORT_UNAVAILABLE');
      const token = Object.freeze({ generation });
      active = { generation, controller, token };
      return Object.freeze({ token, signal: controller.signal });
    }

    function abort(reason = 'user') {
      if (active === null) return false;
      if (active.controller.signal.aborted) return false;
      active.controller.abort(reason);
      return true;
    }

    function finish(token) {
      if (active === null || token !== active.token) return false;
      active = null;
      return true;
    }

    function isCurrent(token) {
      return active !== null && token === active.token;
    }

    return Object.freeze({ begin, abort, finish, isCurrent, snapshot });
  }

  function isAbortError(error, signal) {
    return Boolean(signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR');
  }

  return Object.freeze({ createChatRunController, isAbortError });
});