(function exposeHafizeCodeWrapToggle(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeCodeWrapToggle = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCodeWrapToggle() {
  'use strict';

  const MARKER = 'hafizeCodeWrapReady';
  const STYLE_ID = 'hafize-code-wrap-style';
  const STYLE_TEXT = `
.hafize-code-wrap-toggle{position:absolute;top:7px;right:92px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--surface,#fff);color:inherit;padding:4px 7px;font:inherit;font-size:11px;cursor:pointer;opacity:.86}
.hafize-code-wrap-toggle:hover,.hafize-code-wrap-toggle:focus-visible{opacity:1}
.hafize-code-wrap-toggle:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.hafize-code-shell[data-wrap="on"] pre{white-space:pre-wrap;overflow-wrap:anywhere}
.hafize-code-shell[data-wrap="on"] code{white-space:inherit}
`;

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({ documentRef = globalThis.document, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef?.querySelector) throw new Error('INVALID_CODE_WRAP_DOCUMENT');
    let observer = null;

    function sync(button, shell, enabled) {
      shell.dataset.wrap = enabled ? 'on' : 'off';
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? 'Kaydırma açık' : 'Satırı kaydır';
      button.title = enabled ? 'Kod satır kaydırmasını kapat' : 'Uzun kod satırlarını kaydır';
    }

    function decorate(shell) {
      if (!shell?.querySelector || shell.dataset?.[MARKER] === '1') return false;
      const pre = shell.querySelector(':scope > pre');
      const code = pre?.querySelector?.(':scope > code');
      if (!pre || !code) return false;

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'hafize-code-wrap-toggle';
      button.setAttribute('aria-label', 'Kod satır kaydırmasını aç veya kapat');
      sync(button, shell, false);
      button.addEventListener('click', () => {
        sync(button, shell, shell.dataset.wrap !== 'on');
      });
      shell.append(button);
      shell.dataset[MARKER] = '1';
      return true;
    }

    function decorateAll(root = documentRef) {
      const shells = root.querySelectorAll?.('.message.assistant .content.hafize-markdown .hafize-code-shell') || [];
      let count = 0;
      for (const shell of shells) if (decorate(shell)) count += 1;
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
    return Object.freeze({ mount, destroy, decorate, decorateAll, sync });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; } catch { return null; }
  }

  return Object.freeze({ MARKER, STYLE_ID, installStyles, createController, mount });
});