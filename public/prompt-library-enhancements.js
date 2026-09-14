(function installPromptLibraryEnhancements(root) {
  'use strict';
  const MAX_ITEMS = 120;
  const MAX_SELECTION = 40;
  let mounted = false;
  let observer = null;
  const listeners = [];
  const api = root.HafizePromptLibrary;

  const storage = () => root.localStorage;
  const load = () => api?.loadItems?.(storage()) || [];
  const persist = (items) => api?.saveItems?.(storage(), items) === true;
  const report = (message) => {
    const status = root.document?.querySelector?.('#promptLibraryCard .prompt-library-status');
    if (!status) return;
    status.textContent = String(message ?? '').slice(0, 180);
    root.setTimeout?.(() => { if (status.textContent === String(message ?? '').slice(0, 180)) status.textContent = ''; }, 3200);
  };
  const makeButton = (label, action) => {
    const node = root.document.createElement('button');
    node.type = 'button'; node.className = 'soft-btn prompt-enhancement-action'; node.textContent = label; node.dataset.promptEnhancement = action;
    return node;
  };
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function copyItem(item) {
    const copy = root.navigator?.clipboard?.writeText?.(item.body);
    if (!copy?.then) return report('Panoya kopyalama kullanılamıyor.');
    copy.then(() => report('İstem panoya kopyalandı.')).catch(() => report('Panoya kopyalama kullanılamıyor.'));
  }

  function duplicateItem(item) {
    const items = load();
    if (items.length >= MAX_ITEMS) return report('Kütüphane sınırı dolu.');
    const copy = api.normalizeItem({ ...item, id: makeId(), title: `${item.title} kopyası`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), favorite: false, useCount: 0 });
    if (!copy || !persist([copy, ...items])) return report('İstem çoğaltılamadı.');
    root.dispatchEvent?.(new CustomEvent('hafize:prompt-library-changed'));
    report('İstem çoğaltıldı.');
  }

  function restoreStarters() {
    const starterApi = root.HafizePromptLibraryStarters;
    if (!starterApi?.seed) return report('Başlangıç seti modülü kullanılamıyor.');
    const changed = starterApi.seed({ force: true });
    root.dispatchEvent?.(new CustomEvent('hafize:prompt-library-changed'));
    report(changed ? 'Eksik başlangıç istemleri eklendi.' : 'Başlangıç istemlerinin tamamı zaten mevcut.');
  }

  function clearFilters() {
    const next = { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' };
    api.saveState(storage(), next);
    root.dispatchEvent?.(new CustomEvent('hafize:prompt-library-state-changed', { detail: next }));
    root.document.querySelector('#promptLibrarySearch')?.focus?.();
    report('İstem filtreleri sıfırlandı.');
  }

  function selectedIds(card) {
    return [...card.querySelectorAll('[data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection).slice(0, MAX_SELECTION);
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-prompt-enhancement]');
    if (!target) return;
    const action = target.dataset.promptEnhancement;
    const card = root.document.querySelector('#promptLibraryCard');
    if (!card) return;
    if (action === 'copy') {
      const item = load().find((candidate) => candidate.id === target.closest('.prompt-item')?.dataset.promptId);
      if (item) copyItem(item);
      return;
    }
    if (action === 'duplicate') {
      const item = load().find((candidate) => candidate.id === target.closest('.prompt-item')?.dataset.promptId);
      if (item) duplicateItem(item);
      return;
    }
    if (action === 'restore-starters') return restoreStarters();
    if (action === 'clear-filters') return clearFilters();
    if (action === 'bulk-clear') {
      card.querySelectorAll('[data-prompt-selection]').forEach((node) => { node.checked = false; });
      enhance();
      return;
    }
    if (action === 'bulk-delete') {
      const ids = new Set(selectedIds(card));
      if (!ids.size) return report('Seçili istem yok.');
      if (!root.confirm?.(`${ids.size} istem silinsin mi?`)) return;
      persist(load().filter((item) => !ids.has(item.id)));
      root.dispatchEvent?.(new CustomEvent('hafize:prompt-library-changed'));
      report('Seçilen istemler silindi.');
    }
  }

  function enhance() {
    const card = root.document?.querySelector?.('#promptLibraryCard');
    const list = card?.querySelector?.('#promptLibraryList');
    if (!card || !list) return;
    let toolbar = card.querySelector('.prompt-library-enhancement-toolbar');
    if (!toolbar) {
      toolbar = root.document.createElement('div'); toolbar.className = 'prompt-library-enhancement-toolbar';
      toolbar.append(makeButton('Filtreleri sıfırla', 'clear-filters'), makeButton('Başlangıç seti', 'restore-starters'));
      card.querySelector('.prompt-library-filters')?.after(toolbar);
      listeners.push(() => toolbar.removeEventListener('click', onClick));
      toolbar.addEventListener('click', onClick);
    }
    list.querySelectorAll('.prompt-item').forEach((row) => {
      const id = row.dataset.promptId;
      const actions = row.querySelector('.prompt-item-actions');
      if (!id || !actions || actions.querySelector('[data-prompt-enhancement="copy"]')) return;
      actions.append(makeButton('Kopyala', 'copy'), makeButton('Çoğalt', 'duplicate'));
      row.querySelector('input[type="checkbox"]')?.setAttribute('data-prompt-selection', id);
    });
    const hasSelection = selectedIds(card).length > 0;
    const existingBulk = list.querySelector('.prompt-library-enhancement-bulk');
    if (hasSelection && !existingBulk) {
      const bulk = root.document.createElement('div'); bulk.className = 'prompt-library-enhancement-bulk';
      bulk.append(makeButton('Seçilenleri sil', 'bulk-delete'), makeButton('Seçimi kaldır', 'bulk-clear'));
      list.prepend(bulk); bulk.addEventListener('click', onClick);
    } else if (!hasSelection) existingBulk?.remove();
  }

  function boot() {
    if (mounted || !api || !root.document) return;
    const card = root.document.querySelector('#promptLibraryCard');
    if (!card) return;
    mounted = true;
    observer = new MutationObserver(() => enhance());
    observer.observe(card, { childList: true, subtree: true });
    enhance();
    root.addEventListener?.('hafize:prompt-library-changed', enhance);
    listeners.push(() => root.removeEventListener?.('hafize:prompt-library-changed', enhance));
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  root.addEventListener?.('beforeunload', () => { observer?.disconnect?.(); for (const off of listeners.splice(0)) off(); });
})(typeof globalThis !== 'undefined' ? globalThis : self);
