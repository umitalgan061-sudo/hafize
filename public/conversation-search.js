(function exposeHafizeConversationSearch(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
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
        if (separatorChars) {
          conversationChars += separatorChars;
          totalChars += separatorChars;
        }
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
      const joined = parts.join('\n');
      index.set(id, normalizeSearchText(joined, MAX_INDEXED_CONVERSATION_CHARS));
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

  function filterRows(rows, rawQuery, contentIndex = new Map()) {
    const query = normalizeQuery(rawQuery);
    const list = Array.from(rows || []);
    if (query === null) {
      for (const row of list) row.hidden = false;
      return Object.freeze({ ok: false, total: list.length, visible: list.length, query: '' });
    }

    let visible = 0;
    for (const row of list) {
      const match = rowMatches(row, query, contentIndex);
      row.hidden = !match;
      if (match) visible += 1;
    }
    return Object.freeze({ ok: true, total: list.length, visible, query });
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
    rootRef = globalThis,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_CONVERSATION_SEARCH_DOCUMENT');
    }

    let observer = null;
    let control = null;
    let input = null;
    let clearButton = null;
    let status = null;
    let list = null;
    let canonical = Object.freeze({ ready: false, index: new Map() });
    let refreshQueued = false;
    let destroyed = false;
    let ownsControl = false;

    function rows() {
      return list?.querySelectorAll?.('.conversation-row') || [];
    }

    function refreshCanonicalIndex() {
      canonical = readCanonicalIndex(rootRef);
      return canonical;
    }

    function updateStatus(result) {
      if (!status || !clearButton) return;
      clearButton.disabled = !input?.value;
      if (!result.ok) {
        status.textContent = 'Arama çok uzun; filtre uygulanmadı.';
        return;
      }
      if (!result.query) {
        status.textContent = result.total ? `${result.total} sohbet` : 'Henüz sohbet yok.';
        return;
      }
      const scope = canonical.ready ? 'başlık ve mesajlarda' : 'başlıklarda';
      status.textContent = result.visible
        ? `${result.visible} / ${result.total} sohbet ${scope} eşleşti`
        : `Eşleşen sohbet yok (${scope}).`;
    }

    function apply() {
      if (destroyed) return Object.freeze({ ok: false, total: 0, visible: 0, query: '' });
      const result = filterRows(rows(), input?.value || '', canonical.index);
      updateStatus(result);
      return result;
    }

    function refreshAndApply() {
      if (destroyed) return null;
      refreshCanonicalIndex();
      return apply();
    }

    function queueRefresh() {
      if (destroyed || refreshQueued) return;
      refreshQueued = true;
      const schedule = typeof rootRef?.requestAnimationFrame === 'function'
        ? rootRef.requestAnimationFrame.bind(rootRef)
        : (callback) => rootRef?.setTimeout?.(callback, 0);
      schedule?.(() => {
        refreshQueued = false;
        if (!destroyed) refreshAndApply();
      });
    }

    function clear({ focus = true } = {}) {
      if (destroyed || !input) return false;
      if (input.value) input.value = '';
      apply();
      if (focus) input.focus?.();
      return true;
    }

    function createControl(historyBlock) {
      const existing = documentRef.querySelector(`#${CONTROL_ID}`);
      if (existing) return Object.freeze({ node: existing, created: false });

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
      return Object.freeze({ node: wrapper, created: true });
    }

    function onInput() {
      apply();
    }

    function onInputKeydown(event) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      clear();
    }

    function onClearClick() {
      clear();
    }

    function onStorage(event) {
      const key = rootRef?.HafizeConversationStorageGuard?.STORAGE_KEY || 'hafize.conversations.v1';
      if (event?.key !== key) return;
      queueRefresh();
    }

    function mount() {
      if (control || observer || input || list) return false;
      destroyed = false;
      const historyBlock = documentRef.querySelector('.history-block');
      list = documentRef.querySelector('#conversationList');
      if (!historyBlock || !list) {
        list = null;
        return false;
      }
      installStyles(documentRef);
      const controlResult = createControl(historyBlock);
      control = controlResult.node;
      ownsControl = controlResult.created;
      input = control.querySelector?.(`#${INPUT_ID}`);
      clearButton = control.querySelector?.('.conversation-search-clear');
      status = control.querySelector?.(`#${STATUS_ID}`);
      if (!input || !clearButton || !status) {
        if (ownsControl) control?.remove?.();
        control = null;
        input = null;
        clearButton = null;
        status = null;
        list = null;
        ownsControl = false;
        return false;
      }

      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onInputKeydown);
      clearButton.addEventListener('click', onClearClick);
      rootRef?.addEventListener?.('storage', onStorage);
      rootRef?.addEventListener?.('hafize:conversation-storage-merged', queueRefresh);
      refreshAndApply();

      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(queueRefresh);
        observer.observe(list, { childList: true, subtree: true });
      }
      return true;
    }

    function destroy() {
      destroyed = true;
      observer?.disconnect?.();
      observer = null;
      rootRef?.removeEventListener?.('storage', onStorage);
      rootRef?.removeEventListener?.('hafize:conversation-storage-merged', queueRefresh);
      input?.removeEventListener?.('input', onInput);
      input?.removeEventListener?.('keydown', onInputKeydown);
      clearButton?.removeEventListener?.('click', onClearClick);
      if (ownsControl) control?.remove?.();
      control = null;
      input = null;
      clearButton = null;
      status = null;
      list = null;
      canonical = Object.freeze({ ready: false, index: new Map() });
      refreshQueued = false;
      ownsControl = false;
    }

    return Object.freeze({ mount, destroy, apply, clear, refreshCanonicalIndex });
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
    MAX_QUERY_CHARS,
    MAX_TITLE_CHARS,
    MAX_INDEXED_CONVERSATIONS,
    MAX_INDEXED_CONVERSATION_CHARS,
    MAX_INDEXED_TOTAL_CHARS,
    STYLE_ID,
    CONTROL_ID,
    INPUT_ID,
    STATUS_ID,
    normalizeQuery,
    normalizeSearchText,
    rowConversationId,
    normalizedTitle,
    buildCanonicalIndex,
    readCanonicalIndex,
    rowMatches,
    filterRows,
    installStyles,
    createController,
    mount
  });
});