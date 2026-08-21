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
  const ACTIVE_MESSAGE_ROOTS = new WeakSet();
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
    clearTimeoutImpl = globalThis.clearTimeout,
    EventImpl = globalThis.Event
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_MESSAGE_COPY_DOCUMENT');
    }
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_MESSAGE_COPY_TIMER');

    const timers = new Map();
    const ownedActions = new Set();
    const listenerCleanup = [];
    let observer = null;
    let messages = null;
    let mounted = false;
    let destroyed = false;
    let styleOwned = false;

    function ownsRoot() {
      return Boolean(!destroyed && mounted && messages && ACTIVE_MESSAGE_ROOTS.has(messages));
    }

    function resetButton(button) {
      if (!button) return false;
      const pending = timers.get(button);
      if (pending !== undefined) clearTimeoutImpl(pending);
      timers.delete(button);
      button.textContent = button.dataset?.idleLabel || 'Kopyala';
      if (button.dataset) button.dataset.state = 'idle';
      button.disabled = false;
      return true;
    }

    function showState(button, state, label) {
      if (!button || destroyed) return false;
      const pending = timers.get(button);
      if (pending !== undefined) clearTimeoutImpl(pending);
      if (button.dataset) button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying' || state === 'sending';
      let timer;
      try {
        timer = setTimeoutImpl(() => {
          if (!destroyed && (!mounted || ownsRoot())) resetButton(button);
        }, RESET_DELAY_MS);
      } catch {
        resetButton(button);
        return false;
      }
      timers.set(button, timer);
      timer?.unref?.();
      return true;
    }

    function composerNodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        composer: documentRef.querySelector('#composer'),
        sendButton: documentRef.querySelector('#sendBtn')
      });
    }

    function notifyComposerInput(input) {
      if (typeof input?.dispatchEvent === 'function' && typeof EventImpl === 'function') {
        input.dispatchEvent(new EventImpl('input', { bubbles: true }));
      }
    }

    async function copyMessage(button, content) {
      if (destroyed || (mounted && !ownsRoot())) return false;
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
        if (destroyed || (mounted && !ownsRoot())) return false;
        showState(button, 'success', 'Kopyalandı');
        return true;
      } catch {
        if (destroyed || (mounted && !ownsRoot())) return false;
        showState(button, 'error', 'Kopyalanamadı');
        return false;
      }
    }

    function resendMessage(button, content) {
      if (destroyed || (mounted && !ownsRoot())) return false;
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
      const draft = typeof input.value === 'string' ? input.value : '';
      if (draft.trim() && draft !== text) {
        input.focus?.();
        showState(button, 'error', 'Taslak korunuyor');
        return false;
      }

      showState(button, 'sending', 'Gönderiliyor…');
      input.value = text;
      try {
        notifyComposerInput(input);
        if (destroyed || (mounted && !ownsRoot())) return false;
        composer.requestSubmit();
        showState(button, 'success', 'Tekrar gönderildi');
        return true;
      } catch {
        showState(button, 'error', 'Gönderilemedi');
        return false;
      }
    }

    function quoteMessage(button, content) {
      if (destroyed || (mounted && !ownsRoot())) return false;
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

    function addListener(target, type, handler) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_MESSAGE_COPY_LISTENER_TARGET');
      }
      target.addEventListener(type, handler);
      listenerCleanup.push(() => target.removeEventListener(type, handler));
    }

    function makeButton(label, ariaLabel, handler) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'message-copy-btn';
      button.dataset.state = 'idle';
      button.dataset.idleLabel = label;
      button.textContent = label;
      button.setAttribute('aria-label', ariaLabel);
      addListener(button, 'click', (event) => {
        if (!ownsRoot()) return false;
        return handler(event);
      });
      return button;
    }

    function decorate(article) {
      if (!ownsRoot() || !article || typeof article.querySelector !== 'function') return false;
      if (!article.classList?.contains('message') || article.querySelector('.message-copy-actions')) return false;
      const content = article.querySelector('.content');
      if (!content) return false;

      const actions = documentRef.createElement('div');
      actions.className = 'message-copy-actions';
      actions.setAttribute('aria-live', 'polite');
      actions.setAttribute('data-hafize-owned-message-actions', '1');

      try {
        if (article.classList.contains('user')) {
          let resendButton;
          resendButton = makeButton('Tekrar gönder', 'kendi mesajını tekrar gönder', () => resendMessage(resendButton, content));
          actions.append(resendButton);
        }
        const sender = article.classList.contains('user') ? 'kendi mesajını' : 'Hafize yanıtını';
        let quoteButton;
        quoteButton = makeButton('Alıntıla', `${sender} yazara alıntıla`, () => quoteMessage(quoteButton, content));
        let copyButton;
        copyButton = makeButton('Kopyala', `${sender} kopyala`, () => void copyMessage(copyButton, content));
        actions.append(quoteButton, copyButton);
        article.append(actions);
        ownedActions.add(actions);
        return true;
      } catch (error) {
        actions.remove?.();
        throw error;
      }
    }

    function decorateAll(root = messages || documentRef) {
      if (!ownsRoot()) return 0;
      const nodes = root.querySelectorAll?.('.message') || [];
      let count = 0;
      for (const article of nodes) if (decorate(article)) count += 1;
      return count;
    }

    function cleanupInstallation() {
      observer?.disconnect?.();
      observer = null;
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      for (const [button, timer] of timers) {
        try { clearTimeoutImpl(timer); } catch {}
        try { resetButton(button); } catch {}
      }
      timers.clear();
      for (const actions of ownedActions) {
        try { actions.remove?.(); } catch {}
      }
      ownedActions.clear();
      if (styleOwned) {
        try { documentRef.querySelector?.(`#${STYLE_ID}`)?.remove?.(); } catch {}
        styleOwned = false;
      }
      if (messages) ACTIVE_MESSAGE_ROOTS.delete(messages);
      mounted = false;
    }

    function mount() {
      if (destroyed || mounted) return false;
      const candidate = documentRef.querySelector('#messages');
      if (!candidate || ACTIVE_MESSAGE_ROOTS.has(candidate)) return false;
      messages = candidate;
      ACTIVE_MESSAGE_ROOTS.add(messages);
      mounted = true;
      try {
        styleOwned = installStyles(documentRef);
        decorateAll(messages);
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(() => {
            if (!ownsRoot()) return;
            decorateAll(messages);
          });
          observer.observe(messages, { childList: true, subtree: true });
        }
        return true;
      } catch {
        cleanupInstallation();
        messages = null;
        return false;
      }
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      cleanupInstallation();
      messages = null;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      decorate,
      decorateAll,
      copyMessage,
      resendMessage,
      quoteMessage,
      getState: () => Object.freeze({ mounted, destroyed, ownsRoot: ownsRoot(), ownedActions: ownedActions.size })
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
