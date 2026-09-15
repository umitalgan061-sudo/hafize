(function installLocalDataCenterBulk(root) {
  'use strict';
  const CENTER_ID = 'localDataCenter';
  const BAR_ID = 'localDataBulkBar';
  const MAX_SELECTION = 8;
  const getApi = () => root.HafizeLocalDataCenter;

  const make = (tag, value, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const button = (label, className = 'mini-btn') => { const node = make('button', label, className); node.type = 'button'; return node; };

  function mount() {
    const center = root.document?.getElementById?.(CENTER_ID);
    const api = getApi();
    if (!center || !api || root.document.getElementById(BAR_ID)) return null;
    const selected = new Set();
    const bar = make('div', undefined, 'local-data-bulk');
    bar.id = BAR_ID;
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Yerel veri toplu işlemleri');
    const counter = make('span', '0 seçili', 'local-data-bulk-counter');
    const selectVisible = button('Görünenleri seç');
    const clearSelection = button('Seçimi kaldır');
    const clearSelected = button('Seçilenleri sil', 'mini-btn local-data-danger');
    clearSelected.disabled = true;
    bar.append(counter, selectVisible, clearSelection, clearSelected);
    center.insertBefore(bar, center.querySelector('.local-data-summary'));

    const listeners = [];
    let destroyed = false;
    const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };
    const rows = () => [...center.querySelectorAll('.local-data-list .local-data-row')];
    const itemById = (id) => api.STORES.find((store) => store.id === id);

    function render() {
      if (destroyed) return;
      for (const row of rows()) {
        const id = row.dataset.localDataId;
        let check = row.querySelector('[data-local-bulk-check]');
        if (!check) {
          check = root.document.createElement('input');
          check.type = 'checkbox';
          check.dataset.localBulkCheck = 'true';
          check.setAttribute('aria-label', `${itemById(id)?.label || id} alanını seç`);
          row.insertBefore(check, row.firstChild);
          on(check, 'change', () => {
            if (check.checked) {
              if (selected.size >= MAX_SELECTION) { check.checked = false; setStatus(`${MAX_SELECTION} alan sınırı.`); return; }
              selected.add(id);
            } else selected.delete(id);
            update();
          });
        }
        check.checked = selected.has(id);
      }
      update();
    }

    function update() {
      const valid = [...selected].filter((id) => itemById(id));
      selected.clear(); valid.slice(0, MAX_SELECTION).forEach((id) => selected.add(id));
      counter.textContent = `${selected.size} seçili`;
      clearSelected.disabled = selected.size === 0;
    }

    function setStatus(message) {
      const status = center.querySelector('.local-data-summary');
      if (status) status.textContent = String(message).slice(0, 220);
    }

    on(selectVisible, 'click', () => {
      const candidates = rows().filter((row) => !row.hidden && !row.querySelector('[data-local-bulk-check]')?.disabled);
      for (const row of candidates) {
        const id = row.dataset.localDataId;
        if (selected.size >= MAX_SELECTION) break;
        if (id && itemById(id)?.key) selected.add(id);
      }
      render();
    });
    on(clearSelection, 'click', () => { selected.clear(); render(); setStatus('Seçim kaldırıldı.'); });
    on(clearSelected, 'click', () => {
      if (!selected.size) return;
      const labels = [...selected].map((id) => itemById(id)?.label).filter(Boolean);
      if (!root.confirm?.(`${labels.join(', ')} verileri silinsin mi? Bu işlem geri alınamaz.`)) return;
      const result = api.clearStores([...selected]);
      selected.clear(); render();
      setStatus(result.ok ? 'Seçilen yerel veriler temizlendi.' : 'Bazı seçili veriler temizlenemedi.');
    });

    const observer = typeof MutationObserver === 'function' ? new MutationObserver(render) : null;
    const list = center.querySelector('.local-data-list');
    observer?.observe(list || center, { childList: true, subtree: true });
    on(root, 'storage', (event) => { if (event.key === null || api.KNOWN_KEYS.has(event.key)) render(); });
    render();
    return Object.freeze({ refresh: render, getSelected: () => [...selected], destroy: () => { destroyed = true; observer?.disconnect(); listeners.splice(0).forEach((off) => off()); bar.remove(); } });
  }

  root.HafizeLocalDataCenterBulk = Object.freeze({ mount });
  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
