(function installLocalDataCenterFilters(root) {
  'use strict';
  const CENTER_ID = 'localDataCenter';
  const LIST_SELECTOR = '.local-data-list';
  const GROUPS = Object.freeze([
    ['all', 'Tümü'],
    ['conversation', 'Sohbet'],
    ['draft', 'Taslak'],
    ['prompt', 'İstem'],
    ['history', 'History'],
    ['preference', 'Tercih']
  ]);

  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function mount() {
    const center = root.document?.getElementById?.(CENTER_ID);
    const api = root.HafizeLocalDataCenter;
    if (!center || !api || root.document.getElementById('localDataCenterFilters')) return null;
    const toolbar = make('div', undefined, 'local-data-filter-toolbar');
    toolbar.id = 'localDataCenterFilters';
    toolbar.setAttribute('aria-label', 'Yerel veri filtreleri');
    const search = root.document.createElement('input');
    search.type = 'search';
    search.maxLength = 80;
    search.placeholder = 'Veri alanında ara…';
    search.setAttribute('aria-label', 'Yerel veri alanlarında ara');
    const group = root.document.createElement('select');
    group.setAttribute('aria-label', 'Yerel veri kategorisi');
    GROUPS.forEach(([value, label]) => {
      const option = make('option', label); option.value = value; group.append(option);
    });
    const onlyPresent = root.document.createElement('input');
    onlyPresent.type = 'checkbox'; onlyPresent.id = 'localDataOnlyPresent';
    const presentLabel = root.document.createElement('label', 'Yalnız dolu alanlar');
    presentLabel.htmlFor = onlyPresent.id;
    toolbar.append(search, group, presentLabel, onlyPresent);
    center.insertBefore(toolbar, center.querySelector('.local-data-summary'));

    const listeners = [];
    let destroyed = false;
    const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };
    const groupFor = (id) => api.STORES.find((store) => store.id === id)?.clearGroup || '';
    const apply = () => {
      if (destroyed) return;
      const query = search.value.trim().toLocaleLowerCase('tr-TR');
      const selected = group.value;
      const present = onlyPresent.checked;
      const rows = [...center.querySelectorAll(`${LIST_SELECTOR} .local-data-row`)];
      for (const row of rows) {
        const id = row.dataset.localDataId || '';
        const descriptor = api.STORES.find((store) => store.id === id);
        const haystack = `${descriptor?.label || ''} ${descriptor?.description || ''} ${descriptor?.key || ''}`.toLocaleLowerCase('tr-TR');
        const visible = (!query || haystack.includes(query)) && (selected === 'all' || groupFor(id) === selected) && (!present || !row.querySelector('.local-data-row-actions button')?.disabled);
        row.hidden = !visible;
      }
    };
    on(search, 'input', apply);
    on(group, 'change', apply);
    on(onlyPresent, 'change', apply);
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(apply) : null;
    observer?.observe(center, { childList: true, subtree: true });
    apply();
    return Object.freeze({ refresh: apply, destroy: () => { destroyed = true; observer?.disconnect(); listeners.splice(0).forEach((off) => off()); toolbar.remove(); } });
  }

  root.HafizeLocalDataCenterFilters = Object.freeze({ mount });
  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
