(function exposeHafizeConversationOutline(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeConversationOutline = api;
  const install = () => api.install(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationOutline() {
  'use strict';

  const MAX_OUTLINE_ITEMS = 100;
  const MAX_PREVIEW_CHARS = 92;
  const MAX_QUERY_CHARS = 120;
  const MAX_MESSAGE_ID_CHARS = 160;
  const HIGHLIGHT_MS = 1400;
  const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
  const ACTIVE_MESSAGES = new WeakSet();
  const STYLE_MARKER = 'data-hafize-conversation-outline-style';

  function normalizeMessageId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_MESSAGE_ID_CHARS || !MESSAGE_ID_PATTERN.test(clean)) return null;
    return clean;
  }

  function normalizeText(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function createPreview(value, maxChars = MAX_PREVIEW_CHARS) {
    const normalized = normalizeText(value);
    const limit = Number.isInteger(maxChars) && maxChars > 8 ? Math.min(maxChars, MAX_PREVIEW_CHARS) : MAX_PREVIEW_CHARS;
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
  }

  function normalizeQuery(value) {
    if (typeof value !== 'string') return '';
    const normalized = normalizeText(value).toLocaleLowerCase('tr-TR');
    return normalized.length <= MAX_QUERY_CHARS ? normalized : '';
  }

  function matchesQuery(preview, query) {
    const cleanQuery = normalizeQuery(query);
    return !cleanQuery || normalizeText(preview).toLocaleLowerCase('tr-TR').includes(cleanQuery);
  }

  function collectOutlineItems(messages) {
    if (!messages?.querySelectorAll) return [];
    const items = [];
    for (const article of messages.querySelectorAll('.message.user[data-message-id]')) {
      if (items.length >= MAX_OUTLINE_ITEMS) break;
      const id = normalizeMessageId(article?.dataset?.messageId);
      const preview = createPreview(article?.querySelector?.('.content')?.textContent || '');
      if (id && preview) items.push(Object.freeze({ id, preview, turn: items.length + 1 }));
    }
    return items;
  }

  function findMessageById(messages, id) {
    const cleanId = normalizeMessageId(id);
    if (!cleanId || !messages?.querySelectorAll) return null;
    for (const article of messages.querySelectorAll('.message.user[data-message-id]')) {
      if (normalizeMessageId(article?.dataset?.messageId) === cleanId) return article;
    }
    return null;
  }

  function installStyle(documentRef) {
    if (!documentRef?.head) return Object.freeze({ node: null, owned: false });
    const existing = documentRef.querySelector?.(`link[${STYLE_MARKER}]`);
    if (existing) return Object.freeze({ node: existing, owned: false });
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/conversation-outline.css';
    link.setAttribute(STYLE_MARKER, '1');
    documentRef.head.append(link);
    return Object.freeze({ node: link, owned: true });
  }

  function install(documentRef, root) {
    if (!documentRef?.body || !root || typeof documentRef.createElement !== 'function') return null;
    const messages = documentRef.querySelector?.('#messages');
    const topbar = documentRef.querySelector?.('.topbar');
    if (!messages || !topbar || ACTIVE_MESSAGES.has(messages)) return null;
    if (documentRef.querySelector?.('#conversationOutlinePanel') || topbar.querySelector?.('.conversation-outline-trigger')) return null;

    let items = [];
    let query = '';
    let open = false;
    let mounted = false;
    let destroyed = false;
    let observer = null;
    let refreshHandle = null;
    let refreshKind = null;
    let styleNode = null;
    let ownsStyle = false;
    const listenerCleanup = [];
    const targetCleanup = new Map();

    const trigger = documentRef.createElement('button');
    trigger.type = 'button';
    trigger.className = 'conversation-outline-trigger';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'conversationOutlinePanel');
    trigger.disabled = true;

    const panel = documentRef.createElement('section');
    panel.id = 'conversationOutlinePanel';
    panel.className = 'conversation-outline-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'conversationOutlineTitle');
    panel.hidden = true;

    const head = documentRef.createElement('div'); head.className = 'conversation-outline-head';
    const titleWrap = documentRef.createElement('div'); titleWrap.className = 'conversation-outline-title-wrap';
    const title = documentRef.createElement('strong'); title.id = 'conversationOutlineTitle'; title.textContent = 'Sohbet taslağı';
    const count = documentRef.createElement('span'); count.className = 'conversation-outline-count'; count.setAttribute('aria-live', 'polite');
    titleWrap.append(title, count);
    const closeButton = documentRef.createElement('button'); closeButton.type = 'button'; closeButton.className = 'conversation-outline-close'; closeButton.setAttribute('aria-label', 'Sohbet taslağını kapat'); closeButton.textContent = '×';
    head.append(titleWrap, closeButton);

    const searchLabel = documentRef.createElement('label'); searchLabel.className = 'conversation-outline-search-label'; searchLabel.textContent = 'Kullanıcı turlarında ara';
    const searchInput = documentRef.createElement('input'); searchInput.type = 'search'; searchInput.className = 'conversation-outline-search'; searchInput.maxLength = MAX_QUERY_CHARS; searchInput.autocomplete = 'off'; searchInput.spellcheck = false; searchInput.placeholder = 'Örn. GitHub, plan, kod…'; searchInput.setAttribute('aria-controls', 'conversationOutlineList'); searchInput.setAttribute('aria-describedby', 'conversationOutlineStatus'); searchLabel.append(searchInput);
    const status = documentRef.createElement('p'); status.id = 'conversationOutlineStatus'; status.className = 'conversation-outline-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    const list = documentRef.createElement('div'); list.id = 'conversationOutlineList'; list.className = 'conversation-outline-list'; list.setAttribute('role', 'list');
    panel.append(head, searchLabel, status, list);

    function isLive() { return mounted && !destroyed && ACTIVE_MESSAGES.has(messages); }

    function addListener(target, type, listener, options) {
      if (typeof target?.addEventListener !== 'function' || typeof target?.removeEventListener !== 'function') throw new Error('INVALID_CONVERSATION_OUTLINE_LISTENER_TARGET');
      target.addEventListener(type, listener, options);
      listenerCleanup.push(() => target.removeEventListener(type, listener, options));
    }

    function cancelRefresh() {
      if (refreshHandle == null) return;
      if (refreshKind === 'raf') root.cancelAnimationFrame?.(refreshHandle);
      else root.clearTimeout?.(refreshHandle);
      refreshHandle = null;
      refreshKind = null;
    }

    function clearTarget(article) {
      const snapshot = targetCleanup.get(article);
      if (!snapshot) return;
      root.clearTimeout?.(snapshot.timer);
      article.classList?.remove?.('conversation-outline-target');
      if (!snapshot.hadTabindex) article.removeAttribute?.('tabindex');
      else article.setAttribute?.('tabindex', snapshot.tabindex);
      targetCleanup.delete(article);
    }

    function clearTargets() {
      for (const article of Array.from(targetCleanup.keys())) clearTarget(article);
    }

    function visibleItems() { return items.filter((item) => matchesQuery(item.preview, query)); }

    function positionPanel() {
      if (!isLive() || !open || typeof trigger.getBoundingClientRect !== 'function') return false;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = Number(root.innerWidth) || 1280;
      const safeMargin = 12;
      const preferredWidth = Math.min(420, Math.max(280, viewportWidth - safeMargin * 2));
      const left = Math.min(Math.max(safeMargin, rect.right - preferredWidth), Math.max(safeMargin, viewportWidth - preferredWidth - safeMargin));
      panel.style.setProperty('--conversation-outline-left', `${Math.round(left)}px`);
      panel.style.setProperty('--conversation-outline-top', `${Math.round(rect.bottom + 8)}px`);
      panel.style.setProperty('--conversation-outline-width', `${Math.round(preferredWidth)}px`);
      return true;
    }

    function syncTrigger() {
      if (!isLive()) return false;
      const total = items.length;
      trigger.disabled = total === 0;
      trigger.textContent = total ? `☷ Taslak ${total}` : '☷ Taslak';
      trigger.setAttribute('aria-expanded', String(open && total > 0));
      trigger.setAttribute('aria-label', total ? `Sohbet taslağını aç, ${total} kullanıcı turu` : 'Sohbet taslağı için kullanıcı mesajı yok');
      trigger.title = total ? 'Kullanıcı turları arasında hızlı gezin' : 'Kullanıcı mesajı yok';
      return true;
    }

    function activateItem(item) {
      if (!isLive()) return false;
      const article = findMessageById(messages, item?.id);
      if (!article) { scheduleRefresh(); return false; }
      close({ returnFocus: false });
      clearTarget(article);
      const hadTabindex = article.hasAttribute?.('tabindex') === true;
      const tabindex = hadTabindex ? article.getAttribute?.('tabindex') ?? '' : '';
      if (!hadTabindex) article.setAttribute?.('tabindex', '-1');
      try { article.focus?.({ preventScroll: true }); } catch { return false; }
      try {
        const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
        article.scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      } catch {}
      article.classList?.add?.('conversation-outline-target');
      const timer = typeof root.setTimeout === 'function' ? root.setTimeout(() => { if (isLive()) clearTarget(article); }, HIGHLIGHT_MS) : null;
      targetCleanup.set(article, { hadTabindex, tabindex, timer });
      return true;
    }

    function renderList() {
      if (!isLive()) return false;
      const visible = visibleItems();
      list.replaceChildren();
      count.textContent = `${items.length} tur`;
      if (!items.length) { status.textContent = 'Bu sohbette henüz kullanıcı turu yok.'; return true; }
      if (!visible.length) {
        status.textContent = 'Aramayla eşleşen kullanıcı turu yok.';
        const empty = documentRef.createElement('div'); empty.className = 'conversation-outline-empty'; empty.textContent = 'Başka bir arama deneyebilirsin.'; list.append(empty); return true;
      }
      status.textContent = query ? `${visible.length} / ${items.length} tur gösteriliyor.` : `${items.length} kullanıcı turu gösteriliyor.`;
      for (const item of visible) {
        if (!isLive()) return false;
        const row = documentRef.createElement('div'); row.className = 'conversation-outline-row'; row.setAttribute('role', 'listitem');
        const button = documentRef.createElement('button'); button.type = 'button'; button.className = 'conversation-outline-item'; button.dataset.messageId = item.id; button.setAttribute('aria-label', `${item.turn}. kullanıcı turuna git: ${item.preview}`);
        const number = documentRef.createElement('span'); number.className = 'conversation-outline-turn'; number.setAttribute('aria-hidden', 'true'); number.textContent = String(item.turn);
        const preview = documentRef.createElement('span'); preview.className = 'conversation-outline-preview'; preview.textContent = item.preview;
        button.append(number, preview);
        addListener(button, 'click', () => activateItem(item));
        row.append(button); list.append(row);
      }
      return true;
    }

    function refresh() {
      refreshHandle = null; refreshKind = null;
      if (!isLive()) return false;
      items = collectOutlineItems(messages);
      if (!items.length && open) close({ returnFocus: false });
      syncTrigger(); renderList(); positionPanel();
      return true;
    }

    function scheduleRefresh() {
      if (!isLive() || refreshHandle != null) return false;
      if (typeof root.requestAnimationFrame === 'function') { refreshKind = 'raf'; refreshHandle = root.requestAnimationFrame(refresh); }
      else if (typeof root.setTimeout === 'function') { refreshKind = 'timer'; refreshHandle = root.setTimeout(refresh, 0); }
      else return false;
      return refreshHandle != null;
    }

    function show() {
      if (!isLive() || !items.length) return false;
      open = true; panel.hidden = false; documentRef.body.classList?.add?.('conversation-outline-open'); syncTrigger(); renderList(); positionPanel(); searchInput.focus?.(); return true;
    }

    function close({ returnFocus = true } = {}) {
      if (!isLive() || (!open && panel.hidden)) return false;
      open = false; panel.hidden = true; documentRef.body.classList?.remove?.('conversation-outline-open'); syncTrigger(); if (returnFocus) trigger.focus?.(); return true;
    }

    function toggle() { return isLive() ? (open ? close() : show()) : false; }
    function onSearchInput() { if (!isLive()) return; query = normalizeQuery(searchInput.value); if (searchInput.value.length > MAX_QUERY_CHARS) searchInput.value = searchInput.value.slice(0, MAX_QUERY_CHARS); renderList(); }
    function onDocumentKeydown(event) { if (!isLive() || event?.key !== 'Escape' || !open) return; event.preventDefault?.(); event.stopPropagation?.(); close(); }
    function onDocumentPointerDown(event) { if (!isLive() || !open) return; const target = event?.target; if (panel.contains?.(target) || trigger.contains?.(target)) return; close({ returnFocus: false }); }
    function onViewportChange() { if (isLive() && open) positionPanel(); }
    function onCloseClick() { close(); }

    function rollback() {
      cancelRefresh(); observer?.disconnect?.(); observer = null; clearTargets();
      while (listenerCleanup.length) { try { listenerCleanup.pop()?.(); } catch {} }
      documentRef.body.classList?.remove?.('conversation-outline-open');
      trigger.remove?.(); panel.remove?.();
      if (ownsStyle) styleNode?.remove?.();
      styleNode = null; ownsStyle = false; mounted = false; ACTIVE_MESSAGES.delete(messages);
    }

    ACTIVE_MESSAGES.add(messages);
    try {
      const style = installStyle(documentRef); styleNode = style.node; ownsStyle = style.owned;
      documentRef.body.append(panel);
      const themeToggle = topbar.querySelector?.('#themeToggle');
      if (themeToggle?.parentNode === topbar) topbar.insertBefore(trigger, themeToggle); else topbar.append(trigger);
      addListener(trigger, 'click', toggle); addListener(closeButton, 'click', onCloseClick); addListener(searchInput, 'input', onSearchInput);
      addListener(documentRef, 'keydown', onDocumentKeydown); addListener(documentRef, 'pointerdown', onDocumentPointerDown);
      addListener(root, 'resize', onViewportChange); addListener(root, 'scroll', onViewportChange, true);
      if (typeof root.MutationObserver === 'function') { observer = new root.MutationObserver(scheduleRefresh); observer.observe(messages, { childList: true, subtree: true, characterData: true }); }
      mounted = true;
      refresh();
    } catch {
      rollback();
      return null;
    }

    return Object.freeze({
      getItems: () => Object.freeze(items.map((item) => Object.freeze({ ...item }))),
      isOpen: () => isLive() && open,
      refresh,
      scheduleRefresh,
      show,
      close,
      activateItem,
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        rollback();
        return true;
      }
    });
  }

  return Object.freeze({
    MAX_OUTLINE_ITEMS, MAX_PREVIEW_CHARS, MAX_QUERY_CHARS, MAX_MESSAGE_ID_CHARS, HIGHLIGHT_MS,
    normalizeMessageId, normalizeText, createPreview, normalizeQuery, matchesQuery,
    collectOutlineItems, findMessageById, install
  });
});