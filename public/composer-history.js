(function exposeHafizeComposerHistory(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeComposerHistory = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeComposerHistory() {
  'use strict';
  const MAX_HISTORY = 50;
  const MAX_MESSAGE_CHARS = 12_000;
  const STATUS_ID = 'composerHistoryStatus';

  function normalizeMessage(value) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
    if (!text.trim() || text.length > MAX_MESSAGE_CHARS) return null;
    return text;
  }

  function collectHistory(root) {
    const articles = Array.from(root?.querySelectorAll?.('.message.user') || []);
    const history = [];
    for (let index = Math.max(0, articles.length - MAX_HISTORY); index < articles.length; index += 1) {
      const text = normalizeMessage(articles[index]?.querySelector?.('.content')?.textContent);
      if (text !== null) history.push(text);
    }
    return Object.freeze(history);
  }

  function collapsedSelection(input) {
    const start = Number(input?.selectionStart);
    const end = Number(input?.selectionEnd);
    return Number.isInteger(start) && Number.isInteger(end) && start === end ? start : null;
  }

  function canRecall(event, input, direction, navigating = false) {
    if (!event || event.defaultPrevented || event.repeat || event.isComposing) return false;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    if (direction !== -1 && direction !== 1) return false;
    if (direction === -1 && event.key !== 'ArrowUp') return false;
    if (direction === 1 && event.key !== 'ArrowDown') return false;
    if (!input || input.disabled === true || input.readOnly === true || typeof input.value !== 'string') return false;
    const caret = collapsedSelection(input);
    if (caret === null) return false;
    if (navigating) return true;
    return direction === -1 ? caret === 0 : caret === input.value.length;
  }

  function createController({ documentRef = globalThis.document, EventImpl = globalThis.Event } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_COMPOSER_HISTORY_DOCUMENT');
    let mounted = false;
    let input = null;
    let messages = null;
    let status = null;
    let history = Object.freeze([]);
    let cursor = null;
    let draft = '';
    let internalWrite = false;

    function refreshHistory() {
      history = collectHistory(messages);
      if (cursor !== null && cursor > history.length) cursor = null;
      return history;
    }

    function ensureStatus(composer) {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return existing;
      if (!composer || typeof documentRef.createElement !== 'function') return null;
      const node = documentRef.createElement('p');
      node.id = STATUS_ID;
      node.className = 'agent-hint composer-history-status';
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
      composer.append(node);
      return node;
    }

    function announce(text = '') {
      if (!status) return;
      status.textContent = text;
      status.hidden = !text;
    }

    function dispatchInput() {
      if (typeof input?.dispatchEvent !== 'function' || typeof EventImpl !== 'function') return;
      try { input.dispatchEvent(new EventImpl('input', { bubbles: true })); } catch {}
    }

    function writeValue(value, caretAtStart = false) {
      internalWrite = true;
      input.value = value;
      dispatchInput();
      internalWrite = false;
      input.focus?.();
      if (typeof input.setSelectionRange === 'function') {
        const caret = caretAtStart ? 0 : value.length;
        try { input.setSelectionRange(caret, caret); } catch {}
      }
    }

    function reset({ keepStatus = false } = {}) {
      cursor = null;
      draft = '';
      if (!keepStatus) announce('');
    }

    function recall(direction) {
      refreshHistory();
      if (!history.length) { announce('Bu sohbette geri çağrılacak önceki mesaj yok.'); return false; }
      if (cursor === null) {
        if (direction === 1) return false;
        draft = input.value;
        cursor = history.length;
      }
      const next = cursor + direction;
      if (next < 0) { announce(`En eski mesaja ulaştın · 1/${history.length}`); return false; }
      if (next >= history.length) {
        writeValue(draft);
        reset({ keepStatus: true });
        announce(draft ? 'Mevcut taslağa döndün.' : 'Mesaj geçmişinden çıktın.');
        return true;
      }
      cursor = next;
      writeValue(history[cursor], false);
      announce(`Önceki mesaj ${cursor + 1}/${history.length}`);
      return true;
    }

    function onKeydown(event) {
      const navigating = cursor !== null;
      if (canRecall(event, input, -1, navigating)) {
        const changed = recall(-1);
        if (changed || cursor !== null) event.preventDefault?.();
        return changed;
      }
      if (canRecall(event, input, 1, navigating)) {
        const changed = recall(1);
        if (changed || cursor !== null) event.preventDefault?.();
        return changed;
      }
      if (navigating && ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event?.key)) reset();
      return false;
    }

    function onInput() { if (!internalWrite) reset(); }
    function onMessagesChanged() {
      const active = cursor !== null;
      refreshHistory();
      if (active) reset();
    }

    function mount() {
      if (mounted) return true;
      input = documentRef.querySelector('#messageInput');
      messages = documentRef.querySelector('#messages');
      const composer = documentRef.querySelector('#composer');
      if (!input || !messages || !composer || typeof input.addEventListener !== 'function') return false;
      status = ensureStatus(composer);
      refreshHistory();
      input.addEventListener('keydown', onKeydown);
      input.addEventListener('input', onInput);
      messages.addEventListener?.('hafize:conversation-changed', onMessagesChanged);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      input?.removeEventListener?.('keydown', onKeydown);
      input?.removeEventListener?.('input', onInput);
      messages?.removeEventListener?.('hafize:conversation-changed', onMessagesChanged);
      status?.remove?.();
      input = null; messages = null; status = null; history = Object.freeze([]); reset(); mounted = false;
      return true;
    }

    function snapshot() {
      return Object.freeze({ mounted, historyLength: history.length, cursor, navigating: cursor !== null, hasDraft: Boolean(draft) });
    }

    return Object.freeze({ mount, destroy, snapshot, refreshHistory, recall, onKeydown, onInput, onMessagesChanged });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; } catch { return null; }
  }

  return Object.freeze({ MAX_HISTORY, MAX_MESSAGE_CHARS, STATUS_ID, normalizeMessage, collectHistory, collapsedSelection, canRecall, createController, mount });
});
