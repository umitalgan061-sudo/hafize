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

  const STORAGE_KEY = 'hafize.conversations.v1';
  const MAX_MODEL_ID_LENGTH = 240;

  function normalizeModelId(value) {
    const model = typeof value === 'string' ? value.trim() : '';
    if (!model || model.length > MAX_MODEL_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(model)) return '';
    return model;
  }

  function readConversations(storage) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    } catch {
      return [];
    }
  }

  function writeConversations(storage, conversations) {
    if (!storage || typeof storage.setItem !== 'function' || !Array.isArray(conversations)) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
      return true;
    } catch {
      return false;
    }
  }

  function modelIds(select) {
    if (!select?.options) return new Set();
    return new Set(Array.from(select.options, (option) => normalizeModelId(option?.value)).filter(Boolean));
  }

  function activeConversationIndex(documentRef) {
    const list = documentRef?.querySelector?.('#conversationList');
    if (!list || typeof list.querySelectorAll !== 'function') return -1;
    const rows = Array.from(list.querySelectorAll('.conversation-row'));
    return rows.findIndex((row) => row?.classList?.contains('active'));
  }

  function createController({
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
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

    function persistSelection() {
      const { select } = nodes();
      const model = normalizeModelId(select?.value);
      if (!model || !modelIds(select).has(model)) return false;
      const conversations = readConversations(storage);
      const index = activeConversationIndex(documentRef);
      if (index < 0 || index >= conversations.length) return false;
      if (conversations[index].modelId === model) return true;
      conversations[index] = { ...conversations[index], modelId: model };
      return writeConversations(storage, conversations);
    }

    function restoreSelection() {
      const { select } = nodes();
      if (!select) return false;
      const available = modelIds(select);
      if (!available.size) return false;
      const conversations = readConversations(storage);
      const index = activeConversationIndex(documentRef);
      if (index < 0 || index >= conversations.length) return false;

      const saved = normalizeModelId(conversations[index].modelId);
      if (saved && available.has(saved)) {
        if (select.value !== saved) {
          select.value = saved;
          dispatchModelChange(select);
        }
        return true;
      }

      const current = normalizeModelId(select.value);
      if (current && available.has(current)) {
        conversations[index] = { ...conversations[index], modelId: current };
        writeConversations(storage, conversations);
        return true;
      }
      return false;
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

    function mount() {
      if (mounted) return false;
      const { select, list, send } = nodes();
      if (!select || !list || !send) return false;
      select.addEventListener?.('change', onModelChange);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(queueSync);
        observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
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
      observer?.disconnect?.();
      observer = null;
      if (runLocked && select) select.disabled = disabledBeforeRun;
      runLocked = false;
      mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, sync, persistSelection, restoreSelection, syncRunLock });
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
    MAX_MODEL_ID_LENGTH,
    normalizeModelId,
    readConversations,
    writeConversations,
    modelIds,
    activeConversationIndex,
    createController,
    mount
  });
});
