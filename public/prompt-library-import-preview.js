(function installPromptLibraryImportPreview(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const MAX_FILE = 1000000;
  const MODAL_ID = 'promptLibraryImportPreview';
  const api = () => root.HafizePromptLibrary;
  let active = null;

  const make = (tag, textValue, className) => {
    const element = root.document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== undefined) element.textContent = textValue;
    return element;
  };
  const button = (label, className = 'soft-btn') => {
    const element = make('button', label, className);
    element.type = 'button';
    return element;
  };
  const status = (message) => {
    const node = root.document.querySelector(`#${CARD_ID} .prompt-library-status`);
    if (node) node.textContent = String(message || '').slice(0, 180);
  };
  const focusBack = (target) => root.setTimeout?.(() => target?.focus?.(), 0);

  function close(reason = 'cancel') {
    if (!active) return;
    const current = active;
    active = null;
    current.modal.remove();
    current.trigger?.focus?.();
    root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-import-preview', { detail: { reason } }));
  }

  function existingIds(items) { return new Set(items.map((item) => item.id)); }
  function duplicateCounts(current, incoming) {
    const ids = existingIds(current);
    const idsSeen = new Set();
    let sameId = 0;
    let capacity = 0;
    for (const item of incoming) {
      if (ids.has(item.id) || idsSeen.has(item.id)) sameId += 1;
      idsSeen.add(item.id);
    }
    capacity = Math.max(0, (api()?.LIMITS?.maxItems || 120) - current.length);
    return { sameId, capacity, overflow: Math.max(0, incoming.length - capacity) };
  }
  function normalizedPayload(text) {
    const source = String(text || '');
    if (source.length > MAX_FILE) throw new Error('oversize');
    const parsed = JSON.parse(source);
    const payload = api()?.normalizeImportedPayload?.(parsed);
    if (!payload) throw new Error('invalid');
    return payload;
  }

  function importNow(incoming, trigger) {
    const library = api();
    if (!library?.mergeImportedItems || !library?.saveItems) return status('İçe aktarma modülü hazır değil.');
    const current = library.loadItems?.(root.localStorage) || [];
    const merged = library.mergeImportedItems(current, incoming);
    if (!merged || !library.saveItems(root.localStorage, merged.items)) return status('İçe aktarma kaydedilemedi.');
    try {
      root.dispatchEvent?.(new root.StorageEvent('storage', { key: library.STORAGE_KEY, newValue: JSON.stringify(merged.items), storageArea: root.localStorage }));
    } catch {
      root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh'));
    }
    close('imported');
    status(`${merged.imported} istem içe aktarıldı.`);
    focusBack(trigger);
  }

  function showPreview(payload, trigger) {
    const library = api();
    const current = library?.loadItems?.(root.localStorage) || [];
    const incoming = Array.isArray(payload.items) ? payload.items : [];
    const counts = duplicateCounts(current, incoming);

    const modal = make('div', undefined, 'prompt-library-import-preview');
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'promptLibraryImportPreviewTitle');
    modal.tabIndex = -1;

    const panel = make('section', undefined, 'prompt-library-import-preview-panel');
    const header = make('div', undefined, 'prompt-library-import-preview-header');
    const title = make('h3', 'İçe aktarma önizlemesi');
    title.id = 'promptLibraryImportPreviewTitle';
    const closeButton = button('Kapat', 'mini-btn');
    header.append(title, closeButton);

    const summary = make('div', undefined, 'prompt-library-import-preview-summary');
    const rows = [
      ['Dosyadaki kayıt', incoming.length],
      ['Mevcut kayıt', current.length],
      ['Çakışan kimlik', counts.sameId],
      ['Kapasite', counts.capacity],
      ['Kapasite dışı', counts.overflow]
    ];
    for (const [label, value] of rows) {
      const row = make('div', undefined, 'prompt-library-import-stat');
      row.append(make('strong', String(value)), make('span', label));
      summary.append(row);
    }

    const meta = make('p', payload.meta?.source ? `Kaynak: ${payload.meta.source}` : 'Kaynak bilgisi bulunmuyor.', 'prompt-library-import-preview-meta');
    const note = make('p', 'Çakışan kimlikler mevcut kaydın üzerine yazılmaz; yeni kimliklerle eklenir. Kütüphane sınırı aşılırsa yalnızca kapasite kadar kayıt eklenir.', 'prompt-library-import-preview-note');
    const list = make('div', undefined, 'prompt-library-import-preview-list');
    const sample = incoming.slice(0, 6);
    sample.forEach((item, index) => {
      const entry = make('div', undefined, 'prompt-library-import-preview-item');
      entry.append(make('span', `${index + 1}.`, 'prompt-library-import-preview-index'), make('span', item.title || 'İsimsiz istem', 'prompt-library-import-preview-name'));
      list.append(entry);
    });
    if (!sample.length) list.append(make('div', 'İçe aktarılacak geçerli kayıt bulunamadı.', 'prompt-library-import-preview-empty'));
    else if (incoming.length > sample.length) list.append(make('div', `… ve ${incoming.length - sample.length} kayıt daha.`, 'prompt-library-import-preview-more'));

    const feedback = make('div', '', 'prompt-library-import-preview-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    const actions = make('div', undefined, 'prompt-library-import-preview-actions');
    const cancel = button('Vazgeç');
    const confirm = button(counts.overflow ? `Kapasite kadar ekle (${counts.capacity})` : `İçe aktar (${incoming.length})`);
    confirm.disabled = !incoming.length || !counts.capacity;
    actions.append(cancel, confirm);

    panel.append(header, summary, meta, note, list, feedback, actions);
    modal.append(panel);
    (root.document.body || root.document.documentElement).append(modal);
    active = { modal, trigger };

    const focusables = () => [...modal.querySelectorAll('button:not([disabled])')];
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusables(); if (!nodes.length) return;
      const index = nodes.indexOf(root.document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); nodes.at(-1).focus(); }
      else if (!event.shiftKey && index === nodes.length - 1) { event.preventDefault(); nodes[0].focus(); }
    };
    const onBackdrop = (event) => { if (event.target === modal) close('backdrop'); };
    modal.addEventListener('keydown', onKey);
    modal.addEventListener('click', onBackdrop);
    closeButton.addEventListener('click', () => close());
    cancel.addEventListener('click', () => close());
    confirm.addEventListener('click', () => importNow(incoming, trigger));
    root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-import-preview-ready', { detail: { incoming: incoming.length, conflicts: counts.sameId, overflow: counts.overflow } }));
    focusables()[0]?.focus?.();
  }

  function onFileChange(event) {
    const input = event.target;
    if (!(input instanceof root.HTMLInputElement) || input.type !== 'file') return;
    const card = root.document.getElementById(CARD_ID);
    if (!card || !card.contains(input) || input.accept.indexOf('json') === -1) return;
    event.stopImmediatePropagation();
    const trigger = root.document.activeElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_FILE) return status('İçe aktarma dosyası 1 MB sınırını aşamaz.');
    const reader = new FileReader();
    reader.onload = () => {
      try { showPreview(normalizedPayload(String(reader.result || '')), trigger); }
      catch (error) { status(error?.message === 'oversize' ? 'İçe aktarma dosyası 1 MB sınırını aşamaz.' : 'Geçersiz istem yedeği.'); }
    };
    reader.onerror = () => status('İstem yedeği okunamadı.');
    reader.readAsText(file);
  }

  function mount() {
    if (!root.document || !api()) return null;
    const card = root.document.getElementById(CARD_ID);
    if (!card || card.dataset.promptImportPreviewMounted === 'true') return null;
    card.dataset.promptImportPreviewMounted = 'true';
    card.addEventListener('change', onFileChange, true);
    return Object.freeze({ showPreview, close, normalizedPayload, duplicateCounts, destroy });
  }
  function destroy() {
    const card = root.document?.getElementById?.(CARD_ID);
    card?.removeEventListener?.('change', onFileChange, true);
    card?.removeAttribute?.('data-prompt-import-preview-mounted');
    close('destroy');
  }

  const exposed = Object.freeze({ mount, close, normalizedPayload, duplicateCounts, LIMITS: Object.freeze({ MAX_FILE }) });
  root.HafizePromptLibraryImportPreview = exposed;
  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
