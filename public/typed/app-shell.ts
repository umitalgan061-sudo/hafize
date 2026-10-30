// @ts-nocheck
import {
  MAX_RESPONSE_ALTERNATES,
  canRegenerateResponse,
  createGenerationSnapshot,
  normalizeResponseAlternates,
  rememberResponseAlternate,
  restoreLatestResponseAlternate
} from './response-variants.ts';
import { openResponseVariantDialog } from './response-variants-ui.ts';
import { openRegenerationOptions } from './response-regeneration-options-ui.ts';
import { buildRegenerationMessages } from './response-regeneration-options.ts';
import { mountModelPreferences, type ModelPreferencesUiController } from './model-preferences-ui.ts';
import { loadModelPreferences } from './model-preferences.ts';
import { hafizeApi } from './hafize-api.ts';
import { handleAgentEvent } from './agent-extras.ts';
import { HafizeSseClient, type HafizeSseStats, type HafizeSseEvent } from './hafize-sse.ts';
import { createHafizeStreamController, formatStreamBytes, formatStreamDuration, phaseLabel, phaseTone } from './hafize-stream-state.ts';
import { mountChatScroll, type ChatScrollController } from './chat-scroll.ts';
import { decorateUserAttachments } from './user-attachments.ts';
type Role = 'user' | 'assistant';
interface ToolActivity { label: string; state: 'running' | 'success' | 'failure'; }
interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  at: string;
  toolActivities?: ToolActivity[];
  alternates?: string[];
  feedback?: 'positive' | 'negative';
  generation?: {
    model: string;
    agentId: string;
    toolsEnabled: boolean;
    generatedAt: string;
    durationMs: number | null;
  };
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
  // Written by the history-management and conversation-workspace modules.
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
  forkOf?: string;
  forkMessageId?: string;
  forkDepth?: number;
  forkNote?: string;
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
  providerSelect: HTMLSelectElement;
  agentSelect: HTMLSelectElement;
  toolModeBtn: HTMLButtonElement;
}
interface JsonPayload { readonly [key: string]: unknown; }

(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  // Tool runs chain several model calls and web fetches before the answer streams.
  const AGENT_RUN_TIMEOUT_MS = 900_000;
  let serverDefaultModel = '';
  const MAX_TOOL_ACTIVITIES = 4;
  const MAX_TOOL_ACTIVITY_LABEL_LENGTH = 80;
  const MESSAGE_PLACEHOLDER = '…';
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES_PER_CONVERSATION = 100;
  // Same as the server limit (lib/agent-runtime.ts MAX_MESSAGE_CHARS): long pastes and answers survive a reload.
  const MAX_MESSAGE_LENGTH = 200000;
  let networkOnline = globalThis.navigator?.onLine !== false;
  const hafizeSse = new HafizeSseClient();
  const streamState = createHafizeStreamController();
  let streamStatus: HTMLElement | null = null;
  let streamStatusTimer: number | undefined;
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
    providerSelect: document.querySelector('#providerSelect'),
    agentSelect: document.querySelector('#agentSelect'),
    toolModeBtn: document.querySelector('#toolModeBtn')
  };

  let installPrompt = null;
  let persistenceWarningShown = false;
  let conversations = loadConversations();
  let activeConversationId = conversations[0]?.id ?? null;
  queueMicrotask(() => rememberPersisted(conversations));
  let isStreaming = false;
  let availableAgents = [];
  let defaultAgentId = '';
  let editingMessageId = null;
  let modelPreferencesController: ModelPreferencesUiController | null = null;
  // Auto-follow while streaming, a jump-to-latest button when the user scrolls up, thinking bubble.
  let chatScroll: ChatScrollController | null = null;

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
    const alternates = normalizeResponseAlternates(source.alternates);
    const feedback = source.feedback === 'positive' || source.feedback === 'negative' ? source.feedback : undefined;
    const generation = source.generation && typeof source.generation === 'object'
      ? {
        model: typeof source.generation.model === 'string' ? source.generation.model.slice(0, 160) : '',
        agentId: typeof source.generation.agentId === 'string' ? source.generation.agentId.slice(0, 120) : '',
        toolsEnabled: source.generation.toolsEnabled === true,
        generatedAt: typeof source.generation.generatedAt === 'string' ? source.generation.generatedAt.slice(0, 40) : '',
        durationMs: Number.isFinite(source.generation.durationMs) && source.generation.durationMs >= 0
          ? Math.min(600_000, Math.floor(source.generation.durationMs))
          : null
      }
      : undefined;
    return {
      id: typeof source.id === 'string' && source.id ? source.id.slice(0, 120) : uid(),
      role: source.role,
      content,
      at: typeof source.at === 'string' ? source.at.slice(0, 40) : new Date().toISOString(),
      ...(alternates.length ? { alternates } : {}),
      ...(feedback ? { feedback } : {}),
      ...(generation ? { generation } : {}),
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
      // The tools toggle is not shown; every conversation uses live tools.
      toolsEnabled: true,
      createdAt: typeof source.createdAt === 'string' ? source.createdAt.slice(0, 40) : now,
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt.slice(0, 40) : now,
      messages,
      ...(source.pinned === true ? { pinned: true } : {}),
      ...(source.archived === true ? { archived: true } : {}),
      ...(Array.isArray(source.tags) ? { tags: source.tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim().slice(0, 40)).slice(0, 12) } : {}),
      ...(typeof source.forkOf === 'string' && source.forkOf ? { forkOf: source.forkOf.slice(0, 120) } : {}),
      ...(typeof source.forkMessageId === 'string' && source.forkMessageId ? { forkMessageId: source.forkMessageId.slice(0, 120) } : {}),
      ...(Number.isFinite(source.forkDepth) && source.forkDepth >= 1 ? { forkDepth: Math.min(4, Math.floor(source.forkDepth)) } : {}),
      ...(typeof source.forkNote === 'string' && source.forkNote ? { forkNote: source.forkNote.slice(0, 400) } : {})
    };
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

  // Other modules (rename/pin, archive/tags, delete, backup import, clear history) edit the stored
  // list directly, while this module keeps its own copy in memory. Before every save, a three-way
  // merge against what was last persisted keeps their edits instead of overwriting them.
  const EXTERNAL_FIELDS = ['title', 'pinned', 'archived', 'tags'] as const;
  let persistedFields = new Map<string, string[]>();
  const fieldValue = (value: unknown) => JSON.stringify(value ?? null);
  function rememberPersisted(list: Conversation[]) {
    persistedFields = new Map(list.map((item) => [item.id, EXTERNAL_FIELDS.map((field) => fieldValue(item[field]))]));
  }
  function mergeExternalChanges() {
    let stored: Conversation[];
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return;
      stored = raw.map((item) => normalizeConversation(item)).filter(Boolean);
    } catch {
      return;
    }
    const storedById = new Map(stored.map((item) => [item.id, item]));
    conversations = conversations.filter((item) => !(persistedFields.has(item.id) && !storedById.has(item.id)));
    for (const conversation of conversations) {
      const external = storedById.get(conversation.id);
      const base = persistedFields.get(conversation.id);
      if (!external || !base) continue;
      EXTERNAL_FIELDS.forEach((field, index) => {
        const theirs = fieldValue(external[field]);
        if (theirs !== base[index] && fieldValue(conversation[field]) === base[index]) {
          if (external[field] === undefined) delete conversation[field];
          else (conversation as Record<string, unknown>)[field] = external[field];
        }
      });
    }
    const known = new Set(conversations.map((item) => item.id));
    for (const item of stored) if (!known.has(item.id) && !persistedFields.has(item.id)) conversations.push(item);
    if (activeConversationId && !conversations.some((item) => item.id === activeConversationId)) activeConversationId = conversations[0]?.id ?? null;
  }

  function saveConversations() {
    try {
      mergeExternalChanges();
      conversations = conversations.map((item) => normalizeConversation(item)).filter(Boolean).slice(0, MAX_CONVERSATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      rememberPersisted(conversations);
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
      toolsEnabled: true,
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
      // Re-decorate so an edited user message keeps its attachment chips.
      if (message.role === 'user') decorateUserAttachments(node, content);
    // Every new line of the answer pulls the view down while the user is still at the bottom.
    if (chatScroll) chatScroll.follow();
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
    mergeExternalChanges();
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
    ui.messages.dataset.conversationId = conversation?.id ?? '';
    ui.messages.setAttribute('aria-busy', String(isStreaming));
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
      // User messages are painted as plain text; turn stored markdown references into chips.
      if (message.role === 'user') decorateUserAttachments(content, message.content);

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
      if (message.role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'assistant-message-actions';
        actions.setAttribute('aria-label', 'Yanıt işlemleri');
        const regenerate = document.createElement('button');
        regenerate.type = 'button';
        regenerate.className = 'message-action';
        regenerate.textContent = 'Yeniden üret';
        regenerate.setAttribute('aria-label', 'Bu asistan yanıtını yeniden üret');
        regenerate.disabled = isStreaming || message.id !== messages.at(-1)?.id;
        regenerate.title = message.id === messages.at(-1)?.id ? 'Bu yanıt için yeni bir varyant üret' : 'Yalnızca son yanıt yeniden üretilebilir';
        regenerate.addEventListener('click', () => regenerateAssistantMessage(message.id));
        actions.append(regenerate);
        const options = document.createElement('button');
        options.type = 'button';
        options.className = 'message-action';
        options.textContent = 'Yönergeyle yeniden üret';
        options.setAttribute('aria-label', 'Özel yönergeyle bu asistan yanıtını yeniden üret');
        options.disabled = isStreaming || message.id !== messages.at(-1)?.id;
        options.title = options.disabled ? 'Yalnızca son yanıt için kullanılabilir' : 'Yeni yanıtın yönünü seç';
        options.addEventListener('click', () => {
          openRegenerationOptions({
            trigger: options,
            onSelect: (instruction) => { void regenerateAssistantMessage(message.id, instruction); }
          });
        });
        actions.append(options);
        const positive = document.createElement('button');
        positive.type = 'button';
        positive.className = 'message-action' + (message.feedback === 'positive' ? ' selected' : '');
        positive.textContent = '👍';
        positive.setAttribute('aria-label', 'Yanıtı beğenildi olarak işaretle');
        positive.setAttribute('aria-pressed', String(message.feedback === 'positive'));
        positive.disabled = isStreaming;
        positive.addEventListener('click', () => setAssistantFeedback(message.id, message.feedback === 'positive' ? undefined : 'positive'));
        const negative = document.createElement('button');
        negative.type = 'button';
        negative.className = 'message-action' + (message.feedback === 'negative' ? ' selected' : '');
        negative.textContent = '👎';
        negative.setAttribute('aria-label', 'Yanıtı beğenilmedi olarak işaretle');
        negative.setAttribute('aria-pressed', String(message.feedback === 'negative'));
        negative.disabled = isStreaming;
        negative.addEventListener('click', () => setAssistantFeedback(message.id, message.feedback === 'negative' ? undefined : 'negative'));
        actions.append(positive, negative);
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'message-action';
        copy.textContent = 'Kopyala';
        copy.setAttribute('aria-label', 'Asistan yanıtını panoya kopyala');
        copy.disabled = !message.content || isStreaming;
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard?.writeText?.(message.content || '');
            showToast('Asistan yanıtı panoya kopyalandı.');
          } catch {
            showToast('Yanıt panoya kopyalanamadı.');
          }
        });
        actions.append(copy);
        if (message.alternates?.length) {
          const variants = document.createElement('button');
          variants.type = 'button';
          variants.className = 'message-action';
          variants.textContent = 'Varyantlar';
          variants.setAttribute('aria-label', 'Yanıt varyantlarını görüntüle');
          variants.disabled = isStreaming;
          variants.addEventListener('click', () => {
            openResponseVariantDialog({
              current: message.content,
              alternates: message.alternates,
              trigger: variants,
              onSelect: (current, alternates) => {
                message.content = current;
                message.alternates = alternates;
                saveConversations();
                render();
                showToast('Seçilen yanıt mevcut cevap yapıldı.');
              }
            });
          });
          actions.append(variants);
          const restore = document.createElement('button');
          restore.type = 'button';
          restore.className = 'message-action';
          restore.textContent = 'Önceki yanıtı getir (' + message.alternates.length + ')';
          restore.setAttribute('aria-label', 'Önceki asistan yanıtını geri getir');
          restore.disabled = isStreaming;
          restore.addEventListener('click', () => restorePreviousAssistantMessage(message.id));
          actions.append(restore);
        }
        const generation = message.generation;
        if (generation?.model || generation?.agentId) {
          const context = document.createElement('span');
          context.className = 'assistant-message-generation';
          const modelLabel = generation.model || 'Model bilinmiyor';
          const agentLabel = generation.agentId || 'Ajan bilinmiyor';
          context.textContent = modelLabel + ' · ' + agentLabel + (generation.toolsEnabled ? ' · araçlar' : '');
          context.title = generation.durationMs === null ? 'Üretim bağlamı' : 'Üretim süresi: ' + generation.durationMs + ' ms';
          actions.append(context);
        }
        article.append(actions);
      }
      ui.messages.append(article);
    }

    // #messages is the element that scrolls; the window never does. `chatScroll` follows only while
    // the user is already at the bottom, so reading history is never interrupted.
    // The thinking bubble is re-attached here because replaceChildren() above detached it.
    if (chatScroll) { chatScroll.attachTail(); chatScroll.refresh(); }
    else requestAnimationFrame(() => { if (ui.messages) ui.messages.scrollTop = ui.messages.scrollHeight; });
  }

  function syncAgentSelect() {
    const agentId = getConversationAgentId();
    ui.agentSelect.disabled = isStreaming || availableAgents.length === 0;
    if (agentId && ui.agentSelect.value !== agentId) ui.agentSelect.value = agentId;
    const selected = availableAgents.find((agent) => agent.id === agentId);
    ui.agentSelect.title = selected?.description || 'Hafize ajanı';
  }

  function syncToolMode() {
    let enabled = Boolean(getActiveConversation()?.toolsEnabled);
    ui.toolModeBtn.disabled = isStreaming || !getConversationAgentId() || ui.providerSelect.value === 'local';
    if (ui.providerSelect.value === 'local' && enabled) {
      const active = getActiveConversation();
      if (active) active.toolsEnabled = false;
      saveConversations();
      enabled = false;
    }
    ui.toolModeBtn.setAttribute('aria-pressed', String(enabled));
    ui.toolModeBtn.textContent = ui.providerSelect.value === 'local' ? '⌘ Yerel · araçsız' : enabled ? '⌘ Araçlar açık' : '⌘ Araçlar';
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
    // An empty box is always its resting size, whatever the layout looked like when it was cleared.
    if (!ui.messageInput.value) { ui.messageInput.style.height = ''; return; }
    ui.messageInput.style.height = 'auto';
    ui.messageInput.style.height = `${Math.min(ui.messageInput.scrollHeight, 180)}px`;
  }

  async function loadModels() {
    const provider = ui.providerSelect.value === 'local' ? 'local' : 'nvidia';
    const providerLabel = provider === 'local' ? 'Yerel modeller' : 'NVIDIA modelleri';
    ui.modelSelect.replaceChildren(new Option(`${providerLabel} yükleniyor…`, ''));
    try {
      const payload = await hafizeApi.models(provider);
      const models = payload.models;
      ui.modelSelect.replaceChildren();
      if (!models.length) {
        ui.modelSelect.append(new Option(provider === 'local' ? 'Yerel model bulunamadı' : 'NVIDIA modeli bulunamadı', ''));
        return;
      }
      for (const model of models) ui.modelSelect.append(new Option(model, model));
      serverDefaultModel = payload.defaultModel || '';
      // The model picker is not shown, so the server's recommended model wins over an old saved choice.
      const preference = loadModelPreferences();
      if (payload.defaultModel) ui.modelSelect.value = payload.defaultModel;
      else if (preference.selectedModel && models.includes(preference.selectedModel)) ui.modelSelect.value = preference.selectedModel;
      modelPreferencesController?.refresh();
    } catch (error) {
      ui.modelSelect.replaceChildren(new Option(provider === 'local' ? 'Ollama bağlantısı bekleniyor' : 'NVIDIA NIM bağlantısı bekleniyor', ''));
      if (error instanceof Error && error.message !== 'NVIDIA_NOT_CONFIGURED') showToast(provider === 'local' ? 'Yerel model listesi alınamadı. Ollama’nın çalıştığını kontrol et.' : 'NVIDIA model listesi alınamadı.');
    }
  }

  async function loadProviders() {
    try {
      const health = await hafizeApi.health();
      const localOption = [...ui.providerSelect.options].find((option) => option.value === 'local');
      if (localOption) localOption.hidden = !health.localModelEnabled;
      const savedProvider = localStorage.getItem('hafize.model-provider.v1');
      if (health.localModelEnabled && savedProvider === 'local') ui.providerSelect.value = 'local';
      else if (health.localModelEnabled && !health.nvidiaConfigured) ui.providerSelect.value = 'local';
      else ui.providerSelect.value = 'nvidia';
    } catch {
      ui.providerSelect.value = 'nvidia';
    }
    syncToolMode();
    await loadModels();
  }

  async function loadAgents() {
    ui.agentSelect.disabled = true;
    ui.agentSelect.replaceChildren(new Option('Ajanlar yükleniyor…', ''));
    try {
      const payload = await hafizeApi.agents();
      const agents = payload.agents;
      const fallback = payload.defaultAgent;
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
      const preference = loadModelPreferences();
      if (!getActiveConversation()?.agentId && preference.selectedAgentId && allowedIds.has(preference.selectedAgentId)) {
        const active = getActiveConversation();
        if (active) active.agentId = preference.selectedAgentId;
      }
      syncAgentSelect();
      syncToolMode();
      modelPreferencesController?.refresh();
    } catch {
      availableAgents = [];
      defaultAgentId = '';
      ui.agentSelect.replaceChildren(new Option('Ajan listesi kullanılamıyor', ''));
      ui.agentSelect.disabled = true;
      showToast('Hafize ajan listesi alınamadı.');
    }
  }

  function ensureStreamStatus(): HTMLElement | null {
    if (streamStatus && document.body.contains(streamStatus)) return streamStatus;
    streamStatus = document.createElement('div');
    streamStatus.className = 'stream-status';
    streamStatus.hidden = true;
    streamStatus.setAttribute('role', 'status');
    streamStatus.setAttribute('aria-live', 'polite');
    streamStatus.setAttribute('aria-atomic', 'true');
    ui.composer.insertBefore(streamStatus, ui.composer.querySelector('.composer-row'));
    return streamStatus;
  }

  function renderStreamStatus(snapshot = streamState.snapshot()): void {
    const node = ensureStreamStatus();
    if (!node) return;
    globalThis.clearTimeout(streamStatusTimer);
    const visible = snapshot.phase !== 'idle';
    node.hidden = !visible;
    node.dataset.phase = snapshot.phase;
    node.dataset.tone = phaseTone(snapshot.phase);
    if (!visible) {
      node.textContent = '';
      return;
    }
    const suffix = snapshot.phase === 'completed'
      ? ` · ${formatStreamDuration(snapshot.durationMs)} · ${formatStreamBytes(snapshot.bytesRead)}`
      : snapshot.phase === 'failed'
        ? ` · ${snapshot.errorCode || 'akış hatası'}`
        : snapshot.phase === 'aborted'
          ? ' · kullanıcı tarafından durduruldu'
          : '';
    node.textContent = `${phaseLabel(snapshot.phase)}${suffix}`;
    if (snapshot.phase === 'completed' || snapshot.phase === 'failed' || snapshot.phase === 'aborted') {
      streamStatusTimer = globalThis.setTimeout(() => {
        streamState.reset();
        renderStreamStatus();
      }, 5000);
    }
  }

  streamState.subscribe(renderStreamStatus);

  function getRequestMessages(conversation = getActiveConversation()) {
    return (conversation?.messages ?? [])
      .filter((message) => message.content)
      .map(({ role, content }) => ({ role, content }));
  }

  async function handleAssistantStreamEvent(
    event: HafizeSseEvent,
    assistantId: string,
    appendContent: (delta: string) => void
  ): Promise<void> {
    if (handleAgentEvent(event.type, event.payload, { assistantId, showToast })) return;
    if (event.type === 'hafize-skill-consent-required') {
      const request = event.payload && typeof event.payload === 'object' ? event.payload as Record<string, any> : {};
      const scopes = Array.isArray(request.scopes) ? request.scopes.filter((scope) => typeof scope === 'string') : [];
      const skillId = typeof request.skillId === 'string' ? request.skillId : '';
      const args = request.arguments && typeof request.arguments === 'object' ? JSON.stringify(request.arguments, null, 2).slice(0, 1_200) : '{}';
      const summary = `${request.description || skillId}\n\nİstenen izinler: ${scopes.join(', ')}\nRisk: ${request.riskLevel || 'bilinmiyor'}\n\nArgümanlar:\n${args}\n\nBu çağrı için bir defalık izin verilsin mi?`;
      if (!skillId || !scopes.length || typeof request.argsHash !== 'string' || !window.confirm(summary)) return;
      const choice = window.prompt('İzin kapsamı: 1 = bu çağrı, 2 = bu oturum, 3 = her zaman, 4 = asla', '1');
      const mode = ({ '1': 'once', '2': 'session', '3': 'always', '4': 'never' } as Record<string, string>)[String(choice || '').trim()];
      if (!mode) return;
      try {
        await hafizeApi.grantSkillConsent({ skillId, scopes, mode, ...(mode === 'once' ? { argsHash: request.argsHash } : {}) });
      } catch {
        showToast('Skill izni kaydedilemedi.');
        return;
      }
      showToast(mode === 'never' ? 'Bu skill için izin kalıcı olarak reddedildi.' : 'Skill izni kaydedildi. Aynı isteği yeniden göndererek devam edebilirsin.');
      return;
    }
    if (event.type === 'hafize-memory') {
      applyMemoryUpdate(event.payload);
      return;
    }
    if (event.type === 'hafize-tool-activity') {
      appendToolActivity(assistantId, event.payload);
      return;
    }
    if (event.type !== 'message' || !event.payload || typeof event.payload !== 'object') return;
    const payload = event.payload as Record<string, any>;
    if (typeof payload.error === 'string' && payload.error) throw new Error(payload.error);
    // NVIDIA reports mid-stream failures as an error object; without this the turn ends as a blank reply.
    if (payload.error && typeof payload.error === 'object') {
      throw new Error(String(payload.error.message || payload.error.code || payload.error.type || 'NVIDIA_STREAM_ERROR').slice(0, 200));
    }
    const delta = payload.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) appendContent(delta);
  }

  // Long-term memory lives in this browser, next to the chat history; it is sent with each
  // request so the model knows the user, and save/forget decisions come back as stream events.
  const MEMORY_KEY = 'hafize.memory.v1';
  function loadMemory(): { id: string; text: string; createdAt?: string }[] {
    try {
      const value = JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
      return Array.isArray(value) ? value.filter((note) => note && typeof note.id === 'string' && typeof note.text === 'string').slice(0, 60) : [];
    } catch {
      return [];
    }
  }
  function memoryForRequest() {
    return loadMemory().map(({ id, text }) => ({ id, text }));
  }
  function applyMemoryUpdate(update) {
    const notes = loadMemory();
    if (update?.action === 'save' && typeof update.id === 'string' && typeof update.text === 'string') {
      if (!notes.some((note) => note.id === update.id)) notes.push({ id: update.id, text: update.text.slice(0, 300), createdAt: new Date().toISOString() });
      showToast(`Hafize bunu hatırlayacak: ${update.text.slice(0, 90)}`);
    } else if (update?.action === 'forget' && typeof update.id === 'string') {
      const index = notes.findIndex((note) => note.id === update.id);
      if (index === -1) return;
      notes.splice(index, 1);
      showToast('Hafize bu bilgiyi unuttu.');
    } else {
      return;
    }
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(notes)); } catch {}
    window.dispatchEvent(new CustomEvent('hafize:memory-changed'));
  }

  function describeChatFailure(error): string {
    const code = String(error?.code || error?.message || '');
    const status = Number(error?.status) || 0;
    if (error?.message === 'OFFLINE') return 'İnternet bağlantısı bulunamadı.';
    if (error?.message === 'MODEL_REQUIRED') return 'Bir NVIDIA modeli seçilmedi.';
    if (error?.message === 'AGENT_REQUIRED') return 'Bir Hafize ajanı seçilmedi.';
    if (status === 404 || status === 410) {
      const failed = ui.modelSelect.value;
      const fallback = serverDefaultModel && serverDefaultModel !== failed && [...ui.modelSelect.options].some((option) => option.value === serverDefaultModel)
        ? serverDefaultModel
        : '';
      [...ui.modelSelect.options].find((option) => option.value === failed && failed !== serverDefaultModel)?.remove();
      if (fallback) {
        ui.modelSelect.value = fallback;
        ui.modelSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return `"${failed}" modeli NVIDIA'da şu an kullanılamıyor. Model "${fallback}" olarak değiştirildi; mesajını tekrar gönderebilir ya da "Yeniden dene"ye basabilirsin.`;
      }
      return `"${failed}" modeli NVIDIA'da şu an kullanılamıyor. Listeden başka bir model seç.`;
    }
    if (status === 429 || code === 'RATE_LIMITED') return 'Çok kısa sürede çok fazla istek gönderildi. Birkaç saniye bekleyip tekrar dene.';
    if (code === 'SSE_TIMEOUT') return 'Yanıt çok uzun sürdü ve zaman aşımına uğradı. NVIDIA sunucuları yoğun olabilir; biraz sonra tekrar dene.';
    if (code === 'SSE_NETWORK_ERROR') return 'Hafize sunucusuna ulaşılamadı. Sunucu penceresinin açık olduğundan emin ol.';
    const detail = String(error?.message || '');
    if (status >= 500 || [code, detail].some((value) => value === 'NVIDIA_CHAT_ERROR' || value === 'STREAM_INTERRUPTED' || value === 'NVIDIA_STREAM_ERROR')) return 'NVIDIA şu an yanıt vermedi ya da yanıt yarıda kesildi. Birkaç saniye sonra "Yeniden dene"ye bas.';
    return `Yanıt alınamadı: ${error?.message || 'bilinmeyen hata'}`;
  }

  async function consumeAssistantStream(
    endpoint: string,
    payload: Record<string, unknown>,
    assistantId: string,
    emptyMessage: string,
    timeoutMs = 60_000
  ): Promise<HafizeSseStats> {
    let content = '';
    streamState.begin();
    renderStreamStatus();
    try {
      const stats = await hafizeSse.stream(endpoint, payload, {
      timeoutMs,
      maxFrameChars: 128 * 1024,
      maxBufferChars: 256 * 1024,
      maxEvents: 20_000,
        onEvent: async (event) => {
          streamState.chunk(0, 1);
          await handleAssistantStreamEvent(event, assistantId, (delta) => {
            content += delta;
            updateMessage(assistantId, content);
          });
          renderStreamStatus();
        }
      });
      streamState.complete({
        traceId: stats.traceId,
        bytesRead: stats.bytesRead,
        events: stats.events,
        durationMs: stats.durationMs,
        endedAt: Date.now()
      });
      renderStreamStatus();
      updateMessage(assistantId, content || emptyMessage, { persist: true });
      return stats;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code || 'SSE_ERROR')
        : '';
      if (code === 'SSE_ABORTED' || code === 'AbortError') streamState.abort(error);
      else streamState.fail(error);
      renderStreamStatus();
      throw error;
    }
  }

  async function streamAssistantReply() {
    const model = ui.modelSelect.value;
    if (!model) throw new Error('MODEL_REQUIRED');

    const conversation = getActiveConversation();
    const agentId = getConversationAgentId(conversation);
    if (!agentId) throw new Error('AGENT_REQUIRED');
    const requestMessages = getRequestMessages(conversation);
    const startedAt = performance.now();

    const assistantId = addMessage('assistant', '', { persist: false });
    const stats = await consumeAssistantStream(
      '/api/chat',
      { model, agentId, messages: requestMessages, memory: memoryForRequest(), max_tokens: 4096, provider: ui.providerSelect.value },
      assistantId,
      ui.providerSelect.value === 'local' ? 'Yerel model boş bir yanıt döndürdü.' : 'NVIDIA modeli boş bir yanıt döndürdü.',
      ui.providerSelect.value === 'local' ? 180_000 : 60_000
    );
    const generated = conversation.messages.find((entry) => entry.id === assistantId);
    if (generated) {
      generated.generation = {
        model,
        agentId,
        toolsEnabled: false,
        generatedAt: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(stats.durationMs || performance.now() - startedAt))
      };
      saveConversations();
    }
  }

  async function runAssistantWithTools() {
    const model = ui.modelSelect.value;
    if (!model) throw new Error('MODEL_REQUIRED');

    const conversation = getActiveConversation();
    const agentId = getConversationAgentId(conversation);
    if (!agentId) throw new Error('AGENT_REQUIRED');
    const requestMessages = getRequestMessages(conversation);
    const startedAt = performance.now();

    const assistantId = addMessage('assistant', '', { persist: false });
    const stats = await consumeAssistantStream(
      '/api/agent/run',
      { model, agentId, conversationId: conversation.id, messages: requestMessages, memory: memoryForRequest(), max_tokens: 4096 },
      assistantId,
      'Ajan araçları çalıştırdı ancak model boş bir yanıt döndürdü.',
      AGENT_RUN_TIMEOUT_MS
    );
    const generated = conversation.messages.find((entry) => entry.id === assistantId);
    if (generated) {
      generated.generation = {
        model,
        agentId,
        toolsEnabled: true,
        generatedAt: new Date().toISOString(),
        durationMs: Math.max(0, Math.round(stats.durationMs || performance.now() - startedAt))
      };
      saveConversations();
    }
  }

  function setAssistantFeedback(messageId, feedback) {
    if (isStreaming) return;
    const conversation = getActiveConversation();
    const message = conversation?.messages.find((candidate) => candidate.id === messageId && candidate.role === 'assistant');
    if (!message) return;
    if (feedback === 'positive' || feedback === 'negative') message.feedback = feedback;
    else delete message.feedback;
    saveConversations();
    render();
    showToast(feedback === 'positive' ? 'Yanıt beğenildi.' : feedback === 'negative' ? 'Yanıt beğenilmedi.' : 'Yanıt geri bildirim etiketi kaldırıldı.');
  }

  function setGenerationUi(disabled) {
    ui.messages.setAttribute('aria-busy', String(disabled));
    ui.messageInput.disabled = disabled;
    ui.agentSelect.disabled = disabled;
    ui.providerSelect.disabled = disabled;
    ui.toolModeBtn.disabled = disabled;
    if (!disabled) {
      syncAgentSelect();
      syncToolMode();
    }
  }

  async function regenerateAssistantMessage(messageId, instruction = '') {
    if (isStreaming) return;
    if (!networkOnline) return showToast('İnternet bağlantısı yok; yanıt yeniden üretilemez.');
    const conversation = getActiveConversation();
    if (!conversation) return;
    const index = conversation.messages.findIndex((message) => message.id === messageId && message.role === 'assistant');
    if (index < 0) return showToast('Yeniden üretilecek asistan yanıtı bulunamadı.');
    if (!canRegenerateResponse(conversation.messages, index)) return showToast('Yalnızca konuşmadaki son asistan yanıtı yeniden üretilebilir.');
    const model = ui.modelSelect.value;
    if (!model) return showToast(ui.providerSelect.value === 'local' ? 'Önce çalışan bir yerel model seç.' : 'Önce NVIDIA NIM bağlantısının hazır olması gerekiyor.');
    const agentId = getConversationAgentId(conversation);
    if (!agentId) return showToast('Önce Hafize ajan listesinin hazır olması gerekiyor.');

    const message = conversation.messages[index];
    const previousContent = message.content;
    const requestMessages = buildRegenerationMessages(
      conversation.messages.slice(0, index),
      instruction
    );
    const startedAt = performance.now();
    message.content = '';
    message.toolActivities = [];
    isStreaming = true;
    setGenerationUi(true);
    chatScroll?.setThinking(true);
    render();

    try {
      const useTools = conversation.toolsEnabled && ui.providerSelect.value !== 'local';
      const endpoint = useTools ? '/api/agent/run' : '/api/chat';
      await consumeAssistantStream(
        endpoint,
        { model, agentId, conversationId: conversation.id, messages: requestMessages, memory: memoryForRequest(), max_tokens: 4096, ...(useTools ? {} : { provider: ui.providerSelect.value }) },
        message.id,
        useTools
          ? 'Ajan araçları çalıştırdı ancak model boş bir yanıt döndürdü.'
          : 'NVIDIA modeli boş bir yanıt döndürdü.',
        useTools ? AGENT_RUN_TIMEOUT_MS : 60_000
      );
      message.alternates = rememberResponseAlternate(message.alternates, previousContent);
      message.generation = createGenerationSnapshot(
        model,
        agentId,
        useTools,
        performance.now() - startedAt
      );
      saveConversations();
      render();
      showToast('Yeni asistan yanıtı üretildi. Önceki yanıt geri alınabilir.');
    } catch (error) {
      message.content = previousContent;
      message.toolActivities = [];
      saveConversations();
      render();
      showToast('Yanıt yeniden üretilemedi: ' + (error?.message || 'bilinmeyen hata'));
    } finally {
      isStreaming = false;
      setGenerationUi(false);
      chatScroll?.setThinking(false);
      ui.messageInput.focus();
    }
  }

  function restorePreviousAssistantMessage(messageId) {
    if (isStreaming) return;
    const conversation = getActiveConversation();
    const message = conversation?.messages.find((candidate) => candidate.id === messageId && candidate.role === 'assistant');
    if (!message || !Array.isArray(message.alternates) || !message.alternates.length) return;
    const rotated = restoreLatestResponseAlternate(message.content, message.alternates);
    if (!rotated) return;
    message.content = rotated.current;
    message.alternates = rotated.alternates;
    message.generation = createGenerationSnapshot(
      message.generation?.model || '',
      message.generation?.agentId || '',
      message.generation?.toolsEnabled === true,
      message.generation?.durationMs ?? null
    );
    saveConversations();
    render();
    showToast('Önceki asistan yanıtı geri getirildi.');
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
    setGenerationUi(true);
    chatScroll?.setThinking(true);

    try {
      await globalThis.HafizeLiveScreen?.beforeSend?.(clean);
      if (getActiveConversation()?.toolsEnabled) await runAssistantWithTools();
      else await streamAssistantReply();
    } catch (error) {
      const message = describeChatFailure(error);
      const conversation = getActiveConversation();
      const last = conversation?.messages.at(-1);
      if (last?.role === 'assistant' && !last.content) updateMessage(last.id, message, { persist: true });
      else addMessage('assistant', message);
    } finally {
      isStreaming = false;
      setGenerationUi(false);
      chatScroll?.setThinking(false);
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
    showToast('İnternet bağlantısı kesildi.');
  }

  function persistOnLifecycle() {
    if (!isStreaming) saveConversations();
  }

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('beforeunload', () => { persistOnLifecycle(); streamState.destroy(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistOnLifecycle(); });

  window.addEventListener('hafize:edit-message', (event) => beginMessageEdit(event.detail?.messageId));
  window.addEventListener('hafize:open-conversation', (event) => {
    if (isStreaming) return showToast('Yanıt sürerken sohbet değiştirilemez.');
    const conversationId = typeof event.detail?.conversationId === 'string' ? event.detail.conversationId : '';
    if (!conversationId || !conversations.some((conversation) => conversation.id === conversationId)) return;
    if (editingMessageId) cancelMessageEdit();
    activeConversationId = conversationId;
    render();
    if (window.innerWidth <= 900) ui.sidebar.classList.remove('open');
    ui.messageInput.focus();
  });

  ui.newChatBtn.addEventListener('click', () => {
    if (isStreaming) return showToast('Yanıt sürerken yeni sohbet açılamaz.');
    // Reuse an untouched empty chat instead of stacking "Yeni sohbet" entries.
    const empty = conversations.find((conversation) => !conversation.messages.length);
    if (empty) {
      activeConversationId = empty.id;
      render();
      ui.messageInput.focus();
    } else {
      createConversation();
    }
    if (window.innerWidth <= 900) ui.sidebar.classList.remove('open');
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
      ? 'Araçlar açık: Hafize gerektiğinde internetten güncel bilgi alır.'
      : 'Araçlar kapalı: Hafize internete bakmadan, yalnızca kendi bilgisiyle yanıt verir.');
  });
  ui.providerSelect.addEventListener('change', () => {
    try { localStorage.setItem('hafize.model-provider.v1', ui.providerSelect.value); } catch {}
    syncToolMode();
    void loadModels();
    showToast(ui.providerSelect.value === 'local' ? 'Yerel Ollama sağlayıcısı seçildi. Araç çağrıları yerel modelde kapalıdır.' : 'NVIDIA NIM sağlayıcısı seçildi.');
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
    button.addEventListener('click', () => {
      ui.messageInput.value = button.dataset.prompt || '';
      ui.messageInput.dispatchEvent(new Event('input', { bubbles: true }));
      ui.messageInput.focus();
    });
  });

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
    window.addEventListener('load', () => {
      const serviceWorkerUrl = import.meta.env.DEV ? '/sw.ts' : '/typed-build/sw.js';
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (navigator.serviceWorker.controller) globalThis.location.reload();
      }, { once: true });
      // The script lives under /typed-build/, so without an explicit scope it never controlled the app.
      navigator.serviceWorker.register(serviceWorkerUrl, { type: 'module', scope: '/' })
        .then((registration) => registration.update())
        .catch(() => undefined);
    });
  }

  if (!activeConversationId) createConversation();
  else render();

  // Auto-follow while the answer streams, jump button when the user scrolls up, thinking bubble.
  chatScroll = mountChatScroll({ messages: ui.messages, documentRef: document });
  if (chatScroll) chatScroll.refresh();

  modelPreferencesController = mountModelPreferences({
    modelSelect: ui.modelSelect,
    agentSelect: ui.agentSelect,
    toolModeButton: ui.toolModeBtn,
    getCurrent: () => ({
      model: ui.modelSelect.value,
      agentId: getConversationAgentId(),
      toolsEnabled: Boolean(getActiveConversation()?.toolsEnabled)
    }),
    getChoices: () => ({
      models: [...ui.modelSelect.options]
        .filter((option) => option.value)
        .map((option) => ({ id: option.value, label: option.textContent || option.value })),
      agents: availableAgents.map((agent) => ({ id: agent.id, label: agent.name }))
    }),
    apply: (selection) => {
      if (isStreaming) return showToast('Yanıt sürerken model veya ajan profili uygulanamaz.');
      if (selection.model && [...ui.modelSelect.options].some((option) => option.value === selection.model)) {
        ui.modelSelect.value = selection.model;
      }
      const active = getActiveConversation();
      if (!active) createConversation();
      const conversation = getActiveConversation();
      if (conversation && availableAgents.some((agent) => agent.id === selection.agentId)) {
        conversation.agentId = selection.agentId;
        conversation.toolsEnabled = selection.toolsEnabled === true;
        saveConversations();
        syncAgentSelect();
        syncToolMode();
        renderMessages();
      }
    }
  });

  void loadProviders();
  loadAgents();
})();


