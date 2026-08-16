(function exposeHafizeComposerPasteGuard(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeComposerPasteGuard = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeComposerPasteGuard() {
  'use strict';

  const MAX_COMPOSER_CHARS = 12_000;
  const STATUS_ID = 'hafizeComposerPasteStatus';
  const STATUS_DELAY_MS = 4200;

  function finiteIndex(value, fallback, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(Math.trunc(number), 0), max);
  }

  function normalizedSelection(value, start, end) {
    const length = typeof value === 'string' ? value.length : 0;
    const from = finiteIndex(start, length, length);
    const to = finiteIndex(end, from, length);
    return Object.freeze(from <= to ? { start: from, end: to } : { start: to, end: from });
  }

  function projectedLength(value, selectionStart, selectionEnd, pastedText) {
    if (typeof value !== 'string' || typeof pastedText !== 'string') return null;
    const selection = normalizedSelection(value, selectionStart, selectionEnd);
    return value.length - (selection.end - selection.start) + pastedText.length;
  }

  function overflowBy(value, selectionStart, selectionEnd, pastedText, limit = MAX_COMPOSER_CHARS) {
    if (!Number.isInteger(limit) || limit < 1) return null;
    const length = projectedLength(value, selectionStart, selectionEnd, pastedText);
    if (length === null) return null;
    return Math.max(0, length - limit);
  }

  function installStatus(documentRef, input) {
    const existing = documentRef.querySelector?.(`#${STATUS_ID}`);
    if (existing) return existing;
    const status = documentRef.createElement('span');
    status.id = STATUS_ID;
    status.className = 'agent-hint';
    status.hidden = true;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    input?.parentNode?.append?.(status);
    return status;
  }

  function createController({
    documentRef = globalThis.document,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_COMPOSER_PASTE_DOCUMENT');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_COMPOSER_PASTE_TIMER');

    let mounted = false;
    let status = null;
    let timer = null;

    function input() {
      return documentRef.querySelector('#messageInput');
    }

    function clearStatus() {
      if (timer !== null) clearTimeoutImpl(timer);
      timer = null;
      if (!status) return;
      status.textContent = '';
      status.hidden = true;
      status.dataset.state = 'idle';
    }

    function showOverflow(amount) {
      if (!status) return;
      if (timer !== null) clearTimeoutImpl(timer);
      status.dataset.state = 'error';
      status.textContent = `Yapıştırma eklenmedi: yazar sınırını ${amount.toLocaleString('tr-TR')} karakter aşıyor.`;
      status.hidden = false;
      timer = setTimeoutImpl(clearStatus, STATUS_DELAY_MS);
    }

    function onPaste(event) {
      if (!event || event.defaultPrevented) return false;
      const composerInput = input();
      if (!composerInput || typeof composerInput.value !== 'string') return false;
      const clipboard = event.clipboardData;
      if (!clipboard || typeof clipboard.getData !== 'function') return false;
      const text = clipboard.getData('text/plain');
      if (typeof text !== 'string' || text.length === 0) return false;
      const amount = overflowBy(
        composerInput.value,
        composerInput.selectionStart,
        composerInput.selectionEnd,
        text
      );
      if (amount === null || amount === 0) return false;
      event.preventDefault?.();
      showOverflow(amount);
      composerInput.focus?.();
      return true;
    }

    function onInput() {
      if (!status?.hidden) clearStatus();
    }

    function mount() {
      if (mounted) return true;
      const composerInput = input();
      if (!composerInput) return false;
      status = installStatus(documentRef, composerInput);
      if (!status) return false;
      composerInput.addEventListener?.('paste', onPaste);
      composerInput.addEventListener?.('input', onInput);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      const composerInput = input();
      composerInput?.removeEventListener?.('paste', onPaste);
      composerInput?.removeEventListener?.('input', onInput);
      clearStatus();
      status?.remove?.();
      status = null;
      mounted = false;
    }

    return Object.freeze({ mount, destroy, onPaste, clearStatus, snapshot: () => Object.freeze({ mounted, statusVisible: Boolean(status && !status.hidden) }) });
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
    MAX_COMPOSER_CHARS,
    STATUS_ID,
    STATUS_DELAY_MS,
    normalizedSelection,
    projectedLength,
    overflowBy,
    createController,
    mount
  });
});
