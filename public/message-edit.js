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
  const MAX_COMPOSER_CHARS = 12_000;
  const MAX_HANDOFF_AGE_MS = 90_000;
  const MARKER = 'hafizeEditReady';

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

    let observer = null;
    let busy = false;

    function composerNodes() {
      return Object.freeze({
        input: documentRef.querySelector('#messageInput'),
        sendButton: documentRef.querySelector('#sendBtn')
      });
    }

    function showState(button, state, label) {
      button.dataset.state = state;
      button.textContent = label;
      button.disabled = state === 'working';
    }

    function readCanonical() {
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

    function copyModelPreference(sourceId, branchId) {
      if (!modelState || typeof modelState.readModelEntries !== 'function' || typeof modelState.writeModelEntries !== 'function') return;
      try {
        const conversations = readCanonical()?.value || [];
        const entries = modelState.readModelEntries(storage, conversations);
        const source = entries.find((entry) => entry.conversationId === sourceId);
        if (!source?.modelId) return;
        modelState.writeModelEntries(storage, [{ conversationId: branchId, modelId: source.modelId }, ...entries], conversations);
      } catch { /* preference copy is best effort */ }
    }

    function stageHandoff(conversationId, text, createdAt) {
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
      if (busy) return false;
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
      if (!candidate.some((conversation) => conversation.id === branch.id)) {
        try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* ignore */ }
        showState(button, 'error', 'Sınır aşıldı');
        return false;
      }

      busy = true;
      showState(button, 'working', 'Düzenleme dalı hazırlanıyor…');
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(candidate));
        const persisted = readCanonical()?.value || [];
        if (!persisted.some((conversation) => conversation.id === branch.id)) throw new Error('EDIT_BRANCH_NOT_PERSISTED');
        copyModelPreference(found.conversation.id, branch.id);
        showState(button, 'success', 'Düzenleme dalı hazır');
        reload();
        return true;
      } catch {
        try { handoffStorage.removeItem(DRAFT_HANDOFF_KEY); } catch { /* ignore */ }
        busy = false;
        showState(button, 'error', 'Düzenlenemedi');
        return false;
      }
    }

    function decorate(article) {
      if (!article?.classList?.contains('message') || !article.classList.contains('user')) return false;
      if (article.dataset?.[MARKER] === '1') return false;
      const content = article.querySelector?.('.content');
      const actions = article.querySelector?.('.message-copy-actions');
      if (!content || !actions || !guard.normalizeId?.(article.dataset?.messageId)) return false;
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'message-copy-btn message-edit-btn';
      button.dataset.state = 'idle';
      button.textContent = 'Düzenle';
      button.setAttribute('aria-label', 'bu mesajdan önceki bağlamı koruyarak yeni düzenleme dalı oluştur');
      button.addEventListener('click', () => { editMessage(button, article, content); });
      actions.prepend?.(button);
      if (article.dataset) article.dataset[MARKER] = '1';
      return true;
    }

    function decorateAll(root = documentRef) {
      const messages = root.querySelectorAll?.('.message.user') || [];
      let count = 0;
      for (const article of messages) if (decorate(article)) count += 1;
      return count;
    }

    function mount() {
      const messages = documentRef.querySelector('#messages');
      if (!messages) return false;
      restoreHandoff();
      decorateAll(messages);
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(() => {
          restoreHandoff();
          decorateAll(messages);
        });
        observer.observe(messages, { childList: true, subtree: true });
      }
      return true;
    }

    function destroy() {
      observer?.disconnect?.();
      observer = null;
      busy = false;
    }

    return Object.freeze({ mount, destroy, decorate, decorateAll, editMessage, restoreHandoff, readCanonical });
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
    MAX_COMPOSER_CHARS,
    MAX_HANDOFF_AGE_MS,
    MARKER,
    editableText,
    defaultId,
    editBranchTitle,
    findSource,
    buildEditBranch,
    normalizeHandoff,
    createController,
    mount
  });
});
