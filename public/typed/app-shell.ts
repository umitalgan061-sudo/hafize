// @ts-nocheck
type Role = 'user' | 'assistant';
interface ToolActivity { label: string; state: 'running' | 'success' | 'failure'; }
interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  at: string;
  toolActivities?: ToolActivity[];
}
interface AgentInfo { id: string; name: string; description?: string; kind?: string; }
interface Conversation {
  id: string;
  title: string;
  agentId: string;
  toolsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
interface AppUi {
  sidebar: HTMLElement;
  sidebarToggle: HTMLButtonElement;
  newChatBtn: HTMLButtonElement;
  clearHistoryBtn: HTMLButtonElement;
  conversationList: HTMLElement;
  composer: HTMLFormElement;
  messageInput: HTMLTextAreaElement;
  messages: HTMLElement;
  welcome: HTMLElement;
  installBtn: HTMLButtonElement;
  toast: HTMLElement;
  modelSelect: HTMLSelectElement;
  agentSelect: HTMLSelectElement;
  toolModeBtn: HTMLButtonElement;
}
interface JsonPayload { readonly [key: string]: unknown; }

(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const MAX_TOOL_ACTIVITIES = 4;
  const MAX_TOOL_ACTIVITY_LABEL_LENGTH = 80;
  const MESSAGE_PLACEHOLDER = '…';
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES_PER_CONVERSATION = 100;
  const MAX_MESSAGE_LENGTH = 12000;
  const REQUEST_TIMEOUT_MS = 60_000;
  let networkOnline = globalThis.navigator?.onLine !== false;
  let activeRequestController = null;
  const ui: AppUi = {
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
    modelSelect: document.querySelector('#modelSelect'),
    agentSelect: document.querySelector('#agentSelect'),
    toolModeBtn: document.querySelector('#toolModeBtn')
  };

  let installPrompt = null;
  let persistenceWarningShown = false;
  let conversations = loadConversations();
  let activeConversationId = conversations[0]?.id ?? null;
  let isStreaming = false;
  let availableAgents = [];
  let defaultAgentId = '';
  let editingMessageId = null;

  function uid() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // Assistant answers are markdown; user messages stay literal text. The
  // renderer is optional on purpose: if `chat-markdown.js` fails to load the
  // chat still shows every answer, just without headings, lists and code
  // blocks.
  function paintContent(node, text, { role = 'assistant', streaming = false } = {}) {
    if (!node) return;
    const value = typeof text === 'string' ? text : '';
    const painter = window.HafizeChatMarkdown;
    if (painter?.paint) {
      painter.paint(node, value, { placeholder: MESSAGE_PLACEHOLDER, plain: role !== 'assistant', streaming });
      return;
    }
    node.textContent = value || MESSAGE_PLACEHOLDER;
  }


  function normalizeMessage(value: unknown): ChatMessage | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value;
    if ((source.role !== 'user' && source.role !== 'assistant') || typeof source.content !== 'string') return null;
    const content = source.content.slice(0, MAX_MESSAGE_LENGTH);
    if (!content) return null;
    return {
      id: typeof source.id === 'string' && source.id ? source.id.slice(0, 120) : uid(),
      role: source.role,
      content,
      at: typeof source.at === 'string' ? source.at.slice(0, 40) : new Date().toISOString(),
      ...(Array.isArray(source.toolActivities) ? {
        toolActivities: source.toolActivities
          .filter((item) => item && typeof item === 'object' && typeof item.label === 'string')
          .slice(0, MAX_TOOL_ACTIVITIES)
          .map((item) => ({
            label: item.label.slice(0, MAX_TOOL_ACTIVITY_LABEL_LENGTH),
            state: item.state === 'running' || item.state === 'failure' ? item.state : 'success'
          }))
      } : {})
    };
  }

  function normalizeConversation(value: unknown): Conversation | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value;
    if (typeof source.id !== 'string' || typeof source.title !== 'string') return null;
    const messages = Array.isArray(source.messages)
      ? source.messages.map((message) => normalizeMessage(message)).filter(Boolean).slice(-MAX_MESSAGES_PER_CONVERSATION)
      : [];
    const now = new Date().toISOString();
    return {
      id: source.id.slice(0, 120),
      title: source.title.trim().slice(0, 80) || 'Yeni sohbet',
      agentId: typeof source.agentId === 'string' ? source.agentId.slice(0, 120) : '',
      toolsEnabled: source.toolsEnabled === true,
      createdAt: typeof source.createdAt === 'string' ? source.createdAt.slice(0, 40) : now,
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt.slice(0, 40) : now,
      messages
    };
  }

  async function fetchJson(url, init = {}) {
    if (!networkOnline) throw new Error('OFFLINE');
    activeRequestController?.abort();
    const controller = new AbortController();
    activeRequestController = controller;
    const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...(init.headers || {}) } });
      let payload = {};
      try { payload = await response.json(); } catch { payload = {}; }
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `HTTP_${response.status}`);
      return payload;
    } finally {
      globalThis.clearTimeout(timeout);
      if (activeRequestController === controller) activeRequestController = null;
    }
  }

  function loadConversations(): Conversation[] {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      return value.map((item) => normalizeConversation(item)).filter(Boolean).slice(0, MAX_CONVERSATIONS);
    } catch {
      return [];
    }
  }

  function saveConversations() {
    try {
      conversations = conversations.map((item) => normalizeConversation(item)).filter(Boolean).slice(0, MAX_CONVERSATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      persistenceWarningShown = false;
      return true;
    } catch {
      if (!persistenceWarningShown) {
        persistenceWarningShown = true;
        showToast('Yerel sohbet geçmişi bu cihazda kalıcı olarak kaydedilemedi.');
      }
      return false;
    }
  }

  function getActiveConversation() {
    return conversations.find((item) => item.id === activeConversationId) ?? null;
  }

  function getConversationAgentId(conversation = getActiveConversation()) {
    const configured = typeof conversation?.agentId === 'string' ? conversation.agentId : '';
    if (availableAgents.some((agent) => agent.id === configured)) return configured;
    return defaultAgentId;
  }

  function createConversation() {
    const conversation = {
      id: uid(),
      title: 'Yeni sohbet',
      agentId: defaultAgentId,
      toolsEnabled: false,
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
    editingMessageId = null;
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
    if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) conversation.messages = conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
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
    // Deltas paint on the next frame; the final, persisted update paints now.
    if (node) paintContent(node, content, { role: message.role, streaming: !persist });
    if (persist) saveConversations();
  }

  function getEditableMessage(id) {
    const conversation = getActiveConversation();
    if (!conversation || typeof id !== 'string') return null;
    const index = conversation.messages.findIndex((item) => item?.id === id && item?.role === 'user');
    if (index < 0) return null;
    return { conversation, index, message: conversation.messages[index] };
  }

  function updateEditingIndicator() {
    let indicator = ui.composer.querySelector('.composer-editing');
    if (!editingMessageId) {
      indicator?.remove();
      return;
    }
    const target = getEditableMessage(editingMessageId);
    if (!target) {
      editingMessageId = null;
      indicator?.remove();
      return;
    }
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'composer-editing';
      indicator.setAttribute('role', 'status');
      ui.composer.insertBefore(indicator, ui.composer.querySelector('.composer-row'));
    }
    indicator.replaceChildren();
    const text = document.createElement('span');
    text.textContent = 'Mesaj düzenleniyor';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'message-action';
    cancel.textContent = 'Vazgeç';
    cancel.setAttribute('aria-label', 'Mesaj düzenlemeyi iptal et');
    cancel.addEventListener('click', cancelMessageEdit);
    indicator.append(text, cancel);
  }

  function beginMessageEdit(id) {
    if (isStreaming) return showToast('Yanıt sürerken mesaj düzenlenemez.');
    const target = getEditableMessage(id);
    if (!target) return showToast('Düzenlenecek kullanıcı mesajı bulunamadı.');
    editingMessageId = id;
    ui.messageInput.value = target.message.content || '';
    ui.messageInput.focus();
    ui.messageInput.select();
    autoResizeComposer();
    updateEditingIndicator();
    showToast('Mesajını düzenleyip gönder; bu noktadan sonraki yanıtlar yeniden oluşturulacak.');
  }

  function cancelMessageEdit() {
    if (!editingMessageId) return;
    editingMessageId = null;
    ui.messageInput.value = '';
    ui.messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    updateEditingIndicator();
    ui.messageInput.focus();
  }

  function replaceEditedTurn(id, content) {
    const target = getEditableMessage(id);
    if (!target) return null;
    target.conversation.messages = target.conversation.messages.slice(0, target.index);
    const message = { id: uid(), role: 'user', content, at: new Date().toISOString() };
    target.conversation.messages.push(message);
    target.conversation.updatedAt = new Date().toISOString();
    if (target.conversation.title === 'Yeni sohbet') {
      target.conversation.title = content.trim().replace(/\s+/g, ' ').slice(0, 48) || 'Yeni sohbet';
    }
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    saveConversations();
    editingMessageId = null;
    updateEditingIndicator();
    render();
    return message.id;
  }

  function normalizeToolActivity(value) {
    if (!value || typeof value !== 'object' || typeof value.label !== 'string') return null;
    const label = value.label.trim().slice(0, MAX_TOOL_ACTIVITY_LABEL_LENGTH);
    if (!label) return null;
    if (value.state === 'running') return { label, state: 'running' };
    if (typeof value.ok === 'boolean') return { label, state: value.ok ? 'success' : 'failure' };
    if (value.state === 'success' || value.state === 'failure') return { label, state: value.state };
    return null;
  }

  function getMessageToolActivities(message) {
    if (!Array.isArray(message?.toolActivities)) return [];
    return message.toolActivities
      .map((activity) => normalizeToolActivity(activity))
      .filter(Boolean)
      .slice(0, MAX_TOOL_ACTIVITIES);
  }

  function renderToolActivities(container, activities) {
    container.replaceChildren();
    for (const activity of activities) {
      const badge = document.createElement('span');
      badge.className = `tool-activity${activity.state === 'failure' ? ' failed' : ''}`;
      badge.textContent = activity.label;
      container.append(badge);
    }
    container.hidden = activities.length === 0;
  }

  function appendToolActivity(messageId, value) {
    const activity = normalizeToolActivity(value);
    if (!activity) return;
    const conversation = getActiveConversation();
    const message = conversation?.messages.find((item) => item.id === messageId);
    if (!message || message.role !== 'assistant') return;

    const activities = getMessageToolActivities(message);

    let nextActivities;
    if (activity.state === 'running') {
      if (activities.some((item) => item.label === activity.label && item.state === activity.state)) return;
      if (activities.length >= MAX_TOOL_ACTIVITIES) return;
      nextActivities = [...activities, activity];
    } else {
      let runningIndex = -1;
      for (let index = activities.length - 1; index >= 0; index -= 1) {
        if (activities[index].state === 'running') {
          runningIndex = index;
          break;
        }
      }
      if (runningIndex >= 0) {
        nextActivities = [...activities];
        nextActivities[runningIndex] = activity;
      } else {
        if (activities.some((item) => item.label === activity.label && item.state === activity.state)) return;
        if (activities.length >= MAX_TOOL_ACTIVITIES) return;
        nextActivities = [...activities, activity];
      }
    }

    message.toolActivities = nextActivities;
    conversation.updatedAt = new Date().toISOString();
    const container = ui.messages.querySelector(`[data-message-id="${CSS.escape(messageId)}"] .tool-activities`);
    if (container) renderToolActivities(container, message.toolActivities);
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
        if (editingMessageId) cancelMessageEdit();
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
      paintContent(content, message.content, { role: message.role });

      article.append(meta);
      if (message.role === 'assistant') {
        const activities = document.createElement('div');
        activities.className = 'tool-activities';
        activities.setAttribute('aria-label', 'Araç etkinlikleri');
        activities.setAttribute('aria-live', 'polite');
        renderToolActivities(activities, getMessageToolActivities(message));
        article.append(activities);
      }
      article.append(content);
      ui.messages.append(article);
    }

    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
  }

  function syncAgentSelect() {
    const agentId = getConversationAgentId();
    ui.agentSelect.disabled = isStreaming || availableAgents.length === 0;
    if (agentId && ui.agentSelect.value !== agentId) ui.agentSelect.value = agentId;
    const selected = availableAgents.find((agent) => agent.id === agentId);
    ui.agentSelect.title = selected?.description || 'Hafize ajanı';
  }

  function syncToolMode() {
    const enabled = Boolean(getActiveConversation()?.toolsEnabled);
    ui.toolModeBtn.disabled = isStreaming || !getConversationAgentId();
    ui.toolModeBtn.setAttribute('aria-pressed', String(enabled));
    ui.toolModeBtn.textContent = enabled ? '⌘ Araçlar açık' : '⌘ Araçlar';
    ui.toolModeBtn.title = enabled
      ? 'Araç çağrıları backend izin politikasıyla etkin'
      : 'Bu sohbet için backend tool-calling modunu aç';
  }

  function render() {
    renderConversationList();
    renderMessages();
    syncAgentSelect();
    syncToolMode();
    updateEditingIndicator();
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
      const payload = await fetchJson('/api/models');
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

  async function loadAgents() {
    ui.agentSelect.disabled = true;
    ui.agentSelect.replaceChildren(new Option('Ajanlar yükleniyor…', ''));
    try {
      const payload = await fetchJson('/api/agents');

      const agents = Array.isArray(payload.agents)
        ? payload.agents.filter((agent) => agent && typeof agent.id === 'string' && typeof agent.name === 'string')
        : [];
      const fallback = typeof payload.defaultAgent === 'string' ? payload.defaultAgent : '';
      if (!agents.length || !agents.some((agent) => agent.id === fallback)) throw new Error('INVALID_AGENT_LIST');

      availableAgents = agents;
      defaultAgentId = fallback;
      ui.agentSelect.replaceChildren(
        ...availableAgents.map((agent) => new Option(
          agent.kind === 'specialist' ? `${agent.name} · uzman` : agent.name,
          agent.id
        ))
      );

      const allowedIds = new Set(availableAgents.map((agent) => agent.id));
      let migrated = false;
      for (const conversation of conversations) {
        if (!allowedIds.has(conversation.agentId)) {
          conversation.agentId = defaultAgentId;
          migrated = true;
        }
      }
      if (migrated) saveConversations();
      syncAgentSelect();
      syncToolMode();
    } catch {
      availableAgents = [];
      defaultAgentId = '';
      ui.agentSelect.replaceChildren(new Option('Ajan listesi kullanılamıyor', ''));
      ui.agentSelect.disabled = true;
      showToast('Hafize ajan listesi alınamadı.');
    }
  }

  function parseSseBlock(block) {
    const lines = block.split('\n');
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() || 'message';
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data || data === '[DONE]') return null;
    try {
      return { type, payload: JSON.parse(data) };
    } catch {
      return null;
    }
  }

  function getRequestMessages(conversation = getActiveConversation()) {
    return (conversation?.messages ?? [])
      .filter((message) => message.content)
      .map(({ role, content }) => ({ role, content }));
  }

  async function consumeAssistantStream(response, assistantId, emptyMessage) {
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
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        if (parsed.type === 'hafize-tool-activity') {
          appendToolActivity(assistantId, parsed.payload);
          continue;
        }
        if (parsed.type !== 'message') continue;
        const event = parsed.payload;
        if (event.error) throw new Error(event.error);
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          content += delta;
          updateMessage(assistantId, content);
        }
      }
      if (done) break;
    }

    updateMessage(assistantId, content || emptyMessage, { persist: true });
  }

  async function streamAssistantReply() {
    const model = ui.modelSelect.value;
    if (!model) throw new Error('MODEL_REQUIRED');

    const conversation = getActiveConversation();
    const agentId = getConversationAgentId(conversation);
    if (!agentId) throw new Error('AGENT_REQUIRED');
    const requestMessages = getRequestMessages(conversation);

    const assistantId = addMessage('assistant', '', { persist: false });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model, agentId, messages: requestMessages, max_tokens: 2048 })
    });
    await consumeAssistantStream(response, assistantId, 'NVIDIA modeli boş bir yanıt döndürdü.');
  }

  async function runAssistantWithTools() {
    const model = ui.modelSelect.value;
    if (!model) throw new Error('MODEL_REQUIRED');

    const conversation = getActiveConversation();
    const agentId = getConversationAgentId(conversation);
    if (!agentId) throw new Error('AGENT_REQUIRED');
    const requestMessages = getRequestMessages(conversation);

    const assistantId = addMessage('assistant', '', { persist: false });
    const response = await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ model, agentId, messages: requestMessages, max_tokens: 2048 })
    });
    await consumeAssistantStream(
      response,
      assistantId,
      'Ajan araçları çalıştırdı ancak model boş bir yanıt döndürdü.'
    );
  }

  async function submitMessage(text) {
    const clean = text.trim();
    if (!clean || isStreaming) return;
    if (!networkOnline) { showToast('İnternet bağlantısı yok. Bağlantı geri geldiğinde tekrar deneyebilirsin.'); return; }
    if (!ui.modelSelect.value) {
      showToast('Önce NVIDIA NIM bağlantısının hazır olması gerekiyor.');
      return;
    }
    if (!getConversationAgentId()) {
      showToast('Önce Hafize ajan listesinin hazır olması gerekiyor.');
      return;
    }

    if (editingMessageId) {
      if (!replaceEditedTurn(editingMessageId, clean)) return;
    } else {
      addMessage('user', clean);
    }
    ui.messageInput.value = '';
    autoResizeComposer();
    isStreaming = true;
    ui.messageInput.disabled = true;
    ui.agentSelect.disabled = true;
    ui.toolModeBtn.disabled = true;

    try {
      if (getActiveConversation()?.toolsEnabled) await runAssistantWithTools();
      else await streamAssistantReply();
    } catch (error) {
      const message = error?.message === 'OFFLINE'
        ? 'İnternet bağlantısı bulunamadı.'
        : error?.message === 'MODEL_REQUIRED'
        ? 'Bir NVIDIA modeli seçilmedi.'
        : error?.message === 'AGENT_REQUIRED'
          ? 'Bir Hafize ajanı seçilmedi.'
          : `NVIDIA yanıtı alınamadı: ${error?.message || 'bilinmeyen hata'}`;
      const conversation = getActiveConversation();
      const last = conversation?.messages.at(-1);
      if (last?.role === 'assistant' && !last.content) updateMessage(last.id, message, { persist: true });
      else addMessage('assistant', message);
    } finally {
      isStreaming = false;
      ui.messageInput.disabled = false;
      syncAgentSelect();
      syncToolMode();
      ui.messageInput.focus();
    }
  }


  function handleOnline() {
    networkOnline = true;
    showToast('Bağlantı geri geldi.');
    loadModels();
    loadAgents();
  }

  function handleOffline() {
    networkOnline = false;
    activeRequestController?.abort();
    showToast('İnternet bağlantısı kesildi.');
  }

  function persistOnLifecycle() {
    if (!isStreaming) saveConversations();
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('beforeunload', persistOnLifecycle);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistOnLifecycle(); });

  window.addEventListener('hafize:edit-message', (event) => beginMessageEdit(event.detail?.messageId));

  ui.sidebarToggle.addEventListener('click', () => ui.sidebar.classList.toggle('open'));
  ui.newChatBtn.addEventListener('click', () => {
    if (isStreaming) return showToast('Yanıt sürerken yeni sohbet açılamaz.');
    createConversation();
  });
  ui.clearHistoryBtn.addEventListener('click', clearHistory);
  ui.agentSelect.addEventListener('change', () => {
    if (isStreaming) return syncAgentSelect();
    const selectedAgentId = ui.agentSelect.value;
    if (!availableAgents.some((agent) => agent.id === selectedAgentId)) return syncAgentSelect();
    if (!getActiveConversation()) createConversation();
    const conversation = getActiveConversation();
    conversation.agentId = selectedAgentId;
    saveConversations();
    syncAgentSelect();
    syncToolMode();
  });
  ui.toolModeBtn.addEventListener('click', () => {
    if (isStreaming || !getConversationAgentId()) return syncToolMode();
    if (!getActiveConversation()) createConversation();
    const conversation = getActiveConversation();
    conversation.toolsEnabled = !Boolean(conversation.toolsEnabled);
    saveConversations();
    syncToolMode();
    showToast(conversation.toolsEnabled
      ? 'Araç modu açık: uygun çağrılar backend izin politikasıyla çalışır.'
      : 'Araç modu kapalı: gerçek zamanlı SSE sohbetine dönüldü.');
  });
  ui.messageInput.addEventListener('input', autoResizeComposer);
  ui.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ui.composer.requestSubmit();
    }
    if (event.key === 'Escape' && editingMessageId) {
      event.preventDefault();
      cancelMessageEdit();
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
  loadAgents();
})();


export { normalizeConversation, normalizeMessage, fetchJson };
