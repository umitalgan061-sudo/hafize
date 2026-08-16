(function exposeHafizeScheduleList(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) { module.exports = api; return; }
  root.HafizeScheduleList = api;
  api.mount(root.document, root);
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScheduleList() {
  'use strict';

  const PATH = '/api/schedules';
  const MAX_ITEMS = 100;
  const MAX_TASK_PREVIEW_CHARS = 180;
  const MAX_AGENT_ID_CHARS = 120;
  const MAX_SCHEDULE_ID_CHARS = 120;
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

  function createClient({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('INVALID_SCHEDULE_LIST_FETCH');
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

    card.append(head, status, list);
    return { card, refresh, status, list };
  }

  function mount(documentRef, root, { fetchImpl = root?.fetch } = {}) {
    if (!documentRef || !root) return null;
    const rail = documentRef.querySelector?.('.utility-rail');
    if (!rail || documentRef.querySelector?.('#scheduleListCard')) return null;
    ensureStyles(documentRef);

    let client;
    try { client = createClient({ fetchImpl }); } catch { return null; }
    const nodes = createCard(documentRef);
    rail.append(nodes.card);
    let busy = false;
    let destroyed = false;
    let requestGeneration = 0;
    let sessionState = null;

    function setBusy(value) {
      busy = Boolean(value);
      nodes.card.setAttribute('aria-busy', String(busy));
      nodes.refresh.disabled = busy;
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
        meta.textContent = `${formatRunAt(item.runAt)} · ${statusText(item)}`;

        article.append(top, task, meta);
        nodes.list.append(article);
      }
    }

    async function refresh({ reason = 'manual' } = {}) {
      if (destroyed || busy) return false;
      if (reason === 'session' && sessionState === 'loading') return false;
      const generation = ++requestGeneration;
      setBusy(true);
      nodes.status.dataset.state = 'loading';
      nodes.status.textContent = 'Zamanlanmış görevler yükleniyor…';
      try {
        const response = await client.list();
        if (destroyed || generation !== requestGeneration) return false;
        if (response.status === 401) {
          sessionState = 'idle';
          nodes.status.dataset.state = 'auth';
          nodes.status.textContent = 'Görevleri görmek için güvenli cloud oturumu aç.';
          renderEmpty('Cloud oturumu gerekli.');
          return true;
        }
        if (response.status === 404) {
          nodes.status.dataset.state = 'disabled';
          nodes.status.textContent = 'Zamanlanmış görev API’si sunucuda etkin değil.';
          renderEmpty('Görev altyapısı kullanılamıyor.');
          return true;
        }
        if (!response.ok || response.payload?.ok !== true) {
          nodes.status.dataset.state = 'error';
          nodes.status.textContent = 'Görev listesi güvenli biçimde alınamadı.';
          renderEmpty('Liste şu anda kullanılamıyor.');
          return true;
        }
        sessionState = 'active';
        const items = normalizeSchedules(response.payload);
        nodes.status.dataset.state = 'ready';
        nodes.status.textContent = items.length
          ? `${items.length} zamanlanmış görev gösteriliyor.`
          : 'Zamanlanmış görev bulunmuyor.';
        if (items.length) renderSchedules(items);
        else renderEmpty('Henüz zamanlanmış görev yok.');
        return true;
      } catch {
        if (!destroyed && generation === requestGeneration) {
          nodes.status.dataset.state = 'error';
          nodes.status.textContent = 'Görev listesine ulaşılamadı.';
          renderEmpty('Bağlantı kurulamadı.');
        }
        return false;
      } finally {
        if (!destroyed && generation === requestGeneration) setBusy(false);
      }
    }

    function onRefresh() { refresh({ reason: 'manual' }); }
    nodes.refresh.addEventListener('click', onRefresh);

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
      getState: () => Object.freeze({ busy, sessionState }),
      destroy() {
        if (destroyed) return false;
        destroyed = true;
        requestGeneration += 1;
        observer?.disconnect?.();
        nodes.refresh.removeEventListener('click', onRefresh);
        nodes.card.remove();
        return true;
      }
    });
  }

  return Object.freeze({
    PATH,
    MAX_ITEMS,
    MAX_TASK_PREVIEW_CHARS,
    MAX_AGENT_ID_CHARS,
    MAX_SCHEDULE_ID_CHARS,
    STATUSES,
    STATUS_COPY,
    normalizeTaskPreview,
    normalizeIso,
    normalizeSchedule,
    normalizeSchedules,
    formatRunAt,
    statusText,
    createClient,
    mount
  });
});
