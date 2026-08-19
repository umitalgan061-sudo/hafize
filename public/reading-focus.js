(function exposeHafizeReadingFocus(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeReadingFocus = api;
  const install = () => api.install(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeReadingFocus() {
  'use strict';

  const STORAGE_KEY = 'hafize.reading-focus.v1';
  const CONVERSATION_STORAGE_KEY = 'hafize.conversations.v1';
  const MAX_BOOKMARKS = 200;
  const MAX_MESSAGE_ID_CHARS = 160;
  const MAX_CONVERSATION_ID_CHARS = 120;
  const MAX_STORAGE_CHARS = 48 * 1024;
  const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const BOOKMARK_SEPARATOR = '|';
  const DEFAULT_STATE = Object.freeze({
    focusMode: false,
    bookmarkIds: Object.freeze([]),
    legacyBookmarkIds: Object.freeze([])
  });

  function normalizeMessageId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_MESSAGE_ID_CHARS || !MESSAGE_ID_PATTERN.test(clean)) return null;
    return clean;
  }

  function normalizeConversationId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_CONVERSATION_ID_CHARS || !CONVERSATION_ID_PATTERN.test(clean)) return null;
    return clean;
  }

  function bookmarkKey(conversationId, messageId) {
    const conversation = normalizeConversationId(conversationId);
    const message = normalizeMessageId(messageId);
    return conversation && message ? `${conversation}${BOOKMARK_SEPARATOR}${message}` : null;
  }

  function parseBookmarkKey(value) {
    if (typeof value !== 'string') return null;
    const separator = value.indexOf(BOOKMARK_SEPARATOR);
    if (separator <= 0 || separator !== value.lastIndexOf(BOOKMARK_SEPARATOR)) return null;
    const conversationId = normalizeConversationId(value.slice(0, separator));
    const messageId = normalizeMessageId(value.slice(separator + 1));
    if (!conversationId || !messageId) return null;
    return Object.freeze({ conversationId, messageId, key: bookmarkKey(conversationId, messageId) });
  }

  function normalizeLegacyBookmarkIds(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const normalized = [];
    for (const candidate of value) {
      if (parseBookmarkKey(candidate)) continue;
      const id = normalizeMessageId(candidate);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
      if (normalized.length >= MAX_BOOKMARKS) break;
    }
    return normalized;
  }

  function normalizeBookmarkKeys(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const normalized = [];
    for (const candidate of value) {
      const parsed = parseBookmarkKey(candidate);
      if (!parsed || seen.has(parsed.key)) continue;
      seen.add(parsed.key);
      normalized.push(parsed.key);
      if (normalized.length >= MAX_BOOKMARKS) break;
    }
    return normalized;
  }

  function normalizeBookmarkIds(value) {
    return normalizeBookmarkKeys(value);
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { focusMode: false, bookmarkIds: [], legacyBookmarkIds: [] };
    }
    const candidates = Array.isArray(value.bookmarkIds) ? value.bookmarkIds : [];
    return {
      focusMode: value.focusMode === true,
      bookmarkIds: normalizeBookmarkKeys(candidates),
      legacyBookmarkIds: normalizeLegacyBookmarkIds(candidates)
    };
  }

  function parseState(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > MAX_STORAGE_CHARS) {
      return { focusMode: false, bookmarkIds: [], legacyBookmarkIds: [] };
    }
    try {
      return normalizeState(JSON.parse(raw));
    } catch {
      return { focusMode: false, bookmarkIds: [], legacyBookmarkIds: [] };
    }
  }

  function serializeState(state) {
    const normalized = normalizeState(state);
    return JSON.stringify({ focusMode: normalized.focusMode, bookmarkIds: normalized.bookmarkIds });
  }

  function loadState(storage) {
    try {
      return parseState(storage?.getItem?.(STORAGE_KEY));
    } catch {
      return { focusMode: false, bookmarkIds: [], legacyBookmarkIds: [] };
    }
  }

  function persistState(storage, state) {
    try {
      storage?.setItem?.(STORAGE_KEY, serializeState(state));
      return true;
    } catch {
      return false;
    }
  }

  function nextBookmarkIds(current, key, enabled) {
    const parsed = parseBookmarkKey(key);
    const source = normalizeBookmarkKeys(current);
    if (!parsed) return source;
    const without = source.filter((item) => item !== parsed.key);
    if (!enabled) return without;
    without.push(parsed.key);
    return without.slice(-MAX_BOOKMARKS);
  }

  const nextBookmarkKeys = nextBookmarkIds;

  function bookmarkIndexFromConversations(conversations) {
    const validKeys = new Set();
    const legacyMatches = new Map();
    for (const conversation of Array.isArray(conversations) ? conversations : []) {
      const conversationId = normalizeConversationId(conversation?.id);
      if (!conversationId || !Array.isArray(conversation?.messages)) continue;
      for (const message of conversation.messages) {
        const messageId = normalizeMessageId(message?.id);
        const key = bookmarkKey(conversationId, messageId);
        if (!key) continue;
        validKeys.add(key);
        if (!legacyMatches.has(messageId)) legacyMatches.set(messageId, key);
        else if (legacyMatches.get(messageId) !== key) legacyMatches.set(messageId, null);
      }
    }
    return Object.freeze({ validKeys, legacyMatches });
  }

  function messageIdsFromConversations(conversations) {
    const index = bookmarkIndexFromConversations(conversations);
    const ids = new Set(index.legacyMatches.keys());
    Object.defineProperty(ids, 'bookmarkKeys', { value: index.validKeys, enumerable: false });
    Object.defineProperty(ids, 'legacyMatches', { value: index.legacyMatches, enumerable: false });
    return ids;
  }

  function bookmarkKeysFromConversations(conversations) {
    return bookmarkIndexFromConversations(conversations).validKeys;
  }

  function canonicalMessageIds(storage, guard) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    if (!guard || typeof guard.sanitizeStoredValue !== 'function') return null;
    try {
      const canonical = guard.sanitizeStoredValue(storage.getItem(CONVERSATION_STORAGE_KEY) || '[]');
      return messageIdsFromConversations(canonical.value);
    } catch {
      return null;
    }
  }

  function canonicalBookmarkIndex(storage, guard) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    if (!guard || typeof guard.sanitizeStoredValue !== 'function') return null;
    try {
      const canonical = guard.sanitizeStoredValue(storage.getItem(CONVERSATION_STORAGE_KEY) || '[]');
      return bookmarkIndexFromConversations(canonical.value);
    } catch {
      return null;
    }
  }

  function pruneBookmarkIds(bookmarkIds, validMessageIds) {
    if (!(validMessageIds instanceof Set) || !Array.isArray(bookmarkIds)) return [];
    const validKeys = validMessageIds.bookmarkKeys instanceof Set ? validMessageIds.bookmarkKeys : null;
    const legacyMatches = validMessageIds.legacyMatches instanceof Map ? validMessageIds.legacyMatches : null;
    const result = [];
    const seen = new Set();
    for (const candidate of bookmarkIds) {
      const parsed = parseBookmarkKey(candidate);
      let resolved = null;
      if (parsed) {
        if (validKeys ? validKeys.has(parsed.key) : validMessageIds.has(parsed.messageId)) resolved = parsed.key;
      } else {
        const legacyId = normalizeMessageId(candidate);
        if (legacyId) {
          const uniqueKey = legacyMatches?.get(legacyId);
          if (typeof uniqueKey === 'string') resolved = uniqueKey;
        }
      }
      if (!resolved || seen.has(resolved)) continue;
      seen.add(resolved);
      result.push(resolved);
      if (result.length >= MAX_BOOKMARKS) break;
    }
    return result;
  }

  function pruneBookmarkKeys(bookmarkIds, validKeys) {
    const normalized = normalizeBookmarkKeys(bookmarkIds);
    if (!(validKeys instanceof Set)) return normalized;
    return normalized.filter((key) => validKeys.has(key));
  }

  function migrateLegacyBookmarkIds(bookmarkIds, index) {
    const normalized = normalizeLegacyBookmarkIds(bookmarkIds);
    if (!index?.legacyMatches || !(index.legacyMatches instanceof Map)) return [];
    const migrated = [];
    for (const messageId of normalized) {
      const key = index.legacyMatches.get(messageId);
      if (typeof key === 'string') migrated.push(key);
    }
    return normalizeBookmarkKeys(migrated);
  }

  function scopeStateForConversations(state, conversations) {
    const normalized = normalizeState(state);
    const index = bookmarkIndexFromConversations(conversations);
    const bookmarkIds = normalizeBookmarkKeys([
      ...pruneBookmarkKeys(normalized.bookmarkIds, index.validKeys),
      ...migrateLegacyBookmarkIds(normalized.legacyBookmarkIds, index)
    ]);
    return Object.freeze({ focusMode: normalized.focusMode, bookmarkIds, legacyBookmarkIds: [] });
  }

  function compactState(storage, guard, state = loadState(storage)) {
    const normalized = normalizeState(state);
    if (!storage || typeof storage.getItem !== 'function' || !guard || typeof guard.sanitizeStoredValue !== 'function') {
      return Object.freeze({ state: normalized, changed: false, persisted: false });
    }
    let canonical;
    try {
      canonical = guard.sanitizeStoredValue(storage.getItem(CONVERSATION_STORAGE_KEY) || '[]');
    } catch {
      return Object.freeze({ state: normalized, changed: false, persisted: false });
    }
    const next = scopeStateForConversations(normalized, canonical.value);
    const changed = normalized.legacyBookmarkIds.length > 0 || serializeState(next) !== serializeState(normalized);
    if (!changed) return Object.freeze({ state: next, changed: false, persisted: false });
    return Object.freeze({ state: next, changed: true, persisted: persistState(storage, next) });
  }

  function activeConversationId(documentRef, conversations) {
    const canonical = Array.isArray(conversations) ? conversations : [];
    const ids = canonical.map((item) => normalizeConversationId(item?.id)).filter(Boolean);
    if (!ids.length) return null;
    const rows = Array.from(documentRef?.querySelectorAll?.('#conversationList .conversation-row') || []);
    const active = rows.filter((row) => row?.classList?.contains?.('active'));
    if (active.length !== 1) return null;
    const tagged = normalizeConversationId(active[0]?.dataset?.conversationOrganizeId);
    if (tagged && ids.includes(tagged)) return tagged;
    if (rows.some((row) => normalizeConversationId(row?.dataset?.conversationOrganizeId))) return null;
    const index = rows.indexOf(active[0]);
    return index >= 0 && index < ids.length ? ids[index] : null;
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-reading-focus-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/reading-focus.css';
    link.setAttribute('data-hafize-reading-focus-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function messageArticleFor(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const article = target.closest('.message[data-message-id]');
    return normalizeMessageId(article?.dataset?.messageId) ? article : null;
  }

  function install(documentRef, root) {
    if (!documentRef?.body || !root) return null;
    const messages = documentRef.querySelector?.('#messages');
    const topbar = documentRef.querySelector?.('.topbar');
    if (!messages || !topbar) return null;

    ensureStyles(documentRef);
    const storage = root.localStorage;
    const guard = root.HafizeConversationStorageGuard;
    const initialCompaction = compactState(storage, guard);
    let state = initialCompaction.state;
    let bookmarks = new Set(state.bookmarkIds);
    let bookmarksOnly = false;
    let navigationIndex = -1;
    let highlightTimer = null;
    let cachedConversationRaw = null;
    let cachedConversations = [];

    const tools = documentRef.createElement('div');
    tools.className = 'reading-focus-tools';
    tools.setAttribute('aria-label', 'Okuma araçları');

    const focusButton = documentRef.createElement('button');
    focusButton.type = 'button';
    focusButton.className = 'reading-focus-toggle';
    focusButton.setAttribute('aria-pressed', 'false');

    const bookmarkNavigator = documentRef.createElement('button');
    bookmarkNavigator.type = 'button';
    bookmarkNavigator.className = 'reading-bookmark-navigator';
    bookmarkNavigator.disabled = true;

    const bookmarkFilter = documentRef.createElement('button');
    bookmarkFilter.type = 'button';
    bookmarkFilter.className = 'reading-bookmark-filter';
    bookmarkFilter.setAttribute('aria-pressed', 'false');
    bookmarkFilter.disabled = true;

    tools.append(focusButton, bookmarkNavigator, bookmarkFilter);
    const themeToggle = topbar.querySelector?.('#themeToggle');
    if (themeToggle?.parentNode === topbar) topbar.insertBefore(tools, themeToggle);
    else topbar.append(tools);

    function canonicalConversations() {
      if (!guard || typeof guard.sanitizeStoredValue !== 'function') return [];
      try {
        const raw = storage?.getItem?.(CONVERSATION_STORAGE_KEY) || '[]';
        if (raw === cachedConversationRaw) return cachedConversations;
        const canonical = guard.sanitizeStoredValue(raw);
        cachedConversationRaw = raw;
        cachedConversations = canonical.value;
        return cachedConversations;
      } catch {
        cachedConversationRaw = null;
        cachedConversations = [];
        return [];
      }
    }

    function currentConversationId() {
      return activeConversationId(documentRef, canonicalConversations());
    }

    function keyForArticle(article) {
      return bookmarkKey(currentConversationId(), normalizeMessageId(article?.dataset?.messageId));
    }

    function syncFocusMode() {
      documentRef.body.classList.toggle('reading-focus-mode', state.focusMode);
      focusButton.setAttribute('aria-pressed', String(state.focusMode));
      focusButton.textContent = state.focusMode ? '◫ Odaktan çık' : '◫ Odak';
      focusButton.setAttribute('aria-label', state.focusMode ? 'Odak modundan çık' : 'Odak moduna geç');
      focusButton.title = state.focusMode
        ? 'Kenar panellerini yeniden göster'
        : 'Sohbeti genişlet ve kenar panellerini gizle';
      if (state.focusMode) documentRef.querySelector?.('#sidebar')?.classList?.remove?.('open');
    }

    function save() {
      state = { focusMode: state.focusMode, bookmarkIds: Array.from(bookmarks), legacyBookmarkIds: [] };
      persistState(storage, state);
    }

    function applyCanonicalCompaction() {
      const result = compactState(storage, guard, {
        focusMode: state.focusMode,
        bookmarkIds: Array.from(bookmarks),
        legacyBookmarkIds: state.legacyBookmarkIds || []
      });
      state = result.state;
      bookmarks = new Set(state.bookmarkIds);
      return result.changed;
    }

    function allMessageArticles() {
      return Array.from(messages.querySelectorAll?.('.message[data-message-id]') || []);
    }

    function bookmarkedArticles() {
      return allMessageArticles().filter((article) => {
        const key = keyForArticle(article);
        return Boolean(key && bookmarks.has(key));
      });
    }

    function syncBookmarkFilter() {
      const visible = bookmarkedArticles();
      if (!visible.length) bookmarksOnly = false;
      bookmarkFilter.disabled = visible.length === 0;
      bookmarkFilter.setAttribute('aria-pressed', String(bookmarksOnly));
      bookmarkFilter.textContent = bookmarksOnly ? '★ Tümünü göster' : '★ Yalnız';
      bookmarkFilter.setAttribute('aria-label', bookmarksOnly
        ? 'Tüm sohbet mesajlarını yeniden göster'
        : 'Yalnız yer imli mesajları göster');
      bookmarkFilter.title = bookmarksOnly ? 'Tüm mesajları göster' : 'Yalnız yer imlerini göster';
      for (const article of allMessageArticles()) {
        const key = keyForArticle(article);
        article.classList?.toggle?.('reading-bookmark-filtered-out', bookmarksOnly && !(key && bookmarks.has(key)));
      }
      messages.classList?.toggle?.('reading-bookmark-filter-active', bookmarksOnly);
    }

    function syncNavigator() {
      const visible = bookmarkedArticles();
      bookmarkNavigator.disabled = visible.length === 0;
      bookmarkNavigator.textContent = `★ ${visible.length}`;
      bookmarkNavigator.setAttribute('aria-label', visible.length
        ? `Bu sohbetteki ${visible.length} yer iminden sonrakine git`
        : 'Bu sohbette yer imi yok');
      bookmarkNavigator.title = visible.length ? 'Sonraki yer imine git' : 'Bu sohbette yer imi yok';
      if (navigationIndex >= visible.length) navigationIndex = -1;
      syncBookmarkFilter();
    }

    function syncBookmarkButton(button, article) {
      const key = keyForArticle(article);
      const enabled = Boolean(key && bookmarks.has(key));
      button.disabled = !key;
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? '★' : '☆';
      const role = article?.classList?.contains?.('user') ? 'kullanıcı' : 'Hafize';
      button.setAttribute('aria-label', !key
        ? `${role} mesajının sohbet kimliği doğrulanamadı`
        : enabled
          ? `${role} mesajının yer imini kaldır`
          : `${role} mesajını yer imlerine ekle`);
      button.title = !key ? 'Sohbet kimliği doğrulanamadı' : enabled ? 'Yer imini kaldır' : 'Yer imi ekle';
      article?.classList?.toggle?.('reading-bookmarked', enabled);
    }

    function decorateMessage(article) {
      const id = normalizeMessageId(article?.dataset?.messageId);
      if (!id) return false;
      const existing = article.querySelector?.('.reading-bookmark-button');
      if (existing) {
        syncBookmarkButton(existing, article);
        return false;
      }
      const actions = documentRef.createElement('div');
      actions.className = 'reading-bookmark-actions';

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'reading-bookmark-button';
      syncBookmarkButton(button, article);
      button.addEventListener('click', (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        const key = keyForArticle(article);
        if (!key) return;
        const nextEnabled = !bookmarks.has(key);
        bookmarks = new Set(nextBookmarkIds(Array.from(bookmarks), key, nextEnabled));
        save();
        syncBookmarkButton(button, article);
        syncNavigator();
      });

      actions.append(button);
      article.append(actions);
      return true;
    }

    function decorateAll() {
      for (const article of allMessageArticles()) decorateMessage(article);
      syncNavigator();
    }

    function clearHighlight() {
      if (highlightTimer !== null) root.clearTimeout?.(highlightTimer);
      highlightTimer = null;
      for (const article of messages.querySelectorAll?.('.reading-bookmark-current') || []) {
        article.classList?.remove?.('reading-bookmark-current');
      }
    }

    function goToNextBookmark() {
      const visible = bookmarkedArticles();
      if (!visible.length) return false;
      navigationIndex = (navigationIndex + 1) % visible.length;
      const article = visible[navigationIndex];
      clearHighlight();
      article.classList?.add?.('reading-bookmark-current');
      if (!article.hasAttribute?.('tabindex')) article.setAttribute?.('tabindex', '-1');
      article.focus?.({ preventScroll: true });
      const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      article.scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      highlightTimer = root.setTimeout?.(() => {
        article.classList?.remove?.('reading-bookmark-current');
        highlightTimer = null;
      }, 1600) ?? null;
      return true;
    }

    function onFocusToggle() {
      state = { focusMode: !state.focusMode, bookmarkIds: Array.from(bookmarks), legacyBookmarkIds: [] };
      save();
      syncFocusMode();
    }

    function onBookmarkFilterToggle() {
      if (bookmarkFilter.disabled) return;
      bookmarksOnly = !bookmarksOnly;
      syncBookmarkFilter();
      if (!bookmarksOnly) navigationIndex = -1;
    }

    function onStorage(event) {
      if (event?.key !== STORAGE_KEY && event?.key !== CONVERSATION_STORAGE_KEY) return;
      if (event.key === STORAGE_KEY) {
        state = parseState(event.newValue || '');
        bookmarks = new Set(state.bookmarkIds);
      }
      applyCanonicalCompaction();
      syncFocusMode();
      decorateAll();
    }

    focusButton.addEventListener('click', onFocusToggle);
    bookmarkNavigator.addEventListener('click', goToNextBookmark);
    bookmarkFilter.addEventListener('click', onBookmarkFilterToggle);
    root.addEventListener?.('storage', onStorage);

    const observer = typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(() => decorateAll())
      : null;
    observer?.observe(messages, { childList: true, subtree: true });

    const conversationList = documentRef.querySelector?.('#conversationList');
    const conversationObserver = conversationList && typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(() => decorateAll())
      : null;
    conversationObserver?.observe(conversationList, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-conversation-organize-id']
    });

    syncFocusMode();
    decorateAll();

    return Object.freeze({
      getState: () => Object.freeze({
        focusMode: state.focusMode,
        bookmarkIds: Object.freeze(Array.from(bookmarks)),
        legacyBookmarkIds: Object.freeze([...(state.legacyBookmarkIds || [])]),
        bookmarksOnly
      }),
      goToNextBookmark,
      compact: () => { const changed = applyCanonicalCompaction(); decorateAll(); return changed; },
      destroy() {
        observer?.disconnect?.();
        conversationObserver?.disconnect?.();
        root.removeEventListener?.('storage', onStorage);
        focusButton.removeEventListener?.('click', onFocusToggle);
        bookmarkNavigator.removeEventListener?.('click', goToNextBookmark);
        bookmarkFilter.removeEventListener?.('click', onBookmarkFilterToggle);
        clearHighlight();
        tools.remove?.();
        documentRef.body.classList?.remove?.('reading-focus-mode');
        messages.classList?.remove?.('reading-bookmark-filter-active');
        for (const action of messages.querySelectorAll?.('.reading-bookmark-actions') || []) action.remove?.();
        for (const article of messages.querySelectorAll?.('.reading-bookmarked, .reading-bookmark-current, .reading-bookmark-filtered-out') || []) {
          article.classList?.remove?.('reading-bookmarked', 'reading-bookmark-current', 'reading-bookmark-filtered-out');
        }
      }
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    CONVERSATION_STORAGE_KEY,
    MAX_BOOKMARKS,
    MAX_MESSAGE_ID_CHARS,
    MAX_CONVERSATION_ID_CHARS,
    MAX_STORAGE_CHARS,
    BOOKMARK_SEPARATOR,
    DEFAULT_STATE,
    normalizeMessageId,
    normalizeConversationId,
    bookmarkKey,
    parseBookmarkKey,
    normalizeLegacyBookmarkIds,
    normalizeBookmarkKeys,
    normalizeBookmarkIds,
    normalizeState,
    parseState,
    serializeState,
    loadState,
    persistState,
    nextBookmarkIds,
    nextBookmarkKeys,
    bookmarkIndexFromConversations,
    messageIdsFromConversations,
    bookmarkKeysFromConversations,
    canonicalMessageIds,
    canonicalBookmarkIndex,
    pruneBookmarkIds,
    pruneBookmarkKeys,
    migrateLegacyBookmarkIds,
    scopeStateForConversations,
    compactState,
    activeConversationId,
    messageArticleFor,
    install
  });
});
