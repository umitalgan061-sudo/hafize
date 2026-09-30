(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.chat-drafts.v1';
  const CONVERSATION_KEY = 'hafize.conversations.v1';
  const CONVERSATION_LIST = '#conversationList';
  const COMPOSER = '#composer';
  const INPUT = '#messageInput';
  const MAX_DRAFT_LENGTH = 12000;
  const MAX_DRAFTS = 30;
  const SAVE_DELAY = 250;
  const STATUS_ID = 'chatDraftStatus';

  const input = document.querySelector(INPUT);
  const composer = document.querySelector(COMPOSER);
  const list = document.querySelector(CONVERSATION_LIST);
  if (!input || !composer || !list) return;

  let saveTimer = 0;
  let lastConversationId = '';
  let lastPersistedDraft = '';
  let lastSavedAt = '';

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function readConversationIds() {
    try {
      const value = JSON.parse(localStorage.getItem(CONVERSATION_KEY) || '[]');
      return Array.isArray(value)
        ? new Set(value.map((item) => typeof item?.id === 'string' ? item.id : '').filter(Boolean))
        : new Set();
    } catch {
      return new Set();
    }
  }

  function normalizeDraft(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, MAX_DRAFT_LENGTH);
  }

  function sanitizeStore(value) {
    const ids = readConversationIds();
    const entries = Object.entries(value)
      .filter(([id, draft]) => ids.has(id) && normalizeDraft(draft).length > 0)
      .map(([id, draft]) => [id, normalizeDraft(draft)])
      .slice(-MAX_DRAFTS);
    return Object.fromEntries(entries);
  }

  function writeStore(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStore(value)));
      return true;
    } catch {
      return false;
    }
  }

  function cleanupStaleDrafts() {
    const store = readStore();
    const clean = sanitizeStore(store);
    if (JSON.stringify(store) === JSON.stringify(clean)) return false;
    return writeStore(clean);
  }

  function activeConversationId() {
    const row = list.querySelector('.conversation-row.active');
    return row?.querySelector('.conversation-open')?.dataset?.conversationId || '';
  }

  function getDraft(id = activeConversationId()) {
    if (!id) return '';
    return normalizeDraft(readStore()[id]);
  }

  function hasDraft(id = activeConversationId()) {
    return Boolean(getDraft(id).trim());
  }

  function statusNode() {
    let node = document.getElementById(STATUS_ID);
    if (node) return node;
    node = document.createElement('span');
    node.id = STATUS_ID;
    node.className = 'chat-draft-status';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    composer.append(node);
    return node;
  }

  function announce(text) {
    const node = statusNode();
    node.textContent = text;
    node.hidden = !text;
  }

  function savedLabel() {
    if (!lastSavedAt) return 'Taslak kaydedildi';
    return `Taslak kaydedildi · ${new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(lastSavedAt))}`;
  }

  function flushPending() {
    if (!saveTimer) return false;
    window.clearTimeout(saveTimer);
    saveTimer = 0;
    return saveDraft({ silent: true });
  }

  function saveDraft({ silent = false } = {}) {
    const id = activeConversationId();
    if (!id) return false;
    const text = normalizeDraft(input.value);
    const store = readStore();
    if (text.trim()) store[id] = text;
    else delete store[id];
    const ok = writeStore(store);
    if (ok) {
      lastPersistedDraft = text;
      lastSavedAt = new Date().toISOString();
    }
    if (!silent && ok) announce(text.trim() ? savedLabel() : 'Taslak temizlendi');
    if (!ok && !silent) announce('Taslak bu cihazda kaydedilemedi');
    lastConversationId = id;
    return ok;
  }

  function clearDraft(id = activeConversationId()) {
    if (!id) return false;
    const store = readStore();
    if (!Object.prototype.hasOwnProperty.call(store, id)) return true;
    delete store[id];
    const ok = writeStore(store);
    if (ok) lastPersistedDraft = '';
    return ok;
  }

  function restoreDraft() {
    const id = activeConversationId();
    if (!id || id === lastConversationId) return;
    flushPending();
    const draft = getDraft(id);
    if (!draft) {
      input.value = '';
      announce('');
      lastPersistedDraft = '';
      lastSavedAt = '';
      lastConversationId = id;
      return;
    }
    if (!input.value) {
      input.value = draft;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      announce(`Taslak geri yüklendi · ${draft.length} karakter`);
    }
    lastPersistedDraft = draft;
    lastSavedAt = '';
    lastConversationId = id;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      saveDraft();
    }, SAVE_DELAY);
  }

  function onInput() {
    scheduleSave();
    if (!input.value.trim()) return announce('');
    announce('Taslak kaydediliyor…');
  }

  function onSubmit() {
    flushPending();
    clearDraft();
    announce('');
  }

  function sync() {
    cleanupStaleDrafts();
    restoreDraft();
  }

  input.addEventListener('input', onInput);
  composer.addEventListener('submit', onSubmit, true);
  new MutationObserver(sync).observe(list, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === CONVERSATION_KEY) sync();
  });
  window.addEventListener('pagehide', flushPending, { capture: true });
  window.addEventListener('beforeunload', flushPending, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });

  cleanupStaleDrafts();
  sync();

  Object.freeze({
    saveDraft,
    clearDraft,
    restoreDraft,
    cleanupStaleDrafts,
    getDraft,
    hasDraft,
    getLastPersistedDraft: () => lastPersistedDraft
  });
})();
