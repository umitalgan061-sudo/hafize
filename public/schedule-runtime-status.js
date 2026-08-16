(function exposeHafizeScheduleRuntimeStatus(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleRuntimeStatus = api;
  api.mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleRuntimeStatus() {
  'use strict';

  const HEALTH_PATH = '/api/health';
  const CARD_ID = 'scheduleRuntimeCard';
  const STATUS_ID = 'scheduleRuntimeSummary';
  const FIELDS = Object.freeze([
    ['scheduleWorkerConfigured', 'Görev motoru', 'Hazır', 'Kapalı'],
    ['scheduleApiConfigured', 'Görev API', 'Hazır', 'Kapalı'],
    ['scheduleStorageDurable', 'Kalıcı depolama', 'Var', 'Geçici'],
    ['scheduleLeaseConfigured', 'Dağıtık lease', 'Var', 'Yok']
  ]);

  function normalizeHealth(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const result = {};
    for (const [key] of FIELDS) {
      if (typeof value[key] !== 'boolean') return null;
      result[key] = value[key];
    }
    return Object.freeze(result);
  }

  function deriveSummary(health) {
    if (!health) return Object.freeze({ state: 'error', text: 'Görev motoru durumu alınamadı.' });
    if (!health.scheduleWorkerConfigured) return Object.freeze({ state: 'off', text: 'Bulut görev motoru kapalı.' });
    if (!health.scheduleStorageDurable) return Object.freeze({ state: 'warning', text: 'Görev motoru çalışıyor; depolama geçici.' });
    if (!health.scheduleApiConfigured) return Object.freeze({ state: 'warning', text: 'Görev motoru çalışıyor; yönetim API’si kapalı.' });
    if (!health.scheduleLeaseConfigured) return Object.freeze({ state: 'warning', text: 'Görev motoru hazır; dağıtık lease kapalı.' });
    return Object.freeze({ state: 'ready', text: 'Bulut görev motoru hazır.' });
  }

  function createController({ documentRef = globalThis.document, fetchImpl = globalThis.fetch } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_SCHEDULE_STATUS_DOCUMENT');
    }
    if (typeof fetchImpl !== 'function') throw new Error('SCHEDULE_STATUS_FETCH_UNAVAILABLE');

    let mounted = false;
    let card = null;
    let status = null;
    let refresh = null;
    let rows = new Map();
    let requestController = null;

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function buildCard() {
      const rail = documentRef.querySelector('.utility-rail');
      if (!rail) return false;
      const existing = documentRef.querySelector(`#${CARD_ID}`);
      if (existing) { card = existing; return false; }
      card = element('section', 'utility-card schedule-runtime-card');
      card.id = CARD_ID;
      card.setAttribute('aria-labelledby', 'scheduleRuntimeTitle');
      card.setAttribute('aria-busy', 'true');

      const head = element('div', 'utility-head schedule-runtime-head');
      const titleWrap = element('span', 'schedule-runtime-title');
      const icon = element('span', 'mini-icon', '◷');
      icon.setAttribute('aria-hidden', 'true');
      const title = element('span', '', 'Zamanlanmış görevler');
      title.id = 'scheduleRuntimeTitle';
      titleWrap.append(icon, title);
      refresh = element('button', 'mini-btn schedule-runtime-refresh', 'Yenile');
      refresh.type = 'button';
      refresh.setAttribute('aria-label', 'Görev motoru durumunu yenile');
      head.append(titleWrap, refresh);

      status = element('p', 'schedule-runtime-summary', 'Görev motoru kontrol ediliyor…');
      status.id = STATUS_ID;
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');

      const grid = element('dl', 'schedule-runtime-grid');
      for (const [key, label] of FIELDS) {
        const item = element('div', 'schedule-runtime-row');
        const term = element('dt', '', label);
        const value = element('dd', '', '—');
        value.dataset.key = key;
        item.append(term, value);
        grid.append(item);
        rows.set(key, value);
      }
      const note = element('p', 'schedule-runtime-note', 'Bu kart görev içeriğini veya secret değerlerini göstermez; yalnız sunucu hazır olma sinyallerini okur.');
      card.append(head, status, grid, note);
      const calendar = rail.querySelector?.('.calendar-card');
      if (calendar && typeof rail.insertBefore === 'function') rail.insertBefore(card, calendar);
      else rail.append(card);
      return true;
    }

    function render(health) {
      const summary = deriveSummary(health);
      if (status) { status.textContent = summary.text; status.dataset.state = summary.state; }
      if (card) card.setAttribute('aria-busy', 'false');
      for (const [key, , yes, no] of FIELDS) {
        const node = rows.get(key);
        if (!node) continue;
        node.textContent = health ? (health[key] ? yes : no) : '—';
        node.dataset.state = health ? (health[key] ? 'ready' : 'off') : 'unknown';
      }
    }

    async function load() {
      requestController?.abort?.();
      requestController = typeof AbortController === 'function' ? new AbortController() : null;
      if (card) card.setAttribute('aria-busy', 'true');
      if (refresh) refresh.disabled = true;
      try {
        const response = await fetchImpl(HEALTH_PATH, {
          method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin',
          ...(requestController ? { signal: requestController.signal } : {})
        });
        if (!response?.ok) throw new Error('SCHEDULE_STATUS_HTTP_ERROR');
        const health = normalizeHealth(await response.json());
        if (!health) throw new Error('SCHEDULE_STATUS_INVALID_RESPONSE');
        render(health);
        return health;
      } catch (error) {
        if (error?.name !== 'AbortError') render(null);
        return null;
      } finally {
        if (refresh) refresh.disabled = false;
      }
    }

    function mount() {
      if (mounted) return false;
      buildCard();
      if (!card || !refresh) return false;
      refresh.addEventListener?.('click', load);
      mounted = true;
      void load();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      requestController?.abort?.();
      refresh?.removeEventListener?.('click', load);
      card?.remove?.();
      rows = new Map(); card = null; status = null; refresh = null; mounted = false;
      return true;
    }

    return Object.freeze({ mount, destroy, load, render });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; }
    catch { return null; }
  }

  return Object.freeze({ HEALTH_PATH, CARD_ID, STATUS_ID, FIELDS, normalizeHealth, deriveSummary, createController, mount });
});
