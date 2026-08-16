(function exposeHafizeCodeBlockFocus(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeCodeBlockFocus = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeCodeBlockFocus() {
  'use strict';

  const MAX_CODE_CHARS = 256 * 1024;
  const MARKER = 'hafizeCodeFocusReady';
  const BUTTON_CLASS = 'hafize-code-focus';
  const DIALOG_ID = 'hafizeCodeFocusDialog';
  const STYLE_ID = 'hafize-code-focus-style';
  const STYLE_TEXT = `
.${BUTTON_CLASS}{position:absolute;top:7px;right:151px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--surface,#fff);color:inherit;padding:4px 7px;font:inherit;font-size:11px;cursor:pointer;opacity:.86}
.${BUTTON_CLASS}:hover,.${BUTTON_CLASS}:focus-visible{opacity:1}.${BUTTON_CLASS}:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.hafize-code-focus-backdrop{position:fixed;inset:0;z-index:110;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.48);backdrop-filter:blur(4px)}
.hafize-code-focus-backdrop[hidden]{display:none}.hafize-code-focus-dialog{width:min(980px,100%);max-height:88vh;display:flex;flex-direction:column;border:1px solid var(--line,#ddd);border-radius:16px;background:var(--surface,#fff);color:inherit;box-shadow:0 24px 70px rgba(0,0,0,.28);overflow:hidden}
.hafize-code-focus-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--line,#ddd)}.hafize-code-focus-head strong{font-size:13px}.hafize-code-focus-close{border:1px solid var(--line,#ddd);border-radius:9px;background:transparent;color:inherit;padding:6px 9px;font:inherit;cursor:pointer}.hafize-code-focus-close:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.hafize-code-focus-dialog pre{margin:0;padding:18px;overflow:auto;white-space:pre;tab-size:2}.hafize-code-focus-dialog code{font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media(max-width:720px){.${BUTTON_CLASS}{right:151px;font-size:0}.${BUTTON_CLASS}::before{content:'⛶';font-size:13px}.hafize-code-focus-backdrop{padding:8px}.hafize-code-focus-dialog{max-height:92vh;border-radius:14px}}
`;

  function codeText(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
    return text.length <= MAX_CODE_CHARS ? text : null;
  }

  function languageText(code) {
    const value = typeof code?.dataset?.language === 'string' ? code.dataset.language.trim() : '';
    return /^[\w.+-]{1,32}$/.test(value) ? value : 'Kod';
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style'); style.id = STYLE_ID; style.textContent = STYLE_TEXT; documentRef.head.append(style); return true;
  }

  function createController({ documentRef = globalThis.document, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_CODE_FOCUS_DOCUMENT');
    let observer = null; let backdrop = null; let dialog = null; let codeView = null; let title = null; let closeButton = null; let previousFocus = null;

    function close({ restoreFocus = true } = {}) {
      if (!backdrop || backdrop.hidden) return false;
      backdrop.hidden = true;
      codeView.textContent = '';
      if (restoreFocus) previousFocus?.focus?.();
      previousFocus = null;
      return true;
    }

    function onKeydown(event) {
      if (!backdrop || backdrop.hidden) return;
      if (event.key === 'Escape') { event.preventDefault?.(); close(); return; }
      if (event.key !== 'Tab') return;
      event.preventDefault?.();
      closeButton?.focus?.();
    }

    function ensureDialog() {
      if (backdrop) return true;
      if (!documentRef.body) return false;
      backdrop = documentRef.createElement('div'); backdrop.className = 'hafize-code-focus-backdrop'; backdrop.hidden = true;
      dialog = documentRef.createElement('section'); dialog.id = DIALOG_ID; dialog.className = 'hafize-code-focus-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', `${DIALOG_ID}Title`);
      const head = documentRef.createElement('div'); head.className = 'hafize-code-focus-head';
      title = documentRef.createElement('strong'); title.id = `${DIALOG_ID}Title`; title.textContent = 'Kod';
      closeButton = documentRef.createElement('button'); closeButton.type = 'button'; closeButton.className = 'hafize-code-focus-close'; closeButton.textContent = 'Kapat'; closeButton.setAttribute('aria-label', 'Kod görünümünü kapat'); closeButton.addEventListener('click', () => close());
      const pre = documentRef.createElement('pre'); codeView = documentRef.createElement('code'); pre.append(codeView); head.append(title, closeButton); dialog.append(head, pre); backdrop.append(dialog); documentRef.body.append(backdrop);
      backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
      documentRef.addEventListener?.('keydown', onKeydown);
      return true;
    }

    function open(button, code) {
      const text = codeText(code?.textContent);
      if (text === null || !ensureDialog()) return false;
      previousFocus = button || documentRef.activeElement;
      title.textContent = languageText(code);
      codeView.textContent = text;
      backdrop.hidden = false;
      closeButton.focus?.();
      return true;
    }

    function decorate(shell) {
      if (!shell?.querySelector || shell.dataset?.[MARKER] === '1') return false;
      const code = shell.querySelector('pre > code');
      if (!code || codeText(code.textContent) === null) return false;
      const button = documentRef.createElement('button'); button.type = 'button'; button.className = BUTTON_CLASS; button.textContent = 'Büyüt'; button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', DIALOG_ID); button.setAttribute('aria-label', 'Kod bloğunu büyük görünümde aç'); button.addEventListener('click', () => { open(button, code); });
      shell.append(button); if (shell.dataset) shell.dataset[MARKER] = '1'; return true;
    }

    function decorateAll(root = documentRef) {
      const shells = root.querySelectorAll?.('.hafize-code-shell') || []; let count = 0; for (const shell of shells) if (decorate(shell)) count += 1; return count;
    }

    function mount() {
      const messages = documentRef.querySelector('#messages'); if (!messages) return false; installStyles(documentRef); decorateAll(messages);
      if (typeof MutationObserverImpl === 'function') { observer = new MutationObserverImpl(() => decorateAll(messages)); observer.observe(messages, { childList: true, subtree: true }); }
      return true;
    }

    function destroy() {
      observer?.disconnect?.(); observer = null; documentRef.removeEventListener?.('keydown', onKeydown); close({ restoreFocus: false }); backdrop?.remove?.(); backdrop = null; dialog = null; codeView = null; title = null; closeButton = null;
      for (const shell of documentRef.querySelectorAll?.('.hafize-code-shell') || []) { shell.querySelector?.(`.${BUTTON_CLASS}`)?.remove?.(); if (shell.dataset) delete shell.dataset[MARKER]; }
    }

    return Object.freeze({ mount, destroy, decorate, decorateAll, open, close });
  }

  function mount(options) { try { const controller = createController(options); return controller.mount() ? controller : null; } catch { return null; } }
  return Object.freeze({ MAX_CODE_CHARS, MARKER, BUTTON_CLASS, DIALOG_ID, STYLE_ID, codeText, languageText, installStyles, createController, mount });
});
