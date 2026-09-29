// @ts-nocheck
(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const PANEL_ID = 'hafizeConversationForks';
  const DIALOG_ID = 'hafizeConversationForkDialog';
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES = 100;
  const MAX_MESSAGE_LENGTH = 12000;
  const MAX_TITLE = 80;
  const MAX_BRANCHES_PER_PARENT = 8;
  const MAX_FORK_DEPTH = 4;
  const MAX_SNIPPET = 180;

  const ui = {
    messages: document.querySelector('#messages'),
    historyBlock: document.querySelector('.history-block'),
    conversationList: document.querySelector('#conversationList'),
    toast: document.querySelector('#toast')
  };
  if (!ui.messages || !ui.historyBlock || !ui.conversationList) return;

  let observer = null;
  let mounted = false;
  let activeDialog = null;
  let previousFocus = null;
  const listeners = [];

  function uid() {
    return globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(16).slice(2) + '-' + Math.random().toString(16).slice(2);
  }

  function storage() {
    try { return globalThis.localStorage; } catch { return null; }
  }

  function cleanText(value, limit) {
    return typeof value === 'string' ? value.trim().replace(/\0/g, '').slice(0, limit) : '';
  }

  function readConversations() {
    const store = storage();
    if (!store) return [];
    try {
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string').slice(0, MAX_CONVERSATIONS);
    } catch { return []; }
  }

  function writeConversations(next) {
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_CONVERSATIONS)));
      return true;
    } catch { return false; }
  }

  function copyMessage(message) {
    if (!message || typeof message !== 'object') return null;
    const role = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : '';
    const content = cleanText(message.content, MAX_MESSAGE_LENGTH);
    if (!role || !content) return null;
    const result = { id: cleanText(message.id, 120) || uid(), role, content, at: cleanText(message.at, 40) || new Date().toISOString() };
    if (Array.isArray(message.toolActivities)) {
      result.toolActivities = message.toolActivities.filter((item) => item && typeof item === 'object' && typeof item.label === 'string').slice(0, 4)
        .map((item) => ({ label: cleanText(item.label, 80), state: item.state === 'running' || item.state === 'failure' ? item.state : 'success' }))
        .filter((item) => item.label);
    }
    if (Array.isArray(message.alternates)) {
      result.alternates = message.alternates.filter((item) => typeof item === 'string').map((item) => item.slice(0, MAX_MESSAGE_LENGTH)).filter(Boolean).slice(0, 3);
    }
    if (message.feedback === 'positive' || message.feedback === 'negative') result.feedback = message.feedback;
    if (message.generation && typeof message.generation === 'object') {
      result.generation = {
        model: cleanText(message.generation.model, 160),
        agentId: cleanText(message.generation.agentId, 120),
        toolsEnabled: message.generation.toolsEnabled === true,
        generatedAt: cleanText(message.generation.generatedAt, 40),
        durationMs: Number.isFinite(message.generation.durationMs) && message.generation.durationMs >= 0 ? Math.min(600000, Math.floor(message.generation.durationMs)) : null
      };
    }
    return result;
  }

  function conversationDepth(conversation, all) {
    let depth = 0;
    let cursor = conversation;
    const seen = new Set();
    while (cursor?.forkOf && depth < MAX_FORK_DEPTH + 2) {
      if (seen.has(cursor.id)) return MAX_FORK_DEPTH + 1;
      seen.add(cursor.id);
      cursor = all.find((item) => item.id === cursor.forkOf) || null;
      depth += 1;
    }
    return depth;
  }

  function branchCount(parentId, all) {
    return all.filter((item) => item && item.forkOf === parentId).length;
  }

  function makeTitle(source, all) {
    const ordinal = branchCount(source.id, all) + 1;
    return ('↳ ' + (cleanText(source.title, MAX_TITLE) || 'Sohbet') + ' · Dal ' + ordinal).slice(0, MAX_TITLE);
  }

  function makeFork(source, messageId, all) {
    const index = Array.isArray(source.messages) ? source.messages.findIndex((message) => message?.id === messageId) : -1;
    if (index < 0) return { error: 'MESSAGE_NOT_FOUND' };
    const depth = conversationDepth(source, all);
    if (depth >= MAX_FORK_DEPTH) return { error: 'DEPTH_LIMIT' };
    if (branchCount(source.id, all) >= MAX_BRANCHES_PER_PARENT) return { error: 'BRANCH_LIMIT' };
    if (all.length >= MAX_CONVERSATIONS) return { error: 'CONVERSATION_LIMIT' };

    const messages = source.messages.slice(0, index + 1).map(copyMessage).filter(Boolean).slice(-MAX_MESSAGES);
    if (!messages.length) return { error: 'EMPTY_FORK' };

    const now = new Date().toISOString();
    return {
      conversation: {
        id: uid(),
        title: makeTitle(source, all),
        agentId: cleanText(source.agentId, 120),
        toolsEnabled: source.toolsEnabled === true,
        createdAt: now,
        updatedAt: now,
        messages,
        forkOf: cleanText(source.id, 120),
        forkMessageId: cleanText(messageId, 120),
        forkDepth: depth + 1
      }
    };
  }

  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = cleanText(message, 180);
    ui.toast.classList.remove('hidden');
    globalThis.clearTimeout(showToast.timer);
    showToast.timer = globalThis.setTimeout(() => ui.toast.classList.add('hidden'), 3200);
  }

  function isBusy() {
    return ui.messages.getAttribute('aria-busy') === 'true';
  }

  function currentConversationId() {
    return cleanText(ui.messages.dataset.conversationId, 120);
  }

  function currentConversation(all = readConversations()) {
    const id = currentConversationId();
    return all.find((item) => item.id === id) || null;
  }

  function focusable(container) {
    return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  }

  function closeDialog() {
    if (!activeDialog) return;
    const dialog = activeDialog;
    activeDialog = null;
    dialog.remove();
    previousFocus?.focus?.();
    previousFocus = null;
  }

  function openDialog(source, target, onConfirm) {
    closeDialog();
    previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.className = 'conversation-fork-overlay';

    const panel = document.createElement('section');
    panel.className = 'conversation-fork-dialog';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', DIALOG_ID + 'Title');
    panel.setAttribute('aria-describedby', DIALOG_ID + 'Description');

    const title = document.createElement('h2');
    title.id = DIALOG_ID + 'Title';
    title.textContent = 'Konuşmayı buradan dallandır';

    const description = document.createElement('p');
    description.id = DIALOG_ID + 'Description';
    const count = Array.isArray(source.messages) ? source.messages.findIndex((m) => m?.id === target.id) + 1 : 0;
    const snippet = cleanText(target.content, MAX_SNIPPET).replace(/\s+/g, ' ');
    description.textContent = count + ' mesaj yeni sohbetin başlangıcı olacak. Seçilen mesaj: ' + snippet;

    const note = document.createElement('p');
    note.className = 'conversation-fork-note';
    note.textContent = 'Yeni dal yerel sohbette ayrı bir kayıt olur. Şimdilik hiçbir ağ isteği gönderilmez.';

    const actions = document.createElement('div');
    actions.className = 'conversation-fork-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'soft-btn';
    cancel.textContent = 'Vazgeç';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'soft-btn conversation-fork-primary';
    confirm.textContent = 'Yeni dal oluştur';
    actions.append(cancel, confirm);

    panel.append(title, description, note, actions);
    overlay.append(panel);
    document.body.append(overlay);
    activeDialog = overlay;

    const finish = (confirmed) => {
      if (confirmed) onConfirm();
      else closeDialog();
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeDialog(); });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key === 'Enter' && event.target !== cancel) { event.preventDefault(); finish(true); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusable(panel);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    confirm.focus();
  }

  function createFork(messageId) {
    if (isBusy()) return showToast('Yanıt üretimi sürerken yeni dal oluşturulamaz.');

    const all = readConversations();
    const source = currentConversation(all);
    if (!source) return showToast('Aktif sohbet bulunamadı.');
    const target = Array.isArray(source.messages) ? source.messages.find((message) => message?.id === messageId) : null;
    if (!target) return showToast('Dallandırılacak mesaj bulunamadı.');

    const errors = {
      MESSAGE_NOT_FOUND: 'Mesaj bulunamadı.',
      DEPTH_LIMIT: 'Dal derinliği sınırına ulaşıldı.',
      BRANCH_LIMIT: 'Bu sohbet için en fazla 8 dal oluşturulabilir.',
      CONVERSATION_LIMIT: 'Yerel sohbet sınırı dolu. Önce bir sohbet sil.',
      EMPTY_FORK: 'Dala aktarılabilecek mesaj yok.'
    };
    const preview = makeFork(source, messageId, all);
    if (preview.error) return showToast(errors[preview.error] || 'Yeni dal oluşturulamadı.');

    openDialog(source, target, () => {
      const latest = readConversations();
      const freshSource = latest.find((item) => item.id === source.id);
      if (!freshSource) return showToast('Kaynak sohbet değişti; işlem iptal edildi.');
      const created = makeFork(freshSource, messageId, latest);
      if (created.error) return showToast(errors[created.error] || 'Yeni dal oluşturulamadı.');
      const next = [created.conversation, ...latest].slice(0, MAX_CONVERSATIONS);
      if (!writeConversations(next)) return showToast('Yeni dal cihazda kalıcı olarak kaydedilemedi.');
      closeDialog();
      window.dispatchEvent(new CustomEvent('hafize:conversation-forks-changed', { detail: { conversationId: freshSource.id, forkId: created.conversation.id } }));
      window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: created.conversation.id } }));
      showToast('Yeni konuşma dalı oluşturuldu.');
    });
  }

  function decorateMessages() {
    ui.messages.querySelectorAll('.message').forEach((article) => {
      if (article.querySelector('[data-conversation-fork]')) return;
      const messageId = cleanText(article.dataset.messageId, 120);
      if (!messageId) return;

      const actions = document.createElement('div');
      actions.className = 'message-fork-actions';
      const fork = document.createElement('button');
      fork.type = 'button';
      fork.className = 'message-action conversation-fork-button';
      fork.dataset.conversationFork = messageId;
      fork.textContent = 'Buradan dallandır';
      fork.setAttribute('aria-label', 'Bu mesajdan yeni konuşma dalı oluştur');
      fork.addEventListener('click', () => createFork(messageId));
      actions.append(fork);

      const target = article.querySelector('.assistant-message-actions') || article;
      target.append(actions);
    });
  }

  function childrenOf(conversationId, all) {
    return all.filter((item) => item?.forkOf === conversationId)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, MAX_BRANCHES_PER_PARENT);
  }

  function renderBranchPanel() {
    const all = readConversations();
    const active = currentConversation(all);
    let panel = document.getElementById(PANEL_ID);
    if (!active) { panel?.remove(); return; }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'conversation-fork-panel utility-card';
      panel.setAttribute('aria-labelledby', PANEL_ID + 'Title');

      const header = document.createElement('div');
      header.className = 'utility-head conversation-fork-head';
      const heading = document.createElement('span');
      heading.id = PANEL_ID + 'Title';
      heading.textContent = 'Konuşma dalları';
      const count = document.createElement('span');
      count.className = 'conversation-fork-count';
      header.append(heading, count);

      const body = document.createElement('div');
      body.className = 'conversation-fork-body';
      panel.append(header, body);
      ui.historyBlock.after(panel);
    }

    const count = panel.querySelector('.conversation-fork-count');
    const body = panel.querySelector('.conversation-fork-body');
    const children = childrenOf(active.id, all);
    count.textContent = String(children.length);
    body.replaceChildren();

    const context = document.createElement('p');
    context.className = 'conversation-fork-context';
    if (active.forkOf) {
      const parent = all.find((item) => item.id === active.forkOf);
      context.textContent = parent ? 'Bu dal: ' + cleanText(parent.title, MAX_TITLE) : 'Bu dalın üst sohbeti bulunamıyor.';
    } else {
      context.textContent = 'Bu sohbetin yerel dalları';
    }
    body.append(context);

    if (!children.length) {
      const empty = document.createElement('div');
      empty.className = 'conversation-fork-empty';
      empty.textContent = 'Henüz bu sohbetten dal oluşturulmadı.';
      body.append(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'conversation-fork-list';
    list.setAttribute('role', 'list');

    children.forEach((child) => {
      const row = document.createElement('div');
      row.className = 'conversation-fork-row';
      row.setAttribute('role', 'listitem');

      const info = document.createElement('div');
      info.className = 'conversation-fork-info';
      const name = document.createElement('strong');
      name.textContent = cleanText(child.title, MAX_TITLE) || 'Yeni dal';
      const meta = document.createElement('span');
      meta.textContent = (Array.isArray(child.messages) ? child.messages.length : 0) + ' mesaj';
      info.append(name, meta);

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'mini-btn';
      open.textContent = 'Aç';
      open.setAttribute('aria-label', (cleanText(child.title, MAX_TITLE) || 'Yeni dal') + ' dalını aç');
      open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('hafize:open-conversation', { detail: { conversationId: child.id } })));

      row.append(info, open);
      list.append(row);
    });
    body.append(list);
  }

  function onRefresh() {
    decorateMessages();
    renderBranchPanel();
  }

  function onStorage(event) {
    if (event.key === STORAGE_KEY) onRefresh();
  }

  function onKeydown(event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'f') return;
    const target = event.target;
    if (target?.matches?.('input, textarea, select, button, [contenteditable="true"]')) return;
    const active = currentConversation();
    const messages = Array.isArray(active?.messages) ? active.messages : [];
    const last = messages.at(-1);
    if (!last?.id) return;
    event.preventDefault();
    createFork(last.id);
  }

  function boot() {
    if (mounted) return;
    mounted = true;
    observer = new MutationObserver(onRefresh);
    observer.observe(ui.messages, { childList: true, subtree: true });
    const openHandler = () => onRefresh();
    const forkHandler = () => onRefresh();
    const storageHandler = (event) => onStorage(event);
    window.addEventListener('hafize:open-conversation', openHandler);
    window.addEventListener('hafize:conversation-forks-changed', forkHandler);
    window.addEventListener('storage', storageHandler);
    document.addEventListener('keydown', onKeydown);
    listeners.push(() => observer?.disconnect());
    listeners.push(() => window.removeEventListener('hafize:open-conversation', openHandler));
    listeners.push(() => window.removeEventListener('hafize:conversation-forks-changed', forkHandler));
    listeners.push(() => window.removeEventListener('storage', storageHandler));
    listeners.push(() => document.removeEventListener('keydown', onKeydown));
    onRefresh();
  }

  boot();

  window.HafizeConversationForks = Object.freeze({
    STORAGE_KEY,
    MAX_BRANCHES_PER_PARENT,
    MAX_FORK_DEPTH,
    makeFork: (conversation, messageId, all = [conversation]) => makeFork(conversation, messageId, all),
    childrenOf,
    createFork
  });

  window.addEventListener('beforeunload', () => {
    for (const off of listeners.splice(0)) off();
    observer?.disconnect();
    closeDialog();
  });
})();