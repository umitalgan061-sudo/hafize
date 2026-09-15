(function installLocalDataCenterInsights(root) {
  'use strict';
  const CENTER_ID = 'localDataCenter';
  const INSIGHTS_ID = 'localDataCenterInsights';
  const GROUPS = Object.freeze([
    ['conversation', 'Sohbet verisi'],
    ['draft', 'Taslak verisi'],
    ['prompt', 'İstem verisi'],
    ['history', 'Composer geçmişi'],
    ['preference', 'Tercihler']
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
    if (!center || !api || root.document.getElementById(INSIGHTS_ID)) return null;
    const block = make('section', undefined, 'local-data-insights');
    block.id = INSIGHTS_ID;
    block.setAttribute('aria-labelledby', 'localDataInsightsTitle');
    const title = make('h3', 'Veri kullanımı özeti');
    title.id = 'localDataInsightsTitle';
    const intro = make('p', 'Alanları kategori bazında hızlıca karşılaştır. Bu özet de yalnız cihazdaki storage metadata’sını kullanır.', 'local-data-insights-intro');
    const grid = make('div', undefined, 'local-data-insights-grid');
    const render = () => {
      const snapshot = api.inspect();
      const groups = GROUPS.map(([id, label]) => {
        const items = snapshot.filter((item) => api.STORES.find((store) => store.id === item.id)?.clearGroup === id);
        return { id, label, count: items.length, present: items.filter((item) => item.present).length, bytes: items.reduce((sum, item) => sum + item.bytes, 0) };
      });
      grid.replaceChildren();
      for (const group of groups) {
        const card = make('div', undefined, 'local-data-insight-card');
        card.append(make('strong', group.label), make('span', `${group.present}/${group.count} alan · ${group.bytes.toLocaleString('tr-TR')} B`));
        grid.append(card);
      }
    };
    block.append(title, intro, grid);
    center.insertBefore(block, center.querySelector('.local-data-summary'));
    render();
    const onStorage = (event) => { if (event.key === null || api.KNOWN_KEYS.has(event.key)) render(); };
    root.addEventListener?.('storage', onStorage);
    return Object.freeze({ refresh: render, destroy: () => { root.removeEventListener?.('storage', onStorage); block.remove(); } });
  }

  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
