(function exposeHafizeConversationFork(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeConversationFork = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationFork() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const BRANCH_EVENT = 'hafize:conversation-branched';
  const MARKER = 'hafizeForkReady';
  const SOURCE_RETENTION_ERROR = 'Kaynak korunamıyor';
  const STYLE_ID = 'hafize-conversation-fork-style';
  const ACTIVE_MESSAGE_ROOTS = new WeakSet();
  const STYLE_TEXT = `
.conversation-fork-actions{display:flex;justify-content:flex-end;margin-top:7px;min-height:28px}
.conversation-fork-btn{border:1px solid transparent;border-radius:9px;background:transparent;color:var(--muted,#777);padding:5px 8px;font:inherit;font-size:11px;line-height:1.2;cursor:pointer;opacity:.72}
.conversation-fork-btn:hover:not(:disabled),.conversation-fork-btn:focus-visible{opacity:1;border-color:var(--line,#ddd);background:color-mix(in srgb,var(--surface,#fff) 82%,transparent)}
.conversation-fork-btn:focus-visible{outline:2px solid var(--accent,#d97706);outline-offset:2px}
.conversation-fork-btn[data-state="success"],.conversation-fork-btn[data-state="error"]{opacity:1}
.conversation-fork-btn:disabled{cursor:progress}
@media (prefers-reduced-motion:no-preference){.conversation-fork-btn{transition:opacity .15s ease,background-color .15s ease,border-color .15s ease}}
@media (forced-colors:active){.conversation-fork-btn:focus-visible{outline-color:Highlight}}
`;

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function defaultId(prefix, cryptoRef = globalThis.crypto) {
    if (typeof cryptoRef?.randomUUID === 'function') return `${prefix}-${cryptoRef.randomUUID()}`;
    if (typeof cryptoRef?.getRandomValues !== 'function') return '';
    const bytes = new Uint8Array(12);
    cryptoRef.getRandomValues(bytes);
    return `${prefix}-${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function forkTitle(value, maxChars = 80) {
    const title = typeof value === 'string' && value.trim() ? value.trim() : 'Yeni sohbet';
    const suffix = ' · dal';
    const room = Math.max(1, maxChars - suffix.length);
    return `${title.slice(0, room).trimEnd()}${suffix}`.slice(0, maxChars);
  }

  function findSource(conversations, messageId) {
    const matches = [];
    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      const index = Array.isArray(conversation?.messages)
        ? conversation.messages.findIndex((message) => message?.id === messageId && message?.role === 'assistant')
        : -1;
      if (index >= 0) matches.push({ conversation, index });
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function includesConversationIds(conversations, ...ids) {
    if (!Array.isArray(conversations) || !ids.length) return false;
    const required = new Set(ids.filter((id) => typeof id === 'string' && id));
    if (required.size !== ids.length) return false;
    for (const conversation of conversations) required.delete(conversation?.id);
    return required.size === 0;
  }

  function buildFork(source, messageIndex, { nowIso, makeId, maxTitleChars = 80 } = {}) {
    if (!source || !Array.isArray(source.messages) || !Number.isInteger(messageIndex)) return null;
    if (messageIndex < 0 || messageIndex >= source.messages.length || source.messages[messageIndex]?.role !== 'assistant') return null;
    const id = makeId?.('conversation');
    if (!id || typeof nowIso !== 'string') return null;
    const messages = [];
    for (const original of source.messages.slice(0, messageIndex + 1)) {
      const messageId = makeId?.('message');
      if (!messageId) return null;
      messages.push({ ...original, id: messageId });
    }
    return {
      id,
      title: forkTitle(source.title, maxTitleChars),
      agentId: source.agentId || '',
      toolsEnabled: source.toolsEnabled === true,
      createdAt: nowIso,
      updatedAt: nowIso,
      messages
    };
  }

  function createController({
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
    locationRef = globalThis.location,
    guard = globalThis.HafizeConversationStorageGuard,
    modelState = globalThis.HafizeConversationModelState,
    MutationObserverImpl = globalThis.MutationObserver,
    CustomEventImpl = globalThis.CustomEvent,
    cryptoRef = globalThis.crypto,
    now = () => new Date(),
    reload = () => locationRef?.reload?.()
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_CONVERSATION_FORK_DOCUMENT');
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error('INVALID_CONVERSATION_FORK_STORAGE');
    if (!guard || typeof guard.sanitizeStoredValue !== 'function' || typeof guard.normalizeConversations !== 'function') {
      throw new Error('INVALID_CONVERSATION_FORK_GUARD');
    }

    let observer = null;
    let messagesRoot = null;
    let mounted = false;
    let destroyed = false;
    let busy = false;
    const ownedDecorations = new Map();

    function ownsRoot() {
      return !destroyed && mounted && messagesRoot && ACTIVE_MESSAGE_ROOTS.has(messagesRoot);
    }

    function showState(button, state, label) {
      if (!ownsRoot() || !button) return false;
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'working';
      return true;
    }

    function blockedByComposer() {
      const send = documentRef.querySelector('#sendBtn');
      if (send?.classList?.contains('streaming')) return 'Yanıt sürüyor';
      const input = documentRef.querySelector('#messageInput');
      if (typeof input?.value === 'string' && input.value.trim()) return 'Taslak korunuyor';
      return '';
    }

    function readCanonical() {
      if (!ownsRoot()) return null;
      let raw = '[]';
      try { raw = storage.getItem(STORAGE_KEY) || '[]'; } catch { return null; }
      return guard.sanitizeStoredValue(raw);
    }

    function rollbackOrphanFork(forkId) {
      if (!ownsRoot()) return false;
      try {
        const persisted = readCanonical()?.value || [];
        if (!persisted.some((conversation) => conversation.id === forkId)) return true;
        storage.setItem(STORAGE_KEY, JSON.stringify(persisted.filter((conversation) => conversation.id !== forkId)));
        return !(readCanonical()?.value || []).some((conversation) => conversation.id === forkId);
      } catch {
        return false;
      }
    }

    function copyModelPreference(sourceId, forkId) {
      if (!ownsRoot() || !modelState || typeof modelState.readModelEntries !== 'function' || typeof modelState.writeModelEntries !== 'function') return;
      try {
        const conversations = guard.sanitizeStoredValue(storage.getItem(STORAGE_KEY) || '[]').value;
        const entries = modelState.readModelEntries(storage, conversations);
        const source = entries.find((entry) => entry.conversationId === sourceId);
        if (!source?.modelId || !ownsRoot()) return;
        modelState.writeModelEntries(storage, [
          { conversationId: forkId, modelId: source.modelId },
          ...entries
        ], conversations);
      } catch {
        // Model preference copy is best-effort; transcript fork is already canonical.
      }
    }

    function publishLineage(detail) {
      if (!ownsRoot() || typeof documentRef.dispatchEvent !== 'function' || typeof CustomEventImpl !== 'function') return false;
      try {
        documentRef.dispatchEvent(new CustomEventImpl(BRANCH_EVENT, { detail }));
        return true;
      } catch {
        return false;
      }
    }

    function forkFromMessage(button, messageId) {
      if (!ownsRoot() || busy) return false;
      const blocker = blockedByComposer();
      if (blocker) {
        showState(button, 'error', blocker);
        return false;
      }
      const canonical = readCanonical();
      const found = canonical && findSource(canonical.value, messageId);
      if (!found) {
        showState(button, 'error', 'Dallanamadı');
        return false;
      }
      const date = now();
      const nowIso = date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
      const makeId = (prefix) => defaultId(prefix, cryptoRef);
      const fork = buildFork(found.conversation, found.index, {
        nowIso,
        makeId,
        maxTitleChars: guard.MAX_TITLE_CHARS || 80
      });
      if (!fork) {
        showState(button, 'error', 'Dallanamadı');
        return false;
      }
      const candidate = guard.normalizeConversations([fork, ...canonical.value]);
      if (!includesConversationIds(candidate, fork.id, found.conversation.id)) {
        showState(button, 'error', SOURCE_RETENTION_ERROR);
        return false;
      }

      busy = true;
      showState(button, 'working', 'Yeni sohbet hazırlanıyor…');
      try {
        if (!ownsRoot()) return false;
        storage.setItem(STORAGE_KEY, JSON.stringify(candidate));
        if (!ownsRoot()) return false;
        const persisted = guard.sanitizeStoredValue(storage.getItem(STORAGE_KEY) || '[]').value;
        if (!includesConversationIds(persisted, fork.id, found.conversation.id)) {
          rollbackOrphanFork(fork.id);
          throw new Error('FORK_SOURCE_NOT_PERSISTED');
        }
        if (!ownsRoot()) return false;
        copyModelPreference(found.conversation.id, fork.id);
        if (!ownsRoot()) return false;
        publishLineage({
          childConversationId: fork.id,
          parentConversationId: found.conversation.id,
          sourceMessageId: messageId,
          mode: 'fork',
          createdAt: nowIso
        });
        if (!ownsRoot()) return false;
        showState(button, 'success', 'Yeni sohbet hazır');
        reload();
        return true;
      } catch {
        if (ownsRoot()) showState(button, 'error', 'Dallanamadı');
        return false;
      } finally {
        busy = false;
      }
    }

    function removeDecoration(article, record) {
      if (!record) return;
      try { record.button?.removeEventListener?.('click', record.onClick); } catch {}
      try { record.actions?.remove?.(); } catch {}
      if (article?.dataset) {
        if (record.hadMarker) article.dataset[MARKER] = record.markerValue;
        else delete article.dataset[MARKER];
      }
      ownedDecorations.delete(article);
    }

    function rollbackDecorations() {
      for (const [article, record] of [...ownedDecorations.entries()]) removeDecoration(article, record);
    }

    function decorate(article) {
      if (!ownsRoot() || !article?.classList?.contains('message') || !article.classList.contains('assistant')) return false;
      if (ownedDecorations.has(article)) return false;
      if (article.querySelector?.('.conversation-fork-btn')) return false;
      const markerValue = article.dataset?.[MARKER];
      if (markerValue === '1') return false;
      const messageId = guard.normalizeId(article.dataset?.messageId);
      if (!messageId || !article.querySelector?.('.content')) return false;

      const actions = documentRef.createElement('div');
      actions.className = 'conversation-fork-actions';
      actions.setAttribute('aria-live', 'polite');
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'conversation-fork-btn';
      button.dataset.state = 'idle';
      button.textContent = 'Bu noktadan dallan';
      button.setAttribute('aria-label', 'bu Hafize yanıtına kadar olan bağlamdan yeni sohbet oluştur');
      const onClick = () => {
        if (!ownsRoot() || ownedDecorations.get(article)?.button !== button) return;
        forkFromMessage(button, messageId);
      };

      const record = Object.freeze({
        actions,
        button,
        onClick,
        hadMarker: markerValue !== undefined,
        markerValue
      });

      try {
        button.addEventListener('click', onClick);
        actions.append(button);
        article.append(actions);
        if (article.dataset) article.dataset[MARKER] = '1';
        ownedDecorations.set(article, record);
        return true;
      } catch {
        try { button.removeEventListener?.('click', onClick); } catch {}
        try { actions.remove?.(); } catch {}
        if (article.dataset) {
          if (record.hadMarker) article.dataset[MARKER] = record.markerValue;
          else delete article.dataset[MARKER];
        }
        return false;
      }
    }

    function decorateAll(root = documentRef) {
      if (!ownsRoot()) return 0;
      const messages = root.querySelectorAll?.('.message.assistant') || [];
      let count = 0;
      for (const article of messages) if (decorate(article)) count += 1;
      return count;
    }

    function mount() {
      if (destroyed || mounted) return false;
      const candidateRoot = documentRef.querySelector('#messages');
      if (!candidateRoot || ACTIVE_MESSAGE_ROOTS.has(candidateRoot)) return false;
      messagesRoot = candidateRoot;
      ACTIVE_MESSAGE_ROOTS.add(messagesRoot);
      mounted = true;
      try {
        installStyles(documentRef);
        decorateAll(messagesRoot);
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(() => {
            if (ownsRoot()) decorateAll(messagesRoot);
          });
          observer.observe(messagesRoot, { childList: true, subtree: true });
        }
        return true;
      } catch {
        observer?.disconnect?.();
        observer = null;
        rollbackDecorations();
        ACTIVE_MESSAGE_ROOTS.delete(messagesRoot);
        messagesRoot = null;
        mounted = false;
        return false;
      }
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      observer?.disconnect?.();
      observer = null;
      rollbackDecorations();
      if (messagesRoot) ACTIVE_MESSAGE_ROOTS.delete(messagesRoot);
      messagesRoot = null;
      mounted = false;
      busy = false;
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      decorate,
      decorateAll,
      forkFromMessage,
      readCanonical,
      rollbackOrphanFork,
      publishLineage,
      getState: () => Object.freeze({ mounted, destroyed, busy, ownedDecorations: ownedDecorations.size })
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
    BRANCH_EVENT,
    MARKER,
    SOURCE_RETENTION_ERROR,
    STYLE_ID,
    STYLE_TEXT,
    defaultId,
    forkTitle,
    findSource,
    includesConversationIds,
    buildFork,
    installStyles,
    createController,
    mount
  });
});