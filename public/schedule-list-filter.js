(function exposeHafizeScheduleListFilter(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleListFilter = api;
  api.autoMount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleListFilter() {
  'use strict';

  const CARD_ID = 'scheduleListCard';
  const CONTROLS_ID = 'scheduleListFilterControls';
  const STYLE_HREF = '/schedule-list-filter.css';
  const SCOPE_EVENT = 'hafize:schedule-scope-changed';
  const MAX_QUERY_CHARS = 120;
  const AUTO_MOUNT_TIMEOUT_MS = 10_000;
  const FILTERS = Object.freeze({
    all: Object.freeze({ label: 'Tümü', statuses: null }),
    active: Object.freeze({ label: 'Aktif', statuses: Object.freeze(new Set(['scheduled', 'running'])) }),
    history: Object.freeze({ label: 'Geçmiş', statuses: Object.freeze(new Set(['completed', 'failed', 'cancelled'])) }),
    failed: Object.freeze({ label: 'Başarısız', statuses: Object.freeze(new Set(['failed'])) })
  });

  function safeQuery(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_QUERY_CHARS);
  }

  function fold(value) {
    const clean = safeQuery(value);
    try { return clean.toLocaleLowerCase('tr-TR'); } catch { return clean.toLowerCase(); }
  }

  function normalizeFilter(value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FILTERS, value) ? value : 'all';
  }

  function readItem(article) {
    if (!article || typeof article.querySelector !== 'function') return null;
    const status = typeof article.dataset?.state === 'string' ? article.dataset.state : '';
    if (!['scheduled', 'running', 'completed', 'failed', 'cancelled'].includes(status)) return null;
    const agent = article.querySelector('.schedule-list-agent')?.textContent || '';
    const task = article.querySelector('.schedule-list-task')?.textContent || '';
    const haystack = fold(`${agent} ${task}`);
    return Object.freeze({ article, status, haystack });
  }

  function matchesItem(item, { filter = 'all', query = '' } = {}) {
    if (!item) return false;
    const key = normalizeFilter(filter);
    const statuses = FILTERS[key].statuses;
    if (statuses && !statuses.has(item.status)) return false;
    const needle = fold(query);
    return !needle || item.haystack.includes(needle);
  }

  function countByFilter(items) {
    const counts = { all: 0, active: 0, history: 0, failed: 0 };
    for (const item of items) {
      if (!item) continue;
      counts.all += 1;
      if (FILTERS.active.statuses.has(item.status)) counts.active += 1;
      if (FILTERS.history.statuses.has(item.status)) counts.history += 1;
      if (FILTERS.failed.statuses.has(item.status)) counts.failed += 1;
    }
    return Object.freeze(counts);
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-filter-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    link.setAttribute('data-hafize-schedule-filter-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function buildControls(documentRef) {
    const wrapper = documentRef.createElement('div');
    wrapper.id = CONTROLS_ID;
    wrapper.className = 'schedule-list-filter-controls';

    const tabs = documentRef.createElement('div');
    tabs.className = 'schedule-list-filter-tabs';
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Görev durumuna göre filtrele');

    const buttons = new Map();
    for (const [key, config] of Object.entries(FILTERS)) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'schedule-list-filter-tab';
      button.dataset.filter = key;
      button.setAttribute('aria-pressed', String(key === 'all'));
      const label = documentRef.createElement('span');
      label.textContent = config.label;
      const count = documentRef.createElement('span');
      count.className = 'schedule-list-filter-count';
      count.textContent = '0';
      count.setAttribute('aria-hidden', 'true');
      button.append(label, count);
      buttons.set(key, { button, count });
      tabs.append(button);
    }

    const searchLabel = documentRef.createElement('label');
    searchLabel.className = 'schedule-list-filter-search';
    const searchText = documentRef.createElement('span');
    searchText.className = 'sr-only';
    searchText.textContent = 'Yüklü zamanlanmış görevlerde ara';
    const input = documentRef.createElement('input');
    input.type = 'search';
    input.inputMode = 'search';
    input.autocomplete = 'off';
    input.maxLength = MAX_QUERY_CHARS;
    input.placeholder = 'Yüklü görev veya ajan ara';
    input.setAttribute('aria-label', 'Yüklü zamanlanmış görevlerde ara');
    searchLabel.append(searchText, input);

    const live = documentRef.createElement('p');
    live.className = 'schedule-list-filter-live';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');

    wrapper.append(tabs, searchLabel, live);
    return Object.freeze({ wrapper, buttons, input, live });
  }

  function dispatchScope(root, scope) {
    if (typeof root?.dispatchEvent !== 'function') return false;
    const detail = Object.freeze({ scope: normalizeFilter(scope) });
    let event;
    try {
      event = typeof root.CustomEvent === 'function'
        ? new root.CustomEvent(SCOPE_EVENT, { detail })
        : { type: SCOPE_EVENT, detail };
    } catch {
      return false;
    }
    try { return root.dispatchEvent(event) !== false; } catch { return false; }
  }

  function mount(documentRef, root, card = documentRef?.getElementById?.(CARD_ID)) {
    if (!documentRef || !root || !card || card.querySelector?.(`#${CONTROLS_ID}`)) return null;
    const list = card.querySelector?.('.schedule-list-items');
    const status = card.querySelector?.('.schedule-list-status');
    if (!list || !status) return null;
    ensureStyles(documentRef);

    const nodes = buildControls(documentRef);
    status.insertAdjacentElement?.('afterend', nodes.wrapper);
    if (!nodes.wrapper.parentNode) card.insertBefore?.(nodes.wrapper, list);

    let filter = normalizeFilter(card.dataset?.scope || 'all');
    let query = '';
    let destroyed = false;
    let renderQueued = false;

    function collectItems() {
      const articles = Array.from(list.querySelectorAll?.('.schedule-list-item') || []);
      return articles.map(readItem).filter(Boolean);
    }

    function render() {
      renderQueued = false;
      if (destroyed) return;
      const items = collectItems();
      const counts = countByFilter(items);
      const serverScope = normalizeFilter(card.dataset?.scope || filter);
      let visible = 0;
      for (const item of items) {
        const matches = matchesItem(item, { filter, query });
        item.article.hidden = !matches;
        item.article.setAttribute?.('aria-hidden', String(!matches));
        if (matches) visible += 1;
      }
      for (const [key, refs] of nodes.buttons) {
        refs.button.setAttribute('aria-pressed', String(key === filter));
        refs.count.hidden = serverScope !== 'all';
        refs.count.textContent = String(counts[key]);
        refs.button.setAttribute('aria-label', serverScope === 'all'
          ? `${FILTERS[key].label}: yüklenen ${counts[key]} görev`
          : FILTERS[key].label);
      }
      const searching = Boolean(query);
      const filtering = filter !== 'all';
      nodes.live.textContent = searching
        ? `${visible}/${items.length} yüklü görev aramayla eşleşiyor.`
        : filtering
          ? `${visible} ${FILTERS[filter].label.toLocaleLowerCase('tr-TR')} görev yüklendi.`
          : `${items.length} görev filtrelenmeden gösteriliyor.`;
      nodes.wrapper.dataset.filtered = String(searching || filtering);
    }

    function queueRender() {
      if (destroyed || renderQueued) return;
      renderQueued = true;
      if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(render);
      else Promise.resolve().then(render);
    }

    function setFilter(next) {
      const normalized = normalizeFilter(next);
      if (normalized === filter) { queueRender(); return false; }
      filter = normalized;
      dispatchScope(root, filter);
      queueRender();
      return true;
    }

    function setQuery(next) {
      query = safeQuery(next);
      if (nodes.input.value !== query) nodes.input.value = query;
      queueRender();
    }

    function onTabClick(event) {
      const button = event?.target?.closest?.('[data-filter]');
      if (!button || !nodes.wrapper.contains?.(button)) return;
      event.preventDefault?.();
      setFilter(button.dataset.filter);
    }

    function onInput() {
      setQuery(nodes.input.value);
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || documentRef.activeElement !== nodes.input || !query) return;
      event.preventDefault?.();
      setQuery('');
    }

    nodes.wrapper.addEventListener?.('click', onTabClick);
    nodes.input.addEventListener?.('input', onInput);
    nodes.input.addEventListener?.('keydown', onKeydown);

    const observer = typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(queueRender)
      : null;
    observer?.observe(list, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-state'] });
    const cardObserver = typeof root.MutationObserver === 'function'
      ? new root.MutationObserver(() => {
          const scope = normalizeFilter(card.dataset?.scope || 'all');
          if (scope !== filter) filter = scope;
          queueRender();
        })
      : null;
    cardObserver?.observe(card, { attributes: true, attributeFilter: ['data-scope'] });
    render();

    return Object.freeze({
      getState: () => Object.freeze({ filter, query }),
      setFilter,
      setQuery,
      refresh: queueRender,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect?.();
        cardObserver?.disconnect?.();
        nodes.wrapper.removeEventListener?.('click', onTabClick);
        nodes.input.removeEventListener?.('input', onInput);
        nodes.input.removeEventListener?.('keydown', onKeydown);
        for (const item of collectItems()) {
          item.article.hidden = false;
          item.article.removeAttribute?.('aria-hidden');
        }
        nodes.wrapper.remove?.();
      }
    });
  }

  function autoMount(documentRef, root) {
    if (!documentRef || !root) return null;
    const immediate = documentRef.getElementById?.(CARD_ID);
    if (immediate) return mount(documentRef, root, immediate);
    if (typeof root.MutationObserver !== 'function') return null;

    let stopped = false;
    let timer = null;
    const observer = new root.MutationObserver(() => {
      if (stopped) return;
      const card = documentRef.getElementById?.(CARD_ID);
      if (!card) return;
      stopped = true;
      observer.disconnect();
      if (timer) root.clearTimeout?.(timer);
      mount(documentRef, root, card);
    });
    observer.observe(documentRef.documentElement || documentRef.body, { childList: true, subtree: true });
    timer = root.setTimeout?.(() => {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
    }, AUTO_MOUNT_TIMEOUT_MS) || null;
    return Object.freeze({
      destroy() {
        if (stopped) return;
        stopped = true;
        observer.disconnect();
        if (timer) root.clearTimeout?.(timer);
      }
    });
  }

  return Object.freeze({
    CARD_ID,
    CONTROLS_ID,
    STYLE_HREF,
    SCOPE_EVENT,
    MAX_QUERY_CHARS,
    AUTO_MOUNT_TIMEOUT_MS,
    FILTERS,
    safeQuery,
    fold,
    normalizeFilter,
    readItem,
    matchesItem,
    countByFilter,
    ensureStyles,
    buildControls,
    dispatchScope,
    mount,
    autoMount
  });
});