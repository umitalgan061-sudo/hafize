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
  const REQUEST_TIMEOUT_MS = 8_000;
  const ACTIVE_RAILS = new WeakSet();
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

  function requestError(code) {
    const error = new Error(code);
    error.name = 'AbortError';
    error.code = code;
    return error;
  }

  function isAbortSignal(signal) {
    return signal && typeof signal === 'object' && typeof signal.addEventListener === 'function';
  }

  async function readPayload(response) {
    const value = await response.json();
    const health = normalizeHealth(value);
    if (!health) throw new Error('SCHEDULE_STATUS_INVALID_RESPONSE');
    return health;
  }

  function createClient({
    fetchImpl = globalThis.fetch,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('SCHEDULE_STATUS_FETCH_UNAVAILABLE');
    if (typeof AbortControllerImpl !== 'function') throw new Error('SCHEDULE_STATUS_ABORT_CONTROLLER_UNAVAILABLE');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('SCHEDULE_STATUS_TIMER_UNAVAILABLE');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_SCHEDULE_STATUS_TIMEOUT');

    return Object.freeze({
      async read({ signal } = {}) {
        if (signal != null && !isAbortSignal(signal)) throw new Error('INVALID_SCHEDULE_STATUS_SIGNAL');
        if (signal?.aborted) throw requestError('SCHEDULE_STATUS_CANCELLED');

        const controller = new AbortControllerImpl();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener?.('abort', onAbort, { once: true });
        const timer = setTimeoutImpl(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        try {
          const response = await fetchImpl(HEALTH_PATH, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal
          });
          if (!response?.ok) throw new Error('SCHEDULE_STATUS_HTTP_ERROR');
          return await readPayload(response);
        } catch (error) {
          if (timedOut) throw requestError('SCHEDULE_STATUS_TIMEOUT');
          if (signal?.aborted) throw requestError('SCHEDULE_STATUS_CANCELLED');
          throw error;
        } finally {
          clearTimeoutImpl(timer);
          signal?.removeEventListener?.('abort', onAbort);
        }
      }
    });
  }

  function snapshotAttribute(node, name) {
    const value = node?.getAttribute?.(name);
    return Object.freeze({ present: value !== null && value !== undefined, value });
  }

  function restoreAttribute(node, name, snapshot) {
    if (!node || !snapshot) return;
    if (snapshot.present) node.setAttribute?.(name, snapshot.value);
    else node.removeAttribute?.(name);
  }

  function snapshotDataset(node, key) {
    return Object.freeze({ present: Object.prototype.hasOwnProperty.call(node?.dataset || {}, key), value: node?.dataset?.[key] });
  }

  function restoreDataset(node, key, snapshot) {
    if (!node?.dataset || !snapshot) return;
    if (snapshot.present) node.dataset[key] = snapshot.value;
    else delete node.dataset[key];
  }

  function createController({
    documentRef = globalThis.document,
    fetchImpl = globalThis.fetch,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (!documentRef || typeof documentRef.querySelector !== 'function' || typeof documentRef.createElement !== 'function') {
      throw new Error('INVALID_SCHEDULE_STATUS_DOCUMENT');
    }
    const client = createClient({ fetchImpl, AbortControllerImpl, setTimeoutImpl, clearTimeoutImpl, timeoutMs });

    let mounted = false;
    let ownsCard = false;
    let card = null;
    let status = null;
    let refresh = null;
    let rail = null;
    let rows = new Map();
    let requestController = null;
    let generation = 0;
    let hostSnapshot = null;

    function element(tag, className, text) {
      const node = documentRef.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function resetRefs() {
      rows = new Map();
      card = null;
      status = null;
      refresh = null;
      rail = null;
      ownsCard = false;
      hostSnapshot = null;
      requestController = null;
    }

    function captureHostState() {
      const rowStates = new Map();
      for (const [key, node] of rows.entries()) {
        rowStates.set(key, Object.freeze({ textContent: node.textContent, state: snapshotDataset(node, 'state') }));
      }
      return Object.freeze({
        ariaBusy: snapshotAttribute(card, 'aria-busy'),
        statusText: status.textContent,
        statusState: snapshotDataset(status, 'state'),
        refreshDisabled: Boolean(refresh.disabled),
        rows: rowStates
      });
    }

    function restoreHostState() {
      if (!hostSnapshot || ownsCard) return;
      restoreAttribute(card, 'aria-busy', hostSnapshot.ariaBusy);
      status.textContent = hostSnapshot.statusText;
      restoreDataset(status, 'state', hostSnapshot.statusState);
      refresh.disabled = hostSnapshot.refreshDisabled;
      for (const [key, snapshot] of hostSnapshot.rows.entries()) {
        const node = rows.get(key);
        if (!node) continue;
        node.textContent = snapshot.textContent;
        restoreDataset(node, 'state', snapshot.state);
      }
    }

    function hydrateExisting(existing) {
      const existingStatus = existing.querySelector?.('.schedule-runtime-summary');
      const existingRefresh = existing.querySelector?.('.schedule-runtime-refresh');
      if (!existingStatus || !existingRefresh) return false;
      const existingRows = new Map();
      for (const [key] of FIELDS) {
        const node = existing.querySelector?.(`[data-key="${key}"]`);
        if (!node) return false;
        existingRows.set(key, node);
      }
      card = existing;
      status = existingStatus;
      refresh = existingRefresh;
      rows = existingRows;
      hostSnapshot = captureHostState();
      return true;
    }

    function buildCard() {
      rail = documentRef.querySelector('.utility-rail');
      if (!rail || ACTIVE_RAILS.has(rail)) return false;
      const existing = documentRef.querySelector(`#${CARD_ID}`);
      if (existing) return hydrateExisting(existing);

      card = element('section', 'utility-card schedule-runtime-card');
      ownsCard = true;
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
      if (!mounted) return null;
      requestController?.abort?.('schedule-runtime-status-superseded');
      let request;
      try { request = new AbortControllerImpl(); }
      catch {
        render(null);
        return null;
      }
      requestController = request;
      const requestGeneration = ++generation;
      if (card) card.setAttribute('aria-busy', 'true');
      if (refresh) refresh.disabled = true;
      try {
        const health = await client.read({ signal: request.signal });
        if (!mounted || requestGeneration !== generation || requestController !== request) return null;
        render(health);
        return health;
      } catch (error) {
        if (mounted && requestGeneration === generation && requestController === request && error?.code !== 'SCHEDULE_STATUS_CANCELLED') render(null);
        return null;
      } finally {
        if (requestController === request) requestController = null;
        if (mounted && requestGeneration === generation && refresh) refresh.disabled = false;
      }
    }

    function releaseInstallation() {
      generation += 1;
      requestController?.abort?.('schedule-runtime-status-release');
      requestController = null;
      refresh?.removeEventListener?.('click', load);
      if (ownsCard) card?.remove?.();
      else restoreHostState();
      if (rail) ACTIVE_RAILS.delete(rail);
      resetRefs();
    }

    function mount() {
      if (mounted) return false;
      try {
        if (!buildCard() || !card || !status || !refresh || rows.size !== FIELDS.length) {
          if (ownsCard) card?.remove?.();
          resetRefs();
          return false;
        }
        ACTIVE_RAILS.add(rail);
        refresh.addEventListener('click', load);
      } catch {
        releaseInstallation();
        return false;
      }
      mounted = true;
      void load();
      return true;
    }

    function destroy() {
      if (!mounted) return false;
      mounted = false;
      releaseInstallation();
      return true;
    }

    return Object.freeze({ mount, destroy, load, render });
  }

  function mount(options) {
    try { const controller = createController(options); return controller.mount() ? controller : null; }
    catch { return null; }
  }

  return Object.freeze({
    HEALTH_PATH, CARD_ID, STATUS_ID, REQUEST_TIMEOUT_MS, FIELDS,
    normalizeHealth, deriveSummary, createClient, createController, mount
  });
});
