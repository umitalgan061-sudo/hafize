(function exposeHafizeMessageCopy(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMessageCopy = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMessageCopy() {
  'use strict';

  const MAX_COPY_CHARS = 256 * 1024;
  const RESET_DELAY_MS = 1800;

  function copyText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n/g, '\n');
    if (!text.trim() || text.length > MAX_COPY_CHARS) return null;
    return text;
  }

  function createController({
    documentRef = globalThis.document,
    clipboard = globalThis.navigator?.clipboard,
    secureContext = globalThis.isSecureContext === true,
    MutationObserverImpl = globalThis.MutationObserver,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_MESSAGE_COPY_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_MESSAGE_COPY_TIMER');

    const timers = new WeakMap();
    let observer = null;

    function resetButton(button, label = 'Kopyala') {
      const pending = timers.get(button);
      if (pending !== undefined) clearTimeoutImpl(pending);
      timers.delete(button);
      button.textContent = label;
      button.dataset.state = 'idle';
      button.disabled = false;
    }

    function showState(button, state, label) {
      const pending = timers.get(button);
      if (pending !== undefined) clearTimeoutImpl(pending);
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying';
      const timer = setTimeoutImpl(() => resetButton(button), RESET_DELAY_MS);
      timers.set(button, timer);
    }

    async function copyMessage(button, content) {
      const text = copyText(content?.textContent);
      if (!text) {
        showState(button, 'error', 'Kopyalanamadı');
        return false;
      }
      if (!secureContext || typeof clipboard?.writeText !== 'function') {
        showState(button, 'error', 'Clipboard kapalı');
        return false;
      }

      showState(button, 'copying', 'Kopyalanıyor…');
      try {
        await clipboard.writeText(text);
        showState(button, 'success', 'Kopyalandı');
        return true;
      } catch {
        showState(button, 'error', 'Kopyalanamadı');
        return false;
      }
    }

    function decorate(article) {
      if (!article || typeof article.querySelector !== 'function') return false;
      if (!article.classList?.contains('message') || article.querySelector('.message-copy-actions')) return false;
      const content = article.querySelector('.content');
      if (!content) return false;

      const actions = documentRef.createElement('div');
      actions.className = 'message-copy-actions';
      actions.setAttribute('aria-live', 'polite');

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'message-copy-btn';
      button.dataset.state = 'idle';
      button.textContent = 'Kopyala';
      const sender = article.classList.contains('user') ? 'kendi mesajını' : 'Hafize yanıtını';
      button.setAttribute('aria-label', `${sender} kopyala`);
      button.addEventListener('click', () => { void copyMessage(button, content); });

      actions.append(button);
      article.append(actions);
      return true;
    }

    function decorateAll(root = documentRef) {
      const messages = root.querySelectorAll?.('.message') || [];
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

    return Object.freeze({ mount, destroy, decorate, decorateAll, copyMessage });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({ MAX_COPY_CHARS, RESET_DELAY_MS, copyText, createController, mount });
});
