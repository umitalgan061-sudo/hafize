(function installLocalDataCenterSort(root) {
  'use strict';
  const CENTER_ID = 'localDataCenter';
  const SORT_ID = 'localDataSort';
  const OPTIONS = Object.freeze([
    ['registry', 'Varsayılan'],
    ['size-desc', 'En büyük'],
    ['size-asc', 'En küçük'],
    ['name-asc', 'Ada göre'],
    ['state', 'Duruma göre']
  ]);
  const make = (tag, value, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  function mount() {
    const center = root.document?.getElementById?.(CENTER_ID);
    const api = root.HafizeLocalDataCenter;
    if (!center || !api || root.document.getElementById(SORT_ID)) return null;
    const toolbar = make('div', undefined, 'local-data-sort');
    toolbar.id = SORT_ID;
    const label = make('label', 'Sırala');
    const select = root.document.createElement('select');
    select.setAttribute('aria-label', 'Yerel veri alanlarını sırala');
    OPTIONS.forEach(([value, text]) => { const option = make('option', text); option.value = value; select.append(option); });
    toolbar.append(label, select);
    center.insertBefore(toolbar, center.querySelector('.local-data-summary'));
    const list = () => center.querySelector('.local-data-list');
    const run = () => {
      const container = list();
      if (!container) return;
      const rows = [...container.querySelectorAll('.local-data-row')];
      const rank = (row) => api.STORES.findIndex((store) => store.id === row.dataset.localDataId);
      const bytes = (row) => Number(row.querySelector('.local-data-copy small')?.textContent?.match(/([\d\s.]+) B/)?.[1]?.replace(/[\s.]/g, '') || 0);
      if (select.value === 'registry') rows.sort((a,b) => rank(a)-rank(b));
      if (select.value === 'size-desc') rows.sort((a,b) => bytes(b)-bytes(a));
      if (select.value === 'size-asc') rows.sort((a,b) => bytes(a)-bytes(b));
      if (select.value === 'name-asc') rows.sort((a,b) => a.textContent.localeCompare(b.textContent, 'tr'));
      if (select.value === 'state') rows.sort((a,b) => String(a.dataset.auditState||'').localeCompare(String(b.dataset.auditState||'')));
      rows.forEach((row) => container.append(row));
    };
    select.addEventListener('change', run);
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(run) : null;
    observer?.observe(center, { childList: true, subtree: true });
    run();
    return Object.freeze({ refresh: run, destroy: () => { observer?.disconnect(); select.removeEventListener('change', run); toolbar.remove(); } });
  }
  root.HafizeLocalDataCenterSort = Object.freeze({ mount });
  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
