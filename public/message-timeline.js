(function exposeHafizeMessageTimeline(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizeMessageTimeline = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeMessageTimeline() {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const STYLE_ID = 'hafize-message-timeline-style';
  const TIMESTAMP_CLASS = 'message-timestamp';
  const DAY_SEPARATOR_CLASS = 'message-day-separator';
  const MAX_CONVERSATIONS = 30;
  const MAX_MESSAGES_PER_CONVERSATION = 200;
  const MAX_ID_CHARS = 120;
  const ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
  const STYLE_TEXT = `
.message .meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.message-timestamp{font-size:10px;font-weight:500;color:var(--muted,#777);opacity:.82}
.message-timestamp time{font:inherit;color:inherit}
.message-day-separator{display:flex;align-items:center;gap:10px;margin:18px 0 10px;color:var(--muted,#777);font-size:11px;font-weight:650}
.message-day-separator::before,.message-day-separator::after{content:'';height:1px;flex:1;background:var(--line,#ddd)}
.message-day-separator span{white-space:nowrap}
`;

  function normalizeId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    return clean.length <= MAX_ID_CHARS && ID_PATTERN.test(clean) ? clean : null;
  }

  function normalizeIso(value) {
    if (typeof value !== 'string' || value.length < 20 || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  function parseConversationList(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    let conversations;
    try {
      conversations = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(conversations)) return [];
    const result = [];
    const seen = new Set();
    for (const conversation of conversations.slice(0, MAX_CONVERSATIONS)) {
      const id = normalizeId(conversation?.id);
      if (!id || seen.has(id) || !Array.isArray(conversation?.messages)) continue;
      seen.add(id);
      result.push(Object.freeze({ id, messages: conversation.messages }));
    }
    return result;
  }

  function readMessageTimes(raw, conversationId) {
    const cleanConversationId = normalizeId(conversationId);
    if (!cleanConversationId) return new Map();
    const conversations = parseConversationList(raw);
    const conversation = conversations.find((item) => item.id === cleanConversationId);
    if (!conversation) return new Map();

    const times = new Map();
    for (const message of conversation.messages.slice(0, MAX_MESSAGES_PER_CONVERSATION)) {
      const id = normalizeId(message?.id);
      if (!id || times.has(id)) continue;
      const iso = normalizeIso(message?.at);
      if (iso) times.set(id, iso);
    }
    return times;
  }

  function activeConversationId(documentRef, raw) {
    const conversations = parseConversationList(raw);
    if (!conversations.length) return null;
    const rows = Array.from(documentRef?.querySelectorAll?.('#conversationList .conversation-row') || []);
    const active = rows.filter((row) => row?.classList?.contains?.('active'));
    if (active.length !== 1) return null;

    const tagged = normalizeId(active[0]?.dataset?.conversationOrganizeId);
    if (tagged && conversations.some((item) => item.id === tagged)) return tagged;

    const anyTagged = rows.some((row) => normalizeId(row?.dataset?.conversationOrganizeId));
    if (anyTagged) return null;
    const index = rows.indexOf(active[0]);
    return index >= 0 && index < conversations.length ? conversations[index].id : null;
  }

  function safeLocalParts(iso, DateImpl = Date) {
    const normalized = normalizeIso(iso);
    if (!normalized) return null;
    const date = new DateImpl(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return Object.freeze({
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      hours: date.getHours(),
      minutes: date.getMinutes()
    });
  }

  function dayKey(iso, DateImpl = Date) {
    const parts = safeLocalParts(iso, DateImpl);
    if (!parts) return null;
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month + 1).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  function formatTime(iso, IntlImpl = Intl) {
    const normalized = normalizeIso(iso);
    if (!normalized) return '';
    try {
      return new IntlImpl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(normalized));
    } catch {
      const parts = safeLocalParts(normalized);
      return parts ? `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}` : '';
    }
  }

  function formatDay(iso, now = new Date(), IntlImpl = Intl) {
    const normalized = normalizeIso(iso);
    if (!normalized) return '';
    const targetKey = dayKey(normalized);
    const todayKey = dayKey(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dayKey(yesterday.toISOString());
    if (targetKey === todayKey) return 'Bugün';
    if (targetKey === yesterdayKey) return 'Dün';
    try {
      return new IntlImpl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(normalized));
    } catch {
      return targetKey || '';
    }
  }

  function formatExact(iso, IntlImpl = Intl) {
    const normalized = normalizeIso(iso);
    if (!normalized) return '';
    try {
      return new IntlImpl.DateTimeFormat('tr-TR', {
        dateStyle: 'long',
        timeStyle: 'short'
      }).format(new Date(normalized));
    } catch {
      return normalized;
    }
  }

  function installStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.(`#${STYLE_ID}`)) return false;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    documentRef.head.append(style);
    return true;
  }

  function createController({
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
    windowRef = globalThis.window,
    MutationObserverImpl = globalThis.MutationObserver,
    IntlImpl = globalThis.Intl,
    now = () => new Date()
  } = {}) {
    if (!documentRef?.querySelector || !documentRef?.createElement) throw new Error('INVALID_MESSAGE_TIMELINE_DOCUMENT');

    let observer = null;
    let conversationObserver = null;
    let mounted = false;
    let scheduled = false;

    function readRaw() {
      try {
        return storage?.getItem?.(STORAGE_KEY) || '';
      } catch {
        return '';
      }
    }

    function loadTimes() {
      const raw = readRaw();
      const conversationId = activeConversationId(documentRef, raw);
      return readMessageTimes(raw, conversationId);
    }

    function removeSeparators(messages) {
      const separators = messages?.querySelectorAll?.(`.${DAY_SEPARATOR_CLASS}`) || [];
      for (const separator of separators) separator.remove?.();
    }

    function ensureTimestamp(article, iso) {
      const meta = article?.querySelector?.('.meta');
      if (!meta) return false;
      let wrapper = meta.querySelector?.(`.${TIMESTAMP_CLASS}`);
      if (!wrapper) {
        wrapper = documentRef.createElement('span');
        wrapper.className = TIMESTAMP_CLASS;
        const time = documentRef.createElement('time');
        wrapper.append(time);
        meta.append(wrapper);
      }
      const time = wrapper.querySelector?.('time');
      if (!time) return false;
      time.dateTime = iso;
      time.textContent = formatTime(iso, IntlImpl);
      time.title = formatExact(iso, IntlImpl);
      time.setAttribute?.('aria-label', `Gönderim zamanı: ${time.title}`);
      return true;
    }

    function clearTimestamp(article) {
      article?.querySelector?.(`.${TIMESTAMP_CLASS}`)?.remove?.();
    }

    function insertDaySeparator(messages, article, iso) {
      const label = formatDay(iso, now(), IntlImpl);
      if (!label) return false;
      const separator = documentRef.createElement('div');
      separator.className = DAY_SEPARATOR_CLASS;
      separator.setAttribute('role', 'separator');
      separator.setAttribute('aria-label', label);
      separator.dataset.day = dayKey(iso) || '';
      const text = documentRef.createElement('span');
      text.textContent = label;
      separator.append(text);
      messages.insertBefore(separator, article);
      return true;
    }

    function render() {
      const messages = documentRef.querySelector('#messages');
      if (!messages) return Object.freeze({ decorated: 0, separators: 0 });
      removeSeparators(messages);
      const times = loadTimes();
      const articles = Array.from(messages.querySelectorAll?.('.message[data-message-id]') || []);
      let decorated = 0;
      let separators = 0;
      let previousDay = null;

      for (const article of articles) {
        const id = normalizeId(article?.dataset?.messageId);
        const iso = id ? times.get(id) : null;
        if (!iso) {
          clearTimestamp(article);
          continue;
        }
        const currentDay = dayKey(iso);
        if (currentDay && currentDay !== previousDay) {
          if (insertDaySeparator(messages, article, iso)) separators += 1;
        }
        previousDay = currentDay || previousDay;
        if (ensureTimestamp(article, iso)) decorated += 1;
      }
      return Object.freeze({ decorated, separators });
    }

    function scheduleRender() {
      if (scheduled) return;
      scheduled = true;
      const run = () => {
        scheduled = false;
        render();
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(run);
      else Promise.resolve().then(run);
    }

    function onStorage(event) {
      if (!event || event.key === STORAGE_KEY || event.key === null) scheduleRender();
    }

    function mount() {
      if (mounted) return true;
      const messages = documentRef.querySelector('#messages');
      if (!messages) return false;
      installStyles(documentRef);
      render();
      if (typeof MutationObserverImpl === 'function') {
        observer = new MutationObserverImpl(scheduleRender);
        observer.observe(messages, { childList: true, subtree: true });
        const list = documentRef.querySelector('#conversationList');
        if (list) {
          conversationObserver = new MutationObserverImpl(scheduleRender);
          conversationObserver.observe(list, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-conversation-organize-id']
          });
        }
      }
      windowRef?.addEventListener?.('storage', onStorage);
      mounted = true;
      return true;
    }

    function destroy() {
      if (!mounted) return;
      observer?.disconnect?.();
      conversationObserver?.disconnect?.();
      observer = null;
      conversationObserver = null;
      windowRef?.removeEventListener?.('storage', onStorage);
      const messages = documentRef.querySelector('#messages');
      removeSeparators(messages);
      const stamps = messages?.querySelectorAll?.(`.${TIMESTAMP_CLASS}`) || [];
      for (const stamp of stamps) stamp.remove?.();
      mounted = false;
    }

    return Object.freeze({ mount, destroy, render, scheduleRender, onStorage, loadTimes });
  }

  function mount(options) {
    try {
      const controller = createController(options);
      return controller.mount() ? controller : null;
    } catch {
      return null;
    }
  }

  return Object.freeze({
    STORAGE_KEY,
    STYLE_ID,
    TIMESTAMP_CLASS,
    DAY_SEPARATOR_CLASS,
    MAX_CONVERSATIONS,
    MAX_MESSAGES_PER_CONVERSATION,
    MAX_ID_CHARS,
    normalizeId,
    normalizeIso,
    parseConversationList,
    readMessageTimes,
    activeConversationId,
    dayKey,
    formatTime,
    formatDay,
    formatExact,
    installStyles,
    createController,
    mount
  });
});
