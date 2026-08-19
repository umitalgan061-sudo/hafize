(function exposeHafizeConversationSearchSnippets(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeConversationSearchSnippets = api;
    api.mount({ rootRef: root });
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationSearchSnippets() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const INPUT_ID = 'conversationSearchInput';
  const LIST_ID = 'conversationList';
  const SNIPPET_CLASS = 'conversation-search-snippet';
  const STYLE_ID = 'hafize-conversation-search-snippet-style';
  const MAX_QUERY_CHARS = 120;
  const MAX_SNIPPET_CHARS = 180;
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES_PER_CONVERSATION = 200;
  const STYLE_TEXT = `
.${SNIPPET_CLASS}{display:block;margin:4px 2px 0;color:var(--muted,#777);font-size:10px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}
.${SNIPPET_CLASS}[hidden]{display:none}
@media (forced-colors:active){.${SNIPPET_CLASS}{color:CanvasText}}
`;

  function normalizeId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,120}$/.test(value) ? value : '';
  }

  function normalizeQuery(value) {
    if (typeof value !== 'string' || value.length > MAX_QUERY_CHARS) return '';
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  }

  function collapse(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  function boundedWindow(text, query) {
    const clean = collapse(text);
    if (!clean || !query) return '';
    const folded = clean.toLocaleLowerCase('tr-TR');
    const at = folded.indexOf(query);
    if (at < 0) return '';
    const half = Math.floor(MAX_SNIPPET_CHARS / 2);
    let start = Math.max(0, at - half);
    let end = Math.min(clean.length, start + MAX_SNIPPET_CHARS);
    if (end - start < MAX_SNIPPET_CHARS) start = Math.max(0, end - MAX_SNIPPET_CHARS);
    let snippet = clean.slice(start, end).trim();
    if (start > 0) snippet = `…${snippet}`;
    if (end < clean.length) snippet = `${snippet}…`;
    return snippet.slice(0, MAX_SNIPPET_CHARS + 2);
  }

  function firstMessageSnippet(conversation, query) {
    const messages = Array.isArray(conversation?.messages)
      ? conversation.messages.slice(0, MAX_MESSAGES_PER_CONVERSATION)
      : [];
    for (const message of messages) {
      if (message?.role !== 'user' && message?.role !== 'assistant') continue;
      const snippet = boundedWindow(message.content, query);
      if (!snippet) continue;
      const prefix = message.role === 'user' ? 'Sen' : 'Hafize';
      return `${prefix}: ${snippet}`.slice(0, MAX_SNIPPET_CHARS + 12);
    }
    return '';
  }

  function buildSnippetIndex(conversations, query) {
    const index = new Map();
    if (!query || !Array.isArray(conversations)) return index;
    for (const conversation of conversations.slice(0, MAX_CONVERSATIONS)) {
      const id = normalizeId(conversation?.id);
      if (!id || index.has(id)) continue;
      const snippet = firstMessageSnippet(conversation, query);
      if (snippet) index.set(id, snippet);
    }
    return index;
  }

  function readCanonicalConversations(rootRef) {
    const guard = rootRef?.HafizeConversationStorageGuard;
    const storage = rootRef?.localStorage;
    if (!guard || typeof guard.sanitizeStoredValue !== 'function' || typeof storage?.getItem !== 'function') return [];
    try {
      const raw = storage.getItem(guard.STORAGE_KEY || STORAGE_KEY) || '[]';
      const sanitized = guard.sanitizeStoredValue(raw);
      return Array.isArray(sanitized?.value) ? sanitized.value : [];
    } catch {
      return [];
    }
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function renderRowSnippet(documentRef, row, text) {
    if (!row || typeof row.querySelector !== 'function') return false;
    let node = row.querySelector(`.${SNIPPET_CLASS}`);
    if (!node && text) {
      node = documentRef.createElement('small');
      node.className = SNIPPET_CLASS;
      row.append(node);
    }
    if (!node) return false;
    node.textContent = text || '';
    node.hidden = !text;
    return true;
  }

  function createController({ documentRef = globalThis.document, rootRef = globalThis, MutationObserverImpl = globalThis.MutationObserver } = {}) {
    if (!documentRef?.querySelector) throw new Error('INVALID_CONVERSATION_SEARCH_SNIPPET_DOCUMENT');
    let input = null;
    let list = null;
    let observer = null;
    let queued = false;
    let mounted = false;
    let destroyed = false;

    function apply() {
      if (!mounted || destroyed || !input || !list) return Object.freeze({ query: '', rows: 0, snippets: 0 });
      const query = normalizeQuery(input.value || '');
      const index = buildSnippetIndex(readCanonicalConversations(rootRef), query);
      const rows = Array.from(list.querySelectorAll?.('.conversation-row') || []);
      for (const row of rows) {
        const id = normalizeId(row?.dataset?.conversationId);
        const text = !row.hidden && id ? index.get(id) || '' : '';
        renderRowSnippet(documentRef, row, text);
      }
      return Object.freeze({ query, rows: rows.length, snippets: index.size });
    }

    function queueApply() {
      if (!mounted || destroyed || queued) return;
      queued = true;
      const schedule = rootRef?.requestAnimationFrame?.bind?.(rootRef) || ((callback) => rootRef?.setTimeout?.(callback, 0));
      schedule(() => {
        queued = false;
        if (mounted && !destroyed) apply();
      });
    }

    function onStorage(event) {
      const key = rootRef?.HafizeConversationStorageGuard?.STORAGE_KEY || STORAGE_KEY;
      if (event?.key === key) queueApply();
    }

    function mount() {
      if (mounted) return false;
      destroyed = false;
      input = documentRef.querySelector(`#${INPUT_ID}`);
      list = documentRef.querySelector(`#${LIST_ID}`);
      if (!input || !list) {
        input = null;
        list = null;
        return false;
      }
      installStyles(documentRef);
      input.addEventListener('input', queueApply);
      rootRef?.addEventListener?.('storage', onStorage);
      rootRef?.addEventListener?.('hafize:conversation-storage-merged', queueApply);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(queueApply);
        observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      }
      mounted = true;
      apply();
      return true;
    }

    function destroy() {
      destroyed = true;
      input?.removeEventListener?.('input', queueApply);
      rootRef?.removeEventListener?.('storage', onStorage);
      rootRef?.removeEventListener?.('hafize:conversation-storage-merged', queueApply);
      observer?.disconnect?.();
      observer = null;
      for (const node of Array.from(list?.querySelectorAll?.(`.${SNIPPET_CLASS}`) || [])) node.remove?.();
      input = null;
      list = null;
      queued = false;
      mounted = false;
    }

    return Object.freeze({ mount, destroy, apply });
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
    STORAGE_KEY,
    INPUT_ID,
    LIST_ID,
    SNIPPET_CLASS,
    STYLE_ID,
    MAX_QUERY_CHARS,
    MAX_SNIPPET_CHARS,
    MAX_CONVERSATIONS,
    MAX_MESSAGES_PER_CONVERSATION,
    normalizeId,
    normalizeQuery,
    boundedWindow,
    firstMessageSnippet,
    buildSnippetIndex,
    readCanonicalConversations,
    renderRowSnippet,
    createController,
    mount
  });
});