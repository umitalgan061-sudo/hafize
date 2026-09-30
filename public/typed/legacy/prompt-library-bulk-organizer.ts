(function installPromptLibraryBulkOrganizer(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const MAX_SELECTION = 40;
  const MAX_TAGS = 8;
  const MAX_TAG = 24;
  const PANEL_ID = 'promptLibraryBulkOrganizer';
  const api = () => root.HafizePromptLibrary;
  let mounted = false;
  let dialog = null;

  const make = (tag, textValue, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  };
  const button = (label, className = 'soft-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    return node;
  };
  const trimTag = (value) => String(value || '').trim().slice(0, MAX_TAG).replace(/[,\r\n]/g, ' ');
  const status = (message) => {
    const node = root.document.querySelector(`#${CARD_ID} .prompt-library-status`);
    if (node) node.textContent = String(message || '').slice(0, 180);
  };
  const ids = () => [...root.document.querySelectorAll(`#${CARD_ID} [data-prompt-selection]:checked`)].map((node) => node.dataset.promptSelection).filter(Boolean).slice(0, MAX_SELECTION);

  function readItems() { return api()?.loadItems?.(root.localStorage) || []; }
  function writeItems(items) {
    const library = api();
    if (!library?.saveItems) return false;
    const ok = library.saveItems(root.localStorage, items);
    if (!ok) return false;
    try { root.dispatchEvent?.(new root.StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(items), storageArea: root.localStorage })); }
    catch { root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh')); }
    return true;
  }
  function normalizeTags(values) {
    const seen = new Set(); const result = [];
    for (const raw of values) {
      const tag = trimTag(raw); const key = tag.toLocaleLowerCase('tr-TR');
      if (!tag || seen.has(key)) continue;
      seen.add(key); result.push(tag); if (result.length >= MAX_TAGS) break;
    }
    return result;
  }
  function close() { dialog?.remove(); dialog = null; }

  function apply(mode) {
    const selection = new Set(ids());
    const tagInput = dialog?.querySelector?.('[data-bulk-tags]');
    const tags = normalizeTags(String(tagInput?.value || '').split(','));
    const favorite = dialog?.querySelector?.('[data-bulk-favorite]')?.value || 'keep';
    if (!selection.size) return status('Seçili istem yok.');
    if ((mode === 'add-tags' || mode === 'replace-tags') && !tags.length) return status('En az bir etiket gir.');
    const current = readItems();
    const next = current.map((item) => {
      if (!selection.has(item.id)) return item;
      const nextTags = mode === 'replace-tags' ? tags : mode === 'remove-tags' ? item.tags.filter((tag) => !tags.some((value) => value.toLocaleLowerCase('tr-TR') === tag.toLocaleLowerCase('tr-TR'))) : normalizeTags([...item.tags, ...tags]);
      return api().normalizeItem({ ...item, tags: nextTags, favorite: favorite === 'keep' ? item.favorite : favorite === 'on', updatedAt: new Date().toISOString() });
    });
    if (!writeItems(next)) return status('Toplu değişiklik kaydedilemedi.');
    close(); status(`${selection.size} istem güncellendi.`);
  }

  function renderDialog() {
    const doc = root.document;
    dialog = make('div', undefined, 'prompt-library-bulk-organizer');
    dialog.id = PANEL_ID; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptLibraryBulkTitle'); tabIndex(dialog, -1);
    const panel = make('section', undefined, 'prompt-library-bulk-panel');
    const header = make('div', undefined, 'prompt-library-bulk-header'); const title = make('h3', 'Toplu düzenle'); title.id = 'promptLibraryBulkTitle';
    const closeButton = button('Kapat', 'mini-btn'); header.append(title, closeButton);
    const count = make('p', `${ids().length} istem seçildi.`, 'prompt-library-bulk-count');
    const label = make('label', 'Etiketler'); const tagInput = make('input'); tagInput.type = 'text'; tagInput.maxLength = 220; tagInput.placeholder = 'etiket1, etiket2'; tagInput.dataset.bulkTags = 'true'; tagInput.setAttribute('aria-label', 'Toplu etiketler'); label.htmlFor = 'promptBulkTags'; tagInput.id = 'promptBulkTags';
    const help = make('div', 'Etiket ekle/çıkar için virgülle ayır. En fazla 8 etiket tutulur.', 'prompt-library-bulk-help');
    const favoriteLabel = make('label', 'Favori durumu'); const favorite = make('select'); favorite.id = 'promptBulkFavorite'; favorite.setAttribute('aria-label', 'Toplu favori durumu'); favorite.dataset.bulkFavorite = 'true';
    for (const [value, labelText] of [['keep', 'Mevcut durumu koru'], ['on', 'Favoriye al'], ['off', 'Favoriden çıkar']]) { const option = make('option', labelText); option.value = value; favorite.append(option); }
    favoriteLabel.htmlFor = favorite.id;
    const actions = make('div', undefined, 'prompt-library-bulk-actions');
    const add = button('Etiket ekle'); const replace = button('Etiketleri değiştir'); const remove = button('Etiketleri çıkar'); const cancel = button('Vazgeç'); actions.append(add, replace, remove, cancel);
    panel.append(header, count, label, tagInput, help, favoriteLabel, favorite, actions); dialog.append(panel); doc.body.append(dialog);
    closeButton.addEventListener('click', close); cancel.addEventListener('click', close); add.addEventListener('click', () => apply('add-tags')); replace.addEventListener('click', () => apply('replace-tags')); remove.addEventListener('click', () => apply('remove-tags'));
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    root.setTimeout?.(() => tagInput.focus(), 0);
  }
  function tabIndex(node, value) { node.tabIndex = value; }

  function addToolbar() {
    const toolbar = root.document.querySelector(`#${CARD_ID} .prompt-library-enhancement-toolbar`);
    if (!toolbar || toolbar.querySelector('[data-bulk-organizer]')) return;
    const openButton = button('Toplu düzenle'); openButton.dataset.bulkOrganizer = 'true'; openButton.setAttribute('aria-label', 'Seçili istemleri toplu düzenle');
    openButton.addEventListener('click', () => { if (!ids().length) return status('Önce istem seç.'); close(); renderDialog(); });
    toolbar.append(openButton);
  }
  function observe() {
    const card = root.document.getElementById(CARD_ID); if (!card) return null;
    const observer = typeof root.MutationObserver === 'function' ? new root.MutationObserver(addToolbar) : null;
    observer?.observe(card, { childList: true, subtree: true }); addToolbar();
    return observer;
  }
  function mount() {
    if (mounted || !root.document || !api()) return null;
    const card = root.document.getElementById(CARD_ID); if (!card) return null;
    mounted = true;
    const observer = observe();
    return Object.freeze({ open: renderDialog, close, normalizeTags, apply, destroy: () => { observer?.disconnect?.(); close(); mounted = false; } });
  }
  const exposed = Object.freeze({ mount, normalizeTags, LIMITS: Object.freeze({ MAX_SELECTION, MAX_TAGS, MAX_TAG }) });
  root.HafizePromptLibraryBulkOrganizer = exposed;
  const boot = () => mount(); if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
