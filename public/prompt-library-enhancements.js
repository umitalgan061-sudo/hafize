(function installPromptLibraryEnhancements(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const STATE_KEY = `${STORAGE_KEY}.state`;
  const MAX_ITEMS = 120;
  const MAX_SELECTION = 40;
  const STARTER_TITLES = new Set([
    'Metin editörü', 'Kısa özet', 'Kod incelemesi', 'Toplantı notu', 'Araştırma çerçevesi',
    'Planlayıcı', 'Karar matrisi', 'E-posta taslağı', 'Test senaryoları', 'Fikirden gereksinime'
  ]);
  let mounted = false;
  let observer = null;
  const listeners = [];

  const api = root.HafizePromptLibrary;
  function storage() { return root.localStorage; }
  function load() { return api?.loadItems?.(storage()) || []; }
  function persist(items) { return api?.saveItems?.(storage(), items) === true; }
  function state() { return api?.loadState?.(storage()) || { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' }; }
  function saveState(value) { return api?.saveState?.(storage(), value) === true; }
  function uid() { return root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function copyText(value) {
    if (root.navigator?.clipboard?.writeText) return root.navigator.clipboard.writeText(value);
    return Promise.reject(new Error('CLIPBOARD_UNAVAILABLE'));
  }
  function text(node, value) { if (node) node.textContent = String(value ?? ''); }
  function button(label, action) { const node = document.createElement('button'); node.type = 'button'; node.className = 'soft-btn prompt-enhancement-action'; node.textContent = label; node.dataset.promptEnhancement = action; return node; }

  function report(message) {
    const status = document.querySelector('#promptLibraryCard .prompt-library-status');
    text(status, message);
    root.setTimeout?.(() => { if (status?.textContent === message) status.textContent = ''; }, 3200);
  }

  function duplicate(id) {
    const items = load();
    const original = items.find((item) => item.id === id);
    if (!original) return;
    if (items.length >= MAX_ITEMS) return report('Kütüphane sınırı dolu.');
    const copy = api.normalizeItem({ ...original, id: uid(), title: `${original.title} kopyası`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), favorite: false, useCount: 0 });
    if (!copy || !persist([copy, ...items])) return report('İstem çoğaltılamadı.');
    report('İstem çoğaltıldı.');
  }

  function restoreStarters() {
    const items = load();
    if (items.some((item) => STARTER_TITLES.has(item.title))) return report('Başlangıç istemlerinin bazıları zaten mevcut.');
    const changed = document.createElement('textarea');
    changed.hidden = true;
    changed.textContent = 'starter-seed-marker';
    document.querySelector('#promptLibraryCard')?.append(changed);
    report('Başlangıç seti hazır olduğunda yeniden seed etmek için kartı yenileyin.');
    changed.remove();
  }

  function clearFilters() {
    const next = { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' };
    saveState(next);
    report('İstem filtreleri sıfırlandı.');
    root.dispatchEvent?.(new CustomEvent('hafize:prompt-library-reset', { detail: next }));
    const search = document.querySelector('#promptLibrarySearch');
    search?.focus?.();
  }

  function enhanceRows() {
    const card = document.querySelector('#promptLibraryCard');
    if (!card) return;
    const list = card.querySelector('#promptLibraryList');
    if (!list) return;
    const bulk = card.querySelector('.prompt-library-enhancement-toolbar');
    if (!bulk) {
      const toolbar = document.createElement('div');
      toolbar.className = 'prompt-library-enhancement-toolbar';
      toolbar.append(button('Filtreleri sıfırla', 'clear-filters'), button('Başlangıç seti', 'restore-starters'));
      card.querySelector('.prompt-library-filters')?.after(toolbar);
      toolbar.addEventListener('click', onEnhancementClick);
    }
    list.querySelectorAll('.prompt-item').forEach((row) => {
      if (row.querySelector('.prompt-enhancement-action')) return;
      const id = row.dataset.promptId;
      if (!id) return;
      const actions = row.querySelector('.prompt-item-actions');
      if (!actions) return;
      actions.append(button('Kopyala', 'copy'), button('Çoğalt', 'duplicate'));
      const checkbox = row.querySelector('input[type="checkbox"]');
      checkbox?.setAttribute('data-prompt-selection', id);
    });
    if (!list.querySelector('.prompt-library-enhancement-bulk') && card.querySelectorAll('[data-prompt-selection]:checked').length) {
      const bulk = document.createElement('div'); bulk.className = 'prompt-library-enhancement-bulk';
      bulk.append(button('Seçilenleri sil', 'bulk-delete'), button('Seçimi kaldır', 'bulk-clear'));
      list.prepend(bulk); bulk.addEventListener('click', onEnhancementClick);
    }
  }

  function selectedIds() {
    return [...document.querySelectorAll('#promptLibraryCard [data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection).slice(0, MAX_SELECTION);
  }

  function onEnhancementClick(event) {
    const target = event.target?.closest?.('[data-prompt-enhancement]');
    if (!target) return;
    const action = target.dataset.promptEnhancement;
    if (action === 'clear-filters') return clearFilters();
    if (action === 'restore-starters') return restoreStarters();
    if (action === 'bulk-clear') { document.querySelectorAll('#promptLibraryCard [data-prompt-selection]').forEach((node) => { node.checked = false; }); enhanceRows(); return; }
    const row = target.closest('.prompt-item');
    const id = row?.dataset.promptId;
    if (action === 'duplicate') return duplicate(id);
    if (action === 'bulk-delete') {
      const ids = new Set(selectedIds());
      if (!ids.size) return report('Seçili istem yok.');
      if (!root.confirm?.(`${ids.size} istem silinsin mi?`)) return;
      const items = load().filter((item) => !ids.has(item.id));
      persist(items); report('Seçilen istemler silindi.');
      return;
    }
    if (action === 'copy') {
      const item = load().find((candidate) => candidate.id === id);
      if (!item) return;
      copyText(item.body).then(() => report('İstem panoya kopyalandı.')).catch(() => report('Panoya kopyalama kullanılamıyor.'));
    }
  }

  function install() {
    if (mounted || !document.querySelector('#promptLibraryCard')) return false;
    mounted = true;
    observer = new MutationObserver(enhanceRows);
    observer.observe(document.querySelector('#promptLibraryCard'), { childList: true, subtree: true });
    enhanceRows();
    return true;
  }

  function boot() {
    if (!api) return;
    if (install()) return;
    const rootObserver = new MutationObserver(() => { if (install()) rootObserver.disconnect(); });
    rootObserver.observe(document.documentElement, { childList: true, subtree: true });
    listeners.push(() => rootObserver.disconnect());
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  root.addEventListener?.('beforeunload', () => { observer?.disconnect?.(); for (const off of listeners.splice(0)) off(); });
})(typeof globalThis !== 'undefined' ? globalThis : self);
