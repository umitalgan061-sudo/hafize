(function exposeHafizeScheduleScopeCountsUi(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleScopeCountsUi = api;
  api.autoMount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleScopeCountsUi() {
  'use strict';

  const COUNTS_PATH = '/api/schedules?view=counts';
  const CONTROLS_ID = 'scheduleListFilterControls';
  const MAX_COUNT = 1_000_000;
  const AUTO_MOUNT_TIMEOUT_MS = 10_000;
  const REFRESH_EVENTS = Object.freeze([
    'hafize:schedule-created',
    'hafize:schedule-cancelled',
    'hafize:schedule-rescheduled'
  ]);
  const KEYS = Object.freeze(['all', 'active', 'history', 'failed']);
  const LABELS = Object.freeze({ all: 'Tümü', active: 'Aktif', history: 'Geçmiş', failed: 'Başarısız' });

  function normalizeCounts(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    const counts = {};
    for (const key of KEYS) {
      const count = value[key];
      if (!Number.isSafeInteger(count) || count < 0 || count > MAX_COUNT) return null;
      counts[key] = count;
    }
    if (counts.active + counts.history !== counts.all) return null;
    if (counts.failed > counts.history) return null;
    return Object.freeze(counts);
  }

  async function readPayload(response) {
    try {
      const payload = await response.json();
      return payload && !Array.isArray(payload) && typeof payload === 'object' ? payload : {};
    } catch {
      return {};
    }
  }

  function createClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_SCOPE_COUNTS_FETCH');
    return Object.freeze({
      async read() {
        const response = await fetchImpl(COUNTS_PATH, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const payload = await readPayload(response);
        return Object.freeze({
          ok: Boolean(response?.ok),
          status: Number(response?.status) || 0,
          counts: normalizeCounts(payload?.listMeta?.scopeCounts)
        });
      }
    });
  }

  function collectCountNodes(controls) {
    if (!controls || typeof controls.querySelectorAll !== 'function') return null;
    const nodes = new Map();
    for (const button of Array.from(controls.querySelectorAll('[data-filter]'))) {
      const key = button?.dataset?.filter;
      if (!KEYS.includes(key) || nodes.has(key)) continue;
      const count = button.querySelector?.('.schedule-list-filter-count');
      if (!count) continue;
      nodes.set(key, { button, count });
    }
    return nodes.size === KEYS.length ? nodes : null;
  }

  function renderCounts(nodes, counts) {
    const normalized = normalizeCounts(counts);
    if (!nodes || !normalized) return false;
    for (const key of KEYS) {
      const refs = nodes.get(key);
      if (!refs) return false;
      refs.count.textContent = String(normalized[key]);
      refs.count.hidden = false;
      refs.button.setAttribute?.('aria-label', `${LABELS[key]}: ${normalized[key]} görev`);
      refs.button.dataset.serverCount = String(normalized[key]);
    }
    return true;
  }

  function clearCounts(nodes) {
    if (!nodes) return;
    for (const key of KEYS) {
      const refs = nodes.get(key);
      if (!refs) continue;
      delete refs.button.dataset.serverCount;
    }
  }

  function mount(documentRef, root, controls = documentRef?.getElementById?.(CONTROLS_ID), { fetchImpl = root?.fetch } = {}) {
    if (!documentRef || !root || !controls) return null;
    const nodes = collectCountNodes(controls);
    if (!nodes) return null;
    const client = createClient({ fetchImpl });
    let destroyed = false;
    let loading = false;
    let pending = false;
    let generation = 0;
    let lastCounts = null;

    async function refresh() {
      if (destroyed) return Object.freeze({ ok: false, reason: 'destroyed' });
      if (loading) {
        pending = true;
        return Object.freeze({ ok: false, reason: 'pending' });
      }
      loading = true;
      const requestGeneration = ++generation;
      try {
        const result = await client.read();
        if (destroyed || requestGeneration !== generation) return Object.freeze({ ok: false, reason: 'stale' });
        if (!result.ok || !result.counts) {
          lastCounts = null;
          clearCounts(nodes);
          return Object.freeze({ ok: false, status: result.status });
        }
        lastCounts = result.counts;
        renderCounts(nodes, result.counts);
        return Object.freeze({ ok: true, counts: result.counts });
      } catch {
        if (!destroyed && requestGeneration === generation) {
          lastCounts = null;
          clearCounts(nodes);
        }
        return Object.freeze({ ok: false, status: 0 });
      } finally {
        loading = false;
        if (!destroyed && pending) {
          pending = false;
          void refresh();
        }
      }
    }

    const onMutation = () => { void refresh(); };
    for (const eventName of REFRESH_EVENTS) root.addEventListener?.(eventName, onMutation);
    void refresh();

    return Object.freeze({
      refresh,
      getCounts: () => lastCounts,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        generation += 1;
        pending = false;
        for (const eventName of REFRESH_EVENTS) root.removeEventListener?.(eventName, onMutation);
        clearCounts(nodes);
      }
    });
  }

  function autoMount(documentRef, root) {
    if (!documentRef || !root) return null;
    const immediate = documentRef.getElementById?.(CONTROLS_ID);
    if (immediate) return mount(documentRef, root, immediate);
    if (typeof root.MutationObserver !== 'function') return null;
    let stopped = false;
    let timer = null;
    const observer = new root.MutationObserver(() => {
      if (stopped) return;
      const controls = documentRef.getElementById?.(CONTROLS_ID);
      if (!controls) return;
      stopped = true;
      observer.disconnect();
      if (timer) root.clearTimeout?.(timer);
      mount(documentRef, root, controls);
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
    COUNTS_PATH,
    CONTROLS_ID,
    MAX_COUNT,
    AUTO_MOUNT_TIMEOUT_MS,
    REFRESH_EVENTS,
    KEYS,
    normalizeCounts,
    createClient,
    collectCountNodes,
    renderCounts,
    mount,
    autoMount
  });
});
