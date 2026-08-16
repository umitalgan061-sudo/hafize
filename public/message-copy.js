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
  const MAX_COMPOSER_CHARS = 12_000;
  const RESET_DELAY_MS = 1800;
  const STYLE_ID = 'hafize-message-copy-style';
  const STYLE_TEXT = `
.message-copy-actions{display:flex;justify-content:flex-end;gap:4px;margin-top:7px;min-height:26px;flex-wrap:wrap}
.message.user .message-copy-actions{justify-content:flex-start}
.message-copy-btn{border:1px solid transparent;border-radius:9px;background:transparent;color:var(--muted,#777);padding:4px 7px;font:inherit;font-size:11px;line-height:1.2;cursor:pointer;opacity:.72}
.message-copy-btn:hover:not(:disabled),.message-copy-btn:focus-visible{opacity:1;border-color:var(--line,#ddd);background:color-mix(in srgb,var(--surface,#fff) 82%,transparent)}
.message-copy-btn:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.message-copy-btn[data-state="success"]{opacity:1}
.message-copy-btn[data-state="error"]{opacity:1}
.message-copy-btn:disabled{cursor:progress}
@media (prefers-reduced-motion:no-preference){.message-copy-btn{transition:opacity .15s ease,background-color .15s ease,border-color .15s ease}}
`;

  function copyText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n/g, '\n');
    if (!text.trim() || text.length > MAX_COPY_CHARS) return null;
    return text;
  }

  function composerText(value) {
    const text = copyText(value);
    return text && text.length <= MAX_COMPOSER_CHARS ? text : null;
  }

  function quoteText(value) {
    const text = copyText(value);
    if (!text) return null;
    const quoted = text.split('\n').map((line) => `> ${line}`).join('\n');
    return quoted.length <= MAX_COMPOSER_CHARS ? quoted : null;
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

    function resetButton(button) {
      const pending = timers.get(button);
      if (pending !== undefined) clearTimeoutImpl(pending);
      timers.delete(button);
      button.textContent = button.dataset.idleLabel || 'Kopyala';
      button.dataset.state = 'idle';
      button.disabled = false;
    }

    function showState(button, state, label) {
      const pending = timers.get(button);
      if (pending !== undefined) clearTimeoutImpl(pending);
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying' || state === 'sending';
      const timer = setTimeoutImpl(() => resetButton(button), RESET_DELAY_MS);
      timers.set(button, timer);
    }

    function composerNodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        composer: documentRef.querySelector('#composer'),
        sendButton: documentRef.querySelector('#sendBtn')
      });
    }

    function notifyComposerInput(input) {
      if (typeof input?.dispatchEvent === 'function' && typeof globalThis.Event === 'function') {
        input.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
      }
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

    function resendMessage(button, content) {
      const text = composerText(content?.textContent);
      if (!text) {
        showState(button, 'error', 'Gönderilemedi');
        return false;
      }
      const { input, composer, sendButton } = composerNodes();
      if (!input || !composer || typeof composer.requestSubmit !== 'function') {
        showState(button, 'error', 'Gönderilemedi');
        return false;
      }
      if (sendButton?.classList?.contains('streaming')) {
        showState(button, 'error', 'Yanıt sürüyor');
        return false;
      }

      showState(button, 'sending', 'Gönderiliyor…');
      input.value = text;
      try {
        notifyComposerInput(input);
        composer.requestSubmit();
        showState(button, 'success', 'Tekrar gönderildi');
        return true;
      } catch {
        showState(button, 'error', 'Gönderilemedi');
        return false;
      }
    }

    function quoteMessage(button, content) {
      const quoted = quoteText(content?.textContent);
      if (!quoted) {
        showState(button, 'error', 'Alıntılanamadı');
        return false;
      }
      const { input } = composerNodes();
      if (!input) {
        showState(button, 'error', 'Alıntılanamadı');
        return false;
      }
      const draft = typeof input.value === 'string' ? input.value : '';
      const separator = draft.trim() ? '\n\n' : '';
      const next = `${draft}${separator}${quoted}`;
      if (next.length > MAX_COMPOSER_CHARS) {
        showState(button, 'error', 'Yazar dolu');
        return false;
      }
      input.value = next;
      notifyComposerInput(input);
      input.focus?.();
      showState(button, 'success', 'Alıntı eklendi');
      return true;
    }

    function makeButton(label, ariaLabel, handler) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'message-copy-btn';
      button.dataset.state = 'idle';
      button.dataset.idleLabel = label;
      button.textContent = label;
      button.setAttribute('aria-label', ariaLabel);
      button.addEventListener('click', handler);
      return button;
    }

    function decorate(article) {
      if (!article || typeof article.querySelector !== 'function') return false;
      if (!article.classList?.contains('message') || article.querySelector('.message-copy-actions')) return false;
      const content = article.querySelector('.content');
      if (!content) return false;

      const actions = documentRef.createElement('div');
      actions.className = 'message-copy-actions';
      actions.setAttribute('aria-live', 'polite');

      if (article.classList.contains('user')) {
        const resendButton = makeButton('Tekrar gönder', 'kendi mesajını tekrar gönder', () => { resendMessage(resendButton, content); });
        actions.append(resendButton);
      }
      const sender = article.classList.contains('user') ? 'kendi mesajını' : 'Hafize yanıtını';
      const quoteButton = makeButton('Alıntıla', `${sender} yazara alıntıla`, () => { quoteMessage(quoteButton, content); });
      const copyButton = makeButton('Kopyala', `${sender} kopyala`, () => { void copyMessage(copyButton, content); });
      actions.append(quoteButton, copyButton);
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
      installStyles(documentRef);
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

    return Object.freeze({ mount, destroy, decorate, decorateAll, copyMessage, resendMessage, quoteMessage });
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
    MAX_COPY_CHARS,
    MAX_COMPOSER_CHARS,
    RESET_DELAY_MS,
    STYLE_ID,
    copyText,
    composerText,
    quoteText,
    installStyles,
    createController,
    mount
  });
});
