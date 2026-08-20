(function exposeHafizeScheduleList(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleList = api;
  api.mount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleList() {
  'use strict';

  const PATH = '/api/schedules';
  const PAGE_SIZE = 100;
  const MAX_ITEMS = 500;
  const MAX_TASK_PREVIEW_CHARS = 180;
  const MAX_AGENT_ID_CHARS = 120;
  const MAX_SCHEDULE_ID_CHARS = 120;
  const REQUEST_TIMEOUT_MS = 30_000;
  const SNAPSHOT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
  const CREATED_EVENT = 'hafize:schedule-created';
  const CANCELLED_EVENT = 'hafize:schedule-cancelled';
  const RESCHEDULED_EVENT = 'hafize:schedule-rescheduled';
  const SCOPE_EVENT = 'hafize:schedule-scope-changed';
  const SCOPES = Object.freeze(new Set(['all', 'active', 'history', 'failed']));
  const STATUSES = Object.freeze(new Set(['scheduled', 'running', 'completed', 'failed', 'cancelled']));
  const STATUS_COPY = Object.freeze({
    scheduled: 'Planlandı',
    running: 'Çalışıyor',
    completed: 'Tamamlandı',
    failed: 'Başarısız',
    cancelled: 'İptal edildi'
  });

  function safeText(value, maxChars) {
    if (typeof value !== 'string') return null;
    const clean = value.trim().replace(/\s+/g, ' ');
    if (!clean || clean.length > maxChars) return null;
    return clean;
  }

  function normalizeScope(value) {
    return typeof value === 'string' && SCOPES.has(value) ? value : 'all';
  }

  function normalizeTaskPreview(value) {
    if (typeof value !== 'string') return null;
    const clean = value.trim().replace(/\s+/g, ' ');
    if (!clean) return null;
    return clean.length <= MAX_TASK_PREVIEW_CHARS
      ? clean
      : `${clean.slice(0, MAX_TASK_PREVIEW_CHARS - 1).trimEnd()}…`;
  }

  function normalizeIso(value) {
    const text = safeText(value, 64);
    if (!text) return null;
    const time = Date.parse(text);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }

  function normalizeSchedule(raw) {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') return null;
    const scheduleId = safeText(raw.scheduleId, MAX_SCHEDULE_ID_CHARS);
    const agentId = safeText(raw.agentId, MAX_AGENT_ID_CHARS);
    const task = normalizeTaskPreview(raw.task);
    const runAt = normalizeIso(raw.runAt);
    const status = typeof raw.status === 'string' && STATUSES.has(raw.status) ? raw.status : null;
    const attempts = Number.isInteger(raw.attempts) && raw.attempts >= 0 && raw.attempts <= 5 ? raw.attempts : null;
    const maxAttempts = Number.isInteger(raw.maxAttempts) && raw.maxAttempts >= 1 && raw.maxAttempts <= 5 ? raw.maxAttempts : null;
    if (!scheduleId || !agentId || !task || !runAt || !status || attempts == null || maxAttempts == null || attempts > maxAttempts) return null;
    return Object.freeze({ scheduleId, agentId, task, runAt, status, attempts, maxAttempts });
  }

  function normalizeSchedules(payload) {
    const source = Array.isArray(payload?.schedules) ? payload.schedules : [];
    const seen = new Set();
    const output = [];
    for (const raw of source) {
      const item = normalizeSchedule(raw);
      if (!item || seen.has(item.scheduleId)) continue;
      seen.add(item.scheduleId);
      output.push(item);
      if (output.length >= MAX_ITEMS) break;
    }
    output.sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt) || a.scheduleId.localeCompare(b.scheduleId));
    return output;
  }

  function normalizeListMeta(payload) {
    const meta = payload?.listMeta;
    if (!meta || Array.isArray(meta) || typeof meta !== 'object') return Object.freeze({ snapshot: null, nextOffset: null, total: null });
    const snapshot = typeof meta.snapshot === 'string' && SNAPSHOT_PATTERN.test(meta.snapshot) ? meta.snapshot : null;
    const nextOffset = Number.isSafeInteger(meta.nextOffset) && meta.nextOffset > 0 && meta.nextOffset <= 10_000 ? meta.nextOffset : null;
    const total = Number.isSafeInteger(meta.total) && meta.total >= 0 && meta.total <= 100_000 ? meta.total : null;
    if (nextOffset !== null && snapshot === null) return Object.freeze({ snapshot: null, nextOffset: null, total });
    return Object.freeze({ snapshot, nextOffset, total });
  }

  function mergeSchedules(current, incoming) {
    const byId = new Map();
    for (const item of [...current, ...incoming]) {
      if (!item?.scheduleId || byId.has(item.scheduleId)) continue;
      byId.set(item.scheduleId, item);
      if (byId.size >= MAX_ITEMS) break;
    }
    return Array.from(byId.values()).sort((a, b) => Date.parse(a.runAt) - Date.parse(b.runAt) || a.scheduleId.localeCompare(b.scheduleId));
  }

  function formatRunAt(value, locale = 'tr-TR') {
    const iso = normalizeIso(value);
    if (!iso) return 'Zaman bilinmiyor';
    try {
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function statusText(item) {
    if (!item || !STATUSES.has(item.status)) return 'Durum bilinmiyor';
    const base = STATUS_COPY[item.status];
    if (item.status === 'running' || item.status === 'failed') return `${base} · deneme ${item.attempts}/${item.maxAttempts}`;
    if (item.status === 'scheduled' && item.maxAttempts > 1) return `${base} · en fazla ${item.maxAttempts} deneme`;
    return base;
  }

  async function readPayload(response) {
    try {
      const value = await response.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function requestError(code) {
    const error = new Error(code);
    error.name = 'AbortError';
    error.code = code;
    return error;
  }

  function createListPath({ offset = 0, snapshot = null, scope = 'all' } = {}) {
    const selectedScope = normalizeScope(scope);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10_000) throw new Error('INVALID_SCHEDULE_LIST_OFFSET');
    if (offset > 0 && (typeof snapshot !== 'string' || !SNAPSHOT_PATTERN.test(snapshot))) throw new Error('INVALID_SCHEDULE_LIST_SNAPSHOT');
    if (offset === 0 && snapshot != null) throw new Error('INVALID_SCHEDULE_LIST_SNAPSHOT');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), view: 'summary', scope: selectedScope });
    if (offset > 0) {
      params.set('offset', String(offset));
      params.set('snapshot', snapshot);
    }
    return `${PATH}?${params.toString()}`;
  }

  function createClient({
    fetchImpl = globalThis.fetch,
    AbortControllerImpl = globalThis.AbortController,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_LIST_FETCH');
    if (typeof AbortControllerImpl !== 'function') throw new Error('INVALID_SCHEDULE_LIST_ABORT_CONTROLLER');
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') throw new Error('INVALID_SCHEDULE_LIST_TIMER');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('INVALID_SCHEDULE_LIST_TIMEOUT');

    return Object.freeze({
      async list(options = {}, { signal } = {}) {
        if (signal != null && (typeof signal !== 'object' || typeof signal.addEventListener !== 'function')) {
          throw new Error('INVALID_SCHEDULE_LIST_SIGNAL');
        }
        if (signal?.aborted) throw requestError('SCHEDULE_LIST_CANCELLED');

        const controller = new AbortControllerImpl();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener?.('abort', onAbort, { once: true });
        const timer = setTimeoutImpl(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        try {
          const response = await fetchImpl(createListPath(options), {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal
          });
          return Object.freeze({
            ok: Boolean(response?.ok),
            status: Number(response?.status) || 0,
            payload: Object.freeze(await readPayload(response))
          });
        } catch (error) {
          if (timedOut) throw requestError('SCHEDULE_LIST_TIMEOUT');
          if (signal?.aborted) throw requestError('SCHEDULE_LIST_CANCELLED');
          throw error;
        } finally {
          clearTimeoutImpl(timer);
          signal?.removeEventListener?.('abort', onAbort);
        }
      }
    });
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-list-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/schedule-list.css';
    link.setAttribute('data-hafize-schedule-list-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function createCard(documentRef) {
    const card = documentRef.createElement('section');
    card.className = 'utility-card schedule-list-card';
    card.id = 'scheduleListCard';
    card.dataset.scope = 'all';
    card.setAttribute('aria-labelledby', 'scheduleListTitle');
    card.setAttribute('aria-busy', 'false');

    const head = documentRef.createElement('div');
    head.className = 'utility-head schedule-list-head';
    const title = documentRef.createElement('span');
    title.id = 'scheduleListTitle';
    title.textContent = 'Zamanlanmış görevler';
    const refresh = documentRef.createElement('button');
    refresh.type = 'button';
    refresh.className = 'mini-btn schedule-list-refresh';
    refresh.textContent = 'Yenile';
    refresh.setAttribute('aria-label', 'Zamanlanmış görev listesini yenile');
    head.append(title, refresh);

    const status = documentRef.createElement('p');
    status.className = 'schedule-list-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Görevler kontrol ediliyor…';

    const list = documentRef.createElement('div');
    list.className = 'schedule-list-items';
    list.setAttribute('aria-label', 'Zamanlanmış görevler');

    const more = documentRef.createElement('button');
    more.type = 'button';
    more.className = 'mini-btn schedule-list-more';
    more.textContent = 'Daha eski görevleri yükle';
    more.hidden = true;
    more.setAttribute('aria-label', 'Daha eski zamanlanmış görevleri yükle');

    card.append(head, status, list, more);
    return { card, refresh, status, list, more };
  }

  function mount(documentRef, root, {
    fetchImpl = root?.fetch,
    AbortControllerImpl = root?.AbortController,
    setTimeoutImpl = root?.setTimeout,
    clearTimeoutImpl = root?.clearTimeout,
    timeoutMs = REQUEST_TIMEOUT_MS
  } = {}) {
    if (!documentRef || !root) return null;
    const rail = documentRef.querySelector?.('.utility-rail');
    if (!rail || documentRef.querySelector?.('#scheduleListCard')) return null;
    ensureStyles(documentRef);

    let client;
    try { client = createClient({ fetchImpl, AbortControllerImpl, setTimeoutImpl, clearTimeoutImpl, timeoutMs }); } catch { return null; }
    const nodes = createCard(documentRef);
    rail.append(nodes.card);
    let busy = false;
    let destroyed = false;
    let requestGeneration = 0;
    let activeRequestController = null;
    let sessionState = null;
    let pendingMutationRefresh = false;
    let pendingScope = null;
    let currentScope = 'all';
    let loadedItems = [];
    let snapshot = null;
    let nextOffset = null;
    let total = null;

    function setBusy(value) {
      busy = Boolean(value);
      nodes.card.setAttribute('aria-busy', String(busy));
      nodes.refresh.disabled = busy;
      nodes.more.disabled = busy;
    }

    function resetPagination() {
      loadedItems = [];
      snapshot = null;
      nextOffset = null;
      total = null;
      nodes.more.hidden = true;
    }

    function clearList() {
      nodes.list.replaceChildren();
    }

    function renderEmpty(text) {
      clearList();
      const empty = documentRef.createElement('p');
      empty.className = 'schedule-list-empty';
      empty.textContent = text;
      nodes.list.append(empty);
    }

    function renderSchedules(items) {
      clearList();
      for (const item of items) {
        const article = documentRef.createElement('article');
        article.className = 'schedule-list-item';
        article.dataset.state = item.status;
        article.dataset.scheduleId = item.scheduleId;
        article.dataset.maxAttempts = String(item.maxAttempts);

        const top = documentRef.createElement('div');
        top.className = 'schedule-list-item-head';
        const agent = documentRef.createElement('span');
        agent.className = 'schedule-list-agent';
        agent.textContent = item.agentId;
        const badge = documentRef.createElement('span');
        badge.className = 'schedule-list-badge';
        badge.dataset.state = item.status;
        badge.textContent = STATUS_COPY[item.status];
        top.append(agent, badge);

        const task = documentRef.createElement('p');
        task.className = 'schedule-list-task';
        task.textContent = item.task;

        const meta = documentRef.createElement('p');
        meta.className = 'schedule-list-meta';
        meta.dataset.runAt = item.runAt;
        meta.textContent = `${formatRunAt(item.runAt)} · ${statusText(item)}`;

        article.append(top, task, meta);
        nodes.list.append(article);
      }
    }

    function renderReadyStatus() {
      const visible = loadedItems.length;
      nodes.status.dataset.state = 'ready';
      if (!visible) nodes.status.textContent = 'Bu görünümde zamanlanmış görev bulunmuyor.';
      else if (total !== null && total > visible) nodes.status.textContent = `${visible}/${total} zamanlanmış görev gösteriliyor.`;
      else nodes.status.textContent = `${visible} zamanlanmış görev gösteriliyor.`;
      nodes.more.hidden = nextOffset === null || snapshot === null || visible >= MAX_ITEMS;
    }

    async function loadPage({ append = false, reason = 'manual' } = {}) {
      if (destroyed || busy) return false;
      if (reason === 'session' && sessionState === 'loading') return false;
      if (append && (nextOffset === null || snapshot === null || loadedItems.length >= MAX_ITEMS)) return false;
      const generation = ++requestGeneration;
      const requestOffset = append ? nextOffset : 0;
      const requestSnapshot = append ? snapshot : null;
      const requestScope = currentScope;
      const requestController = new AbortControllerImpl();
      activeRequestController = requestController;
      setBusy(true);
      nodes.status.dataset.state = 'loading';
      nodes.status.textContent = append ? 'Daha eski görevler yükleniyor…' : 'Zamanlanmış görevler yükleniyor…';
      try {
        const response = await client.list(
          { offset: requestOffset, snapshot: requestSnapshot, scope: requestScope },
          { signal: requestController.signal }
        );
        if (destroyed || generation !== requestGeneration || requestScope !== currentScope) return false;
        if (append && response.status === 409 && response.payload?.error === 'SCHEDULE_LIST_SNAPSHOT_CHANGED') {
          resetPagination();
          nodes.status.dataset.state = 'stale';
          nodes.status.textContent = 'Görev listesi değişti; güncel ilk sayfa yeniden yükleniyor…';
          setBusy(false);
          activeRequestController = null;
          return loadPage({ append: false, reason: 'snapshot-changed' });
        }
        if (response.status === 401) {
          sessionState = 'idle';
          resetPagination();
          nodes.status.dataset.state = 'auth';
          nodes.status.textContent = 'Görevleri görmek için güvenli cloud oturumu aç.';
          renderEmpty('Cloud oturumu gerekli.');
          return true;
        }
        if (response.status === 404) {
          resetPagination();
          nodes.status.dataset.state = 'disabled';
          nodes.status.textContent = 'Zamanlanmış görev API’si sunucuda etkin değil.';
          renderEmpty('Görev altyapısı kullanılamıyor.');
          return true;
        }
        if (!response.ok || response.payload?.ok !== true) {
          if (!append) resetPagination();
          nodes.status.dataset.state = 'error';
          nodes.status.textContent = 'Görev listesi güvenli biçimde alınamadı.';
          if (!append) renderEmpty('Liste şu anda kullanılamıyor.');
          return true;
        }
        sessionState = 'active';
        const pageItems = normalizeSchedules(response.payload);
        const meta = normalizeListMeta(response.payload);
        loadedItems = append ? mergeSchedules(loadedItems, pageItems) : pageItems.slice(0, MAX_ITEMS);
        snapshot = meta.snapshot;
        nextOffset = loadedItems.length >= MAX_ITEMS ? null : meta.nextOffset;
        total = meta.total;
        renderReadyStatus();
        if (loadedItems.length) renderSchedules(loadedItems);
        else renderEmpty('Bu görünümde henüz görev yok.');
        return true;
      } catch (error) {
        if (!destroyed && generation === requestGeneration && error?.code !== 'SCHEDULE_LIST_CANCELLED') {
          if (!append) resetPagination();
          nodes.status.dataset.state = error?.code === 'SCHEDULE_LIST_TIMEOUT' ? 'timeout' : 'error';
          nodes.status.textContent = error?.code === 'SCHEDULE_LIST_TIMEOUT'
            ? 'Görev listesi isteği zaman aşımına uğradı; yeniden deneyebilirsin.'
            : 'Görev listesine ulaşılamadı.';
          if (!append) renderEmpty(error?.code === 'SCHEDULE_LIST_TIMEOUT' ? 'Liste zamanında yanıt vermedi.' : 'Bağlantı kurulamadı.');
        }
        return false;
      } finally {
        if (activeRequestController === requestController) activeRequestController = null;
        if (!destroyed && generation === requestGeneration && busy) {
          setBusy(false);
          if (pendingScope !== null) {
            const scope = pendingScope;
            pendingScope = null;
            setScope(scope);
          } else if (pendingMutationRefresh) {
            pendingMutationRefresh = false;
            loadPage({ append: false, reason: 'mutation' });
          }
        }
      }
    }

    function refresh({ reason = 'manual' } = {}) {
      if (destroyed) return false;
      if (busy) {
        pendingMutationRefresh = true;
        return true;
      }
      resetPagination();
      return loadPage({ append: false, reason });
    }
    function setScope(value) {
      const scope = normalizeScope(value);
      if (destroyed || scope === currentScope) return false;
      if (busy) {
        pendingScope = scope;
        activeRequestController?.abort?.();
        return true;
      }
      currentScope = scope;
      nodes.card.dataset.scope = currentScope;
      resetPagination();
      loadPage({ append: false, reason: 'scope' });
      return true;
    }
    function onRefresh() { refresh({ reason: 'manual' }); }
    function onMore() { loadPage({ append: true, reason: 'more' }); }
    function onScope(event) { setScope(event?.detail?.scope); }
    function onScheduleMutation() {
      if (destroyed) return;
      if (busy) { pendingMutationRefresh = true; return; }
      refresh({ reason: 'mutation' });
    }
    nodes.refresh.addEventListener('click', onRefresh);
    nodes.more.addEventListener('click', onMore);
    root.addEventListener?.(CREATED_EVENT, onScheduleMutation);
    root.addEventListener?.(CANCELLED_EVENT, onScheduleMutation);
    root.addEventListener?.(RESCHEDULED_EVENT, onScheduleMutation);
    root.addEventListener?.(SCOPE_EVENT, onScope);

    const sessionBadge = documentRef.querySelector?.('#sessionBadge');
    let lastBadgeState = typeof sessionBadge?.dataset?.state === 'string' ? sessionBadge.dataset.state : null;
    const observer = typeof root.MutationObserver === 'function' && sessionBadge
      ? new root.MutationObserver(() => {
          const next = typeof sessionBadge.dataset?.state === 'string' ? sessionBadge.dataset.state : null;
          if (!next || next === lastBadgeState || next === 'loading') return;
          lastBadgeState = next;
          sessionState = next;
          refresh({ reason: 'session' });
        })
      : null;
    observer?.observe(sessionBadge, { attributes: true, attributeFilter: ['data-state'] });

    refresh({ reason: 'mount' });

    return Object.freeze({
      refresh,
      setScope,
      loadMore: () => loadPage({ append: true, reason: 'more' }),
      getState: () => Object.freeze({ busy, sessionState, pendingMutationRefresh, pendingScope, scope: currentScope, loaded: loadedItems.length, snapshot, nextOffset, total }),
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        requestGeneration += 1;
        activeRequestController?.abort?.();
        activeRequestController = null;
        pendingMutationRefresh = false;
        pendingScope = null;
        resetPagination();
        observer?.disconnect?.();
        nodes.refresh.removeEventListener('click', onRefresh);
        nodes.more.removeEventListener('click', onMore);
        root.removeEventListener?.(CREATED_EVENT, onScheduleMutation);
        root.removeEventListener?.(CANCELLED_EVENT, onScheduleMutation);
        root.removeEventListener?.(RESCHEDULED_EVENT, onScheduleMutation);
        root.removeEventListener?.(SCOPE_EVENT, onScope);
        nodes.card.remove();
        return true;
      }
    });
  }

  return Object.freeze({
    PATH,
    PAGE_SIZE,
    MAX_ITEMS,
    MAX_TASK_PREVIEW_CHARS,
    MAX_AGENT_ID_CHARS,
    MAX_SCHEDULE_ID_CHARS,
    REQUEST_TIMEOUT_MS,
    SNAPSHOT_PATTERN,
    CREATED_EVENT,
    CANCELLED_EVENT,
    RESCHEDULED_EVENT,
    SCOPE_EVENT,
    SCOPES,
    STATUSES,
    STATUS_COPY,
    normalizeScope,
    normalizeTaskPreview,
    normalizeIso,
    normalizeSchedule,
    normalizeSchedules,
    normalizeListMeta,
    mergeSchedules,
    createListPath,
    formatRunAt,
    statusText,
    createClient,
    mount
  });
});