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
    const start = input?.selectionStart;
    const end = input?.selectionEnd;
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
    let ownedStatus = null;
    let statusTextBeforeMount = '';
    let statusHiddenBeforeMount = false;
    let history = Object.freeze([]);
    let cursor = null;
    let draft = '';
    let internalWrite = false;

    function refreshHistory() {
      if (!messages) {
        history = Object.freeze([]);
        cursor = null;
        return history;
      }
      history = collectHistory(messages);
      if (cursor !== null && cursor > history.length) cursor = null;
      return history;
    }

    function ensureStatus(composer) {
      const existing = documentRef.querySelector(`#${STATUS_ID}`);
      if (existing) return { node: existing, owned: false };
      if (!composer || typeof documentRef.createElement !== 'function') return null;
      const node = documentRef.createElement('p');
      node.id = STATUS_ID;
      node.className = 'agent-hint composer-history-status';
      node.hidden = true;
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
      composer.append(node);
      return { node, owned: true };
    }

    function announce(text = '') {
      if (!mounted || !status) return false;
      status.textContent = text;
      status.hidden = !text;
      return true;
    }

    function dispatchInput() {
      if (!mounted || typeof input?.dispatchEvent !== 'function' || typeof EventImpl !== 'function') return false;
      try {
        input.dispatchEvent(new EventImpl('input', { bubbles: true }));
        return true;
      } catch {
        return false;
      }
    }

    function writeValue(value, caretAtStart = false) {
      if (!mounted || !input) return false;
      internalWrite = true;
      input.value = value;
      dispatchInput();
      internalWrite = false;
      input.focus?.();
      if (typeof input.setSelectionRange === 'function') {
        const caret = caretAtStart ? 0 : value.length;
        try { input.setSelectionRange(caret, caret); } catch {}
      }
      return true;
    }

    function reset({ keepStatus = false } = {}) {
      cursor = null;
      draft = '';
      if (!keepStatus) announce('');
    }

    function recall(direction) {
      if (!mounted || !input || (direction !== -1 && direction !== 1)) return false;
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
        const hadDraft = Boolean(draft);
        writeValue(draft);
        reset({ keepStatus: true });
        announce(hadDraft ? 'Mevcut taslağa döndün.' : 'Mesaj geçmişinden çıktın.');
        return true;
      }
      cursor = next;
      writeValue(history[cursor], false);
      announce(`Önceki mesaj ${cursor + 1}/${history.length}`);
      return true;
    }

    function onKeydown(event) {
      if (!mounted) return false;
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

    function onInput() {
      if (!mounted) return false;
      if (!internalWrite) reset();
      return true;
    }

    function onMessagesChanged() {
      if (!mounted) return false;
      const active = cursor !== null;
      refreshHistory();
      if (active) reset();
      return true;
    }

    function mount() {
      if (mounted) return true;
      input = documentRef.querySelector('#messageInput');
      messages = documentRef.querySelector('#messages');
      const composer = documentRef.querySelector('#composer');
      if (!input || !messages || !composer || typeof input.addEventListener !== 'function') return false;
      const resolvedStatus = ensureStatus(composer);
      if (!resolvedStatus?.node) {
        input = null;
        messages = null;
        return false;
      }
      status = resolvedStatus.node;
      ownedStatus = resolvedStatus.owned ? status : null;
      statusTextBeforeMount = String(status.textContent || '');
      statusHiddenBeforeMount = Boolean(status.hidden);
      mounted = true;
      refreshHistory();
      input.addEventListener('keydown', onKeydown);
      input.addEventListener('input', onInput);
      messages.addEventListener?.('hafize:conversation-changed', onMessagesChanged);
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      input?.removeEventListener?.('keydown', onKeydown);
      input?.removeEventListener?.('input', onInput);
      messages?.removeEventListener?.('hafize:conversation-changed', onMessagesChanged);
      if (ownedStatus) ownedStatus.remove?.();
      else if (status) {
        status.textContent = statusTextBeforeMount;
        status.hidden = statusHiddenBeforeMount;
      }
      input = null;
      messages = null;
      status = null;
      ownedStatus = null;
      statusTextBeforeMount = '';
      statusHiddenBeforeMount = false;
      history = Object.freeze([]);
      cursor = null;
      draft = '';
      internalWrite = false;
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
