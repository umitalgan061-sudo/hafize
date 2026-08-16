(function exposeHafizeConversationOutline(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeConversationOutline = api;
  const install = () => api.install(root.document, root);
  if (root.document?.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeConversationOutline() {
  'use strict';

  const MAX_OUTLINE_ITEMS = 100;
  const MAX_PREVIEW_CHARS = 92;
  const MAX_QUERY_CHARS = 120;
  const MAX_MESSAGE_ID_CHARS = 160;
  const MESSAGE_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

  function normalizeMessageId(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > MAX_MESSAGE_ID_CHARS || !MESSAGE_ID_PATTERN.test(clean)) return null;
    return clean;
  }

  function normalizeText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
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
    if (!cleanQuery) return true;
    return normalizeText(preview).toLocaleLowerCase('tr-TR').includes(cleanQuery);
  }

  function collectOutlineItems(messages) {
    if (!messages?.querySelectorAll) return [];
    const items = [];
    const articles = messages.querySelectorAll('.message.user[data-message-id]');
    for (const article of articles) {
      if (items.length >= MAX_OUTLINE_ITEMS) break;
      const id = normalizeMessageId(article?.dataset?.messageId);
      const content = article?.querySelector?.('.content');
      const preview = createPreview(content?.textContent || '');
      if (!id || !preview) continue;
      items.push(Object.freeze({ id, preview, turn: items.length + 1 }));
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

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-conversation-outline-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/conversation-outline.css';
    link.setAttribute('data-hafize-conversation-outline-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function install(documentRef, root) {
    if (!documentRef?.body || !root) return null;
    const messages = documentRef.querySelector?.('#messages');
    const topbar = documentRef.querySelector?.('.topbar');
    if (!messages || !topbar) return null;

    ensureStyles(documentRef);

    let items = [];
    let query = '';
    let open = false;
    let destroyed = false;
    let renderQueued = false;

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

    const head = documentRef.createElement('div');
    head.className = 'conversation-outline-head';

    const titleWrap = documentRef.createElement('div');
    titleWrap.className = 'conversation-outline-title-wrap';

    const title = documentRef.createElement('strong');
    title.id = 'conversationOutlineTitle';
    title.textContent = 'Sohbet taslağı';

    const count = documentRef.createElement('span');
    count.className = 'conversation-outline-count';
    count.setAttribute('aria-live', 'polite');

    titleWrap.append(title, count);

    const closeButton = documentRef.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'conversation-outline-close';
    closeButton.setAttribute('aria-label', 'Sohbet taslağını kapat');
    closeButton.textContent = '×';

    head.append(titleWrap, closeButton);

    const searchLabel = documentRef.createElement('label');
    searchLabel.className = 'conversation-outline-search-label';
    searchLabel.textContent = 'Kullanıcı turlarında ara';

    const searchInput = documentRef.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'conversation-outline-search';
    searchInput.maxLength = MAX_QUERY_CHARS;
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchInput.placeholder = 'Örn. GitHub, plan, kod…';
    searchInput.setAttribute('aria-controls', 'conversationOutlineList');
    searchInput.setAttribute('aria-describedby', 'conversationOutlineStatus');
    searchLabel.append(searchInput);

    const status = documentRef.createElement('p');
    status.id = 'conversationOutlineStatus';
    status.className = 'conversation-outline-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');

    const list = documentRef.createElement('div');
    list.id = 'conversationOutlineList';
    list.className = 'conversation-outline-list';
    list.setAttribute('role', 'list');

    panel.append(head, searchLabel, status, list);
    documentRef.body.append(panel);

    const themeToggle = topbar.querySelector?.('#themeToggle');
    if (themeToggle?.parentNode === topbar) topbar.insertBefore(trigger, themeToggle);
    else topbar.append(trigger);

    function visibleItems() {
      return items.filter((item) => matchesQuery(item.preview, query));
    }

    function positionPanel() {
      if (!open || typeof trigger.getBoundingClientRect !== 'function') return;
      const rect = trigger.getBoundingClientRect();
      const viewportWidth = Number(root.innerWidth) || 1280;
      const safeMargin = 12;
      const preferredWidth = Math.min(420, Math.max(280, viewportWidth - safeMargin * 2));
      const left = Math.min(
        Math.max(safeMargin, rect.right - preferredWidth),
        Math.max(safeMargin, viewportWidth - preferredWidth - safeMargin)
      );
      panel.style.setProperty('--conversation-outline-left', `${Math.round(left)}px`);
      panel.style.setProperty('--conversation-outline-top', `${Math.round(rect.bottom + 8)}px`);
      panel.style.setProperty('--conversation-outline-width', `${Math.round(preferredWidth)}px`);
    }

    function syncTrigger() {
      const total = items.length;
      trigger.disabled = total === 0;
      trigger.textContent = total ? `☷ Taslak ${total}` : '☷ Taslak';
      trigger.setAttribute('aria-expanded', String(open && total > 0));
      trigger.setAttribute('aria-label', total
        ? `Sohbet taslağını aç, ${total} kullanıcı turu`
        : 'Sohbet taslağı için kullanıcı mesajı yok');
      trigger.title = total ? 'Kullanıcı turları arasında hızlı gezin' : 'Kullanıcı mesajı yok';
    }

    function renderList() {
      if (destroyed) return;
      const visible = visibleItems();
      list.replaceChildren();
      count.textContent = `${items.length} tur`;

      if (!items.length) {
        status.textContent = 'Bu sohbette henüz kullanıcı turu yok.';
        return;
      }

      if (!visible.length) {
        status.textContent = 'Aramayla eşleşen kullanıcı turu yok.';
        const empty = documentRef.createElement('div');
        empty.className = 'conversation-outline-empty';
        empty.textContent = 'Başka bir arama deneyebilirsin.';
        list.append(empty);
        return;
      }

      status.textContent = query
        ? `${visible.length} / ${items.length} tur gösteriliyor.`
        : `${items.length} kullanıcı turu gösteriliyor.`;

      for (const item of visible) {
        const row = documentRef.createElement('div');
        row.className = 'conversation-outline-row';
        row.setAttribute('role', 'listitem');

        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'conversation-outline-item';
        button.dataset.messageId = item.id;
        button.setAttribute('aria-label', `${item.turn}. kullanıcı turuna git: ${item.preview}`);

        const number = documentRef.createElement('span');
        number.className = 'conversation-outline-turn';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = String(item.turn);

        const preview = documentRef.createElement('span');
        preview.className = 'conversation-outline-preview';
        preview.textContent = item.preview;

        button.append(number, preview);
        button.addEventListener('click', () => {
          const article = findMessageById(messages, item.id);
          if (!article) {
            scheduleRefresh();
            return;
          }
          close({ returnFocus: false });
          if (!article.hasAttribute?.('tabindex')) article.setAttribute?.('tabindex', '-1');
          article.focus?.({ preventScroll: true });
          const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
          article.scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
          article.classList?.add?.('conversation-outline-target');
          root.setTimeout?.(() => article.classList?.remove?.('conversation-outline-target'), 1400);
        });

        row.append(button);
        list.append(row);
      }
    }

    function refresh() {
      renderQueued = false;
      if (destroyed) return;
      items = collectOutlineItems(messages);
      if (!items.length && open) close({ returnFocus: false });
      syncTrigger();
      renderList();
      positionPanel();
    }

    function scheduleRefresh() {
      if (destroyed || renderQueued) return;
      renderQueued = true;
      const raf = typeof root.requestAnimationFrame === 'function'
        ? root.requestAnimationFrame.bind(root)
        : (callback) => root.setTimeout?.(callback, 0);
      raf(refresh);
    }

    function show() {
      if (destroyed || !items.length) return false;
      open = true;
      panel.hidden = false;
      documentRef.body.classList?.add?.('conversation-outline-open');
      syncTrigger();
      renderList();
      positionPanel();
      searchInput.focus?.();
      return true;
    }

    function close({ returnFocus = true } = {}) {
      if (!open && panel.hidden) return false;
      open = false;
      panel.hidden = true;
      documentRef.body.classList?.remove?.('conversation-outline-open');
      syncTrigger();
      if (returnFocus) trigger.focus?.();
      return true;
    }

    function toggle() {
      return open ? close() : show();
    }

    function onSearchInput() {
      query = normalizeQuery(searchInput.value);
      if (searchInput.value.length > MAX_QUERY_CHARS) searchInput.value = searchInput.value.slice(0, MAX_QUERY_CHARS);
      renderList();
    }

    function onDocumentKeydown(event) {
      if (event?.key !== 'Escape' || !open) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      close();
    }

    function onDocumentPointerDown(event) {
      if (!open) return;
      const target = event?.target;
      if (panel.contains?.(target) || trigger.contains?.(target)) return;
      close({ returnFocus: false });
    }

    function onViewportChange() {
      if (open) positionPanel();
    }

    trigger.addEventListener('click', toggle);
    closeButton.addEventListener('click', () => close());
    searchInput.addEventListener('input', onSearchInput);
    documentRef.addEventListener?.('keydown', onDocumentKeydown);
    documentRef.addEventListener?.('pointerdown', onDocumentPointerDown);
    root.addEventListener?.('resize', onViewportChange);
    root.addEventListener?.('scroll', onViewportChange, true);

    const observer = typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(() => scheduleRefresh())
      : null;
    observer?.observe(messages, { childList: true, subtree: true, characterData: true });

    refresh();

    return Object.freeze({
      getItems: () => Object.freeze(items.map((item) => Object.freeze({ ...item }))),
      isOpen: () => open,
      refresh,
      show,
      close,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect?.();
        trigger.removeEventListener?.('click', toggle);
        searchInput.removeEventListener?.('input', onSearchInput);
        documentRef.removeEventListener?.('keydown', onDocumentKeydown);
        documentRef.removeEventListener?.('pointerdown', onDocumentPointerDown);
        root.removeEventListener?.('resize', onViewportChange);
        root.removeEventListener?.('scroll', onViewportChange, true);
        documentRef.body.classList?.remove?.('conversation-outline-open');
        for (const article of messages.querySelectorAll?.('.conversation-outline-target') || []) {
          article.classList?.remove?.('conversation-outline-target');
        }
        trigger.remove?.();
        panel.remove?.();
      }
    });
  }

  return Object.freeze({
    MAX_OUTLINE_ITEMS,
    MAX_PREVIEW_CHARS,
    MAX_QUERY_CHARS,
    MAX_MESSAGE_ID_CHARS,
    normalizeMessageId,
    normalizeText,
    createPreview,
    normalizeQuery,
    matchesQuery,
    collectOutlineItems,
    findMessageById,
    install
  });
});
