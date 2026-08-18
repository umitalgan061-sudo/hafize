(function exposeHafizeConversationStorageGuard(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeConversationStorageGuard = api;
    api.install(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationStorageGuard() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const MAX_CONVERSATIONS = 30;
  const MAX_CONVERSATION_CANDIDATES = 120;
  const MAX_MESSAGES_PER_CONVERSATION = 200;
  const MAX_MESSAGE_CHARS = 12_000;
  const MAX_CONVERSATION_CONTENT_CHARS = 120_000;
  const MAX_TOTAL_CONTENT_CHARS = 1_200_000;
  const MAX_TITLE_CHARS = 80;
  const MAX_ID_CHARS = 120;
  const MAX_TOOL_ACTIVITIES = 4;
  const MAX_TOOL_LABEL_CHARS = 80;
  const ALLOWED_ROLES = new Set(['user', 'assistant']);
  const ALLOWED_TOOL_STATES = new Set(['running', 'success', 'failure']);
  const ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
  const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/;
  const INSTALLATIONS = new WeakMap();

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function normalizeText(value, maxChars, { allowEmpty = false } = {}) {
    if (typeof value !== 'string') return null;
    const text = value.normalize('NFC').replace(/\u0000/g, '').slice(0, maxChars);
    if (!allowEmpty && !text.trim()) return null;
    return text;
  }

  function normalizeId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim();
    return ID_PATTERN.test(id) ? id : null;
  }

  function normalizeAgentId(value) {
    if (typeof value !== 'string') return '';
    const id = value.trim();
    return AGENT_ID_PATTERN.test(id) ? id : '';
  }

  function normalizeIsoTimestamp(value) {
    if (typeof value !== 'string' || value.length > 40) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }

  function normalizeToolActivity(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !hasOwn(value, 'label')) return null;
    const label = normalizeText(value.label, MAX_TOOL_LABEL_CHARS);
    if (!label) return null;
    let state = null;
    if (hasOwn(value, 'state') && typeof value.state === 'string' && ALLOWED_TOOL_STATES.has(value.state)) state = value.state;
    else if (hasOwn(value, 'ok') && typeof value.ok === 'boolean') state = value.ok ? 'success' : 'failure';
    if (!state) return null;
    return Object.freeze({ label, state });
  }

  function normalizeMessage(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!['id', 'role', 'content', 'at'].every((key) => hasOwn(value, key))) return null;
    const id = normalizeId(value.id);
    const role = ALLOWED_ROLES.has(value.role) ? value.role : null;
    const content = normalizeText(value.content, MAX_MESSAGE_CHARS, { allowEmpty: role === 'assistant' });
    const at = normalizeIsoTimestamp(value.at);
    if (!id || !role || content == null || !at) return null;

    const result = { id, role, content, at };
    if (role === 'assistant' && hasOwn(value, 'toolActivities') && Array.isArray(value.toolActivities)) {
      const activities = [];
      for (const candidate of value.toolActivities) {
        if (activities.length >= MAX_TOOL_ACTIVITIES) break;
        const activity = normalizeToolActivity(candidate);
        if (activity) activities.push(activity);
      }
      if (activities.length) result.toolActivities = activities;
    }
    return Object.freeze(result);
  }

  function normalizeMessages(values, contentBudget = MAX_CONVERSATION_CONTENT_CHARS) {
    if (!Array.isArray(values) || !Number.isInteger(contentBudget) || contentBudget < 0) return Object.freeze([]);
    const messages = [];
    const seenMessageIds = new Set();
    let contentChars = 0;
    for (let index = values.length - 1; index >= 0 && messages.length < MAX_MESSAGES_PER_CONVERSATION; index -= 1) {
      const message = normalizeMessage(values[index]);
      if (!message || seenMessageIds.has(message.id)) continue;
      if (contentChars + message.content.length > contentBudget) continue;
      seenMessageIds.add(message.id);
      messages.push(message);
      contentChars += message.content.length;
    }
    messages.reverse();
    return Object.freeze(messages);
  }

  function conversationContentChars(conversation) {
    if (!conversation || !Array.isArray(conversation.messages)) return 0;
    return conversation.messages.reduce((total, message) => total + (typeof message?.content === 'string' ? message.content.length : 0), 0);
  }

  function normalizeConversation(value, contentBudget = MAX_CONVERSATION_CONTENT_CHARS) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!['id', 'createdAt', 'updatedAt', 'messages'].every((key) => hasOwn(value, key))) return null;
    const id = normalizeId(value.id);
    const title = hasOwn(value, 'title') ? normalizeText(value.title, MAX_TITLE_CHARS) || 'Yeni sohbet' : 'Yeni sohbet';
    const createdAt = normalizeIsoTimestamp(value.createdAt);
    const updatedAt = normalizeIsoTimestamp(value.updatedAt);
    if (!id || !createdAt || !updatedAt || !Array.isArray(value.messages)) return null;

    return Object.freeze({
      id,
      title,
      agentId: hasOwn(value, 'agentId') ? normalizeAgentId(value.agentId) : '',
      toolsEnabled: hasOwn(value, 'toolsEnabled') && value.toolsEnabled === true,
      createdAt,
      updatedAt,
      messages: normalizeMessages(value.messages, Math.min(contentBudget, MAX_CONVERSATION_CONTENT_CHARS))
    });
  }

  function normalizeConversations(value) {
    if (!Array.isArray(value)) return Object.freeze([]);
    const candidates = [];
    const seenIds = new Set();
    const scanLimit = Math.min(value.length, MAX_CONVERSATION_CANDIDATES);
    for (let index = 0; index < scanLimit; index += 1) {
      const conversation = normalizeConversation(value[index]);
      if (!conversation || seenIds.has(conversation.id)) continue;
      seenIds.add(conversation.id);
      candidates.push(conversation);
    }
    candidates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    const conversations = [];
    let remainingContentChars = MAX_TOTAL_CONTENT_CHARS;
    for (const candidate of candidates) {
      if (conversations.length >= MAX_CONVERSATIONS) break;
      const originalCount = candidate.messages.length;
      const conversation = remainingContentChars >= conversationContentChars(candidate)
        ? candidate
        : normalizeConversation(candidate, remainingContentChars);
      const contentChars = conversationContentChars(conversation);
      if (originalCount > 0 && conversation.messages.length === 0) break;
      conversations.push(conversation);
      remainingContentChars -= contentChars;
      if (remainingContentChars <= 0) break;
    }
    return Object.freeze(conversations);
  }

  function canonicalJson(value) {
    return JSON.stringify(value);
  }

  function sanitizeStoredValue(rawValue) {
    if (typeof rawValue !== 'string' || !rawValue) {
      return Object.freeze({ changed: false, value: [], serialized: '[]', reason: null });
    }
    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return Object.freeze({ changed: true, value: [], serialized: '[]', reason: 'invalid_json' });
    }
    const value = normalizeConversations(parsed);
    const serialized = canonicalJson(value);
    return Object.freeze({
      changed: serialized !== rawValue,
      value,
      serialized,
      reason: serialized !== rawValue ? 'normalized' : null
    });
  }

  function boundedSetItem(originalSetItem, receiver, key, rawValue) {
    if (key !== STORAGE_KEY) return originalSetItem.call(receiver, key, rawValue);
    const result = sanitizeStoredValue(String(rawValue));
    return originalSetItem.call(receiver, key, result.serialized);
  }

  function installWriteBoundary(storage) {
    if (!storage || typeof storage !== 'object') return null;
    const existing = INSTALLATIONS.get(storage);
    if (existing) return existing;
    if (typeof storage.setItem !== 'function') return null;

    const originalSetItem = storage.setItem;
    const instanceSetItem = function guardedConversationStorageSetItem(key, rawValue) {
      return boundedSetItem(originalSetItem, storage, key, rawValue);
    };
    let mode = 'instance';
    try {
      Object.defineProperty(storage, 'setItem', {
        configurable: true,
        writable: true,
        value: instanceSetItem
      });
    } catch {
      const prototype = Object.getPrototypeOf(storage);
      const prototypeSetItem = prototype?.setItem;
      if (!prototype || typeof prototypeSetItem !== 'function') return null;
      mode = 'prototype';
      try {
        Object.defineProperty(prototype, 'setItem', {
          configurable: true,
          writable: true,
          value: function guardedConversationStoragePrototypeSetItem(key, rawValue) {
            if (this !== storage) return prototypeSetItem.call(this, key, rawValue);
            return boundedSetItem(prototypeSetItem, storage, key, rawValue);
          }
        });
      } catch {
        return null;
      }
    }

    const boundary = Object.freeze({ mode, originalSetItem: originalSetItem.bind(storage) });
    INSTALLATIONS.set(storage, boundary);
    return boundary;
  }

  function install(rootRef) {
    const storage = rootRef?.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;

    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      return Object.freeze({ changed: false, reloaded: false, writeBoundary: false, error: 'storage_unavailable' });
    }

    let result = Object.freeze({ changed: false, value: [], serialized: '[]', reason: null });
    if (raw != null) result = sanitizeStoredValue(raw);
    if (raw != null && result.changed) {
      try {
        storage.setItem(STORAGE_KEY, result.serialized);
      } catch {
        return Object.freeze({ changed: false, reloaded: false, writeBoundary: false, error: 'storage_write_failed' });
      }
    }

    const writeBoundary = installWriteBoundary(storage);
    let reloaded = false;
    if (raw != null && result.changed) {
      const marker = 'hafizeConversationStorageGuardReloaded';
      try {
        const session = rootRef?.sessionStorage;
        const alreadyReloaded = session?.getItem?.(marker) === '1';
        if (!alreadyReloaded && typeof rootRef?.location?.reload === 'function') {
          session?.setItem?.(marker, '1');
          reloaded = true;
          rootRef.location.reload();
        } else {
          session?.removeItem?.(marker);
        }
      } catch {
        // Sanitized data is persisted; reload is best-effort only.
      }
    }
    return Object.freeze({
      changed: raw != null && result.changed,
      reloaded,
      writeBoundary: Boolean(writeBoundary),
      writeBoundaryMode: writeBoundary?.mode || null,
      error: writeBoundary ? null : 'write_boundary_unavailable',
      reason: result.reason
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    MAX_CONVERSATIONS,
    MAX_CONVERSATION_CANDIDATES,
    MAX_MESSAGES_PER_CONVERSATION,
    MAX_MESSAGE_CHARS,
    MAX_CONVERSATION_CONTENT_CHARS,
    MAX_TOTAL_CONTENT_CHARS,
    MAX_TITLE_CHARS,
    MAX_ID_CHARS,
    MAX_TOOL_ACTIVITIES,
    MAX_TOOL_LABEL_CHARS,
    normalizeId,
    normalizeAgentId,
    normalizeIsoTimestamp,
    normalizeToolActivity,
    normalizeMessage,
    normalizeMessages,
    conversationContentChars,
    normalizeConversation,
    normalizeConversations,
    sanitizeStoredValue,
    boundedSetItem,
    installWriteBoundary,
    install
  });
});