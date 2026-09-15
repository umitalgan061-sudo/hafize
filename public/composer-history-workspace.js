(function installComposerHistoryWorkspace(root) {
  'use strict';
  const CARD_ID = 'composerHistoryWorkspace';
  const INPUT_ID = 'messageInput';
  const STORAGE_KEY = 'hafize.composer-history.v1';
  const MAX_ITEMS = 40;
  const MAX_QUERY = 120;
  const MAX_EXPORT = 500000;
  let state = null;

  const api = () => root.HafizeComposerHistory;
  const storage = () => root.localStorage;
  const text = (doc, tag, value, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const button = (doc, label, className = 'soft-btn') => {
    const node = text(doc, 'button', label, className);
    node.type = 'button';
    return node;
  };
  const normalized = (value) => String(value ?? '').replace(/\0/g, '').trim().slice(0, 12000);

  function readItems() {
    const source = api()?.load?.() || [];
    return Array.isArray(source) ? source.filter((item) => typeof item === 'string' && item.trim()).slice(0, MAX_ITEMS) : [];
  }

  function writeItems(items) {
    return api()?.save?.(items) === true;
  }

  function matches(item, query) {
    return !query || item.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'));
  }

  function visibleItems() {
    const items = state.items;
    return items.filter((item) => matches(item, state.query)).slice(0, MAX_ITEMS);
  }

  function close() {
    if (!state) return;
    state.card.hidden = true;
    state.trigger?.focus?.();
    state.trigger = null;
  }

  function open(trigger) {
    if (!state) return;
    state.items = readItems();
    state.query = '';
    state.trigger = trigger || root.document.activeElement;
    state.card.hidden = false;
    state.search.value = '';
    render();
    state.search.focus();
  }

  function selectItem(item) {
    const input = root.document.getElementById(INPUT_ID);
    if (!input) return close();
    input.value = normalized(item);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    close();
  }

  function clearHistory() {
    if (!root.confirm?.('Composer geçmişindeki kayıtların tamamı silinsin mi?')) return;
    if (!api()?.save?.([])) return setStatus('Geçmiş temizlenemedi.');
    state.items = [];
    render();
    setStatus('Composer geçmişi temizlendi.');
  }

  function deleteItem(item) {
    const next = state.items.filter((candidate) => candidate !== item);
    if (next.length === state.items.length) return;
    if (!writeItems(next)) return setStatus('Kayıt silinemedi.');
    state.items = next;
    render();
    setStatus('Kayıt silindi.');
  }

  function copyItem(item) {
    const promise = root.navigator?.clipboard?.writeText?.(item);
    if (!promise?.then) return setStatus('Panoya kopyalama kullanılamıyor.');
    promise.then(() => setStatus('Kayıt panoya kopyalandı.')).catch(() => setStatus('Panoya kopyalama kullanılamıyor.'));
  }

  function exportItems() {
    const payload = JSON.stringify({ version: 1, source: 'hafize-composer-history', exportedAt: new Date().toISOString(), items: state.items.slice(0, MAX_ITEMS) }, null, 2);
    if (payload.length > MAX_EXPORT) return setStatus('Yedek dosyası sınırı aşıyor.');
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = text(root.document, 'a');
    link.href = url; link.download = 'hafize-composer-history.json'; link.click();
    root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
    setStatus(`${state.items.length} kayıt dışa aktarıldı.`);
  }

  function importItems(file) {
    if (!file || file.size > MAX_EXPORT) return setStatus('Yedek dosyası sınırı aşıyor.');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || ''));
        const incoming = Array.isArray(payload) ? payload : payload?.items;
        if (!Array.isArray(incoming)) throw new Error('invalid');
        const merged = [...state.items];
        for (const value of incoming.slice(0, MAX_ITEMS * 2)) {
          const item = normalized(value);
          if (!item || merged.includes(item)) continue;
          merged.push(item);
          if (merged.length >= MAX_ITEMS) break;
        }
        if (!writeItems(merged)) throw new Error('write');
        state.items = merged.slice(0, MAX_ITEMS);
        render();
        setStatus(`${Math.min(incoming.length, MAX_ITEMS)} yedek kaydı işlendi.`);
      } catch {
        setStatus('Geçersiz composer geçmişi yedeği.');
      }
    };
    reader.onerror = () => setStatus('Yedek okunamadı.');
    reader.readAsText(file);
  }

  function setStatus(message) {
    if (state) state.status.textContent = String(message).slice(0, 180);
  }

  function render() {
    if (!state) return;
    state.list.replaceChildren();
    const items = visibleItems();
    state.count.textContent = `${items.length}/${state.items.length}`;
    if (!items.length) {
      state.list.append(text(root.document, 'div', state.items.length ? 'Aramanla eşleşen kayıt yok.' : 'Composer geçmişi boş.', 'composer-history-empty'));
      return;
    }
    items.forEach((item) => {
      const row = text(root.document, 'article', undefined, 'composer-history-row');
      const preview = text(root.document, 'p', item.replace(/\s+/g, ' ').slice(0, 240), 'composer-history-preview');
      const actions = text(root.document, 'div', undefined, 'composer-history-row-actions');
      const use = button(root.document, 'Kullan', 'mini-btn');
      const copy = button(root.document, 'Kopyala', 'mini-btn');
      const remove = button(root.document, 'Sil', 'mini-btn');
      actions.append(use, copy, remove);
      row.append(preview, actions);
      state.list.append(row);
      use.addEventListener('click', () => selectItem(item));
      copy.addEventListener('click', () => copyItem(item));
      remove.addEventListener('click', () => deleteItem(item));
    });
  }

  function mount(documentRef = root.document) {
    if (!documentRef || documentRef.getElementById(CARD_ID)) return null;
    const input = documentRef.getElementById(INPUT_ID);
    if (!input) return null;

    const card = text(documentRef, 'section', undefined, 'utility-card composer-history-workspace');
    card.id = CARD_ID; card.hidden = true; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'composerHistoryTitle');
    const head = text(documentRef, 'div', undefined, 'composer-history-head');
    const title = text(documentRef, 'h2', 'Composer geçmişi', 'composer-history-title'); title.id = 'composerHistoryTitle';
    const count = text(documentRef, 'span', '0/0', 'composer-history-count');
    const closeButton = button(documentRef, 'Kapat', 'mini-btn'); closeButton.setAttribute('aria-label', 'Composer geçmişini kapat');
    head.append(title, count, closeButton);
    const toolbar = text(documentRef, 'div', undefined, 'composer-history-toolbar');
    const search = documentRef.createElement('input'); search.type = 'search'; search.maxLength = MAX_QUERY; search.placeholder = 'Geçmişte ara…'; search.setAttribute('aria-label', 'Composer geçmişinde ara');
    const exportButton = button(documentRef, 'Dışa aktar', 'mini-btn');
    const importButton = button(documentRef, 'İçe aktar', 'mini-btn');
    const clearButton = button(documentRef, 'Tümünü temizle', 'mini-btn');
    const file = documentRef.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    toolbar.append(search, exportButton, importButton, clearButton, file);
    const list = text(documentRef, 'div', undefined, 'composer-history-list'); list.setAttribute('role', 'list');
    const status = text(documentRef, 'div', '', 'composer-history-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    card.append(head, toolbar, list, status);
    input.closest('.composer')?.after(card);

    state = { card, search, count, list, status, items: readItems(), query: '', trigger: null };
    search.addEventListener('input', () => { state.query = String(search.value).slice(0, MAX_QUERY); render(); });
    closeButton.addEventListener('click', close);
    exportButton.addEventListener('click', exportItems);
    importButton.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { importItems(file.files?.[0]); file.value = ''; });
    clearButton.addEventListener('click', clearHistory);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Tab') {
        const focusables = [...card.querySelectorAll('button,input')].filter((node) => !node.disabled && !node.hidden);
        if (!focusables.length) return;
        const first = focusables[0]; const last = focusables[focusables.length - 1];
        if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    root.addEventListener?.('storage', (event) => { if (event.key === STORAGE_KEY) { state.items = readItems(); render(); } });
    render();
    return Object.freeze({ open, close, refresh: () => { state.items = readItems(); render(); }, destroy: () => { card.remove(); state = null; } });
  }

  root.HafizeComposerHistoryWorkspace = Object.freeze({ mount });
  const boot = () => mount(root.document);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
