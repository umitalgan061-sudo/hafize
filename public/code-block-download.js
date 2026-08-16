(function exposeHafizeCodeBlockDownload(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeCodeBlockDownload = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCodeBlockDownload() {
  'use strict';

  const MAX_CODE_CHARS = 256 * 1024;
  const MARKER = 'hafizeCodeDownloadReady';
  const STYLE_ID = 'hafize-code-download-style';
  const RESET_DELAY_MS = 1800;
  const EXTENSIONS = Object.freeze({
    js: 'js', javascript: 'js', ts: 'ts', typescript: 'ts', json: 'json',
    html: 'html', css: 'css', py: 'py', python: 'py', sh: 'sh', bash: 'sh',
    sql: 'sql', md: 'md', markdown: 'md', yaml: 'yaml', yml: 'yml', xml: 'xml',
    java: 'java', c: 'c', cpp: 'cpp', cs: 'cs', go: 'go', rust: 'rs', rs: 'rs'
  });
  const STYLE_TEXT = `
.hafize-code-download{position:absolute;top:38px;right:7px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--surface,#fff);color:inherit;padding:4px 7px;font:inherit;font-size:11px;cursor:pointer;opacity:.86}
.hafize-code-download:hover,.hafize-code-download:focus-visible{opacity:1}
.hafize-code-download:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.hafize-code-download:disabled{cursor:progress;opacity:.65}
.hafize-code-shell pre{padding-top:65px}
@media(max-width:560px){.hafize-code-download{font-size:0}.hafize-code-download::before{content:'⇩';font-size:13px}}
`;

  function codeText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
    return text.length <= MAX_CODE_CHARS ? text : null;
  }

  function languageOf(code) {
    const value = typeof code?.dataset?.language === 'string' ? code.dataset.language.trim().toLowerCase() : '';
    return /^[\w.+-]{1,32}$/.test(value) ? value : '';
  }

  function extensionFor(language) {
    return EXTENSIONS[language] || 'txt';
  }

  function filenameFor(language) {
    return `hafize-code.${extensionFor(language)}`;
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
    BlobImpl = globalThis.Blob,
    URLImpl = globalThis.URL,
    MutationObserverImpl = globalThis.MutationObserver,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef?.querySelector) throw new Error('INVALID_CODE_DOWNLOAD_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_CODE_DOWNLOAD_TIMER');
    let observer = null;
    const timers = new WeakMap();

    function reset(button) {
      const timer = timers.get(button);
      if (timer !== undefined) clearTimeoutImpl(timer);
      timers.delete(button);
      button.disabled = false;
      button.dataset.state = 'idle';
      button.textContent = 'Kodu indir';
    }

    function show(button, state, label) {
      const timer = timers.get(button);
      if (timer !== undefined) clearTimeoutImpl(timer);
      button.disabled = state === 'working';
      button.dataset.state = state;
      button.textContent = label;
      timers.set(button, setTimeoutImpl(() => reset(button), RESET_DELAY_MS));
    }

    function download(button, code) {
      const text = codeText(code?.textContent);
      if (text === null || typeof BlobImpl !== 'function' || typeof URLImpl?.createObjectURL !== 'function' || typeof URLImpl?.revokeObjectURL !== 'function') {
        show(button, 'error', 'İndirilemedi');
        return false;
      }
      show(button, 'working', 'Hazırlanıyor…');
      let url = '';
      let anchor = null;
      try {
        const blob = new BlobImpl([text], { type: 'text/plain;charset=utf-8' });
        url = URLImpl.createObjectURL(blob);
        anchor = documentRef.createElement('a');
        anchor.href = url;
        anchor.download = filenameFor(languageOf(code));
        anchor.rel = 'noopener';
        anchor.hidden = true;
        documentRef.body?.append(anchor);
        anchor.click?.();
        show(button, 'success', 'İndirildi');
        return true;
      } catch {
        show(button, 'error', 'İndirilemedi');
        return false;
      } finally {
        anchor?.remove?.();
        if (url) URLImpl.revokeObjectURL(url);
      }
    }

    function decorate(pre) {
      if (!pre?.querySelector || pre.dataset?.[MARKER] === '1') return false;
      const code = pre.querySelector(':scope > code');
      const shell = pre.closest?.('.hafize-code-shell');
      if (!code || !shell) return false;
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'hafize-code-download';
      button.dataset.state = 'idle';
      button.textContent = 'Kodu indir';
      button.setAttribute('aria-label', 'Kod bloğunu dosya olarak indir');
      button.addEventListener('click', () => download(button, code));
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

    function destroy() { observer?.disconnect?.(); observer = null; }
    return Object.freeze({ mount, destroy, decorate, decorateAll, download });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; } catch { return null; }
  }

  return Object.freeze({ MAX_CODE_CHARS, MARKER, STYLE_ID, RESET_DELAY_MS, EXTENSIONS, codeText, languageOf, extensionFor, filenameFor, installStyles, createController, mount });
});
