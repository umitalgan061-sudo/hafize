(function exposeHafizeScheduleActivity(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleActivity = api;
  api.mount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleActivity() {
  'use strict';

  const PATH = '/api/schedules';
  const MAX_ITEMS = 50;
  const MAX_AGENT_ID_CHARS = 120;
  const MAX_SCHEDULE_ID_CHARS = 120;
  const CREATED_EVENT = 'hafize:schedule-created';
  const CANCELLED_EVENT = 'hafize:schedule-cancelled';
  const RESCHEDULED_EVENT = 'hafize:schedule-rescheduled';
  const STATUSES = Object.freeze(new Set(['scheduled', 'running', 'completed', 'failed', 'cancelled']));
  const FILTERS = Object.freeze(new Set(['all', 'active', 'history']));
  const STATUS_COPY = Object.freeze({
    scheduled: 'Planlandı',
    running: 'Çalışıyor',
    completed: 'Tamamlandı',
    failed: 'Başarısız',
    cancelled: 'İptal edildi'
  });

  function safeText(value, maxChars) {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > maxChars) return null;
    return clean;
  }

  function normalizeIso(value, { optional = false } = {}) {
    if (value == null && optional) return null;
    const text = safeText(value, 64);
    if (!text) return null;
    const time = Date.parse(text);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }

  function normalizeActivity(raw) {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') return null;
    const scheduleId = safeText(raw.scheduleId, MAX_SCHEDULE_ID_CHARS);
    const agentId = safeText(raw.agentId, MAX_AGENT_ID_CHARS);
    const status = typeof raw.status === 'string' && STATUSES.has(raw.status) ? raw.status : null;
    const attempts = Number.isInteger(raw.attempts) && raw.attempts >= 0 && raw.attempts <= 5 ? raw.attempts : null;
    const maxAttempts = Number.isInteger(raw.maxAttempts) && raw.maxAttempts >= 1 && raw.maxAttempts <= 5 ? raw.maxAttempts : null;
    const runAt = normalizeIso(raw.runAt);
    const createdAt = normalizeIso(raw.createdAt);
    const updatedAt = normalizeIso(raw.updatedAt, { optional: true });
    if (!scheduleId || !agentId || !status || attempts == null || maxAttempts == null || attempts > maxAttempts || !runAt || !createdAt) return null;
    if (status === 'scheduled' && attempts >= maxAttempts) return null;
    if ((status === 'running' || status === 'completed' || status === 'failed') && attempts < 1) return null;
    return Object.freeze({ scheduleId, agentId, status, attempts, maxAttempts, runAt, createdAt, updatedAt });
  }

  function normalizeActivities(payload) {
    const source = Array.isArray(payload?.schedules) ? payload.schedules : [];
    const seen = new Set();
    const items = [];
    for (const raw of source) {
      const item = normalizeActivity(raw);
      if (!item || seen.has(item.scheduleId)) continue;
      seen.add(item.scheduleId);
      items.push(item);
      if (items.length >= MAX_ITEMS) break;
    }
    items.sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt);
      const bTime = Date.parse(b.updatedAt || b.createdAt);
      return bTime - aTime || a.scheduleId.localeCompare(b.scheduleId);
    });
    return items;
  }

  function activityGroup(status) {
    return status === 'scheduled' || status === 'running' ? 'active' : 'history';
  }

  function filterActivities(items, filter) {
    const mode = FILTERS.has(filter) ? filter : 'all';
    if (mode === 'all') return [...items];
    return items.filter((item) => activityGroup(item.status) === mode);
  }

  function activitySummary(item) {
    if (!item || !STATUSES.has(item.status)) return 'Çalışma durumu bilinmiyor';
    if (item.status === 'scheduled') {
      return item.attempts === 0
        ? 'Henüz çalışmadı'
        : `Yeniden deneme bekliyor · ${item.attempts}/${item.maxAttempts} deneme kullanıldı`;
    }
    if (item.status === 'running') return `Deneme ${item.attempts}/${item.maxAttempts} çalışıyor`;
    if (item.status === 'completed') return `Deneme ${item.attempts}/${item.maxAttempts} ile tamamlandı`;
    if (item.status === 'failed') return `Deneme ${item.attempts}/${item.maxAttempts} sonrası başarısız`;
    return item.attempts === 0
      ? 'Çalışmadan iptal edildi'
      : `${item.attempts}/${item.maxAttempts} deneme sonrası iptal edildi`;
  }

  function formatTime(value, locale = 'tr-TR') {
    const iso = normalizeIso(value, { optional: true });
    if (!iso) return 'Bilinmiyor';
    try {
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function latestChange(item) {
    return item?.updatedAt || item?.createdAt || null;
  }

  async function readPayload(response) {
    try {
      const value = await response.json();
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function createClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_ACTIVITY_FETCH');
    return Object.freeze({
      async list() {
        const response = await fetchImpl(PATH, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store'
        });
        return Object.freeze({
          ok: Boolean(response?.ok),
          status: Number(response?.status) || 0,
          payload: Object.freeze(await readPayload(response))
        });
      }
    });
  }

  function ensureStyles(documentRef) {
    if (!documentRef?.head || documentRef.querySelector?.('link[data-hafize-schedule-activity-style]')) return false;
    const link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/schedule-activity.css';
    link.setAttribute('data-hafize-schedule-activity-style', '1');
    documentRef.head.append(link);
    return true;
  }

  function createCard(documentRef) {
    const card = documentRef.createElement('section');
    card.className = 'utility-card schedule-activity-card';
    card.id = 'scheduleActivityCard';
    card.setAttribute('aria-labelledby', 'scheduleActivityTitle');
    card.setAttribute('aria-busy', 'false');

    const head = documentRef.createElement('div');
    head.className = 'utility-head schedule-activity-head';
    const title = documentRef.createElement('span');
    title.id = 'scheduleActivityTitle';
    title.textContent = 'Görev aktivitesi';
    const refresh = documentRef.createElement('button');
    refresh.type = 'button';
    refresh.className = 'mini-btn schedule-activity-refresh';
    refresh.textContent = 'Yenile';
    refresh.setAttribute('aria-label', 'Görev aktivitesini yenile');
    head.append(title, refresh);

    const status = documentRef.createElement('p');
    status.className = 'schedule-activity-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Görev aktivitesi kontrol ediliyor…';

    const filters = documentRef.createElement('div');
    filters.className = 'schedule-activity-filters';
    filters.setAttribute('role', 'group');
    filters.setAttribute('aria-label', 'Görev aktivitesi filtresi');
    for (const [value, label] of [['all', 'Tümü'], ['active', 'Aktif'], ['history', 'Geçmiş']]) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'schedule-activity-filter';
      button.dataset.filter = value;
      button.textContent = label;
      button.setAttribute('aria-pressed', String(value === 'all'));
      filters.append(button);
    }

    const list = documentRef.createElement('div');
    list.className = 'schedule-activity-items';
    list.setAttribute('aria-label', 'Görev çalışma özeti');

    card.append(head, status, filters, list);
    return { card, refresh, status, filters, list };
  }

  function mount(documentRef, root, { fetchImpl = root?.fetch } = {}) {
    if (!documentRef || !root) return null;
    const rail = documentRef.querySelector?.('.utility-rail');
    if (!rail || documentRef.querySelector?.('#scheduleActivityCard')) return null;
    ensureStyles(documentRef);

    let client;
    try { client = createClient({ fetchImpl }); } catch { return null; }
    const nodes = createCard(documentRef);
    const scheduleCard = documentRef.querySelector?.('#scheduleListCard');
    if (scheduleCard?.parentNode === rail && scheduleCard.nextSibling) rail.insertBefore(nodes.card, scheduleCard.nextSibling);
    else rail.append(nodes.card);

    let allItems = [];
    let filter = 'all';
    let busy = false;
    let destroyed = false;
    let generation = 0;
    let pendingRefresh = false;
    let sessionState = null;

    function setBusy(value) {
      busy = Boolean(value);
      nodes.card.setAttribute('aria-busy', String(busy));
      nodes.refresh.disabled = busy;
    }

    function render() {
      nodes.list.replaceChildren();
      const visible = filterActivities(allItems, filter);
      for (const item of visible) {
        const article = documentRef.createElement('article');
        article.className = 'schedule-activity-item';
        article.dataset.state = item.status;
        article.dataset.group = activityGroup(item.status);

        const top = documentRef.createElement('div');
        top.className = 'schedule-activity-item-head';
        const agent = documentRef.createElement('span');
        agent.className = 'schedule-activity-agent';
        agent.textContent = item.agentId;
        const badge = documentRef.createElement('span');
        badge.className = 'schedule-activity-badge';
        badge.dataset.state = item.status;
        badge.textContent = STATUS_COPY[item.status];
        top.append(agent, badge);

        const summary = documentRef.createElement('p');
        summary.className = 'schedule-activity-summary';
        summary.textContent = activitySummary(item);

        const progress = documentRef.createElement('progress');
        progress.className = 'schedule-activity-progress';
        progress.max = item.maxAttempts;
        progress.value = item.attempts;
        progress.setAttribute('aria-label', `${item.attempts}/${item.maxAttempts} deneme kullanıldı`);

        const time = documentRef.createElement('p');
        time.className = 'schedule-activity-time';
        time.textContent = item.status === 'scheduled'
          ? `Sonraki çalışma: ${formatTime(item.runAt)} · Son değişiklik: ${formatTime(latestChange(item))}`
          : `Son değişiklik: ${formatTime(latestChange(item))}`;

        article.append(top, summary, progress, time);
        nodes.list.append(article);
      }
      if (!visible.length) {
        const empty = documentRef.createElement('p');
        empty.className = 'schedule-activity-empty';
        empty.textContent = allItems.length ? 'Bu filtrede görev yok.' : 'Henüz görev aktivitesi yok.';
        nodes.list.append(empty);
      }
      nodes.status.dataset.state = 'ready';
      nodes.status.textContent = allItems.length
        ? `${visible.length}/${allItems.length} görev gösteriliyor.`
        : 'Görev aktivitesi bulunmuyor.';
    }

    function renderProblem(state, text) {
      render();
      nodes.status.dataset.state = state;
      nodes.status.textContent = text;
    }

    function setFilter(next) {
      if (!FILTERS.has(next)) return false;
      filter = next;
      for (const button of nodes.filters.querySelectorAll?.('.schedule-activity-filter') || []) {
        button.setAttribute('aria-pressed', String(button.dataset?.filter === filter));
      }
      render();
      return true;
    }

    async function refresh({ reason = 'manual' } = {}) {
      if (destroyed || busy) return false;
      if (reason === 'session' && sessionState === 'loading') return false;
      const request = ++generation;
      setBusy(true);
      nodes.status.dataset.state = 'loading';
      nodes.status.textContent = 'Görev aktivitesi yükleniyor…';
      try {
        const response = await client.list();
        if (destroyed || request !== generation) return false;
        if (response.status === 401) {
          allItems = [];
          sessionState = 'idle';
          renderProblem('auth', 'Görev aktivitesi için güvenli cloud oturumu aç.');
          return true;
        }
        if (!response.ok || response.payload?.ok !== true) {
          allItems = [];
          renderProblem('error', 'Görev aktivitesi güvenli biçimde alınamadı.');
          return true;
        }
        sessionState = 'active';
        allItems = normalizeActivities(response.payload);
        render();
        return true;
      } catch {
        if (!destroyed && request === generation) {
          allItems = [];
          renderProblem('error', 'Görev aktivitesine ulaşılamadı.');
        }
        return false;
      } finally {
        if (!destroyed && request === generation) {
          setBusy(false);
          if (pendingRefresh) {
            pendingRefresh = false;
            refresh({ reason: 'mutation' });
          }
        }
      }
    }

    function onFilter(event) {
      const button = event?.target?.closest?.('.schedule-activity-filter');
      if (button) setFilter(button.dataset?.filter);
    }
    function onMutation() {
      if (destroyed) return;
      if (busy) { pendingRefresh = true; return; }
      refresh({ reason: 'mutation' });
    }
    nodes.refresh.addEventListener('click', refresh);
    nodes.filters.addEventListener('click', onFilter);
    root.addEventListener?.(CREATED_EVENT, onMutation);
    root.addEventListener?.(CANCELLED_EVENT, onMutation);
    root.addEventListener?.(RESCHEDULED_EVENT, onMutation);

    const sessionBadge = documentRef.querySelector?.('#sessionBadge');
    let lastBadgeState = typeof sessionBadge?.dataset?.state === 'string' ? sessionBadge.dataset.state : null;
    const sessionObserver = typeof root.MutationObserver === 'function' && sessionBadge
      ? new root.MutationObserver(() => {
          const next = typeof sessionBadge.dataset?.state === 'string' ? sessionBadge.dataset.state : null;
          if (!next || next === lastBadgeState || next === 'loading') return;
          lastBadgeState = next;
          sessionState = next;
          if (busy) { pendingRefresh = true; return; }
          refresh({ reason: 'session' });
        })
      : null;
    sessionObserver?.observe(sessionBadge, { attributes: true, attributeFilter: ['data-state'] });

    refresh({ reason: 'mount' });

    return Object.freeze({
      refresh,
      setFilter,
      getState: () => Object.freeze({ busy, filter, count: allItems.length, pendingRefresh, sessionState }),
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        generation += 1;
        pendingRefresh = false;
        sessionObserver?.disconnect?.();
        nodes.refresh.removeEventListener('click', refresh);
        nodes.filters.removeEventListener('click', onFilter);
        root.removeEventListener?.(CREATED_EVENT, onMutation);
        root.removeEventListener?.(CANCELLED_EVENT, onMutation);
        root.removeEventListener?.(RESCHEDULED_EVENT, onMutation);
        nodes.card.remove();
        return true;
      }
    });
  }

  return Object.freeze({
    PATH,
    MAX_ITEMS,
    MAX_AGENT_ID_CHARS,
    MAX_SCHEDULE_ID_CHARS,
    CREATED_EVENT,
    CANCELLED_EVENT,
    RESCHEDULED_EVENT,
    STATUSES,
    FILTERS,
    STATUS_COPY,
    normalizeIso,
    normalizeActivity,
    normalizeActivities,
    activityGroup,
    filterActivities,
    activitySummary,
    formatTime,
    latestChange,
    createClient,
    mount
  });
});