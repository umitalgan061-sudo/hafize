(function installPromptCommandPalette(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const INPUT_ID = 'messageInput';
  const PALETTE_ID = 'promptLibraryCommandPalette';
  const MAX_RESULTS = 12;
  const MAX_QUERY = 120;
  const core = () => root.HafizePromptLibrary;

  const make = (doc, tag, text, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function loadItems() {
    try { return core()?.loadItems?.(root.localStorage) || []; } catch { return []; }
  }

  function score(item, query) {
    const q = query.toLocaleLowerCase('tr-TR').trim();
    if (!q) return 0;
    const title = String(item.title || '').toLocaleLowerCase('tr-TR');
    const tags = (item.tags || []).join(' ').toLocaleLowerCase('tr-TR');
    const body = String(item.body || '').toLocaleLowerCase('tr-TR');
    if (title === q) return 100;
    if (title.startsWith(q)) return 80;
    if (title.includes(q)) return 60;
    if (tags.includes(q)) return 45;
    if (body.includes(q)) return 20;
    return 0;
  }

  function results(query) {
    const items = loadItems();
    const normalized = String(query || '').slice(0, MAX_QUERY);
    return items.map((item) => ({ item, score: score(item, normalized) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.item.favorite) - Number(a.item.favorite) || b.item.updatedAt.localeCompare(a.item.updatedAt))
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.item);
  }

  function variableCount(item) {
    return core()?.extractVariables?.(item.body)?.length || 0;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const input = /** @type {HTMLTextAreaElement | null} */ (documentRef?.getElementById?.(INPUT_ID) ?? null);
    if (!documentRef || !input || documentRef.getElementById(PALETTE_ID)) return null;

    const palette = make(documentRef, 'section', undefined, 'prompt-command-palette');
    palette.id = PALETTE_ID;
    palette.hidden = true;
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'false');
    palette.setAttribute('aria-label', 'İstem seçici');

    const head = make(documentRef, 'div', undefined, 'prompt-command-palette-head');
    const heading = make(documentRef, 'strong', 'İstem seçici');
    const hint = make(documentRef, 'span', '↑ ↓ seç · Enter ekle · Esc kapat', 'prompt-command-palette-hint');
    head.append(heading, hint);
    const query = make(documentRef, 'input');
    query.type = 'search';
    query.maxLength = MAX_QUERY;
    query.placeholder = 'İstem ara…';
    query.setAttribute('aria-label', 'İstem seçicide ara');
    const list = make(documentRef, 'div', undefined, 'prompt-command-palette-list');
    list.setAttribute('role', 'listbox');
    const status = make(documentRef, 'div', '', 'prompt-command-palette-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    palette.append(head, query, list, status);
    documentRef.body.append(palette);

    let activeIndex = 0;
    let current = [];
    let triggerStart = -1;
    let previousFocus = null;

    function close() {
      palette.hidden = true;
      query.value = '';
      list.replaceChildren();
      current = [];
      activeIndex = 0;
      triggerStart = -1;
      previousFocus?.focus?.();
      previousFocus = null;
    }

    function insert(item) {
      const text = input.value;
      const start = triggerStart >= 0 ? triggerStart : 0;
      const before = text.slice(0, start).replace(/\/prompt(?:\s+[^\n]*)?$/, '');
      const marker = variableCount(item) ? `${item.title} · değişkenleri doldur` : item.title;
      if (variableCount(item) && rootRef.HafizePromptLibrarySmartFill?.open) {
        close();
        rootRef.HafizePromptLibrarySmartFill.open(item);
        return;
      }
      input.value = `${before}${item.body}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      close();
      rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:prompt-command-inserted', { detail: { id: item.id, title: marker } }));
    }

    function render() {
      current = results(query.value);
      list.replaceChildren();
      activeIndex = Math.min(activeIndex, Math.max(0, current.length - 1));
      if (!current.length) {
        status.textContent = loadItems().length ? 'Eşleşen istem bulunamadı.' : 'Kütüphanede istem yok.';
        return;
      }
      status.textContent = `${current.length} istem bulundu.`;
      current.forEach((item, index) => {
        const option = make(documentRef, 'button', undefined, 'prompt-command-palette-item');
        option.type = 'button';
        option.dataset.promptId = item.id;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(index === activeIndex));
        const main = make(documentRef, 'span', item.title, 'prompt-command-palette-name');
        const meta = make(documentRef, 'span', `${item.favorite ? '★ ' : ''}${item.tags?.slice(0, 2).join(' · ') || 'etiketsiz'}${variableCount(item) ? ` · ${variableCount(item)} değişken` : ''}`, 'prompt-command-palette-meta');
        option.append(main, meta);
        option.addEventListener('click', () => insert(item));
        list.append(option);
      });
      list.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }

    function open(start) {
      previousFocus = documentRef.activeElement;
      triggerStart = start;
      palette.hidden = false;
      query.value = '';
      activeIndex = 0;
      render();
      query.focus();
    }

    function move(delta) {
      if (!current.length) return;
      activeIndex = (activeIndex + delta + current.length) % current.length;
      [...list.children].forEach((node, index) => node.setAttribute('aria-selected', String(index === activeIndex)));
      list.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }

    function onInputKeydown(event) {
      const value = input.value;
      const cursor = input.selectionStart ?? value.length;
      const before = value.slice(0, cursor);
      const match = before.match(/(^|\s)\/prompt(?:\s+([^\n]*))?$/i);
      if (match && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        if (palette.hidden) open(cursor - match[0].length + (match[1] ? 1 : 0));
        if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
        if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
        if (event.key === 'Enter' && current[activeIndex]) { event.preventDefault(); insert(current[activeIndex]); }
        return;
      }
      if (match && palette.hidden && !event.ctrlKey && !event.metaKey && event.key === ' ') {
        open(cursor - match[0].length + (match[1] ? 1 : 0));
      }
    }

    function onInput(event) {
      const value = event.target.value;
      const cursor = event.target.selectionStart ?? value.length;
      const before = value.slice(0, cursor);
      const match = before.match(/(^|\s)\/prompt(?:\s+([^\n]*))?$/i);
      if (!match) { if (!palette.hidden) close(); return; }
      if (palette.hidden) open(cursor - match[0].length + (match[1] ? 1 : 0));
      query.value = (match[2] || '').slice(0, MAX_QUERY);
      activeIndex = 0;
      render();
    }

    function onQueryInput() { activeIndex = 0; render(); }
    function onPaletteKeydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      else if (event.key === 'Enter' && current[activeIndex]) { event.preventDefault(); insert(current[activeIndex]); }
    }
    function onGlobalShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
      event.preventDefault();
      if (palette.hidden) open(input.selectionStart ?? input.value.length); else close();
    }

    input.addEventListener('keydown', onInputKeydown);
    input.addEventListener('input', onInput);
    query.addEventListener('input', onQueryInput);
    palette.addEventListener('keydown', onPaletteKeydown);
    rootRef.addEventListener?.('keydown', onGlobalShortcut);

    return Object.freeze({ mounted: true, open, close, search: results, destroy: () => { close(); input.removeEventListener('keydown', onInputKeydown); input.removeEventListener('input', onInput); query.removeEventListener('input', onQueryInput); palette.removeEventListener('keydown', onPaletteKeydown); rootRef.removeEventListener?.('keydown', onGlobalShortcut); palette.remove(); } });
  }

  root.PromptLibraryCommandPalette = Object.freeze({ mount, results });
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
