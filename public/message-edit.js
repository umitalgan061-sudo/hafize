(function exposeHafizeMessageEdit(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMessageEdit = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMessageEdit() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const DRAFT_HANDOFF_KEY = 'hafize.edit-branch-draft.v1';
  const BRANCH_EVENT = 'hafize:conversation-branched';
  const MAX_COMPOSER_CHARS = 12_000;
  const MAX_HANDOFF_AGE_MS = 90_000;
  const MARKER = 'hafizeEditReady';
  const SOURCE_RETENTION_ERROR = 'Kaynak korunamıyor';
  const INSTALL_MARKER = Symbol.for('hafize.message.edit.controller.v2');

  function editableText(value) {
    if (typeof value !== 'string') return null;
    const text = value.normalize('NFC').replace(/\r\n/g, '\n').replace(/\u0000/g, '');
    if (!text.trim() || text.length > MAX_COMPOSER_CHARS) return null;
    return text;
  }

  function defaultId(prefix, cryptoRef = globalThis.crypto) {
    if (typeof cryptoRef?.randomUUID === 'function') return `${prefix}-${cryptoRef.randomUUID()}`;
    if (typeof cryptoRef?.getRandomValues !== 'function') return '';
    const bytes = new Uint8Array(12);
    cryptoRef.getRandomValues(bytes);
    return `${prefix}-${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function editBranchTitle(value, maxChars = 80) {
    const title = typeof value === 'string' && value.trim() ? value.trim() : 'Yeni sohbet';
    const suffix = ' · düzenleme';
    const room = Math.max(1, maxChars - suffix.length);
    return `${title.slice(0, room).trimEnd()}${suffix}`.slice(0, maxChars);
  }

  function findSource(conversations, messageId) {
    const matches = [];
    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      const index = Array.isArray(conversation?.messages)
        ? conversation.messages.findIndex((message) => message?.id === messageId && message?.role === 'user')
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

  function buildEditBranch(source, messageIndex, { nowIso, makeId, maxTitleChars = 80 } = {}) {
    if (!source || !Array.isArray(source.messages) || !Number.isInteger(messageIndex)) return null;
    if (messageIndex < 0 || messageIndex >= source.messages.length || source.messages[messageIndex]?.role !== 'user') return null;
    const id = makeId?.('conversation');
    if (!id || typeof nowIso !== 'string' || !nowIso) return null;
    const messages = [];
    for (const original of source.messages.slice(0, messageIndex)) {
      const messageId = makeId?.('message');
      if (!messageId) return null;
      messages.push({ ...original, id: messageId });
    }
    return {
      id,
      title: editBranchTitle(source.title, maxTitleChars),
      agentId: source.agentId || '',
      toolsEnabled: source.toolsEnabled === true,
      createdAt: nowIso,
      updatedAt: nowIso,
      messages
    };
  }

  function normalizeHandoff(value, { nowMs = Date.now() } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const conversationId = typeof value.conversationId === 'string' ? value.conversationId.trim() : '';
    const text = editableText(value.text);
    const createdAt = Number(value.createdAt);
    if (!/^[A-Za-z0-9._:-]{1,120}$/.test(conversationId) || !text) return null;
    if (!Number.isFinite(createdAt) || createdAt <= 0 || nowMs < createdAt || nowMs - createdAt > MAX_HANDOFF_AGE_MS) return null;
    return Object.freeze({ conversationId, text, createdAt });
  }

  function createController({
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
    handoffStorage = globalThis.sessionStorage,
    locationRef = globalThis.location,
    guard = globalThis.HafizeConversationStorageGuard,
    modelState = globalThis.HafizeConversationModelState,
    MutationObserverImpl = globalThis.MutationObserver,
    EventImpl = globalThis.Event,
    CustomEventImpl = globalThis.CustomEvent,
    cryptoRef = globalThis.crypto,
    now = () => new Date(),
    reload = () => locationRef?.reload?.()
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function') throw new Error('INVALID_MESSAGE_EDIT_DOCUMENT');
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') throw new Error('INVALID_MESSAGE_EDIT_STORAGE');
    if (!handoffStorage || typeof handoffStorage.getItem !== 'function' || typeof handoffStorage.setItem !== 'function' || typeof handoffStorage.removeItem !== 'function') {
      throw new Error('INVALID_MESSAGE_EDIT_HANDOFF_STORAGE');
    }
    if (!guard || typeof guard.sanitizeStoredValue !== 'function' || typeof guard.normalizeConversations !== 'function') throw new Error('INVALID_MESSAGE_EDIT_GUARD');

    const ownerToken = Object.freeze({});
    const decorations = new Map();
    let messagesOwner = null;
    let observer = null;
    let busy = false;
    let mounted = false;
    let destroyed = false;

    function ownsSurface() {
      return mounted && !destroyed && messagesOwner?.[INSTALL_MARKER] === ownerToken;
    }

    function composerNodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        sendButton: documentRef.querySelector('#sendBtn')
      });
    }

    function showState(button, state, label) {
      if (!ownsSurface() || !decorationsHasButton(button)) return false;
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'working';
      return true;
    }

    function decorationsHasButton(button) {
      for (const record of decorations.values()) if (record.button === button) return true;
      return false;
    }

    function readCanonical() {
      if (destroyed) return null;
      try { return guard.sanitizeStoredValue(storage.getItem(STORAGE_KEY) || '[]'); } catch { return null; }
    }

    function activeConversationId(conversations) {
      if (modelState && typeof modelState.activeConversationId === 'function') {
        return modelState.activeConversationId(documentRef, conversations);
      }
      const rows = Array.from(documentRef.querySelectorAll?.('#conversationList .conversation-row') || []);
      const index = rows.findIndex((row) => row?.classList?.contains('active'));
      return index >= 0 && index < conversations.length ? conversations[index]?.id || '' : '';
    }

    function rollbackOrphanBranch(branchId) {
      if (!ownsSurface()) return false;
      try {
        const persisted = readCanonical()?.value || [];
        if (!persisted.some((conversation) => conversation.id === branchId)) return true;
        storage.setItem(STORAGE_KEY, JSON.stringify(persisted.filter((conversation) => conversation.id !== branchId)));
        return !(readCanonical()?.value || []).some((conversation) => conversation.id === branchId);
      } catch {
        return false;
      }
    }

    function copyModelPreference(sourceId, branchId) {
      if (!ownsSurface() || !modelState || typeof modelState.readModelEntries !== 'function' || typeof modelState.writeModelEntries !== 'function') return;
      try {
        const conversations = readCanonical()?.value || [];
        const entries = modelState.readModelEntries(storage, conversations);
        const source = entries.find((entry) => entry.conversationId === sourceId);
        if (!source?.modelId) return;
        modelState.writeModelEntries(storage, [{ conversationId: branchId, modelId: source.modelId }, ...entries], conversations);
      } catch { /* preference copy is best effort */ }
    }

    function publishLineage(detail) {
      if (!ownsSurface() || typeof documentRef.dispatchEvent !== 'function' || typeof CustomEventImpl !== 'function') return false;
      try {
        documentRef.dispatchEvent(new CustomEventImpl(BRANCH_EVENT, { detail }));
        return true;
      } catch {
        return false;
      }
    }

    function stageHandoff(conversationId, text, createdAt) {
      if (!ownsSurface()) return false;
      const handoff = normalizeHandoff({ conversationId, text, createdAt }, { nowMs: createdAt });
      if (!handoff) return false;
      try {
        handoffStorage.setItem(DRAFT_HANDOFF_KEY, JSON.stringify(handoff));
        return normalizeHandoff(JSON.parse(handoffStorage.getItem(DRAFT_HANDOFF_KEY) || 'null'), { nowMs: createdAt })?.conversationId === conversationId;
      } catch {
        try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* ignore */ }
        return false;
      }
    }

    function restoreHandoff() {
      if (!ownsSurface()) return false;
      const { input, sendButton } = composerNodes();
      if (!input || sendButton?.classList?.contains('streaming')) return false;
      let raw = '';
      try { raw = handoffStorage.getItem(DRAFT_HANDOFF_KEY) || ''; } catch { return false; }
      if (!raw) return false;
      let handoff = null;
      try { handoff = normalizeHandoff(JSON.parse(raw), { nowMs: Date.now() }); } catch { /* invalid */ }
      if (!handoff) {
        try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* ignore */ }
        return false;
      }
      const canonical = readCanonical();
      if (!canonical || activeConversationId(canonical.value) !== handoff.conversationId) return false;
      if (typeof input.value === 'string' && input.value.trim()) return false;
      input.value = handoff.text;
      if (typeof input.dispatchEvent === 'function' && typeof EventImpl === 'function') input.dispatchEvent(new EventImpl('input', { bubbles: true }));
      input.focus?.();
      input.setSelectionRange?.(handoff.text.length, handoff.text.length);
      try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* one-shot best effort */ }
      return true;
    }

    function editMessage(button, article, content) {
      if (!ownsSurface() || !decorationsHasButton(button) || busy) return false;
      const text = editableText(content?.textContent);
      const messageId = guard.normalizeId?.(article?.dataset?.messageId) || '';
      if (!text || !messageId) {
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
      const { input, sendButton } = composerNodes();
      if (!input || sendButton?.classList?.contains('streaming')) {
        showState(button, 'error', sendButton?.classList?.contains('streaming') ? 'Yanıt sürüyor' : 'Düzenlenemedi');
        return false;
      }
      if (typeof input.value === 'string' && input.value.trim()) {
        input.focus?.();
        showState(button, 'error', 'Taslak korunuyor');
        return false;
      }

      const canonical = readCanonical();
      const found = canonical && findSource(canonical.value, messageId);
      if (!found || activeConversationId(canonical.value) !== found.conversation.id) {
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
      const date = now();
      const nowIso = date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : '';
      const createdAt = date instanceof Date ? date.getTime() : NaN;
      const branch = buildEditBranch(found.conversation, found.index, {
        nowIso,
        makeId: (prefix) => defaultId(prefix, cryptoRef),
        maxTitleChars: guard.MAX_TITLE_CHARS || 80
      });
      if (!branch || !stageHandoff(branch.id, text, createdAt)) {
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
      const candidate = guard.normalizeConversations([branch, ...canonical.value]);
      if (!includesConversationIds(candidate, branch.id, found.conversation.id)) {
        try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* ignore */ }
        showState(button, 'error', SOURCE_RETENTION_ERROR);
        return false;
      }

      busy = true;
      showState(button, 'working', 'Düzenleme dalı hazırlanıyor…');
      try {
        if (!ownsSurface()) throw new Error('MESSAGE_EDIT_CONTROLLER_STALE');
        storage.setItem(STORAGE_KEY, JSON.stringify(candidate));
        if (!ownsSurface()) throw new Error('MESSAGE_EDIT_CONTROLLER_STALE');
        const persisted = readCanonical()?.value || [];
        if (!includesConversationIds(persisted, branch.id, found.conversation.id)) {
          rollbackOrphanBranch(branch.id);
          throw new Error('EDIT_BRANCH_SOURCE_NOT_PERSISTED');
        }
        copyModelPreference(found.conversation.id, branch.id);
        publishLineage({
          childConversationId: branch.id,
          parentConversationId: found.conversation.id,
          sourceMessageId: messageId,
          mode: 'edit',
          createdAt: nowIso
        });
        showState(button, 'success', 'Düzenleme dalı hazır');
        if (ownsSurface()) reload();
        return true;
      } catch {
        try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* ignore */ }
        busy = false;
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
    }

    function restoreArticle(article, record) {
      try { record.button.removeEventListener?.('click', record.handler); } catch { /* ignore */ }
      try { record.button.remove?.(); } catch { /* ignore */ }
      if (!article?.dataset) return;
      if (record.hadMarker) article.dataset[MARKER] = record.markerValue;
      else {
        try { delete article.dataset[MARKER]; } catch { article.dataset[MARKER] = undefined; }
      }
    }

    function clearDecorations() {
      for (const [article, record] of decorations) restoreArticle(article, record);
      decorations.clear();
    }

    function decorate(article) {
      if (!ownsSurface() || !article?.classList?.contains('message') || !article.classList.contains('user')) return false;
      if (decorations.has(article)) return false;
      const content = article.querySelector?.('.content');
      const actions = article.querySelector?.('.message-copy-actions');
      if (!content || !actions || !guard.normalizeId?.(article.dataset?.messageId)) return false;
      if (article.dataset?.[MARKER] === '1' || article.querySelector?.('.message-edit-btn')) return false;

      const hadMarker = Object.prototype.hasOwnProperty.call(article.dataset || {}, MARKER);
      const markerValue = article.dataset?.[MARKER];
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'message-copy-btn message-edit-btn';
      button.dataset.state = 'idle';
      button.textContent = 'Düzenle';
      button.setAttribute('aria-label', 'bu mesajdan önceki bağlamı koruyarak yeni düzenleme dalı oluştur');
      const handler = () => {
        if (ownsSurface() && decorations.get(article)?.button === button) editMessage(button, article, content);
      };
      try {
        button.addEventListener('click', handler);
        actions.prepend?.(button);
        if (!button.parentNode && !actions.contains?.(button)) throw new Error('MESSAGE_EDIT_BUTTON_NOT_ATTACHED');
        if (article.dataset) article.dataset[MARKER] = '1';
        decorations.set(article, Object.freeze({ button, handler, hadMarker, markerValue }));
        return true;
      } catch {
        try { button.removeEventListener?.('click', handler); } catch { /* ignore */ }
        try { button.remove?.(); } catch { /* ignore */ }
        if (article.dataset) {
          if (hadMarker) article.dataset[MARKER] = markerValue;
          else {
            try { delete article.dataset[MARKER]; } catch { article.dataset[MARKER] = undefined; }
          }
        }
        return false;
      }
    }

    function decorateAll(root = documentRef) {
      if (!ownsSurface()) return 0;
      const messages = root.querySelectorAll?.('.message.user') || [];
      let count = 0;
      for (const article of messages) if (decorate(article)) count += 1;
      return count;
    }

    function releaseOwnership() {
      if (messagesOwner?.[INSTALL_MARKER] === ownerToken) {
        try { delete messagesOwner[INSTALL_MARKER]; } catch { messagesOwner[INSTALL_MARKER] = undefined; }
      }
      messagesOwner = null;
    }

    function rollbackMount() {
      observer?.disconnect?.();
      observer = null;
      clearDecorations();
      releaseOwnership();
      busy = false;
      mounted = false;
    }

    function mount() {
      if (destroyed || mounted) return false;
      const messages = documentRef.querySelector('#messages');
      if (!messages || messages[INSTALL_MARKER]) return false;
      messages[INSTALL_MARKER] = ownerToken;
      messagesOwner = messages;
      mounted = true;
      try {
        restoreHandoff();
        decorateAll(messages);
        if (typeof MutationObserverImpl === 'function') {
          observer = new MutationObserverImpl(() => {
            if (!ownsSurface()) return;
            restoreHandoff();
            decorateAll(messages);
          });
          observer.observe(messages, { childList: true, subtree: true });
        }
        return true;
      } catch {
        rollbackMount();
        return false;
      }
    }

    function destroy() {
      if (destroyed) return false;
      destroyed = true;
      rollbackMount();
      return true;
    }

    return Object.freeze({
      mount,
      destroy,
      decorate,
      decorateAll,
      editMessage,
      restoreHandoff,
      readCanonical,
      rollbackOrphanBranch,
      publishLineage,
      getState: () => Object.freeze({ mounted, destroyed, busy, decorations: decorations.size, ownsSurface: ownsSurface() })
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
    DRAFT_HANDOFF_KEY,
    BRANCH_EVENT,
    MAX_COMPOSER_CHARS,
    MAX_HANDOFF_AGE_MS,
    MARKER,
    SOURCE_RETENTION_ERROR,
    INSTALL_MARKER,
    editableText,
    defaultId,
    editBranchTitle,
    findSource,
    includesConversationIds,
    buildEditBranch,
    normalizeHandoff,
    createController,
    mount
  });
});