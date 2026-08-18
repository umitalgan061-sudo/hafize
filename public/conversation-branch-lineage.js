(function exposeHafizeConversationBranchLineage(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationBranchLineage = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationBranchLineage() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversation-branches.v1';
  const CONVERSATION_KEY = 'hafize.conversations.v1';
  const BRANCH_EVENT = 'hafize:conversation-branched';
  const MAX_ENTRIES = 60;
  const MAX_ID_CHARS = 120;
  const STYLE_ID = 'hafize-conversation-branch-lineage-style';
  const STYLE_TEXT = `
.conversation-branch-lineage{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 12px 0;padding:8px 10px;border:1px solid var(--line,#ddd);border-radius:10px;background:color-mix(in srgb,var(--surface,#fff) 88%,transparent);font-size:12px;color:var(--muted,#666)}
.conversation-branch-lineage[hidden]{display:none}.conversation-branch-source{min-height:36px;border:1px solid var(--line,#ddd);border-radius:8px;background:transparent;color:inherit;padding:6px 9px;cursor:pointer}.conversation-branch-source:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
@media(max-width:620px){.conversation-branch-lineage{align-items:stretch;flex-direction:column}.conversation-branch-source{min-height:44px}}
@media(forced-colors:active){.conversation-branch-source:focus-visible{outline-color:Highlight}}
`;

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function normalizeId(value) {
    if (typeof value !== 'string') return '';
    const id = value.trim();
    return id.length <= MAX_ID_CHARS && /^[A-Za-z0-9._:-]+$/.test(id) ? id : '';
  }

  function normalizeMode(value) {
    return value === 'fork' || value === 'edit' ? value : '';
  }

  function normalizeEntry(value, validConversationIds) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    for (const key of ['childConversationId', 'parentConversationId', 'sourceMessageId', 'mode', 'createdAt']) {
      if (!own(value, key)) return null;
    }
    const childConversationId = normalizeId(value.childConversationId);
    const parentConversationId = normalizeId(value.parentConversationId);
    const sourceMessageId = normalizeId(value.sourceMessageId);
    const mode = normalizeMode(value.mode);
    const createdAt = typeof value.createdAt === 'string' ? value.createdAt : '';
    const createdMs = Date.parse(createdAt);
    if (!childConversationId || !parentConversationId || childConversationId === parentConversationId) return null;
    if (!sourceMessageId || !mode || !Number.isFinite(createdMs)) return null;
    if (validConversationIds && (!validConversationIds.has(childConversationId) || !validConversationIds.has(parentConversationId))) return null;
    return Object.freeze({ childConversationId, parentConversationId, sourceMessageId, mode, createdAt: new Date(createdMs).toISOString() });
  }

  function normalizeEntries(value, validConversationIds) {
    const source = Array.isArray(value) ? value : [];
    const seenChildren = new Set();
    const output = [];
    for (const candidate of source) {
      const entry = normalizeEntry(candidate, validConversationIds);
      if (!entry || seenChildren.has(entry.childConversationId)) continue;
      seenChildren.add(entry.childConversationId);
      output.push(entry);
      if (output.length >= MAX_ENTRIES) break;
    }
    return output;
  }

  function parseEntries(raw, validConversationIds) {
    if (typeof raw !== 'string' || !raw) return [];
    try { return normalizeEntries(JSON.parse(raw), validConversationIds); } catch { return []; }
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
    guard = globalThis.HafizeConversationStorageGuard,
    MutationObserverImpl = globalThis.MutationObserver,
    windowRef = globalThis
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_BRANCH_LINEAGE_DOCUMENT');
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error('INVALID_BRANCH_LINEAGE_STORAGE');
    if (!guard || typeof guard.sanitizeStoredValue !== 'function') throw new Error('INVALID_BRANCH_LINEAGE_GUARD');

    let observer = null;
    let banner = null;
    let label = null;
    let sourceButton = null;

    function conversations() {
      try { return guard.sanitizeStoredValue(storage.getItem(CONVERSATION_KEY) || '[]').value || []; } catch { return []; }
    }

    function conversationIds(list = conversations()) {
      return new Set(list.map((conversation) => normalizeId(conversation?.id)).filter(Boolean));
    }

    function readEntries(list = conversations()) {
      let raw = '';
      try { raw = storage.getItem(STORAGE_KEY) || ''; } catch { return []; }
      return parseEntries(raw, conversationIds(list));
    }

    function writeEntries(entries, list = conversations()) {
      const normalized = normalizeEntries(entries, conversationIds(list));
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return true;
      } catch {
        return false;
      }
    }

    function record(detail) {
      const list = conversations();
      const entry = normalizeEntry(detail, conversationIds(list));
      if (!entry) return false;
      const prior = readEntries(list).filter((item) => item.childConversationId !== entry.childConversationId);
      if (!writeEntries([entry, ...prior], list)) return false;
      render();
      return true;
    }

    function annotateRows(list = conversations()) {
      const rows = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || []);
      rows.forEach((row, index) => {
        const id = normalizeId(list[index]?.id);
        if (row?.dataset) {
          if (id) row.dataset.conversationId = id;
          else delete row.dataset.conversationId;
        }
      });
      return rows;
    }

    function activeConversationId() {
      const row = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || [])
        .find((candidate) => candidate?.classList?.contains?.('active'));
      return normalizeId(row?.dataset?.conversationId);
    }

    function ensureBanner() {
      if (banner) return banner;
      const stage = documentRef.querySelector('.chat-stage');
      if (!stage) return null;
      banner = documentRef.createElement('div');
      banner.className = 'conversation-branch-lineage';
      banner.hidden = true;
      banner.setAttribute('role', 'status');
      label = documentRef.createElement('span');
      sourceButton = documentRef.createElement('button');
      sourceButton.type = 'button';
      sourceButton.className = 'conversation-branch-source';
      sourceButton.textContent = 'Kaynak sohbeti aç';
      sourceButton.addEventListener('click', () => openSource());
      banner.append(label, sourceButton);
      stage.prepend?.(banner);
      return banner;
    }

    function currentEntry() {
      const list = conversations();
      annotateRows(list);
      const activeId = activeConversationId();
      if (!activeId) return null;
      return readEntries(list).find((entry) => entry.childConversationId === activeId) || null;
    }

    function openSource() {
      const entry = currentEntry();
      if (!entry) return false;
      const row = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || [])
        .find((candidate) => candidate?.dataset?.conversationId === entry.parentConversationId);
      const open = row?.querySelector?.('.conversation-open');
      if (!open || typeof open.click !== 'function') return false;
      open.click();
      return true;
    }

    function render() {
      const node = ensureBanner();
      if (!node) return false;
      const entry = currentEntry();
      if (!entry) {
        node.hidden = true;
        if (label) label.textContent = '';
        return false;
      }
      const mode = entry.mode === 'fork' ? 'Dallanmış sohbet' : 'Düzenleme / tekrar dalı';
      label.textContent = `${mode} · kaynak sohbet korunuyor`;
      node.hidden = false;
      return true;
    }

    function onBranch(event) {
      const detail = event?.detail;
      if (!detail || typeof detail !== 'object') return;
      record(detail);
    }

    function onStorage(event) {
      if (event?.key !== STORAGE_KEY && event?.key !== CONVERSATION_KEY) return;
      render();
    }

    function mount() {
      installStyles(documentRef);
      ensureBanner();
      documentRef.addEventListener?.(BRANCH_EVENT, onBranch);
      windowRef?.addEventListener?.('storage', onStorage);
      const listNode = documentRef.querySelector('#conversationList');
      if (listNode && typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => render());
        observer.observe(listNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
      render();
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
      documentRef.removeEventListener?.(BRANCH_EVENT, onBranch);
      windowRef?.removeEventListener?.('storage', onStorage);
      banner?.remove?.();
      banner = null;
      label = null;
      sourceButton = null;
    }

    return Object.freeze({ mount, destroy, render, record, readEntries, writeEntries, annotateRows, activeConversationId, currentEntry, openSource });
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
    CONVERSATION_KEY,
    BRANCH_EVENT,
    MAX_ENTRIES,
    MAX_ID_CHARS,
    STYLE_ID,
    STYLE_TEXT,
    normalizeId,
    normalizeMode,
    normalizeEntry,
    normalizeEntries,
    parseEntries,
    installStyles,
    createController,
    mount
  });
});
