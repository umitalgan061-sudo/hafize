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
    toast: document.querySelector('#toast'),
    modelSelect: document.querySelector('#modelSelect')
  };

  let installPrompt = null;
  let conversations = loadConversations();
  let activeConversationId = conversations[0]?.id ?? null;
  let isStreaming = false;

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
    if (isStreaming) return showToast('Yanıt sürerken sohbet silinemez.');
    conversations = conversations.filter((item) => item.id !== id);
    if (activeConversationId === id) activeConversationId = conversations[0]?.id ?? null;
    saveConversations();
    render();
  }

  function clearHistory() {
    if (isStreaming) return showToast('Yanıt sürerken geçmiş temizlenemez.');
    if (!conversations.length) return;
    if (!globalThis.confirm('Tüm yerel sohbet geçmişi silinsin mi?')) return;
    conversations = [];
    activeConversationId = null;
    saveConversations();
    render();
  }

  function addMessage(role, content, { persist = true } = {}) {
    let conversation = getActiveConversation();
    if (!conversation) {
      createConversation();
      conversation = getActiveConversation();
    }
    const message = { id: uid(), role, content, at: new Date().toISOString() };
    conversation.messages.push(message);
    conversation.updatedAt = new Date().toISOString();
    if (conversation.title === 'Yeni sohbet' && role === 'user') {
      conversation.title = content.trim().replace(/\s+/g, ' ').slice(0, 48) || 'Yeni sohbet';
    }
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (persist) saveConversations();
    render();
    return message.id;
  }

  function updateMessage(id, content, { persist = false } = {}) {
    const conversation = getActiveConversation();
    const message = conversation?.messages.find((item) => item.id === id);
    if (!message) return;
    message.content = content;
    conversation.updatedAt = new Date().toISOString();
    const node = ui.messages.querySelector(`[data-message-id="${CSS.escape(id)}"] .content`);
    if (node) node.textContent = content || '…';
    if (persist) saveConversations();
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
        if (isStreaming) return showToast('Yanıt sürerken sohbet değiştirilemez.');
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
      article.dataset.messageId = message.id;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = message.role === 'user' ? 'Sen' : 'Hafize';

      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = message.content || '…';

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

  async function loadModels() {
    ui.modelSelect.replaceChildren(new Option('NVIDIA modelleri yükleniyor…', ''));
    try {
      const response = await fetch('/api/models', { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'MODEL_LIST_FAILED');
      const models = Array.isArray(payload.models) ? payload.models : [];
      ui.modelSelect.replaceChildren();
      if (!models.length) {
        ui.modelSelect.append(new Option('NVIDIA modeli bulunamadı', ''));
        return;
      }
      for (const model of models) ui.modelSelect.append(new Option(model, model));
    } catch (error) {
      ui.modelSelect.replaceChildren(new Option('NVIDIA NIM bağlantısı bekleniyor', ''));
      if (error?.message !== 'NVIDIA_NOT_CONFIGURED') showToast('NVIDIA model listesi alınamadı.');
    }
  }

  function parseSseBlock(block) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data || data === '[DONE]') return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async function streamAssistantReply() {
    const model = ui.modelSelect.value;
    if (!model) throw new Error('MODEL_REQUIRED');

    const conversation = getActiveConversation();
    const requestMessages = (conversation?.messages ?? [])
      .filter((message) => message.content)
      .map(({ role, content }) => ({ role, content }));

    const assistantId = addMessage('assistant', '', { persist: false });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model, messages: requestMessages, max_tokens: 2048 })
    });

    if (!response.ok || !response.body) {
      let detail = response.statusText;
      try {
        const payload = await response.json();
        detail = payload?.error || detail;
      } catch {
        // Keep HTTP status text.
      }
      throw new Error(detail || 'CHAT_FAILED');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const event = parseSseBlock(block);
        if (!event) continue;
        if (event.error) throw new Error(event.error);
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          content += delta;
          updateMessage(assistantId, content);
        }
      }
      if (done) break;
    }

    updateMessage(assistantId, content || 'NVIDIA modeli boş bir yanıt döndürdü.', { persist: true });
  }

  async function submitMessage(text) {
    const clean = text.trim();
    if (!clean || isStreaming) return;
    if (!ui.modelSelect.value) {
      showToast('Önce NVIDIA NIM bağlantısının hazır olması gerekiyor.');
      return;
    }

    addMessage('user', clean);
    ui.messageInput.value = '';
    autoResizeComposer();
    isStreaming = true;
    ui.messageInput.disabled = true;

    try {
      await streamAssistantReply();
    } catch (error) {
      const message = error?.message === 'MODEL_REQUIRED'
        ? 'Bir NVIDIA modeli seçilmedi.'
        : `NVIDIA yanıtı alınamadı: ${error?.message || 'bilinmeyen hata'}`;
      const conversation = getActiveConversation();
      const last = conversation?.messages.at(-1);
      if (last?.role === 'assistant' && !last.content) updateMessage(last.id, message, { persist: true });
      else addMessage('assistant', message);
    } finally {
      isStreaming = false;
      ui.messageInput.disabled = false;
      ui.messageInput.focus();
    }
  }

  ui.sidebarToggle.addEventListener('click', () => ui.sidebar.classList.toggle('open'));
  ui.newChatBtn.addEventListener('click', () => {
    if (isStreaming) return showToast('Yanıt sürerken yeni sohbet açılamaz.');
    createConversation();
  });
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
  loadModels();
})();
