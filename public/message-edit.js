(function exposeHafizeMessageEdit(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMessageEdit = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMessageEdit() {
  'use strict';

  const MAX_COMPOSER_CHARS = 12_000;
  const MARKER = 'hafizeEditReady';

  function editableText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n/g, '\n');
    if (!text.trim() || text.length > MAX_COMPOSER_CHARS) return null;
    return text;
  }

  function createController({
    documentRef = globalThis.document,
    MutationObserverImpl = globalThis.MutationObserver,
    EventImpl = globalThis.Event
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_MESSAGE_EDIT_DOCUMENT');
    let observer = null;

    function composerNodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        sendButton: documentRef.querySelector('#sendBtn')
      });
    }

    function showState(button, state, label) {
      button.dataset.state = state;
      button.textContent = label;
    }

    function editMessage(button, content) {
      const text = editableText(content?.textContent);
      if (!text) {
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
      const { input, sendButton } = composerNodes();
      if (!input) {
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
      if (sendButton?.classList?.contains('streaming')) {
        showState(button, 'error', 'Yanıt sürüyor');
        return false;
      }
      const draft = typeof input.value === 'string' ? input.value : '';
      if (draft.trim() && draft !== text) {
        input.focus?.();
        showState(button, 'error', 'Taslak korunuyor');
        return false;
      }

      input.value = text;
      if (typeof input.dispatchEvent === 'function' && typeof EventImpl === 'function') {
        input.dispatchEvent(new EventImpl('input', { bubbles: true }));
      }
      input.focus?.();
      input.setSelectionRange?.(text.length, text.length);
      showState(button, 'success', 'Düzenlemeye hazır');
      return true;
    }

    function decorate(article) {
      if (!article?.classList?.contains('message') || !article.classList.contains('user')) return false;
      if (article.dataset?.[MARKER] === '1') return false;
      const content = article.querySelector?.('.content');
      const actions = article.querySelector?.('.message-copy-actions');
      if (!content || !actions) return false;

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'message-copy-btn message-edit-btn';
      button.dataset.state = 'idle';
      button.textContent = 'Düzenle';
      button.setAttribute('aria-label', 'kendi mesajını yazarda düzenle');
      button.addEventListener('click', () => { editMessage(button, content); });
      actions.prepend?.(button);
      if (article.dataset) article.dataset[MARKER] = '1';
      return true;
    }

    function decorateAll(root = documentRef) {
      const messages = root.querySelectorAll?.('.message.user') || [];
      let count = 0;
      for (const article of messages) if (decorate(article)) count += 1;
      return count;
    }

    function mount() {
      const messages = documentRef.querySelector('#messages');
      if (!messages) return false;
      decorateAll(messages);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => decorateAll(messages));
        observer.observe(messages, { childList: true, subtree: true });
      }
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
    }

    return Object.freeze({ mount, destroy, decorate, decorateAll, editMessage });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ MAX_COMPOSER_CHARS, MARKER, editableText, createController, mount });
});
