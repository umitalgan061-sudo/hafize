// TypeScript migration wave: compiled through Vite/Rolldown.\n// The browser-global surface is kept stable for compatibility with sibling modules.\n// @ts-nocheck\n(function installPromptCollectionEnhancements(root) {
  'use strict';
  const CARD = '#promptLibraryCard';
  const COLLECTIONS = '#promptLibraryCollections';
  const STORAGE_KEY = 'hafize.prompt-library.collections.v1';
  const MAX_SELECTION = 40;
  let booted = false;
  let observer = null;
  const listeners = [];

  const api = () => root.HafizePromptLibraryCollections;
  const storage = () => root.localStorage;
  const doc = () => root.document;
  const read = () => api()?.readCollections?.(storage()) || [];
  const promptSelection = () => [...doc()?.querySelectorAll?.('#promptLibraryList [data-prompt-selection]:checked') || []]
    .map((node) => node.dataset.promptSelection).filter(Boolean).slice(0, MAX_SELECTION);
  const announce = (message) => {
    const node = doc()?.querySelector?.(`${COLLECTIONS} .prompt-library-collections-status`);
    if (!node) return;
    node.textContent = String(message ?? '').slice(0, 160);
    root.setTimeout?.(() => { if (node.textContent === String(message ?? '').slice(0, 160)) node.textContent = ''; }, 2600);
  };
  const button = (label, action, cls = 'mini-btn') => {
    const node = doc().createElement('button');
    node.type = 'button';
    node.className = cls;
    node.textContent = label;
    node.dataset.promptCollectionAction = action;
    node.setAttribute('aria-label', label);
    return node;
  };

  function sync() {
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-collections-changed', { detail: { key: STORAGE_KEY } })); } catch {}
  }

  function clearSelection() {
    doc()?.querySelectorAll?.('#promptLibraryList [data-prompt-selection]').forEach((node) => { node.checked = false; });
    renderTools();
  }

  function createFromSelection() {
    const ids = promptSelection();
    if (!ids.length) return announce('Önce istem seç.');
    const name = root.prompt?.('Koleksiyon adı:', 'Seçili istemler');
    if (name === null || name === undefined) return;
    const created = api()?.createCollection?.({ name, description: `${ids.length} seçili istem` }, storage());
    if (!created) return announce('Koleksiyon oluşturulamadı.');
    api()?.setMembership?.(created.id, ids, storage());
    sync();
    clearSelection();
    announce('Seçili istemlerden koleksiyon oluşturuldu.');
  }

  function duplicateCollection(collection) {
    if (read().length >= (api()?.MAX_COLLECTIONS || 40)) return announce('Koleksiyon sınırı dolu.');
    const created = api()?.createCollection?.({
      name: `${collection.name} kopyası`,
      description: collection.description,
      color: collection.color,
      promptIds: collection.promptIds
    }, storage());
    if (!created) return announce('Koleksiyon çoğaltılamadı.');
    api()?.setMembership?.(created.id, collection.promptIds, storage());
    sync();
    announce('Koleksiyon çoğaltıldı.');
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-prompt-collection-action]');
    if (!target) return;
    const action = target.dataset.promptCollectionAction;
    const row = target.closest('[data-collection-id]');
    const collection = row ? read().find((item) => item.id === row.dataset.collectionId) : null;
    if (action === 'create-from-selection') return createFromSelection();
    if (action === 'clear-selection') return clearSelection();
    if (action === 'duplicate' && collection) return duplicateCollection(collection);
    if (action === 'select-all') {
      const rows = [...doc().querySelectorAll('#promptLibraryList .prompt-item [data-prompt-selection]')].slice(0, MAX_SELECTION);
      rows.forEach((node) => { node.checked = true; });
      renderTools();
      return announce(`${rows.length} istem seçildi.`);
    }
  }

  function renderTools() {
    const panel = doc()?.querySelector?.(COLLECTIONS);
    if (!panel) return;
    let toolbar = panel.querySelector('.prompt-library-collections-enhancement-toolbar');
    if (!toolbar) {
      toolbar = doc().createElement('div');
      toolbar.className = 'prompt-library-collections-enhancement-toolbar';
      panel.querySelector('.prompt-library-collections-body')?.prepend(toolbar);
      toolbar.addEventListener('click', onClick);
      listeners.push(() => toolbar.removeEventListener('click', onClick));
    }
    toolbar.replaceChildren(
      button('Seçilenlerden koleksiyon', 'create-from-selection'),
      button('Tümünü seç', 'select-all'),
      button('Seçimi kaldır', 'clear-selection')
    );

    panel.querySelectorAll('[data-collection-id]').forEach((row) => {
      const actions = row.querySelector('.prompt-library-collection-actions');
      if (!actions || actions.querySelector('[data-prompt-collection-action="duplicate"]')) return;
      actions.append(button('Çoğalt', 'duplicate'));
    });
  }

  function boot() {
    if (booted || !api() || !doc()) return;
    const panel = doc().querySelector(COLLECTIONS);
    if (!panel) return;
    booted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(() => renderTools()) : null;
    observer?.observe(panel, { childList: true, subtree: true });
    root.addEventListener?.('hafize:prompt-library-collections-changed', renderTools);
    listeners.push(() => root.removeEventListener?.('hafize:prompt-library-collections-changed', renderTools));
    root.addEventListener?.('keydown', onKeydown);
    listeners.push(() => root.removeEventListener?.('keydown', onKeydown));
    renderTools();
  }

  function onKeydown(event) {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier || !event.shiftKey || event.key.toLowerCase() !== 'l') return;
    const active = doc()?.activeElement;
    if (active?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    event.preventDefault();
    doc()?.querySelector?.(`${COLLECTIONS} input[type="search"]`)?.focus?.();
  }

  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  root.addEventListener?.('beforeunload', () => { observer?.disconnect?.(); for (const off of listeners.splice(0)) off(); });
})(typeof globalThis !== 'undefined' ? globalThis : self);
