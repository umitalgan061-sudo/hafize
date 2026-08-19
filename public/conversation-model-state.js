(function exposeHafizeConversationModelState(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationModelState = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationModelState() {
  'use strict';

  const CONVERSATION_STORAGE_KEY = 'hafize.conversations.v1';
  const MODEL_STORAGE_KEY = 'hafize.conversation-models.v1';
  const MAX_MODEL_ID_LENGTH = 240;
  const MAX_CONVERSATION_ID_LENGTH = 120;
  const MAX_ENTRIES = 30;
  const MAX_SESSION_MUTATIONS = 30;
  const MAX_STORAGE_CHARS = 32 * 1024;
  const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
  const ORGANIZE_ID_DATASET_KEY = 'conversationOrganizeId';

  function normalizeModelId(value) {
    const model = typeof value === 'string' ? value.normalize('NFC').trim() : '';
    if (!model || model.length > MAX_MODEL_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(model)) return '';
    return model;
  }

  function normalizeConversationId(value) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id || id.length > MAX_CONVERSATION_ID_LENGTH || !CONVERSATION_ID_PATTERN.test(id)) return '';
    return id;
  }

  function readConversations(storage) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
      const value = JSON.parse(storage.getItem(CONVERSATION_STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    } catch {
      return [];
    }
  }

  function normalizeModelEntries(value, allowedConversationIds) {
    if (!Array.isArray(value)) return Object.freeze([]);
    const allowed = allowedConversationIds instanceof Set ? allowedConversationIds : null;
    const seen = new Set();
    const result = [];
    for (const candidate of value) {
      if (result.length >= MAX_ENTRIES) break;
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const conversationId = normalizeConversationId(candidate.conversationId);
      const modelId = normalizeModelId(candidate.modelId);
      if (!conversationId || !modelId || seen.has(conversationId)) continue;
      if (allowed && !allowed.has(conversationId)) continue;
      seen.add(conversationId);
      result.push(Object.freeze({ conversationId, modelId }));
    }
    return Object.freeze(result);
  }

  function allowedConversationIds(conversations) {
    return new Set((Array.isArray(conversations) ? conversations : [])
      .map((item) => normalizeConversationId(item?.id))
      .filter(Boolean));
  }

  function parseModelEntries(raw, conversations = []) {
    if (raw == null || raw === '') return Object.freeze([]);
    if (typeof raw !== 'string' || raw.length > MAX_STORAGE_CHARS) return Object.freeze([]);
    try {
      return normalizeModelEntries(JSON.parse(raw), allowedConversationIds(conversations));
    } catch {
      return Object.freeze([]);
    }
  }

  function readModelRaw(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(MODEL_STORAGE_KEY);
      if (raw == null || raw === '') return '';
      if (typeof raw !== 'string' || raw.length > MAX_STORAGE_CHARS) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function readModelEntries(storage, conversations = readConversations(storage)) {
    const raw = readModelRaw(storage);
    return raw === null ? Object.freeze([]) : parseModelEntries(raw, conversations);
  }

  function writeModelEntries(storage, entries, conversations = readConversations(storage)) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    const normalized = normalizeModelEntries(entries, allowedConversationIds(conversations));
    const serialized = JSON.stringify(normalized);
    if (serialized.length > MAX_STORAGE_CHARS) return false;
    try {
      storage.setItem(MODEL_STORAGE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }

  function compactModelEntries(storage, conversations = readConversations(storage)) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    const raw = readModelRaw(storage);
    const entries = readModelEntries(storage, conversations);
    const canonical = JSON.stringify(entries);
    if (raw === canonical) return false;
    try {
      storage.setItem(MODEL_STORAGE_KEY, canonical);
      return true;
    } catch {
      return false;
    }
  }

  function entryFor(entries, conversationId) {
    const id = normalizeConversationId(conversationId);
    if (!id) return null;
    return normalizeModelEntries(entries).find((entry) => entry.conversationId === id) || null;
  }

  function sameModelEntry(left, right) {
    const a = left == null ? null : entryFor([left], left?.conversationId);
    const b = right == null ? null : entryFor([right], right?.conversationId);
    if (a === null || b === null) return a === b;
    return a.conversationId === b.conversationId && a.modelId === b.modelId;
  }

  function replaceModelEntry(entries, conversationId, value) {
    const id = normalizeConversationId(conversationId);
    if (!id) return normalizeModelEntries(entries);
    const source = normalizeModelEntries(entries).filter((entry) => entry.conversationId !== id);
    if (value == null) return source;
    const replacement = entryFor([value], id);
    return replacement ? normalizeModelEntries([replacement, ...source]) : source;
  }

  function normalizeModelMutation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const conversationId = normalizeConversationId(value.conversationId);
    if (!conversationId) return null;
    const before = value.before == null ? null : entryFor([value.before], conversationId);
    const after = value.after == null ? null : entryFor([value.after], conversationId);
    if ((value.before != null && !before) || (value.after != null && !after)) return null;
    if ((before && before.conversationId !== conversationId) || (after && after.conversationId !== conversationId)) return null;
    if (!after || sameModelEntry(before, after)) return null;
    return Object.freeze({ conversationId, before, after });
  }

  function changedModelEntryIds(beforeEntries, afterEntries) {
    const before = new Map(normalizeModelEntries(beforeEntries).map((entry) => [entry.conversationId, entry]));
    const after = new Map(normalizeModelEntries(afterEntries).map((entry) => [entry.conversationId, entry]));
    const ids = new Set([...before.keys(), ...after.keys()]);
    return [...ids].filter((id) => !sameModelEntry(before.get(id) || null, after.get(id) || null));
  }

  function reconcileModelMutation(entries, mutation, previousEntries = null) {
    const source = normalizeModelEntries(entries);
    const normalized = normalizeModelMutation(mutation);
    if (!normalized) return Object.freeze({ entries: source, status: 'invalid' });
    const current = entryFor(source, normalized.conversationId);
    if (sameModelEntry(current, normalized.after)) {
      return Object.freeze({ entries: source, status: 'settled' });
    }
    if (!sameModelEntry(current, normalized.before)) {
      return Object.freeze({ entries: source, status: 'conflict' });
    }
    if (!Array.isArray(previousEntries)) {
      return Object.freeze({ entries: source, status: 'conflict' });
    }
    const prior = entryFor(previousEntries, normalized.conversationId);
    if (!sameModelEntry(prior, normalized.after)) {
      return Object.freeze({ entries: source, status: 'conflict' });
    }
    const changed = changedModelEntryIds(previousEntries, source);
    if (changed.length <= 1) {
      return Object.freeze({ entries: source, status: 'conflict' });
    }
    return Object.freeze({
      entries: replaceModelEntry(source, normalized.conversationId, normalized.after),
      status: 'replay'
    });
  }

  function modelIds(select) {
    if (!select?.options) return new Set();
    return new Set(Array.from(select.options, (option) => normalizeModelId(option?.value)).filter(Boolean));
  }

  function conversationRows(documentRef) {
    const list = documentRef?.querySelector?.('#conversationList');
    if (!list || typeof list.querySelectorAll !== 'function') return [];
    return Array.from(list.querySelectorAll('.conversation-row'));
  }

  function activeConversationIndex(documentRef) {
    const rows = conversationRows(documentRef);
    return rows.findIndex((row) => row?.classList?.contains('active'));
  }

  function hasOrganizerIdentity(row) {
    const dataset = row?.dataset;
    return Boolean(dataset && Object.prototype.hasOwnProperty.call(dataset, ORGANIZE_ID_DATASET_KEY));
  }

  function organizerConversationId(row) {
    if (!hasOrganizerIdentity(row)) return '';
    return normalizeConversationId(row.dataset[ORGANIZE_ID_DATASET_KEY]);
  }

  function activeConversationId(documentRef, conversations) {
    const rows = conversationRows(documentRef);
    const activeRows = rows.filter((row) => row?.classList?.contains('active'));
    if (activeRows.length !== 1) return '';

    const activeRow = activeRows[0];
    if (hasOrganizerIdentity(activeRow)) {
      const organizerId = organizerConversationId(activeRow);
      if (!organizerId) return '';

      const canonicalMatches = conversations.filter(
        (conversation) => normalizeConversationId(conversation?.id) === organizerId
      );
      if (canonicalMatches.length !== 1) return '';

      const rowMatches = rows.filter(
        (row) => hasOrganizerIdentity(row) && organizerConversationId(row) === organizerId
      );
      if (rowMatches.length !== 1) return '';
      return organizerId;
    }

    if (rows.some((row) => hasOrganizerIdentity(row))) return '';
    const index = rows.indexOf(activeRow);
    if (index < 0 || index >= conversations.length) return '';
    return normalizeConversationId(conversations[index]?.id);
  }

  function legacyModelEntry(conversation, availableModels) {
    const conversationId = normalizeConversationId(conversation?.id);
    const modelId = normalizeModelId(conversation?.modelId);
    if (!conversationId || !modelId || !availableModels.has(modelId)) return null;
    return Object.freeze({ conversationId, modelId });
  }

  function upsertModelEntry(entries, conversationId, modelId) {
    const id = normalizeConversationId(conversationId);
    const model = normalizeModelId(modelId);
    if (!id || !model) return normalizeModelEntries(entries);
    const next = [{ conversationId: id, modelId: model }];
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (normalizeConversationId(entry?.conversationId) === id) continue;
      next.push(entry);
      if (next.length >= MAX_ENTRIES) break;
    }
    return normalizeModelEntries(next);
  }

  function createController({
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
    rootRef = globalThis,
    MutationObserverImpl = globalThis.MutationObserver,
    EventImpl = globalThis.Event,
    queueMicrotaskImpl = globalThis.queueMicrotask
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      throw new Error('INVALID_CONVERSATION_MODEL_DOCUMENT');
    }

    let mounted = false;
    let observer = null;
    let syncQueued = false;
    let runLocked = false;
    let disabledBeforeRun = false;
    const sessionMutations = new Map();

    function nodes() {
      return Object.freeze({
        select: documentRef.querySelector('#modelSelect'),
        list: documentRef.querySelector('#conversationList'),
        send: documentRef.querySelector('#sendBtn')
      });
    }

    function dispatchModelChange(select) {
      if (typeof select?.dispatchEvent !== 'function' || typeof EventImpl !== 'function') return;
      try { select.dispatchEvent(new EventImpl('change', { bubbles: true })); } catch { /* best effort */ }
    }

    function rememberMutation(conversationId, before, after) {
      const mutation = normalizeModelMutation({ conversationId, before, after });
      if (!mutation) {
        sessionMutations.delete(conversationId);
        return false;
      }
      sessionMutations.set(mutation.conversationId, mutation);
      while (sessionMutations.size > MAX_SESSION_MUTATIONS) {
        sessionMutations.delete(sessionMutations.keys().next().value);
      }
      return true;
    }

    function persistSelection() {
      const { select } = nodes();
      const model = normalizeModelId(select?.value);
      const available = modelIds(select);
      if (!model || !available.has(model)) return false;
      const conversations = readConversations(storage);
      compactModelEntries(storage, conversations);
      const conversationId = activeConversationId(documentRef, conversations);
      if (!conversationId) return false;
      const entries = readModelEntries(storage, conversations);
      const current = entryFor(entries, conversationId);
      if (current?.modelId === model) return true;
      const next = upsertModelEntry(entries, conversationId, model);
      const after = entryFor(next, conversationId);
      if (!writeModelEntries(storage, next, conversations)) return false;
      rememberMutation(conversationId, current, after);
      return true;
    }

    function restoreSelection() {
      const { select } = nodes();
      if (!select) return false;
      const available = modelIds(select);
      if (!available.size) return false;
      const conversations = readConversations(storage);
      compactModelEntries(storage, conversations);
      const conversationId = activeConversationId(documentRef, conversations);
      if (!conversationId) return false;
      const conversation = conversations.find(
        (candidate) => normalizeConversationId(candidate?.id) === conversationId
      );
      if (!conversation) return false;

      let entries = readModelEntries(storage, conversations);
      let saved = normalizeModelId(entries.find((entry) => entry.conversationId === conversationId)?.modelId);
      if (!saved) {
        const legacy = legacyModelEntry(conversation, available);
        if (legacy) {
          entries = upsertModelEntry(entries, legacy.conversationId, legacy.modelId);
          if (writeModelEntries(storage, entries, conversations)) saved = legacy.modelId;
        }
      }

      if (saved && available.has(saved)) {
        if (select.value !== saved) {
          select.value = saved;
          dispatchModelChange(select);
        }
        return true;
      }

      const current = normalizeModelId(select.value);
      if (current && available.has(current)) {
        return writeModelEntries(storage, upsertModelEntry(entries, conversationId, current), conversations);
      }
      return false;
    }

    function reconcileStorageEvent(event, conversations) {
      if (event?.key !== MODEL_STORAGE_KEY || !sessionMutations.size) return false;
      const allowed = allowedConversationIds(conversations);
      for (const id of [...sessionMutations.keys()]) if (!allowed.has(id)) sessionMutations.delete(id);
      if (!sessionMutations.size) return false;

      const previous = parseModelEntries(event.oldValue || '', conversations);
      let next = parseModelEntries(event.newValue || '', conversations);
      let replayed = false;
      for (const [id, mutation] of [...sessionMutations.entries()]) {
        const result = reconcileModelMutation(next, mutation, previous);
        next = result.entries;
        if (result.status === 'settled' || result.status === 'conflict' || result.status === 'invalid') {
          sessionMutations.delete(id);
        } else if (result.status === 'replay') {
          replayed = true;
        }
      }
      if (!replayed) return false;
      const current = readModelEntries(storage, conversations);
      if (JSON.stringify(current) === JSON.stringify(next)) return false;
      return writeModelEntries(storage, next, conversations);
    }

    function syncRunLock() {
      const { select, send } = nodes();
      if (!select || !send?.classList) return false;
      const streaming = send.classList.contains('streaming');
      if (streaming && !runLocked) {
        disabledBeforeRun = Boolean(select.disabled);
        select.disabled = true;
        runLocked = true;
      } else if (!streaming && runLocked) {
        select.disabled = disabledBeforeRun;
        runLocked = false;
      }
      return streaming;
    }

    function sync() {
      syncQueued = false;
      syncRunLock();
      if (!runLocked) restoreSelection();
    }

    function queueSync() {
      if (syncQueued) return;
      syncQueued = true;
      if (typeof queueMicrotaskImpl === 'function') queueMicrotaskImpl(sync);
      else Promise.resolve().then(sync);
    }

    function onModelChange() {
      if (runLocked) return;
      persistSelection();
    }

    function onStorage(event) {
      if (event?.key !== MODEL_STORAGE_KEY && event?.key !== CONVERSATION_STORAGE_KEY) return;
      const conversations = readConversations(storage);
      if (event.key === MODEL_STORAGE_KEY) reconcileStorageEvent(event, conversations);
      else {
        const allowed = allowedConversationIds(conversations);
        for (const id of [...sessionMutations.keys()]) if (!allowed.has(id)) sessionMutations.delete(id);
      }
      queueSync();
    }

    function mount() {
      if (mounted) return false;
      const { select, list, send } = nodes();
      if (!select || !list || !send) return false;
      select.addEventListener?.('change', onModelChange);
      rootRef?.addEventListener?.('storage', onStorage);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(queueSync);
        observer.observe(list, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'data-conversation-organize-id']
        });
        observer.observe(select, { childList: true, subtree: true });
        observer.observe(send, { attributes: true, attributeFilter: ['class'] });
      }
      mounted = true;
      sync();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      const { select } = nodes();
      select?.removeEventListener?.('change', onModelChange);
      rootRef?.removeEventListener?.('storage', onStorage);
      observer?.disconnect?.();
      observer = null;
      sessionMutations.clear();
      if (runLocked && select) select.disabled = disabledBeforeRun;
      runLocked = false;
      mounted = false;
      return true;
    }

    function mutationSnapshot() {
      return Object.freeze([...sessionMutations.values()].map((mutation) => Object.freeze({
        conversationId: mutation.conversationId,
        before: mutation.before,
        after: mutation.after
      })));
    }

    return Object.freeze({
      mount,
      destroy,
      sync,
      persistSelection,
      restoreSelection,
      reconcileStorageEvent,
      syncRunLock,
      mutationSnapshot
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
    CONVERSATION_STORAGE_KEY,
    MODEL_STORAGE_KEY,
    MAX_MODEL_ID_LENGTH,
    MAX_CONVERSATION_ID_LENGTH,
    MAX_ENTRIES,
    MAX_SESSION_MUTATIONS,
    MAX_STORAGE_CHARS,
    ORGANIZE_ID_DATASET_KEY,
    normalizeModelId,
    normalizeConversationId,
    normalizeModelEntries,
    allowedConversationIds,
    parseModelEntries,
    readConversations,
    readModelRaw,
    readModelEntries,
    writeModelEntries,
    compactModelEntries,
    entryFor,
    sameModelEntry,
    replaceModelEntry,
    normalizeModelMutation,
    changedModelEntryIds,
    reconcileModelMutation,
    modelIds,
    conversationRows,
    activeConversationIndex,
    hasOrganizerIdentity,
    organizerConversationId,
    activeConversationId,
    legacyModelEntry,
    upsertModelEntry,
    createController,
    mount
  });
});