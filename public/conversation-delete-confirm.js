(function exposeHafizeConversationDeleteConfirm(root, factory) {
  'use strict';

  const api = factory(root);
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationDeleteConfirm = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationDeleteConfirm(defaultRoot) {
  'use strict';

  const FALLBACK_TITLE = 'Bu sohbet';
  const MAX_TITLE_CHARS = 120;
  const CONFIRM_WINDOW_MS = 8_000;
  const UNDO_WINDOW_MS = 12_000;
  const COMPANION_MAX_RAW_CHARS = 96 * 1024;
  const PENDING_TEXT = 'Sil?';
  const CLEAR_PENDING_TEXT = 'Temizle?';
  const UNDO_TEXT = 'Geri al';
  const CLEAR_HISTORY_PROMPT = 'Tüm yerel sohbet geçmişi silinsin mi?';

  function safeTitle(row) {
    const raw = row?.querySelector?.('.conversation-open')?.textContent;
    if (typeof raw !== 'string') return FALLBACK_TITLE;
    const title = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TITLE_CHARS);
    return title || FALLBACK_TITLE;
  }

  function shouldDeferToDraftGuard(target, input) {
    const row = target?.closest?.('.conversation-row');
    return Boolean(row?.classList?.contains('active') && typeof input?.value === 'string' && input.value.trim());
  }

  function isClearHistoryButton(target) {
    return target?.id === 'clearHistoryBtn';
  }

  function boundedRaw(storage, key, maxChars = COMPANION_MAX_RAW_CHARS) {
    if (!storage || typeof storage.getItem !== 'function' || typeof key !== 'string' || !key) return null;
    try {
      const raw = storage.getItem(key);
      if (raw == null || raw === '') return '';
      if (typeof raw !== 'string' || raw.length > maxChars) return null;
      return raw;
    } catch {
      return null;
    }
  }

  function snapshotCompanionState(rootRef, storage, conversations) {
    const list = Array.isArray(conversations) ? conversations : [];
    const snapshot = {};
    const sourceIds = list.map((item) => item?.id).filter((id) => typeof id === 'string');

    const organize = rootRef?.HafizeConversationOrganize;
    if (organize && typeof organize.STORAGE_KEY === 'string' && typeof organize.parseEntries === 'function' &&
        typeof organize.pruneEntries === 'function' && typeof organize.normalizeEntries === 'function') {
      const raw = boundedRaw(storage, organize.STORAGE_KEY);
      if (raw !== null) {
        const entries = organize.pruneEntries(organize.parseEntries(raw), sourceIds);
        snapshot.organize = organize.normalizeEntries(entries).map((entry) => ({ ...entry }));
      }
    }

    const modelState = rootRef?.HafizeConversationModelState;
    if (modelState && typeof modelState.MODEL_STORAGE_KEY === 'string' && typeof modelState.readModelEntries === 'function' &&
        typeof modelState.normalizeModelEntries === 'function') {
      const raw = boundedRaw(storage, modelState.MODEL_STORAGE_KEY);
      if (raw !== null) {
        snapshot.models = modelState.readModelEntries(storage, list).map((entry) => ({ ...entry }));
      }
    }

    const lineage = rootRef?.HafizeConversationBranchLineage;
    if (lineage && typeof lineage.STORAGE_KEY === 'string' && typeof lineage.parseEntries === 'function' &&
        typeof lineage.buildConversationIndex === 'function' && typeof lineage.normalizeEntries === 'function') {
      const maxChars = Number.isSafeInteger(lineage.MAX_STORAGE_CHARS)
        ? Math.min(lineage.MAX_STORAGE_CHARS, COMPANION_MAX_RAW_CHARS)
        : COMPANION_MAX_RAW_CHARS;
      const raw = boundedRaw(storage, lineage.STORAGE_KEY, maxChars);
      if (raw !== null) {
        const index = lineage.buildConversationIndex(list);
        snapshot.lineage = lineage.parseEntries(raw, index).map((entry) => ({ ...entry }));
      }
    }

    const reading = rootRef?.HafizeReadingFocus;
    if (reading && typeof reading.STORAGE_KEY === 'string' && typeof reading.parseState === 'function' &&
        typeof reading.messageIdsFromConversations === 'function' && typeof reading.pruneBookmarkIds === 'function') {
      const maxChars = Number.isSafeInteger(reading.MAX_STORAGE_CHARS)
        ? Math.min(reading.MAX_STORAGE_CHARS, COMPANION_MAX_RAW_CHARS)
        : COMPANION_MAX_RAW_CHARS;
      const raw = boundedRaw(storage, reading.STORAGE_KEY, maxChars);
      if (raw !== null) {
        const state = reading.parseState(raw);
        const validMessageIds = reading.messageIdsFromConversations(list);
        snapshot.readingBookmarks = reading.pruneBookmarkIds(state.bookmarkIds, validMessageIds);
      }
    }

    try {
      return JSON.stringify(snapshot).length <= COMPANION_MAX_RAW_CHARS ? Object.freeze(snapshot) : Object.freeze({});
    } catch {
      return Object.freeze({});
    }
  }

  function restoreCompanionState(snapshot, rootRef, storage, conversations) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 0;
    const list = Array.isArray(conversations) ? conversations : [];
    const sourceIds = list.map((item) => item?.id).filter((id) => typeof id === 'string');
    let restored = 0;

    const organize = rootRef?.HafizeConversationOrganize;
    if (Array.isArray(snapshot.organize) && organize && typeof organize.STORAGE_KEY === 'string' &&
        typeof organize.parseEntries === 'function' && typeof organize.normalizeEntries === 'function' &&
        typeof organize.pruneEntries === 'function' && typeof organize.serializeEntries === 'function') {
      try {
        const currentRaw = boundedRaw(storage, organize.STORAGE_KEY);
        const current = currentRaw === null ? [] : organize.parseEntries(currentRaw);
        const merged = organize.pruneEntries(
          organize.normalizeEntries([...current, ...snapshot.organize]),
          sourceIds
        );
        storage.setItem(organize.STORAGE_KEY, organize.serializeEntries(merged));
        restored += 1;
      } catch { /* best effort companion restore */ }
    }

    const modelState = rootRef?.HafizeConversationModelState;
    if (Array.isArray(snapshot.models) && modelState && typeof modelState.MODEL_STORAGE_KEY === 'string' &&
        typeof modelState.readModelEntries === 'function' && typeof modelState.normalizeModelEntries === 'function' &&
        typeof modelState.writeModelEntries === 'function') {
      try {
        const currentRaw = boundedRaw(storage, modelState.MODEL_STORAGE_KEY);
        const current = currentRaw === null ? [] : modelState.readModelEntries(storage, list);
        const allowedIds = new Set(sourceIds.map((id) => modelState.normalizeConversationId?.(id)).filter(Boolean));
        const merged = modelState.normalizeModelEntries([...current, ...snapshot.models], allowedIds);
        if (modelState.writeModelEntries(storage, merged, list)) restored += 1;
      } catch { /* best effort companion restore */ }
    }

    const lineage = rootRef?.HafizeConversationBranchLineage;
    if (Array.isArray(snapshot.lineage) && lineage && typeof lineage.STORAGE_KEY === 'string' &&
        typeof lineage.parseEntries === 'function' && typeof lineage.buildConversationIndex === 'function' &&
        typeof lineage.mergeEntries === 'function') {
      try {
        const index = lineage.buildConversationIndex(list);
        const maxChars = Number.isSafeInteger(lineage.MAX_STORAGE_CHARS)
          ? Math.min(lineage.MAX_STORAGE_CHARS, COMPANION_MAX_RAW_CHARS)
          : COMPANION_MAX_RAW_CHARS;
        const currentRaw = boundedRaw(storage, lineage.STORAGE_KEY, maxChars);
        const current = currentRaw === null ? [] : lineage.parseEntries(currentRaw, index);
        const merged = lineage.mergeEntries(current, snapshot.lineage, index);
        const serialized = JSON.stringify(merged);
        if (serialized.length <= maxChars) {
          storage.setItem(lineage.STORAGE_KEY, serialized);
          restored += 1;
        }
      } catch { /* best effort companion restore */ }
    }

    const reading = rootRef?.HafizeReadingFocus;
    if (Array.isArray(snapshot.readingBookmarks) && reading && typeof reading.STORAGE_KEY === 'string' &&
        typeof reading.parseState === 'function' && typeof reading.serializeState === 'function' &&
        typeof reading.messageIdsFromConversations === 'function' && typeof reading.pruneBookmarkIds === 'function') {
      try {
        const maxChars = Number.isSafeInteger(reading.MAX_STORAGE_CHARS)
          ? Math.min(reading.MAX_STORAGE_CHARS, COMPANION_MAX_RAW_CHARS)
          : COMPANION_MAX_RAW_CHARS;
        const currentRaw = boundedRaw(storage, reading.STORAGE_KEY, maxChars);
        const current = currentRaw === null ? { focusMode: false, bookmarkIds: [] } : reading.parseState(currentRaw);
        const validMessageIds = reading.messageIdsFromConversations(list);
        const bookmarkIds = reading.pruneBookmarkIds(
          [...current.bookmarkIds, ...snapshot.readingBookmarks],
          validMessageIds
        );
        storage.setItem(reading.STORAGE_KEY, reading.serializeState({
          focusMode: current.focusMode,
          bookmarkIds
        }));
        restored += 1;
      } catch { /* best effort companion restore */ }
    }

    return restored;
  }

  function createController({
    documentRef = globalThis.document,
    rootRef = defaultRoot || globalThis,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout
  } = {}) {
    if (!documentRef || typeof documentRef.addEventListener !== 'function') {
      throw new Error('INVALID_CONVERSATION_DELETE_CONFIRM_DOCUMENT');
    }
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') {
      throw new Error('INVALID_CONVERSATION_DELETE_CONFIRM_TIMER');
    }

    let mounted = false;
    let pending = null;
    let timer = null;
    let undoState = null;
    let undoTimer = null;
    let replayingClear = false;

    function restorePending({ focus = false } = {}) {
      if (!pending) return false;
      if (timer !== null) {
        clearTimeoutImpl(timer);
        timer = null;
      }
      const { button, text, ariaLabel, title } = pending;
      pending = null;
      button.textContent = text;
      if (ariaLabel == null) button.removeAttribute?.('aria-label');
      else button.setAttribute?.('aria-label', ariaLabel);
      if (title == null) button.removeAttribute?.('title');
      else button.setAttribute?.('title', title);
      button.removeAttribute?.('data-delete-pending');
      button.removeAttribute?.('data-clear-history-pending');
      button.setAttribute?.('aria-pressed', 'false');
      if (focus) button.focus?.();
      return true;
    }

    function clearUndo({ focus = false } = {}) {
      if (!undoState) return false;
      if (undoTimer !== null) {
        clearTimeoutImpl(undoTimer);
        undoTimer = null;
      }
      const { button, text, ariaLabel, title } = undoState;
      undoState = null;
      button.textContent = text;
      if (ariaLabel == null) button.removeAttribute?.('aria-label');
      else button.setAttribute?.('aria-label', ariaLabel);
      if (title == null) button.removeAttribute?.('title');
      else button.setAttribute?.('title', title);
      button.removeAttribute?.('data-clear-history-undo');
      if (focus) button.focus?.();
      return true;
    }

    function getStorageGuard() {
      const guard = rootRef?.HafizeConversationStorageGuard;
      const storage = rootRef?.localStorage;
      if (!guard || typeof guard.sanitizeStoredValue !== 'function' || typeof guard.STORAGE_KEY !== 'string') return null;
      if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;
      if (typeof rootRef?.location?.reload !== 'function') return null;
      return { guard, storage, key: guard.STORAGE_KEY };
    }

    function captureUndoSnapshot() {
      const context = getStorageGuard();
      if (!context) return null;
      try {
        const sanitized = context.guard.sanitizeStoredValue(context.storage.getItem(context.key) || '[]');
        if (sanitized.serialized === '[]') return null;
        return Object.freeze({
          context,
          serialized: sanitized.serialized,
          companions: snapshotCompanionState(rootRef, context.storage, sanitized.value)
        });
      } catch {
        return null;
      }
    }

    function armUndo(button, snapshot) {
      if (!snapshot?.serialized) return false;
      let current;
      try {
        current = snapshot.context.guard.sanitizeStoredValue(snapshot.context.storage.getItem(snapshot.context.key) || '[]');
      } catch {
        return false;
      }
      if (current.serialized !== '[]') return false;
      clearUndo();
      undoState = {
        button,
        snapshot,
        text: typeof button.textContent === 'string' ? button.textContent : 'Temizle',
        ariaLabel: button.getAttribute?.('aria-label') ?? null,
        title: button.getAttribute?.('title') ?? null
      };
      button.textContent = UNDO_TEXT;
      button.setAttribute?.('data-clear-history-undo', 'true');
      button.setAttribute?.('aria-label', 'Temizlenen sohbet geçmişini geri al');
      button.setAttribute?.('title', 'Geçmişi geri yüklemek için dokun');
      undoTimer = setTimeoutImpl(() => clearUndo(), UNDO_WINDOW_MS);
      undoTimer?.unref?.();
      return true;
    }

    function restoreUndo() {
      if (!undoState) return false;
      const { snapshot } = undoState;
      try {
        snapshot.context.storage.setItem(snapshot.context.key, snapshot.serialized);
        const restored = snapshot.context.guard.sanitizeStoredValue(snapshot.context.storage.getItem(snapshot.context.key) || '[]');
        if (restored.serialized === '[]') return false;
        restoreCompanionState(snapshot.companions, rootRef, snapshot.context.storage, restored.value);
        clearUndo();
        rootRef.location.reload();
        return true;
      } catch {
        return false;
      }
    }

    function rememberButton(button, kind) {
      restorePending();
      pending = {
        kind,
        button,
        text: typeof button.textContent === 'string' ? button.textContent : kind === 'clear-history' ? 'Temizle' : '×',
        ariaLabel: button.getAttribute?.('aria-label') ?? null,
        title: button.getAttribute?.('title') ?? null
      };
      button.setAttribute?.('aria-pressed', 'true');
      button.focus?.();
      timer = setTimeoutImpl(() => restorePending(), CONFIRM_WINDOW_MS);
      timer?.unref?.();
      return true;
    }

    function armConversation(button) {
      const row = button.closest?.('.conversation-row');
      const conversationTitle = safeTitle(row);
      rememberButton(button, 'conversation');
      button.textContent = PENDING_TEXT;
      button.setAttribute?.('data-delete-pending', 'true');
      button.setAttribute?.('aria-label', `${conversationTitle} sohbetini silmeyi onayla`);
      button.setAttribute?.('title', 'Silmek için tekrar dokun');
      return true;
    }

    function armClearHistory(button) {
      rememberButton(button, 'clear-history');
      button.textContent = CLEAR_PENDING_TEXT;
      button.setAttribute?.('data-clear-history-pending', 'true');
      button.setAttribute?.('aria-label', 'Tüm yerel sohbet geçmişini temizlemeyi onayla');
      button.setAttribute?.('title', 'Tüm sohbetleri temizlemek için tekrar dokun');
      return true;
    }

    function replayApprovedClear(button) {
      const originalConfirm = rootRef?.confirm;
      if (typeof originalConfirm !== 'function' || typeof button?.click !== 'function') return false;
      const undoSnapshot = captureUndoSnapshot();

      let consumed = false;
      function oneShotConfirm(message) {
        if (!consumed && message === CLEAR_HISTORY_PROMPT) {
          consumed = true;
          return true;
        }
        return originalConfirm.call(rootRef, message);
      }

      try {
        rootRef.confirm = oneShotConfirm;
        if (rootRef.confirm !== oneShotConfirm) return false;
        replayingClear = true;
        button.click();
        if (consumed && undoSnapshot) armUndo(button, undoSnapshot);
        return consumed;
      } catch {
        return false;
      } finally {
        replayingClear = false;
        try {
          rootRef.confirm = originalConfirm;
        } catch {
          // Fail closed for future attempts when the host does not allow confirm reassignment.
        }
      }
    }

    function onCaptureClick(event) {
      if (event.defaultPrevented || typeof event.target?.closest !== 'function') return false;
      const clearButton = event.target.closest('#clearHistoryBtn');
      if (clearButton) {
        if (replayingClear) return true;
        if (undoState?.button === clearButton) {
          event.preventDefault();
          event.stopImmediatePropagation?.();
          return restoreUndo();
        }
        if (pending?.kind === 'clear-history' && pending.button === clearButton) {
          event.preventDefault();
          event.stopImmediatePropagation?.();
          restorePending();
          return replayApprovedClear(clearButton);
        }
        event.preventDefault();
        event.stopImmediatePropagation?.();
        armClearHistory(clearButton);
        return false;
      }

      const button = event.target.closest('.conversation-delete');
      if (!button) {
        restorePending();
        return false;
      }

      const input = documentRef.querySelector?.('#messageInput');
      if (shouldDeferToDraftGuard(button, input)) {
        restorePending();
        return false;
      }

      if (pending?.kind === 'conversation' && pending.button === button) {
        restorePending();
        return true;
      }

      event.preventDefault();
      event.stopImmediatePropagation?.();
      armConversation(button);
      return false;
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape') return false;
      if (pending) {
        event.preventDefault?.();
        restorePending({ focus: true });
        return true;
      }
      if (undoState) {
        event.preventDefault?.();
        clearUndo({ focus: true });
        return true;
      }
      return false;
    }

    function onFocusIn(event) {
      if (!pending || event?.target === pending.button) return false;
      restorePending();
      return true;
    }

    function onVisibilityChange() {
      if (documentRef.visibilityState !== 'hidden') return;
      restorePending();
      clearUndo();
    }

    function mount() {
      if (mounted) return false;
      documentRef.addEventListener('click', onCaptureClick, true);
      documentRef.addEventListener('keydown', onKeydown, true);
      documentRef.addEventListener('focusin', onFocusIn, true);
      documentRef.addEventListener('visibilitychange', onVisibilityChange);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      restorePending();
      clearUndo();
      documentRef.removeEventListener?.('click', onCaptureClick, true);
      documentRef.removeEventListener?.('keydown', onKeydown, true);
      documentRef.removeEventListener?.('focusin', onFocusIn, true);
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange);
      mounted = false;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      onCaptureClick,
      onKeydown,
      onFocusIn,
      onVisibilityChange,
      cancel: (options) => restorePending(options),
      cancelUndo: (options) => clearUndo(options),
      replayApprovedClear,
      restoreUndo,
      snapshot: () => Object.freeze({
        pending: Boolean(pending),
        pendingKind: pending?.kind || null,
        pendingTitle: pending?.kind === 'conversation' ? safeTitle(pending.button.closest?.('.conversation-row')) : null,
        undoAvailable: Boolean(undoState)
      })
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
    FALLBACK_TITLE,
    MAX_TITLE_CHARS,
    CONFIRM_WINDOW_MS,
    UNDO_WINDOW_MS,
    COMPANION_MAX_RAW_CHARS,
    PENDING_TEXT,
    CLEAR_PENDING_TEXT,
    UNDO_TEXT,
    CLEAR_HISTORY_PROMPT,
    safeTitle,
    shouldDeferToDraftGuard,
    isClearHistoryButton,
    boundedRaw,
    snapshotCompanionState,
    restoreCompanionState,
    createController,
    mount
  });
});
