(function exposeHafizeDraftClearUndo(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeDraftClearUndo = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeDraftClearUndo() {
  'use strict';

  const CONTROL_ID = 'draftClearUndo';
  const STYLE_ID = 'hafize-draft-clear-undo-style';
  const UNDO_WINDOW_MS = 10_000;
  const MAX_DRAFT_CHARS = 12_000;
  const STYLE_TEXT = `
.draft-clear-undo{display:flex;align-items:center;gap:4px;margin-left:auto}
.draft-clear-undo button{border:0;border-radius:8px;background:transparent;color:var(--muted,#777);padding:5px 7px;font:inherit;font-size:10px;line-height:1.2}
.draft-clear-undo button:hover:not(:disabled),.draft-clear-undo button:focus-visible{background:color-mix(in srgb,var(--surface,#fff) 82%,transparent);color:inherit}
.draft-clear-undo button:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
`;

  function validDraft(value) {
    if (typeof value !== 'string' || value.length > MAX_DRAFT_CHARS || !value.trim()) return null;
    return value;
  }

  function createController({
    documentRef = globalThis.document,
    EventImpl = globalThis.Event,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_DRAFT_CLEAR_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_DRAFT_CLEAR_TIMER');
    let input = null;
    let control = null;
    let clearButton = null;
    let undoButton = null;
    let snapshot = null;
    let timer = null;
    let mounted = false;

    function installStyles() {
      if (!documentRef.head || documentRef.querySelector(`#${STYLE_ID}`)) return false;
      const style = documentRef.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE_TEXT;
      documentRef.head.append(style);
      return true;
    }

    function notifyInput() {
      if (typeof input?.dispatchEvent === 'function' && typeof EventImpl === 'function') {
        input.dispatchEvent(new EventImpl('input', { bubbles: true }));
      }
    }

    function expireUndo() {
      if (timer !== null) clearTimeoutImpl(timer);
      timer = null;
      snapshot = null;
      if (undoButton) undoButton.hidden = true;
    }

    function sync() {
      if (!input || !clearButton) return false;
      clearButton.disabled = !validDraft(input.value);
      return true;
    }

    function clearDraft() {
      const text = validDraft(input?.value);
      if (!text) { sync(); return false; }
      if (timer !== null) clearTimeoutImpl(timer);
      snapshot = text;
      input.value = '';
      notifyInput();
      input.focus?.();
      if (undoButton) undoButton.hidden = false;
      clearButton.disabled = true;
      timer = setTimeoutImpl(expireUndo, UNDO_WINDOW_MS);
      return true;
    }

    function undoClear() {
      if (!snapshot || !input || input.value) return false;
      const text = snapshot;
      expireUndo();
      input.value = text;
      notifyInput();
      input.focus?.();
      input.setSelectionRange?.(text.length, text.length);
      sync();
      return true;
    }

    function mount() {
      if (mounted) return true;
      input = documentRef.querySelector('#messageInput');
      const tools = documentRef.querySelector('.composer-tools');
      if (!input || !tools) return false;
      installStyles();
      control = documentRef.querySelector(`#${CONTROL_ID}`);
      if (!control) {
        control = documentRef.createElement('span');
        control.id = CONTROL_ID;
        control.className = 'draft-clear-undo';
        clearButton = documentRef.createElement('button');
        clearButton.type = 'button';
        clearButton.textContent = 'Taslağı temizle';
        clearButton.setAttribute('aria-label', 'Mesaj taslağını temizle');
        undoButton = documentRef.createElement('button');
        undoButton.type = 'button';
        undoButton.textContent = 'Geri al';
        undoButton.hidden = true;
        undoButton.setAttribute('aria-label', 'Temizlenen taslağı geri al');
        control.append(clearButton, undoButton);
        tools.append(control);
      } else {
        [clearButton, undoButton] = control.querySelectorAll?.('button') || [];
        if (!clearButton || !undoButton) return false;
      }
      clearButton.addEventListener('click', clearDraft);
      undoButton.addEventListener('click', undoClear);
      input.addEventListener('input', sync);
      mounted = true;
      sync();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      expireUndo();
      clearButton?.removeEventListener?.('click', clearDraft);
      undoButton?.removeEventListener?.('click', undoClear);
      input?.removeEventListener?.('input', sync);
      control?.remove?.();
      mounted = false;
      input = null; control = null; clearButton = null; undoButton = null;
      return true;
    }

    return Object.freeze({ mount, destroy, sync, clearDraft, undoClear, expireUndo });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; }
    catch { return null; }
  }

  return Object.freeze({ CONTROL_ID, STYLE_ID, UNDO_WINDOW_MS, MAX_DRAFT_CHARS, validDraft, createController, mount });
});