(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const ui = {
    sidebar: document.querySelector('#sidebar'),
    sidebarToggle: document.querySelector('#sidebarToggle'),
    newChatBtn: document.querySelector('#newChatBtn'),
    clearHistoryBtn: document.querySelector('#clearHistoryBtn'),
    conversationList: document.querySelector('#conversationList'),
    composer: document.querySelector('#composer'),
    messageInput: document.querySelector('#messageInput'),
    messages: document.querySelector('#messages'),
    welcome: document.querySelector('#welcome'),
    installBtn: document.querySelector('#installBtn'),
    toast: document.querySelector('#toast')
  };

  let installPrompt = null;
  let conversations = loadConversations();
  let activeConversationId = conversations[0]?.id ?? null;

  function uid() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadConversations() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveConversations() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
  }

  function getActiveConversation() {
    return conversations.find((item) => item.id === activeConversationId) ?? null;
  }

  function createConversation() {
    const conversation = {
      id: uid(),
      title: 'Yeni sohbet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    conversations.unshift(conversation);
    activeConversationId = conversation.id;
    saveConversations();
    render();
    ui.messageInput.focus();
  }

  function deleteConversation(id) {
    conversations = conversations.filter((item) => item.id !== id);
    if (activeConversationId === id) activeConversationId = conversations[0]?.id ?? null;
    saveConversations();
    render();
  }

  function clearHistory() {
    if (!conversations.length) return;
    if (!globalThis.confirm('Tüm yerel sohbet geçmişi silinsin mi?')) return;
    conversations = [];
    activeConversationId = null;
    saveConversations();
    render();
  }

  function addMessage(role, content) {
    let conversation = getActiveConversation();
    if (!conversation) {
      createConversation();
      conversation = getActiveConversation();
    }
    conversation.messages.push({ id: uid(), role, content, at: new Date().toISOString() });
    conversation.updatedAt = new Date().toISOString();
    if (conversation.title === 'Yeni sohbet' && role === 'user') {
      conversation.title = content.trim().replace(/\s+/g, ' ').slice(0, 48) || 'Yeni sohbet';
    }
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    saveConversations();
    render();
  }

  function renderConversationList() {
    ui.conversationList.replaceChildren();
    if (!conversations.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'Henüz sohbet yok.';
      ui.conversationList.append(empty);
      return;
    }

    for (const conversation of conversations) {
      const row = document.createElement('div');
      row.className = `conversation-row${conversation.id === activeConversationId ? ' active' : ''}`;

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'conversation-open';
      open.textContent = conversation.title;
      open.title = conversation.title;
      open.addEventListener('click', () => {
        activeConversationId = conversation.id;
        render();
        if (window.innerWidth <= 900) ui.sidebar.classList.remove('open');
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'conversation-delete';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${conversation.title} sohbetini sil`);
      remove.addEventListener('click', () => deleteConversation(conversation.id));

      row.append(open, remove);
      ui.conversationList.append(row);
    }
  }

  function renderMessages() {
    ui.messages.replaceChildren();
    const conversation = getActiveConversation();
    const messages = conversation?.messages ?? [];
    ui.welcome.classList.toggle('hidden', messages.length > 0);

    for (const message of messages) {
      const article = document.createElement('article');
      article.className = `message ${message.role}`;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = message.role === 'user' ? 'Sen' : 'Hafize';

      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = message.content;

      article.append(meta, content);
      ui.messages.append(article);
    }

    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  }

  function render() {
    renderConversationList();
    renderMessages();
  }

  function showToast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.remove('hidden');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => ui.toast.classList.add('hidden'), 3200);
  }

  function autoResizeComposer() {
    ui.messageInput.style.height = 'auto';
    ui.messageInput.style.height = `${Math.min(ui.messageInput.scrollHeight, 180)}px`;
  }

  function submitMessage(text) {
    const clean = text.trim();
    if (!clean) return;
    addMessage('user', clean);
    ui.messageInput.value = '';
    autoResizeComposer();

    window.setTimeout(() => {
      addMessage(
        'assistant',
        'Arayüz hazırım. NVIDIA NIM backend bağlantısı sonraki geliştirme turunda eklenecek; API anahtarını tarayıcıya veya bu repoya yazmayacağım.'
      );
    }, 180);
  }

  ui.sidebarToggle.addEventListener('click', () => ui.sidebar.classList.toggle('open'));
  ui.newChatBtn.addEventListener('click', createConversation);
  ui.clearHistoryBtn.addEventListener('click', clearHistory);
  ui.messageInput.addEventListener('input', autoResizeComposer);
  ui.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ui.composer.requestSubmit();
    }
  });
  ui.composer.addEventListener('submit', (event) => {
    event.preventDefault();
    submitMessage(ui.messageInput.value);
  });

  document.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => submitMessage(button.dataset.prompt || ''));
  });

  document.querySelector('#attachBtn').addEventListener('click', () => showToast('Dosya ekleme sonraki küçük geliştirme turunda etkinleştirilecek.'));
  document.querySelector('#micBtn').addEventListener('click', () => showToast('Sesli giriş sonraki küçük geliştirme turunda etkinleştirilecek.'));

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    ui.installBtn.hidden = false;
  });

  ui.installBtn.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    ui.installBtn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
  }

  if (!activeConversationId) createConversation();
  else render();
})();
