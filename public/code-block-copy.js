(function exposeHafizeCodeBlockCopy(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeCodeBlockCopy = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCodeBlockCopy() {
  'use strict';

  const MAX_CODE_CHARS = 256 * 1024;
  const MARKER = 'hafizeCodeCopyReady';
  const RESET_DELAY_MS = 1800;
  const STYLE_ID = 'hafize-code-copy-style';
  const STYLE_TEXT = `
.hafize-code-shell{position:relative}
.hafize-code-copy{position:absolute;top:7px;right:7px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--surface,#fff);color:inherit;padding:4px 7px;font:inherit;font-size:11px;cursor:pointer;opacity:.86}
.hafize-code-copy:hover,.hafize-code-copy:focus-visible{opacity:1}
.hafize-code-copy:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.hafize-code-copy:disabled{cursor:progress;opacity:.65}
.hafize-code-language{display:inline-block;margin:0 0 5px;color:var(--muted,#777);font-size:10px;line-height:1.2}
.hafize-code-shell pre{padding-top:34px}
`;

  function codeText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n');
    if (text.length > MAX_CODE_CHARS) return null;
    return text;
  }

  function languageLabel(code) {
    const raw = typeof code?.dataset?.language === 'string' ? code.dataset.language.trim() : '';
    return raw && /^[\w.+-]{1,32}$/.test(raw) ? raw : '';
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
    if (!documentRef?.querySelector) throw new Error('INVALID_CODE_COPY_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_CODE_COPY_TIMER');

    let observer = null;
    const timers = new WeakMap();

    function reset(button) {
      const timer = timers.get(button);
      if (timer !== undefined) clearTimeoutImpl(timer);
      timers.delete(button);
      button.disabled = false;
      button.dataset.state = 'idle';
      button.textContent = 'Kodu kopyala';
    }

    function show(button, state, label) {
      const timer = timers.get(button);
      if (timer !== undefined) clearTimeoutImpl(timer);
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying';
      timers.set(button, setTimeoutImpl(() => reset(button), RESET_DELAY_MS));
    }

    async function copy(button, code) {
      const text = codeText(code?.textContent);
      if (text === null) {
        show(button, 'error', 'Kopyalanamadı');
        return false;
      }
      if (!secureContext || typeof clipboard?.writeText !== 'function') {
        show(button, 'error', 'Clipboard kapalı');
        return false;
      }
      show(button, 'copying', 'Kopyalanıyor…');
      try {
        await clipboard.writeText(text);
        show(button, 'success', 'Kopyalandı');
        return true;
      } catch {
        show(button, 'error', 'Kopyalanamadı');
        return false;
      }
    }

    function decorate(pre) {
      if (!pre?.querySelector || pre.dataset?.[MARKER] === '1') return false;
      const code = pre.querySelector(':scope > code');
      if (!code) return false;

      const shell = documentRef.createElement('div');
      shell.className = 'hafize-code-shell';
      pre.parentNode?.insertBefore?.(shell, pre);
      if (!shell.parentNode) return false;
      shell.append(pre);

      const language = languageLabel(code);
      if (language) {
        const label = documentRef.createElement('span');
        label.className = 'hafize-code-language';
        label.textContent = language;
        label.setAttribute('aria-hidden', 'true');
        shell.prepend(label);
      }

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'hafize-code-copy';
      button.dataset.state = 'idle';
      button.textContent = 'Kodu kopyala';
      button.setAttribute('aria-label', language ? `${language} kod bloğunu kopyala` : 'Kod bloğunu kopyala');
      button.addEventListener('click', () => { void copy(button, code); });
      shell.append(button);
      if (pre.dataset) pre.dataset[MARKER] = '1';
      return true;
    }

    function decorateAll(root = documentRef) {
      const blocks = root.querySelectorAll?.('.message.assistant .content.hafize-markdown pre') || [];
      let count = 0;
      for (const pre of blocks) if (decorate(pre)) count += 1;
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

    return Object.freeze({ mount, destroy, decorate, decorateAll, copy });
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
    MAX_CODE_CHARS,
    MARKER,
    RESET_DELAY_MS,
    STYLE_ID,
    codeText,
    languageLabel,
    installStyles,
    createController,
    mount
  });
});