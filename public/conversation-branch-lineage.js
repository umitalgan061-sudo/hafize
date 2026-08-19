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
  const MAX_DEPTH = 12;
  const MAX_ID_CHARS = 120;
  const STYLE_ID = 'hafize-conversation-branch-lineage-style';
  const STYLE_TEXT = `
.conversation-branch-lineage{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 12px 0;padding:8px 10px;border:1px solid var(--line,#ddd);border-radius:10px;background:color-mix(in srgb,var(--surface,#fff) 88%,transparent);font-size:12px;color:var(--muted,#666)}
.conversation-branch-lineage[hidden]{display:none}.conversation-branch-actions{display:flex;gap:6px;flex-wrap:wrap}.conversation-branch-source,.conversation-branch-root,.conversation-branch-prev,.conversation-branch-next{min-height:36px;border:1px solid var(--line,#ddd);border-radius:8px;background:transparent;color:inherit;padding:6px 9px;cursor:pointer}.conversation-branch-source:focus-visible,.conversation-branch-root:focus-visible,.conversation-branch-prev:focus-visible,.conversation-branch-next:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}.conversation-branch-prev[hidden],.conversation-branch-next[hidden]{display:none}
@media(max-width:620px){.conversation-branch-lineage{align-items:stretch;flex-direction:column}.conversation-branch-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.conversation-branch-source,.conversation-branch-root,.conversation-branch-prev,.conversation-branch-next{min-height:44px}.conversation-branch-source,.conversation-branch-root{grid-column:1/-1}}
@media(forced-colors:active){.conversation-branch-source:focus-visible,.conversation-branch-root:focus-visible,.conversation-branch-prev:focus-visible,.conversation-branch-next:focus-visible{outline-color:Highlight}}
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

  function wouldCreateInvalidAncestry(entry, byChild) {
    let cursor = entry.parentConversationId;
    const visited = new Set([entry.childConversationId]);
    let depth = 1;
    while (cursor) {
      if (visited.has(cursor)) return true;
      visited.add(cursor);
      const parentEntry = byChild.get(cursor);
      if (!parentEntry) return false;
      depth += 1;
      if (depth > MAX_DEPTH) return true;
      cursor = parentEntry.parentConversationId;
    }
    return false;
  }

  function normalizeEntries(value, validConversationIds) {
    const source = Array.isArray(value) ? value : [];
    const byChild = new Map();
    const output = [];
    for (const candidate of source) {
      const entry = normalizeEntry(candidate, validConversationIds);
      if (!entry || byChild.has(entry.childConversationId)) continue;
      if (wouldCreateInvalidAncestry(entry, byChild)) continue;
      byChild.set(entry.childConversationId, entry);
      output.push(entry);
      if (output.length >= MAX_ENTRIES) break;
    }
    return output;
  }

  function resolveAncestry(entries, childConversationId) {
    const childId = normalizeId(childConversationId);
    if (!childId) return Object.freeze({ entries: [], rootConversationId: '', depth: 0 });
    const normalized = normalizeEntries(entries);
    const byChild = new Map(normalized.map((entry) => [entry.childConversationId, entry]));
    const chain = [];
    const visited = new Set([childId]);
    let cursor = childId;
    let rootConversationId = childId;
    while (chain.length < MAX_DEPTH) {
      const entry = byChild.get(cursor);
      if (!entry || visited.has(entry.parentConversationId)) break;
      chain.push(entry);
      rootConversationId = entry.parentConversationId;
      visited.add(entry.parentConversationId);
      cursor = entry.parentConversationId;
    }
    return Object.freeze({ entries: Object.freeze(chain), rootConversationId, depth: chain.length });
  }

  function compareSiblingEntries(left, right) {
    const leftMs = Date.parse(left.createdAt);
    const rightMs = Date.parse(right.createdAt);
    if (leftMs !== rightMs) return leftMs - rightMs;
    return left.childConversationId.localeCompare(right.childConversationId);
  }

  function resolveSiblings(entries, childConversationId) {
    const childId = normalizeId(childConversationId);
    if (!childId) return Object.freeze({ entries: Object.freeze([]), index: -1, previousConversationId: '', nextConversationId: '' });
    const normalized = normalizeEntries(entries);
    const current = normalized.find((entry) => entry.childConversationId === childId);
    if (!current) return Object.freeze({ entries: Object.freeze([]), index: -1, previousConversationId: '', nextConversationId: '' });
    const siblings = normalized
      .filter((entry) => entry.parentConversationId === current.parentConversationId && entry.sourceMessageId === current.sourceMessageId)
      .sort(compareSiblingEntries);
    const index = siblings.findIndex((entry) => entry.childConversationId === childId);
    return Object.freeze({
      entries: Object.freeze(siblings),
      index,
      previousConversationId: index > 0 ? siblings[index - 1].childConversationId : '',
      nextConversationId: index >= 0 && index + 1 < siblings.length ? siblings[index + 1].childConversationId : ''
    });
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
    let rootButton = null;
    let previousButton = null;
    let nextButton = null;

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
      const priorByChild = new Map(prior.map((item) => [item.childConversationId, item]));
      if (wouldCreateInvalidAncestry(entry, priorByChild)) return false;
      const normalized = normalizeEntries([entry, ...prior], conversationIds(list));
      if (!normalized.some((item) => item.childConversationId === entry.childConversationId)) return false;
      if (!writeEntries(normalized, list)) return false;
      render();
      return true;
    }

    function annotateRows(list = conversations()) {
      const rows = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || []);
      const validIds = conversationIds(list);
      const claimedIds = new Set();

      rows.forEach((row) => {
        const organizedId = normalizeId(row?.dataset?.conversationOrganizeId);
        if (!organizedId || !validIds.has(organizedId) || claimedIds.has(organizedId)) return;
        row.dataset.conversationId = organizedId;
        claimedIds.add(organizedId);
      });

      const remainingIds = list.map((conversation) => normalizeId(conversation?.id)).filter((id) => id && !claimedIds.has(id));
      let fallbackIndex = 0;
      rows.forEach((row) => {
        const organizedId = normalizeId(row?.dataset?.conversationOrganizeId);
        if (organizedId && validIds.has(organizedId) && row?.dataset?.conversationId === organizedId) return;
        const currentId = normalizeId(row?.dataset?.conversationId);
        if (currentId && validIds.has(currentId) && !claimedIds.has(currentId)) {
          claimedIds.add(currentId);
          return;
        }
        while (fallbackIndex < remainingIds.length && claimedIds.has(remainingIds[fallbackIndex])) fallbackIndex += 1;
        const fallbackId = remainingIds[fallbackIndex] || '';
        if (row?.dataset) {
          if (fallbackId) {
            row.dataset.conversationId = fallbackId;
            claimedIds.add(fallbackId);
            fallbackIndex += 1;
          } else delete row.dataset.conversationId;
        }
      });
      return rows;
    }

    function activeConversationId() {
      const row = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || []).find((candidate) => candidate?.classList?.contains?.('active'));
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
      const actions = documentRef.createElement('div');
      actions.className = 'conversation-branch-actions';
      previousButton = documentRef.createElement('button');
      previousButton.type = 'button';
      previousButton.className = 'conversation-branch-prev';
      previousButton.textContent = '← Önceki alternatif';
      previousButton.hidden = true;
      previousButton.addEventListener('click', () => openPreviousSibling());
      nextButton = documentRef.createElement('button');
      nextButton.type = 'button';
      nextButton.className = 'conversation-branch-next';
      nextButton.textContent = 'Sonraki alternatif →';
      nextButton.hidden = true;
      nextButton.addEventListener('click', () => openNextSibling());
      sourceButton = documentRef.createElement('button');
      sourceButton.type = 'button';
      sourceButton.className = 'conversation-branch-source';
      sourceButton.textContent = 'Kaynak sohbeti aç';
      sourceButton.addEventListener('click', () => openSource());
      rootButton = documentRef.createElement('button');
      rootButton.type = 'button';
      rootButton.className = 'conversation-branch-root';
      rootButton.textContent = 'Kök sohbeti aç';
      rootButton.hidden = true;
      rootButton.addEventListener('click', () => openRoot());
      actions.append(previousButton, nextButton, sourceButton, rootButton);
      banner.append(label, actions);
      stage.prepend?.(banner);
      return banner;
    }

    function currentContext() {
      const list = conversations();
      annotateRows(list);
      const activeId = activeConversationId();
      if (!activeId) return null;
      const entries = readEntries(list);
      const entry = entries.find((item) => item.childConversationId === activeId) || null;
      if (!entry) return null;
      return Object.freeze({ entry, ancestry: resolveAncestry(entries, activeId), siblings: resolveSiblings(entries, activeId) });
    }

    function currentEntry() {
      return currentContext()?.entry || null;
    }

    function openConversation(id) {
      const targetId = normalizeId(id);
      if (!targetId) return false;
      const row = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || []).find((candidate) => candidate?.dataset?.conversationId === targetId);
      const open = row?.querySelector?.('.conversation-open');
      if (!open || typeof open.click !== 'function') return false;
      open.click();
      return true;
    }

    function openSource() {
      const context = currentContext();
      return context ? openConversation(context.entry.parentConversationId) : false;
    }

    function openRoot() {
      const context = currentContext();
      return context && context.ancestry.depth > 1 ? openConversation(context.ancestry.rootConversationId) : false;
    }

    function openPreviousSibling() {
      const context = currentContext();
      return context?.siblings?.previousConversationId ? openConversation(context.siblings.previousConversationId) : false;
    }

    function openNextSibling() {
      const context = currentContext();
      return context?.siblings?.nextConversationId ? openConversation(context.siblings.nextConversationId) : false;
    }

    function render() {
      const node = ensureBanner();
      if (!node) return false;
      const context = currentContext();
      if (!context) {
        node.hidden = true;
        if (label) label.textContent = '';
        if (rootButton) rootButton.hidden = true;
        if (previousButton) previousButton.hidden = true;
        if (nextButton) nextButton.hidden = true;
        return false;
      }
      const mode = context.entry.mode === 'fork' ? 'Dallanmış sohbet' : 'Düzenleme / tekrar dalı';
      const depthText = context.ancestry.depth > 1 ? ` · ${context.ancestry.depth}. seviye dal` : '';
      const siblingText = context.siblings.entries.length > 1 && context.siblings.index >= 0
        ? ` · alternatif ${context.siblings.index + 1}/${context.siblings.entries.length}`
        : '';
      label.textContent = `${mode}${depthText}${siblingText} · kaynak sohbet korunuyor`;
      if (rootButton) rootButton.hidden = context.ancestry.depth <= 1;
      if (previousButton) previousButton.hidden = !context.siblings.previousConversationId;
      if (nextButton) nextButton.hidden = !context.siblings.nextConversationId;
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
        observer.observe(listNode, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-conversation-organize-id'] });
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
      rootButton = null;
      previousButton = null;
      nextButton = null;
    }

    return Object.freeze({ mount, destroy, render, record, readEntries, writeEntries, annotateRows, activeConversationId, currentContext, currentEntry, openConversation, openSource, openRoot, openPreviousSibling, openNextSibling });
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
    MAX_DEPTH,
    MAX_ID_CHARS,
    STYLE_ID,
    STYLE_TEXT,
    normalizeId,
    normalizeMode,
    normalizeEntry,
    wouldCreateInvalidAncestry,
    normalizeEntries,
    resolveAncestry,
    compareSiblingEntries,
    resolveSiblings,
    parseEntries,
    installStyles,
    createController,
    mount
  });
});