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
  const MAX_BOOKMARKS = 200;
  const MAX_MESSAGE_ID_CHARS = 160;
  const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const DEFAULT_STATE = Object.freeze({ focusMode: false, bookmarkIds: Object.freeze([]) });

  function normalizeMessageId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_MESSAGE_ID_CHARS || !MESSAGE_ID_PATTERN.test(clean)) return null;
    return clean;
  }

  function normalizeBookmarkIds(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const normalized = [];
    for (const candidate of value) {
      const id = normalizeMessageId(candidate);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
      if (normalized.length >= MAX_BOOKMARKS) break;
    }
    return normalized;
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object') return { focusMode: false, bookmarkIds: [] };
    return {
      focusMode: value.focusMode === true,
      bookmarkIds: normalizeBookmarkIds(value.bookmarkIds)
    };
  }

  function parseState(raw) {
    if (typeof raw !== 'string' || !raw) return { focusMode: false, bookmarkIds: [] };
    try {
      return normalizeState(JSON.parse(raw));
    } catch {
      return { focusMode: false, bookmarkIds: [] };
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
      return { focusMode: false, bookmarkIds: [] };
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

  function nextBookmarkIds(current, id, enabled) {
    const cleanId = normalizeMessageId(id);
    const source = normalizeBookmarkIds(current);
    if (!cleanId) return source;
    const without = source.filter((item) => item !== cleanId);
    if (!enabled) return without;
    without.push(cleanId);
    return without.slice(-MAX_BOOKMARKS);
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
    let state = loadState(storage);
    let bookmarks = new Set(state.bookmarkIds);
    let bookmarksOnly = false;
    let navigationIndex = -1;
    let highlightTimer = null;

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
      state = { focusMode: state.focusMode, bookmarkIds: Array.from(bookmarks) };
      persistState(storage, state);
    }

    function allMessageArticles() {
      return Array.from(messages.querySelectorAll?.('.message[data-message-id]') || []);
    }

    function bookmarkedArticles() {
      return allMessageArticles().filter((article) => {
        const id = normalizeMessageId(article.dataset?.messageId);
        return Boolean(id && bookmarks.has(id));
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
        const id = normalizeMessageId(article.dataset?.messageId);
        article.classList?.toggle?.('reading-bookmark-filtered-out', bookmarksOnly && !bookmarks.has(id));
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
      const id = normalizeMessageId(article?.dataset?.messageId);
      if (!id) return;
      const enabled = bookmarks.has(id);
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? '★' : '☆';
      const role = article.classList?.contains?.('user') ? 'kullanıcı' : 'Hafize';
      button.setAttribute('aria-label', enabled
        ? `${role} mesajının yer imini kaldır`
        : `${role} mesajını yer imlerine ekle`);
      button.title = enabled ? 'Yer imini kaldır' : 'Yer imi ekle';
      article.classList?.toggle?.('reading-bookmarked', enabled);
    }

    function decorateMessage(article) {
      const id = normalizeMessageId(article?.dataset?.messageId);
      if (!id || article.querySelector?.('.reading-bookmark-button')) return false;
      const actions = documentRef.createElement('div');
      actions.className = 'reading-bookmark-actions';

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'reading-bookmark-button';
      syncBookmarkButton(button, article);
      button.addEventListener('click', (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        const nextEnabled = !bookmarks.has(id);
        bookmarks = new Set(nextBookmarkIds(Array.from(bookmarks), id, nextEnabled));
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
      state = { focusMode: !state.focusMode, bookmarkIds: Array.from(bookmarks) };
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
      if (event?.key !== STORAGE_KEY) return;
      state = parseState(event.newValue || '');
      bookmarks = new Set(state.bookmarkIds);
      syncFocusMode();
      for (const button of messages.querySelectorAll?.('.reading-bookmark-button') || []) {
        const article = messageArticleFor(button);
        if (article) syncBookmarkButton(button, article);
      }
      syncNavigator();
    }

    focusButton.addEventListener('click', onFocusToggle);
    bookmarkNavigator.addEventListener('click', goToNextBookmark);
    bookmarkFilter.addEventListener('click', onBookmarkFilterToggle);
    root.addEventListener?.('storage', onStorage);

    const observer = typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(() => decorateAll())
      : null;
    observer?.observe(messages, { childList: true, subtree: true });

    syncFocusMode();
    decorateAll();

    return Object.freeze({
      getState: () => Object.freeze({ focusMode: state.focusMode, bookmarkIds: Object.freeze(Array.from(bookmarks)), bookmarksOnly }),
      goToNextBookmark,
      destroy() {
        observer?.disconnect?.();
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
    MAX_BOOKMARKS,
    MAX_MESSAGE_ID_CHARS,
    DEFAULT_STATE,
    normalizeMessageId,
    normalizeBookmarkIds,
    normalizeState,
    parseState,
    serializeState,
    nextBookmarkIds,
    messageArticleFor,
    install
  });
});
