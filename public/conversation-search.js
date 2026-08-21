(function exposeHafizeConversationSearch(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeConversationSearch = api;
  api.mount({ rootRef: root });
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationSearch() {
  'use strict';

  const MAX_QUERY_CHARS = 120;
  const MAX_TITLE_CHARS = 512;
  const MAX_INDEXED_CONVERSATIONS = 30;
  const MAX_INDEXED_CONVERSATION_CHARS = 120_000;
  const MAX_INDEXED_TOTAL_CHARS = 1_200_000;
  const STYLE_ID = 'hafize-conversation-search-style';
  const CONTROL_ID = 'conversationSearchControl';
  const INPUT_ID = 'conversationSearchInput';
  const STATUS_ID = 'conversationSearchStatus';
  const ACTIVE_LISTS = new WeakSet();
  const STYLE_TEXT = `
.conversation-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin:8px 0 10px}
.conversation-search-input{width:100%;min-width:0;border:1px solid var(--line,#ddd);border-radius:10px;background:var(--surface,#fff);color:inherit;padding:8px 9px;font:inherit;font-size:12px}
.conversation-search-input:focus-visible,.conversation-search-clear:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.conversation-search-clear{min-width:44px;min-height:44px;border:1px solid var(--line,#ddd);border-radius:10px;background:transparent;color:var(--muted,#777);padding:7px 9px;font:inherit;font-size:11px;cursor:pointer}
.conversation-search-clear:disabled{opacity:.45;cursor:default}
.conversation-search-status{grid-column:1/-1;min-height:15px;color:var(--muted,#777);font-size:10px;line-height:1.35}
@media (prefers-reduced-motion:reduce){.conversation-search *{scroll-behavior:auto!important}}
@media (forced-colors:active){.conversation-search-input,.conversation-search-clear{border-color:CanvasText}}
`;

  function normalizeQuery(value) {
    if (typeof value !== 'string') return null;
    if (value.length > MAX_QUERY_CHARS) return null;
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  }

  function normalizeSearchText(value, maxChars) {
    if (typeof value !== 'string' || value.length > maxChars) return '';
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  }

  function rowConversationId(row) {
    const value = row?.dataset?.conversationId;
    return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : '';
  }

  function normalizedTitle(row) {
    const button = row?.querySelector?.('.conversation-open');
    return normalizeSearchText(typeof button?.textContent === 'string' ? button.textContent : '', MAX_TITLE_CHARS);
  }

  function buildCanonicalIndex(conversations) {
    const index = new Map();
    if (!Array.isArray(conversations)) return index;
    let totalChars = 0;
    for (const conversation of conversations.slice(0, MAX_INDEXED_CONVERSATIONS)) {
      const id = typeof conversation?.id === 'string' ? conversation.id : '';
      if (!/^[A-Za-z0-9._:-]{1,120}$/.test(id) || index.has(id)) continue;
      const parts = [];
      let conversationChars = 0;
      const append = (value) => {
        if (typeof value !== 'string' || !value) return;
        const separatorChars = parts.length ? 1 : 0;
        const remainingConversation = MAX_INDEXED_CONVERSATION_CHARS - conversationChars - separatorChars;
        const remainingTotal = MAX_INDEXED_TOTAL_CHARS - totalChars - separatorChars;
        const limit = Math.min(remainingConversation, remainingTotal);
        if (limit <= 0) return;
        const piece = value.slice(0, limit);
        if (!piece) return;
        if (separatorChars) { conversationChars += separatorChars; totalChars += separatorChars; }
        conversationChars += piece.length;
        totalChars += piece.length;
        parts.push(piece);
      };
      append(typeof conversation.title === 'string' ? conversation.title : '');
      for (const message of Array.isArray(conversation.messages) ? conversation.messages : []) {
        if (message?.role !== 'user' && message?.role !== 'assistant') continue;
        append(typeof message.content === 'string' ? message.content : '');
        if (conversationChars >= MAX_INDEXED_CONVERSATION_CHARS || totalChars >= MAX_INDEXED_TOTAL_CHARS) break;
      }
      index.set(id, normalizeSearchText(parts.join('\n'), MAX_INDEXED_CONVERSATION_CHARS));
      if (totalChars >= MAX_INDEXED_TOTAL_CHARS) break;
    }
    return index;
  }

  function readCanonicalIndex(rootRef) {
    const guard = rootRef?.HafizeConversationStorageGuard;
    const storage = rootRef?.localStorage;
    if (!guard || typeof guard.sanitizeStoredValue !== 'function' || typeof storage?.getItem !== 'function') {
      return Object.freeze({ ready: false, index: new Map() });
    }
    try {
      const raw = storage.getItem(guard.STORAGE_KEY || 'hafize.conversations.v1') || '[]';
      const sanitized = guard.sanitizeStoredValue(raw);
      return Object.freeze({ ready: true, index: buildCanonicalIndex(sanitized?.value) });
    } catch {
      return Object.freeze({ ready: false, index: new Map() });
    }
  }

  function rowMatches(row, query, contentIndex) {
    if (!query) return true;
    if (normalizedTitle(row).includes(query)) return true;
    const id = rowConversationId(row);
    return Boolean(id && contentIndex?.get?.(id)?.includes?.(query));
  }

  function filterRows(rows, rawQuery, contentIndex = new Map(), onBeforeChange = null) {
    const query = normalizeQuery(rawQuery);
    const list = Array.from(rows || []);
    if (query === null) {
      for (const row of list) {
        onBeforeChange?.(row);
        row.hidden = false;
      }
      return Object.freeze({ ok: false, total: list.length, visible: list.length, query: '' });
    }
    let visible = 0;
    for (const row of list) {
      const match = rowMatches(row, query, contentIndex);
      onBeforeChange?.(row);
      row.hidden = !match;
      if (match) visible += 1;
    }
    return Object.freeze({ ok: true, total: list.length, visible, query });
  }

  function createStyle(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return Object.freeze({ node: null, created: false });
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return Object.freeze({ node: style, created: true });
  }

  function installStyles(documentRef) {
    return createStyle(documentRef).created;
  }

  function createController({ documentRef = globalThis.document, rootRef = globalThis, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_CONVERSATION_SEARCH_DOCUMENT');
    }

    let observer = null;
    let control = null;
    let input = null;
    let clearButton = null;
    let status = null;
    let list = null;
    let canonical = Object.freeze({ ready: false, index: new Map() });
    let destroyed = false;
    let mounted = false;
    let ownsControl = false;
    let ownedStyle = null;
    let scheduledRefresh = null;
    let refreshGeneration = 0;
    const listenerCleanup = [];
    const rowSnapshots = new Map();

    function isLive() { return !destroyed && mounted && list && ACTIVE_LISTS.has(list); }
    function rows() { return list?.querySelectorAll?.('.conversation-row') || []; }

    function snapshotRow(row) {
      if (row && !rowSnapshots.has(row)) rowSnapshots.set(row, Boolean(row.hidden));
    }

    function restoreRows() {
      for (const [row, hidden] of rowSnapshots) {
        try { row.hidden = hidden; } catch {}
      }
      rowSnapshots.clear();
    }

    function refreshCanonicalIndex() {
      if (!isLive()) return Object.freeze({ ready: false, index: new Map() });
      canonical = readCanonicalIndex(rootRef);
      return canonical;
    }

    function updateStatus(result) {
      if (!isLive() || !status || !clearButton) return;
      clearButton.disabled = !input?.value;
      if (!result.ok) { status.textContent = 'Arama çok uzun; filtre uygulanmadı.'; return; }
      if (!result.query) { status.textContent = result.total ? `${result.total} sohbet` : 'Henüz sohbet yok.'; return; }
      const scope = canonical.ready ? 'başlık ve mesajlarda' : 'başlıklarda';
      status.textContent = result.visible
        ? `${result.visible} / ${result.total} sohbet ${scope} eşleşti`
        : `Eşleşen sohbet yok (${scope}).`;
    }

    function apply() {
      if (!isLive()) return Object.freeze({ ok: false, total: 0, visible: 0, query: '' });
      const result = filterRows(rows(), input?.value || '', canonical.index, snapshotRow);
      updateStatus(result);
      return result;
    }

    function refreshAndApply() {
      if (!isLive()) return null;
      refreshCanonicalIndex();
      return apply();
    }

    function cancelScheduledRefresh() {
      const pending = scheduledRefresh;
      scheduledRefresh = null;
      refreshGeneration += 1;
      if (!pending) return;
      try {
        if (pending.kind === 'raf') rootRef?.cancelAnimationFrame?.(pending.id);
        else rootRef?.clearTimeout?.(pending.id);
      } catch {}
    }

    function queueRefresh() {
      if (!isLive() || scheduledRefresh) return false;
      const generation = ++refreshGeneration;
      const callback = () => {
        scheduledRefresh = null;
        if (!isLive() || generation !== refreshGeneration) return;
        refreshAndApply();
      };
      try {
        if (typeof rootRef?.requestAnimationFrame === 'function') {
          const id = rootRef.requestAnimationFrame(callback);
          scheduledRefresh = Object.freeze({ kind: 'raf', id });
        } else if (typeof rootRef?.setTimeout === 'function') {
          const id = rootRef.setTimeout(callback, 0);
          scheduledRefresh = Object.freeze({ kind: 'timer', id });
        } else {
          return false;
        }
        return true;
      } catch {
        scheduledRefresh = null;
        return false;
      }
    }

    function clear({ focus = true } = {}) {
      if (!isLive() || !input) return false;
      input.value = '';
      apply();
      if (focus) input.focus?.();
      return true;
    }

    function createControl(historyBlock) {
      if (documentRef.querySelector(`#${CONTROL_ID}`)) return null;
      const wrapper = documentRef.createElement('div');
      wrapper.id = CONTROL_ID;
      wrapper.className = 'conversation-search';
      wrapper.setAttribute('role', 'search');
      const field = documentRef.createElement('input');
      field.id = INPUT_ID;
      field.className = 'conversation-search-input';
      field.type = 'search';
      field.maxLength = MAX_QUERY_CHARS;
      field.autocomplete = 'off';
      field.spellcheck = false;
      field.placeholder = 'Sohbetlerde ara';
      field.setAttribute('aria-label', 'Son sohbetlerin başlık ve mesajlarında ara');
      field.setAttribute('aria-controls', 'conversationList');
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'conversation-search-clear';
      button.textContent = 'Temizle';
      button.setAttribute('aria-label', 'Sohbet aramasını temizle');
      const state = documentRef.createElement('small');
      state.id = STATUS_ID;
      state.className = 'conversation-search-status';
      state.setAttribute('role', 'status');
      state.setAttribute('aria-live', 'polite');
      wrapper.append(field, button, state);
      historyBlock.insertBefore(wrapper, list);
      return wrapper;
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_CONVERSATION_SEARCH_LISTENER_TARGET');
      }
      target.addEventListener(type, listener);
      listenerCleanup.push(() => target.removeEventListener(type, listener));
    }

    function onInput() { apply(); }
    function onInputKeydown(event) {
      if (!isLive() || event?.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault?.();
      clear();
    }
    function onClearClick() { clear(); }
    function onStorage(event) {
      if (!isLive()) return;
      const key = rootRef?.HafizeConversationStorageGuard?.STORAGE_KEY || 'hafize.conversations.v1';
      if (event?.key === key) queueRefresh();
    }

    function rollbackInstallation() {
      cancelScheduledRefresh();
      observer?.disconnect?.();
      observer = null;
      while (listenerCleanup.length) { try { listenerCleanup.pop()?.(); } catch {} }
      restoreRows();
      if (ownsControl) control?.remove?.();
      ownedStyle?.remove?.();
      if (list) ACTIVE_LISTS.delete(list);
      control = null;
      input = null;
      clearButton = null;
      status = null;
      list = null;
      ownsControl = false;
      ownedStyle = null;
      mounted = false;
      canonical = Object.freeze({ ready: false, index: new Map() });
    }

    function mount() {
      if (destroyed || mounted || control || observer || input || list) return false;
      const historyBlock = documentRef.querySelector('.history-block');
      list = documentRef.querySelector('#conversationList');
      if (!historyBlock || !list || ACTIVE_LISTS.has(list)) { list = null; return false; }
      ACTIVE_LISTS.add(list);
      try {
        const styleResult = createStyle(documentRef);
        ownedStyle = styleResult.created ? styleResult.node : null;
        control = createControl(historyBlock);
        ownsControl = Boolean(control);
        if (!control) throw new Error('CONVERSATION_SEARCH_CONTROL_OWNED');
        input = control.querySelector?.(`#${INPUT_ID}`);
        clearButton = control.querySelector?.('.conversation-search-clear');
        status = control.querySelector?.(`#${STATUS_ID}`);
        if (!input || !clearButton || !status) throw new Error('INVALID_CONVERSATION_SEARCH_CONTROL');
        addListener(input, 'input', onInput);
        addListener(input, 'keydown', onInputKeydown);
        addListener(clearButton, 'click', onClearClick);
        if (typeof rootRef?.addEventListener === 'function' && typeof rootRef?.removeEventListener === 'function') {
          addListener(rootRef, 'storage', onStorage);
          addListener(rootRef, 'hafize:conversation-storage-merged', queueRefresh);
        }
        mounted = true;
        refreshAndApply();
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(queueRefresh);
          observer.observe(list, { childList: true, subtree: true });
        }
        return true;
      } catch {
        rollbackInstallation();
        return false;
      }
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      rollbackInstallation();
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      apply,
      clear,
      refreshCanonicalIndex,
      queueRefresh,
      getState: () => Object.freeze({ mounted, destroyed, ownsControl, pendingRefresh: Boolean(scheduledRefresh) })
    });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; }
    catch { return null; }
  }

  return Object.freeze({
    MAX_QUERY_CHARS, MAX_TITLE_CHARS, MAX_INDEXED_CONVERSATIONS, MAX_INDEXED_CONVERSATION_CHARS,
    MAX_INDEXED_TOTAL_CHARS, STYLE_ID, CONTROL_ID, INPUT_ID, STATUS_ID,
    normalizeQuery, normalizeSearchText, rowConversationId, normalizedTitle, buildCanonicalIndex,
    readCanonicalIndex, rowMatches, filterRows, installStyles, createController, mount
  });
});
