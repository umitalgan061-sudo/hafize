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
  const ACTIVE_LISTS = new WeakSet();
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

  function snapshotNode(node) {
    return Object.freeze({ textContent: node.textContent || '', hidden: Boolean(node.hidden) });
  }

  function restoreNode(node, snapshot) {
    if (!node || !snapshot) return;
    node.textContent = snapshot.textContent;
    node.hidden = snapshot.hidden;
  }

  function installStyles(documentRef) {
    if (!documentRef?.head) return Object.freeze({ node: null, owned: false });
    const existing = documentRef.getElementById?.(STYLE_ID);
    if (existing) return Object.freeze({ node: existing, owned: false });
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return Object.freeze({ node: style, owned: true });
  }

  function renderRowSnippet(documentRef, row, text, { ownedNodes, hostSnapshots } = {}) {
    if (!row || typeof row.querySelector !== 'function') return false;
    let node = row.querySelector(`.${SNIPPET_CLASS}`);
    if (!node && text) {
      node = documentRef.createElement('small');
      node.className = SNIPPET_CLASS;
      row.append(node);
      ownedNodes?.add?.(node);
    } else if (node && !ownedNodes?.has?.(node) && hostSnapshots && !hostSnapshots.has(node)) {
      hostSnapshots.set(node, snapshotNode(node));
    }
    if (!node) return false;
    node.textContent = text || '';
    node.hidden = !text;
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = globalThis,
    MutationObserverImpl = globalThis.MutationObserver
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_CONVERSATION_SEARCH_SNIPPET_DOCUMENT');

    let input = null;
    let list = null;
    let observer = null;
    let queuedHandle = null;
    let queuedKind = null;
    let mounted = false;
    let destroyed = false;
    let styleNode = null;
    let ownsStyle = false;
    const listenerCleanup = [];
    const ownedNodes = new Set();
    const hostSnapshots = new Map();

    function isLive() {
      return mounted && !destroyed && list && ACTIVE_LISTS.has(list);
    }

    function addListener(target, type, listener) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') {
        throw new Error('INVALID_CONVERSATION_SEARCH_SNIPPET_LISTENER_TARGET');
      }
      target.addEventListener(type, listener);
      listenerCleanup.push(() => target.removeEventListener(type, listener));
    }

    function cancelQueued() {
      if (queuedHandle == null) return;
      if (queuedKind === 'raf') rootRef?.cancelAnimationFrame?.(queuedHandle);
      else rootRef?.clearTimeout?.(queuedHandle);
      queuedHandle = null;
      queuedKind = null;
    }

    function restoreRenderedState() {
      for (const node of ownedNodes) node?.remove?.();
      ownedNodes.clear();
      for (const [node, snapshot] of hostSnapshots) restoreNode(node, snapshot);
      hostSnapshots.clear();
    }

    function rollbackInstallation() {
      cancelQueued();
      observer?.disconnect?.();
      observer = null;
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      restoreRenderedState();
      if (ownsStyle) styleNode?.remove?.();
      styleNode = null;
      ownsStyle = false;
      if (list) ACTIVE_LISTS.delete(list);
      mounted = false;
      input = null;
      list = null;
    }

    function apply() {
      if (!isLive() || !input) return Object.freeze({ query: '', rows: 0, snippets: 0 });
      const query = normalizeQuery(input.value || '');
      const index = buildSnippetIndex(readCanonicalConversations(rootRef), query);
      const rows = Array.from(list.querySelectorAll?.('.conversation-row') || []);
      for (const row of rows) {
        if (!isLive()) break;
        const id = normalizeId(row?.dataset?.conversationId);
        const text = !row.hidden && id ? index.get(id) || '' : '';
        renderRowSnippet(documentRef, row, text, { ownedNodes, hostSnapshots });
      }
      return Object.freeze({ query, rows: rows.length, snippets: index.size });
    }

    function runQueued() {
      queuedHandle = null;
      queuedKind = null;
      if (isLive()) apply();
    }

    function queueApply() {
      if (!isLive() || queuedHandle != null) return false;
      if (typeof rootRef?.requestAnimationFrame === 'function') {
        queuedKind = 'raf';
        queuedHandle = rootRef.requestAnimationFrame(runQueued);
      } else if (typeof rootRef?.setTimeout === 'function') {
        queuedKind = 'timer';
        queuedHandle = rootRef.setTimeout(runQueued, 0);
      } else {
        return false;
      }
      return queuedHandle != null;
    }

    function onStorage(event) {
      if (!isLive()) return;
      const key = rootRef?.HafizeConversationStorageGuard?.STORAGE_KEY || STORAGE_KEY;
      if (event?.key === key) queueApply();
    }

    function mount() {
      if (mounted || destroyed) return false;
      input = documentRef.querySelector(`#${INPUT_ID}`);
      list = documentRef.querySelector(`#${LIST_ID}`);
      if (!input || !list || ACTIVE_LISTS.has(list)) {
        input = null;
        list = null;
        return false;
      }
      ACTIVE_LISTS.add(list);
      try {
        const style = installStyles(documentRef);
        styleNode = style.node;
        ownsStyle = style.owned;
        addListener(input, 'input', queueApply);
        addListener(rootRef, 'storage', onStorage);
        addListener(rootRef, 'hafize:conversation-storage-merged', queueApply);
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(queueApply);
          observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
        }
        mounted = true;
        apply();
        return true;
      } catch {
        rollbackInstallation();
        return false;
      }
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      const ownedList = list;
      cancelQueued();
      observer?.disconnect?.();
      observer = null;
      while (listenerCleanup.length) {
        try { listenerCleanup.pop()?.(); } catch {}
      }
      restoreRenderedState();
      if (ownsStyle) styleNode?.remove?.();
      if (ownedList) ACTIVE_LISTS.delete(ownedList);
      styleNode = null;
      ownsStyle = false;
      input = null;
      list = null;
      mounted = false;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      apply,
      queueApply,
      getState: () => Object.freeze({ mounted, destroyed, queued: queuedHandle != null })
    });
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
    snapshotNode,
    restoreNode,
    renderRowSnippet,
    createController,
    mount
  });
});
