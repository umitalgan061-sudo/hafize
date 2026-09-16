(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const MAX_TOOL_ACTIVITIES = 4;
  const MAX_TOOL_ACTIVITY_LABEL_LENGTH = 80;
  const MESSAGE_PLACEHOLDER = '…';
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
  // The turn currently in flight: `{ controller, stopRequested }`. It exists
  // only while a request is open, which is exactly when stopping is possible.
  let activeStream = null;

  // Stop/regenerate rules live in `chat-stream-policy.js` so the composer
  // controls answer the same questions this runtime does. The module is
  // optional on purpose: without it the chat keeps working, just without the
  // stop and regenerate affordances.
  function streamPolicy() {
    return window.HafizeChatStreamPolicy ?? null;
  }

  function isAbortError(error) {
    return streamPolicy()?.isAbortError(error) ?? error?.name === 'AbortError';
  }

  function stoppedAnswerContent(content) {
    return streamPolicy()?.stoppedContent(content) ?? content;
  }

  /**
   * Publishes what the composer controls may offer right now. Every transition
   * that can change the answer — send, stop, finish, regenerate, switching or
   * clearing a conversation — ends with this, so the buttons never outlive the
   * state that justified them.
   */
  function emitStreamState() {
    const messages = getActiveConversation()?.messages ?? [];
    const detail = streamPolicy()?.describeState({
      streaming: isStreaming,
      hasActiveStream: Boolean(activeStream),
      messages
    });
    if (!detail) return;
    window.dispatchEvent(new CustomEvent('hafize:stream-state', { detail }));
  }

  /**
   * Aborts the open turn. The partial answer is kept: the finaliser below
   * persists whatever arrived and flags the message, so a stopped turn reads as
   * a stopped turn instead of silently looking like the model's whole answer.
   */
  function stopStreaming() {
    if (!isStreaming || !activeStream || activeStream.stopRequested) return false;
    activeStream.stopRequested = true;
    activeStream.controller.abort();
    showToast('Yanıt durduruldu.');
    return true;
  }

  function markAnswerStopped(id, content) {
    const conversation = getActiveConversation();
    const message = conversation?.messages.find((item) => item.id === id);
    if (!message || message.role !== 'assistant') return;
    message.stopped = true;
    updateMessage(id, stoppedAnswerContent(content ?? message.content), { persist: true });
    render();
  }

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

  function loadConversations() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveConversations() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
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
      // A stopped answer is partial by definition; saying so keeps it from
      // reading like everything the model had to say.
      if (message.role === 'assistant' && message.stopped) {
        article.dataset.stopped = 'true';
        const note = document.createElement('div');
        note.className = 'message-stopped';
        note.textContent = streamPolicy()?.STOPPED_BADGE ?? 'Yanıt durduruldu';
        article.append(note);
      }
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
    emitStreamState();
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

  async function loadAgents() {
    ui.agentSelect.disabled = true;
    ui.agentSelect.replaceChildren(new Option('Ajanlar yükleniyor…', ''));
    try {
      const response = await fetch('/api/agents', { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'AGENT_LIST_FAILED');

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

    try {
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
    } catch (error) {
      // A stop aborts the body mid-read. Everything that already arrived is a
      // real part of the answer, so it is kept rather than thrown away.
      if (!activeStream?.stopRequested && !isAbortError(error)) throw error;
      markAnswerStopped(assistantId, content);
      return;
    }

    updateMessage(assistantId, content || emptyMessage, { persist: true });
  }

  async function streamAssistantReply(signal) {
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
      body: JSON.stringify({ model, agentId, messages: requestMessages, max_tokens: 2048 }),
      signal
    });
    await consumeAssistantStream(response, assistantId, 'NVIDIA modeli boş bir yanıt döndürdü.');
  }

  async function runAssistantWithTools(signal) {
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
      body: JSON.stringify({ model, agentId, messages: requestMessages, max_tokens: 2048 }),
      signal
    });
    await consumeAssistantStream(
      response,
      assistantId,
      'Ajan araçları çalıştırdı ancak model boş bir yanıt döndürdü.'
    );
  }

  function readyToAnswer() {
    if (!ui.modelSelect.value) {
      showToast('Önce NVIDIA NIM bağlantısının hazır olması gerekiyor.');
      return false;
    }
    if (!getConversationAgentId()) {
      showToast('Önce Hafize ajan listesinin hazır olması gerekiyor.');
      return false;
    }
    return true;
  }

  /**
   * Runs one assistant turn against the transcript as it stands. Sending a new
   * message and regenerating the last answer differ only in how they prepare
   * that transcript, so they share this: one abort controller, one error path,
   * one place where the composer goes back to being usable.
   */
  async function runAssistantTurn() {
    const controller = new AbortController();
    activeStream = { controller, stopRequested: false };
    isStreaming = true;
    ui.messageInput.disabled = true;
    ui.agentSelect.disabled = true;
    ui.toolModeBtn.disabled = true;
    emitStreamState();

    try {
      if (getActiveConversation()?.toolsEnabled) await runAssistantWithTools(controller.signal);
      else await streamAssistantReply(controller.signal);
    } catch (error) {
      const conversation = getActiveConversation();
      const last = conversation?.messages.at(-1);
      // The abort can also reject the request itself, before a single byte of
      // the body arrives; that is still a stop, not a failure to report.
      if (activeStream?.stopRequested || isAbortError(error)) {
        if (last?.role === 'assistant') markAnswerStopped(last.id, last.content);
      } else {
        const message = error?.message === 'MODEL_REQUIRED'
          ? 'Bir NVIDIA modeli seçilmedi.'
          : error?.message === 'AGENT_REQUIRED'
            ? 'Bir Hafize ajanı seçilmedi.'
            : `NVIDIA yanıtı alınamadı: ${error?.message || 'bilinmeyen hata'}`;
        if (last?.role === 'assistant' && !last.content) updateMessage(last.id, message, { persist: true });
        else addMessage('assistant', message);
      }
    } finally {
      isStreaming = false;
      activeStream = null;
      ui.messageInput.disabled = false;
      syncAgentSelect();
      syncToolMode();
      emitStreamState();
      ui.messageInput.focus();
    }
  }

  async function submitMessage(text) {
    const clean = text.trim();
    if (!clean || isStreaming) return;
    if (!readyToAnswer()) return;

    if (editingMessageId) {
      if (!replaceEditedTurn(editingMessageId, clean)) return;
    } else {
      addMessage('user', clean);
    }
    ui.messageInput.value = '';
    autoResizeComposer();
    await runAssistantTurn();
  }

  /**
   * Drops the last answer and asks for another one from the same question. The
   * dropped turn is gone from the transcript before the request goes out, so
   * the model is never shown the answer it is being asked to replace.
   */
  async function regenerateLastAnswer() {
    if (isStreaming) {
      showToast('Yanıt sürerken yeniden üretilemez.');
      return;
    }
    const conversation = getActiveConversation();
    const remaining = streamPolicy()?.truncateForRegenerate(conversation?.messages ?? []);
    if (!remaining) {
      showToast('Yeniden üretilecek bir Hafize yanıtı yok.');
      return;
    }
    if (!readyToAnswer()) return;
    if (editingMessageId) cancelMessageEdit();

    conversation.messages = remaining;
    conversation.updatedAt = new Date().toISOString();
    conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    saveConversations();
    render();
    await runAssistantTurn();
  }

  window.addEventListener('hafize:edit-message', (event) => beginMessageEdit(event.detail?.messageId));
  window.addEventListener('hafize:stop-stream', () => stopStreaming());
  window.addEventListener('hafize:regenerate-answer', () => { void regenerateLastAnswer(); });

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
