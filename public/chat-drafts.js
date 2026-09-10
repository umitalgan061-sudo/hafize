(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.chat-drafts.v1';
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

  function readStore() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function writeStore(value) {
    try {
      const entries = Object.entries(value)
        .filter(([, draft]) => typeof draft === 'string' && draft.length > 0)
        .slice(-MAX_DRAFTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
      return true;
    } catch {
      return false;
    }
  }

  function activeConversationId() {
    const row = list.querySelector('.conversation-row.active');
    return row?.querySelector('.conversation-open')?.dataset?.conversationId || '';
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

  function saveDraft({ silent = false } = {}) {
    const id = activeConversationId();
    if (!id) return false;
    const text = input.value.slice(0, MAX_DRAFT_LENGTH);
    const store = readStore();
    if (text.trim()) store[id] = text;
    else delete store[id];
    const ok = writeStore(store);
    if (!silent && ok) announce(text.trim() ? 'Taslak kaydedildi' : 'Taslak temizlendi');
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
    if (ok) announce('Taslak gönderim için temizlendi');
    return ok;
  }

  function restoreDraft() {
    const id = activeConversationId();
    if (!id || id === lastConversationId) return;
    const draft = readStore()[id];
    if (typeof draft !== 'string') {
      if (!input.value) input.value = '';
      announce('');
      lastConversationId = id;
      return;
    }
    if (!input.value) {
      input.value = draft.slice(0, MAX_DRAFT_LENGTH);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      announce('Taslak geri yüklendi');
    }
    lastConversationId = id;
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveDraft(), SAVE_DELAY);
  }

  function onInput() {
    scheduleSave();
    if (!input.value.trim()) announce('');
  }

  function onSubmit() {
    window.clearTimeout(saveTimer);
    const id = activeConversationId();
    if (!id) return;
    const store = readStore();
    delete store[id];
    writeStore(store);
    announce('');
  }

  function sync() {
    restoreDraft();
  }

  input.addEventListener('input', onInput);
  composer.addEventListener('submit', onSubmit, true);
  new MutationObserver(sync).observe(list, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === 'hafize.conversations.v1') sync();
  });

  sync();
})();
