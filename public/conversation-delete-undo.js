(function exposeHafizeConversationDeleteUndo(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationDeleteUndo = api;
  api.mount({ rootRef: root });
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationDeleteUndo() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const UNDO_WINDOW_MS = 12_000;
  const MAX_TITLE_CHARS = 80;
  const ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function normalizeTitle(value) {
    if (typeof value !== 'string') return 'Bu sohbet';
    const title = value.normalize('NFC').replace(/\u0000/g, '').trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_CHARS);
    return title || 'Bu sohbet';
  }

  function normalizeConversationId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    return ID_PATTERN.test(id) ? id : null;
  }

  function canonicalSnapshot(rawValue, guardApi) {
    if (!guardApi || typeof guardApi.sanitizeStoredValue !== 'function') return null;
    try {
      const result = guardApi.sanitizeStoredValue(typeof rawValue === 'string' && rawValue ? rawValue : '[]');
      return Array.isArray(result?.value) ? result.value : null;
    } catch {
      return null;
    }
  }

  function findSingleDeletion(beforeValue, candidateValue) {
    if (!Array.isArray(beforeValue) || !Array.isArray(candidateValue)) return null;
    if (beforeValue.length !== candidateValue.length + 1) return null;
    const candidateIds = new Set();
    for (const conversation of candidateValue) {
      const id = normalizeConversationId(conversation?.id);
      if (!id || candidateIds.has(id)) return null;
      candidateIds.add(id);
    }
    let removed = null;
    for (const conversation of beforeValue) {
      const id = normalizeConversationId(conversation?.id);
      if (!id) return null;
      if (candidateIds.has(id)) continue;
      if (removed) return null;
      removed = conversation;
    }
    return removed || null;
  }

  function createNotice(documentRef) {
    if (!documentRef || typeof documentRef.createElement !== 'function') return null;
    const notice = documentRef.createElement('div');
    notice.className = 'conversation-delete-undo hidden';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('aria-atomic', 'true');

    const message = documentRef.createElement('span');
    message.className = 'conversation-delete-undo-message';

    const action = documentRef.createElement('button');
    action.type = 'button';
    action.className = 'conversation-delete-undo-action';
    action.textContent = 'Geri al';

    notice.append(message, action);
    (documentRef.body || documentRef.documentElement)?.append?.(notice);
    return Object.freeze({ notice, message, action });
  }

  function installStorageWrapper(storage, writer) {
    if (!storage || typeof storage.setItem !== 'function' || typeof writer !== 'function') return null;
    const originalSetItem = storage.setItem;
    const instanceWrapper = function conversationDeleteUndoSetItem(key, value) {
      return writer(originalSetItem, this, key, value);
    };
    try {
      Object.defineProperty(storage, 'setItem', {
        configurable: true,
        writable: true,
        value: instanceWrapper
      });
      return Object.freeze({
        mode: 'instance',
        restore() {
          try {
            if (storage.setItem === instanceWrapper) {
              Object.defineProperty(storage, 'setItem', { configurable: true, writable: true, value: originalSetItem });
            }
          } catch {
            // Best-effort teardown only.
          }
        }
      });
    } catch {
      const prototype = Object.getPrototypeOf(storage);
      const prototypeSetItem = prototype?.setItem;
      if (!prototype || typeof prototypeSetItem !== 'function') return null;
      const prototypeWrapper = function conversationDeleteUndoPrototypeSetItem(key, value) {
        if (this !== storage) return prototypeSetItem.call(this, key, value);
        return writer(prototypeSetItem, this, key, value);
      };
      try {
        Object.defineProperty(prototype, 'setItem', {
          configurable: true,
          writable: true,
          value: prototypeWrapper
        });
      } catch {
        return null;
      }
      return Object.freeze({
        mode: 'prototype',
        restore() {
          try {
            if (prototype.setItem === prototypeWrapper) {
              Object.defineProperty(prototype, 'setItem', { configurable: true, writable: true, value: prototypeSetItem });
            }
          } catch {
            // Best-effort teardown only.
          }
        }
      });
    }
  }

  function createController({
    rootRef = globalThis,
    documentRef = rootRef?.document,
    storage = rootRef?.localStorage,
    guardApi = rootRef?.HafizeConversationStorageGuard,
    setTimeoutImpl = rootRef?.setTimeout?.bind(rootRef) || globalThis.setTimeout,
    clearTimeoutImpl = rootRef?.clearTimeout?.bind(rootRef) || globalThis.clearTimeout
  } = {}) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      throw new Error('CONVERSATION_DELETE_UNDO_STORAGE_UNAVAILABLE');
    }
    if (!guardApi || typeof guardApi.sanitizeStoredValue !== 'function') {
      throw new Error('CONVERSATION_DELETE_UNDO_GUARD_UNAVAILABLE');
    }
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
      throw new Error('CONVERSATION_DELETE_UNDO_TIMER_UNAVAILABLE');
    }

    const ui = createNotice(documentRef);
    if (!ui) throw new Error('CONVERSATION_DELETE_UNDO_DOCUMENT_UNAVAILABLE');

    let pending = null;
    let timer = null;
    let destroyed = false;
    let wrapper = null;

    function clearPending() {
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
      pending = null;
      ui.notice.classList?.add?.('hidden');
      ui.message.textContent = '';
      return true;
    }

    function arm(conversation) {
      const id = normalizeConversationId(conversation?.id);
      if (!id) return false;
      clearPending();
      pending = Object.freeze({ id, conversation });
      ui.message.textContent = `${normalizeTitle(conversation.title)} silindi.`;
      ui.notice.classList?.remove?.('hidden');
      timer = setTimeoutImpl(() => clearPending(), UNDO_WINDOW_MS);
      timer?.unref?.();
      return true;
    }

    function currentSnapshot() {
      try {
        return canonicalSnapshot(storage.getItem(STORAGE_KEY) || '[]', guardApi);
      } catch {
        return null;
      }
    }

    function writer(originalSetItem, receiver, key, rawValue) {
      if (destroyed || key !== STORAGE_KEY) return originalSetItem.call(receiver, key, rawValue);
      const before = currentSnapshot();
      const candidate = canonicalSnapshot(String(rawValue), guardApi);
      const removed = findSingleDeletion(before, candidate);
      const result = originalSetItem.call(receiver, key, rawValue);
      if (!removed) return result;
      const after = currentSnapshot();
      const removedId = normalizeConversationId(removed.id);
      if (!after || after.some((conversation) => conversation?.id === removedId)) return result;
      arm(removed);
      return result;
    }

    function restorePendingConversation() {
      if (!pending || destroyed) return false;
      const snapshot = currentSnapshot();
      if (!snapshot) {
        clearPending();
        return false;
      }
      if (snapshot.some((conversation) => conversation?.id === pending.id)) {
        clearPending();
        return false;
      }
      const conversation = pending.conversation;
      clearPending();
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify([conversation, ...snapshot]));
      } catch {
        return false;
      }

      const input = documentRef?.querySelector?.('#messageInput');
      const hasDraft = typeof input?.value === 'string' && input.value.trim().length > 0;
      if (!hasDraft && typeof rootRef?.location?.reload === 'function') {
        rootRef.location.reload();
      } else {
        ui.message.textContent = 'Sohbet geri alındı. Taslağı korumak için görünüm yenilenmedi.';
        ui.notice.classList?.remove?.('hidden');
        timer = setTimeoutImpl(() => clearPending(), 4_000);
        timer?.unref?.();
      }
      return true;
    }

    function onAction(event) {
      event?.preventDefault?.();
      restorePendingConversation();
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !pending) return false;
      clearPending();
      return true;
    }

    ui.action.addEventListener?.('click', onAction);
    documentRef.addEventListener?.('keydown', onKeydown);
    wrapper = installStorageWrapper(storage, writer);
    if (!wrapper) {
      ui.action.removeEventListener?.('click', onAction);
      documentRef.removeEventListener?.('keydown', onKeydown);
      ui.notice.remove?.();
      throw new Error('CONVERSATION_DELETE_UNDO_WRAP_FAILED');
    }

    return Object.freeze({
      restore: restorePendingConversation,
      cancel: clearPending,
      snapshot: () => Object.freeze({ pending: Boolean(pending), pendingId: pending?.id || null, wrapperMode: wrapper.mode }),
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        clearPending();
        wrapper?.restore?.();
        ui.action.removeEventListener?.('click', onAction);
        documentRef.removeEventListener?.('keydown', onKeydown);
        ui.notice.remove?.();
        return true;
      }
    });
  }

  function mount(options) {
    try {
      return createController(options);
    } catch {
      return null;
    }
  }

  return Object.freeze({
    STORAGE_KEY,
    UNDO_WINDOW_MS,
    MAX_TITLE_CHARS,
    normalizeTitle,
    normalizeConversationId,
    canonicalSnapshot,
    findSingleDeletion,
    createNotice,
    installStorageWrapper,
    createController,
    mount
  });
});
