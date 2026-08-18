(function exposeHafizeConversationStorageGuard(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeConversationStorageGuard = api;
    const install = () => api.install(root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationStorageGuard() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES_PER_CONVERSATION = 200;
  const MAX_MESSAGE_CHARS = 12_000;
  const MAX_TITLE_CHARS = 80;
  const MAX_ID_CHARS = 120;
  const MAX_TOOL_ACTIVITIES = 4;
  const MAX_TOOL_LABEL_CHARS = 80;
  const ALLOWED_ROLES = new Set(['user', 'assistant']);
  const ALLOWED_TOOL_STATES = new Set(['running', 'success', 'failure']);
  const ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
  const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,119}$/;

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
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const label = normalizeText(value.label, MAX_TOOL_LABEL_CHARS);
    if (!label) return null;
    let state = null;
    if (typeof value.state === 'string' && ALLOWED_TOOL_STATES.has(value.state)) state = value.state;
    else if (typeof value.ok === 'boolean') state = value.ok ? 'success' : 'failure';
    if (!state) return null;
    return Object.freeze({ label, state });
  }

  function normalizeMessage(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = normalizeId(value.id);
    const role = ALLOWED_ROLES.has(value.role) ? value.role : null;
    const content = normalizeText(value.content, MAX_MESSAGE_CHARS, { allowEmpty: role === 'assistant' });
    const at = normalizeIsoTimestamp(value.at);
    if (!id || !role || content == null || !at) return null;

    const result = { id, role, content, at };
    if (role === 'assistant' && Array.isArray(value.toolActivities)) {
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

  function normalizeConversation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = normalizeId(value.id);
    const title = normalizeText(value.title, MAX_TITLE_CHARS) || 'Yeni sohbet';
    const createdAt = normalizeIsoTimestamp(value.createdAt);
    const updatedAt = normalizeIsoTimestamp(value.updatedAt);
    if (!id || !createdAt || !updatedAt) return null;

    const messages = [];
    const seenMessageIds = new Set();
    if (Array.isArray(value.messages)) {
      for (const candidate of value.messages) {
        if (messages.length >= MAX_MESSAGES_PER_CONVERSATION) break;
        const message = normalizeMessage(candidate);
        if (!message || seenMessageIds.has(message.id)) continue;
        seenMessageIds.add(message.id);
        messages.push(message);
      }
    }

    return Object.freeze({
      id,
      title,
      agentId: normalizeAgentId(value.agentId),
      toolsEnabled: value.toolsEnabled === true,
      createdAt,
      updatedAt,
      messages
    });
  }

  function normalizeConversations(value) {
    if (!Array.isArray(value)) return Object.freeze([]);
    const conversations = [];
    const seenIds = new Set();
    for (const candidate of value) {
      if (conversations.length >= MAX_CONVERSATIONS) break;
      const conversation = normalizeConversation(candidate);
      if (!conversation || seenIds.has(conversation.id)) continue;
      seenIds.add(conversation.id);
      conversations.push(conversation);
    }
    conversations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
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

  function install(rootRef) {
    const storage = rootRef?.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return null;

    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch {
      return Object.freeze({ changed: false, reloaded: false, error: 'storage_unavailable' });
    }
    if (raw == null) return Object.freeze({ changed: false, reloaded: false, error: null });

    const result = sanitizeStoredValue(raw);
    if (!result.changed) return Object.freeze({ changed: false, reloaded: false, error: null });

    try {
      storage.setItem(STORAGE_KEY, result.serialized);
    } catch {
      return Object.freeze({ changed: false, reloaded: false, error: 'storage_write_failed' });
    }

    const marker = 'hafizeConversationStorageGuardReloaded';
    let reloaded = false;
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
      // Sanitized data is already persisted; reload is best-effort only.
    }
    return Object.freeze({ changed: true, reloaded, error: null, reason: result.reason });
  }

  return Object.freeze({
    STORAGE_KEY,
    MAX_CONVERSATIONS,
    MAX_MESSAGES_PER_CONVERSATION,
    MAX_MESSAGE_CHARS,
    MAX_TITLE_CHARS,
    MAX_ID_CHARS,
    MAX_TOOL_ACTIVITIES,
    MAX_TOOL_LABEL_CHARS,
    normalizeId,
    normalizeAgentId,
    normalizeIsoTimestamp,
    normalizeToolActivity,
    normalizeMessage,
    normalizeConversation,
    normalizeConversations,
    sanitizeStoredValue,
    install
  });
});
