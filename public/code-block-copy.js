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
  const WRAP_CLASS = 'hafize-code-wrap';
  const STYLE_TEXT = `
.hafize-code-shell{position:relative}
.hafize-code-copy,.hafize-code-wrap-toggle{position:absolute;top:7px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--surface,#fff);color:inherit;padding:4px 7px;font:inherit;font-size:11px;cursor:pointer;opacity:.86}
.hafize-code-copy{right:7px}
.hafize-code-wrap-toggle{right:92px}
.hafize-code-copy:hover,.hafize-code-copy:focus-visible,.hafize-code-wrap-toggle:hover,.hafize-code-wrap-toggle:focus-visible{opacity:1}
.hafize-code-copy:focus-visible,.hafize-code-wrap-toggle:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.hafize-code-copy:disabled{cursor:progress;opacity:.65}
.hafize-code-language{display:inline-block;margin:0 0 5px;color:var(--muted,#777);font-size:10px;line-height:1.2}
.hafize-code-shell pre{padding-top:34px}
.hafize-code-shell pre.${WRAP_CLASS}{white-space:pre-wrap;overflow-wrap:anywhere}
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

  function setWrap(pre, button, enabled) {
    if (!pre?.classList || !button?.setAttribute) return false;
    pre.classList.toggle(WRAP_CLASS, Boolean(enabled));
    button.setAttribute('aria-pressed', String(Boolean(enabled)));
    button.textContent = enabled ? 'Kaydır' : 'Satırı sar';
    button.title = enabled ? 'Yatay kaydırmaya dön' : 'Uzun kod satırlarını sar';
    return true;
  }

  function toggleWrap(pre, button) {
    const enabled = !pre?.classList?.contains?.(WRAP_CLASS);
    return setWrap(pre, button, enabled);
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
    let mounted = false;
    let destroyed = false;
    const timers = new Map();
    const decorations = new Map();

    function clearButtonTimer(button) {
      const timer = timers.get(button);
      if (timer !== undefined) clearTimeoutImpl(timer);
      timers.delete(button);
    }

    function reset(button) {
      clearButtonTimer(button);
      if (destroyed || !button) return;
      button.disabled = false;
      button.dataset.state = 'idle';
      button.textContent = 'Kodu kopyala';
    }

    function show(button, state, label) {
      if (destroyed || !button) return false;
      clearButtonTimer(button);
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'copying';
      timers.set(button, setTimeoutImpl(() => reset(button), RESET_DELAY_MS));
      return true;
    }

    async function copy(button, code) {
      if (destroyed) return false;
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
        if (destroyed) return false;
        show(button, 'success', 'Kopyalandı');
        return true;
      } catch {
        if (destroyed) return false;
        show(button, 'error', 'Kopyalanamadı');
        return false;
      }
    }

    function decorate(pre) {
      if (destroyed || !pre?.querySelector || pre.dataset?.[MARKER] === '1') return false;
      const code = pre.querySelector(':scope > code');
      if (!code) return false;

      const originalParent = pre.parentNode || null;
      const originalNextSibling = pre.nextSibling || null;
      const hadMarker = Boolean(pre.dataset && Object.prototype.hasOwnProperty.call(pre.dataset, MARKER));
      const markerValue = hadMarker ? pre.dataset[MARKER] : undefined;
      const hadWrapClass = Boolean(pre.classList?.contains?.(WRAP_CLASS));
      const shell = documentRef.createElement('div');
      shell.className = 'hafize-code-shell';
      pre.parentNode?.insertBefore?.(shell, pre);
      if (!shell.parentNode) return false;
      shell.append(pre);

      let label = null;
      const language = languageLabel(code);
      if (language) {
        label = documentRef.createElement('span');
        label.className = 'hafize-code-language';
        label.textContent = language;
        label.setAttribute('aria-hidden', 'true');
        shell.prepend(label);
      }

      const wrapButton = documentRef.createElement('button');
      wrapButton.type = 'button';
      wrapButton.className = 'hafize-code-wrap-toggle';
      wrapButton.setAttribute('aria-label', 'Kod bloğunda uzun satırları sar');
      setWrap(pre, wrapButton, false);
      const onWrapClick = () => {
        if (!destroyed) toggleWrap(pre, wrapButton);
      };
      wrapButton.addEventListener('click', onWrapClick);

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'hafize-code-copy';
      button.dataset.state = 'idle';
      button.textContent = 'Kodu kopyala';
      button.setAttribute('aria-label', language ? `${language} kod bloğunu kopyala` : 'Kod bloğunu kopyala');
      const onCopyClick = () => {
        if (!destroyed) void copy(button, code);
      };
      button.addEventListener('click', onCopyClick);
      shell.append(wrapButton, button);
      if (pre.dataset) pre.dataset[MARKER] = '1';
      decorations.set(pre, Object.freeze({
        shell,
        label,
        wrapButton,
        button,
        onWrapClick,
        onCopyClick,
        originalParent,
        originalNextSibling,
        hadMarker,
        markerValue,
        hadWrapClass
      }));
      return true;
    }

    function decorateAll(root = documentRef) {
      if (destroyed) return 0;
      const blocks = root.querySelectorAll?.('.message.assistant .content.hafize-markdown pre') || [];
      let count = 0;
      for (const pre of blocks) if (decorate(pre)) count += 1;
      return count;
    }

    function mount() {
      if (destroyed || mounted) return false;
      const messages = documentRef.querySelector('#messages');
      if (!messages) return false;
      installStyles(documentRef);
      decorateAll(messages);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => {
          if (!destroyed) decorateAll(messages);
        });
        observer.observe(messages, { childList: true, subtree: true });
      }
      mounted = true;
      return true;
    }

    function restoreDecoration(pre, record) {
      clearButtonTimer(record.button);
      record.wrapButton?.removeEventListener?.('click', record.onWrapClick);
      record.button?.removeEventListener?.('click', record.onCopyClick);

      if (pre?.classList) pre.classList.toggle(WRAP_CLASS, record.hadWrapClass);
      if (pre?.dataset) {
        if (record.hadMarker) pre.dataset[MARKER] = record.markerValue;
        else delete pre.dataset[MARKER];
      }

      if (record.shell?.parentNode) {
        const parent = record.shell.parentNode;
        parent.insertBefore?.(pre, record.shell);
        record.shell.remove?.();
      } else if (record.originalParent && !pre?.parentNode) {
        record.originalParent.insertBefore?.(pre, record.originalNextSibling || null);
      }
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      mounted = false;
      observer?.disconnect?.();
      observer = null;
      for (const [pre, record] of decorations) restoreDecoration(pre, record);
      decorations.clear();
      for (const timer of timers.values()) clearTimeoutImpl(timer);
      timers.clear();
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
    WRAP_CLASS,
    codeText,
    languageLabel,
    setWrap,
    toggleWrap,
    installStyles,
    createController,
    mount
  });
});