(function installScheduledTasksOrganizer(root) {
  'use strict';

  const PANEL_ID = 'scheduledTasksWorkspace';
  const LIST_SELECTOR = '.scheduled-tasks-list';
  const STORAGE_KEY = 'hafize.scheduled-tasks.view.v1';
  const MAX_QUERY = 120;
  const MAX_AGENT = 80;
  const DEFAULT_VIEW = Object.freeze({ query: '', agent: 'all', sort: 'runAt-asc' });
  const SORTS = new Set(['runAt-asc', 'runAt-desc', 'status', 'task-asc']);

  const doc = () => root.document;
  const make = (tag, textValue, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  };
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);
  const storage = () => root.localStorage;

  function readView() {
    try {
      const raw = JSON.parse(storage()?.getItem(STORAGE_KEY) || '{}');
      return {
        query: clamp(raw?.query, MAX_QUERY),
        agent: raw?.agent === 'all' ? 'all' : clamp(raw?.agent, MAX_AGENT) || 'all',
        sort: SORTS.has(raw?.sort) ? raw.sort : DEFAULT_VIEW.sort
      };
    } catch {
      return { ...DEFAULT_VIEW };
    }
  }

  function saveView(view) {
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify(view)); } catch { /* private browsing/storage quota can reject writes */ }
  }

  function statusRank(value) {
    return ({ scheduled: 0, running: 1, failed: 2, completed: 3, cancelled: 4 })[value] ?? 5;
  }

  function timestampFor(row) {
    const value = Date.parse(row.dataset.runAt || '');
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  function taskText(row) {
    return clamp(row.querySelector('.scheduled-task-row-head strong')?.textContent, 400);
  }

  function agentText(row) {
    const meta = row.querySelector('.scheduled-task-meta')?.textContent || '';
    const parts = meta.split('·').map((part) => part.trim()).filter(Boolean);
    return clamp(parts[1] || '', MAX_AGENT);
  }

  function isInputTarget(target) {
    return target?.matches?.('input,textarea,select,[contenteditable="true"]');
  }

  function apiRequest(path, options = {}) {
    return root.fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    }).then(async (response) => {
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        const error = new Error(payload?.code || payload?.error || `HTTP_${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload || {};
    });
  }

  function addAgentData() {
    const panel = doc().getElementById(PANEL_ID);
    panel?.querySelectorAll?.('.scheduled-task-row').forEach((row) => {
      if (!row.dataset.agentId) row.dataset.agentId = agentText(row);
      if (!row.dataset.taskText) row.dataset.taskText = taskText(row);
    });
  }

  function ensureToolbar(panel) {
    let toolbar = panel.querySelector('.scheduled-tasks-organizer');
    if (toolbar) return toolbar;

    toolbar = make('div', undefined, 'scheduled-tasks-organizer');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Görev listesi düzenleme araçları');

    const search = doc().createElement('input');
    search.type = 'search';
    search.maxLength = MAX_QUERY;
    search.placeholder = 'Görevlerde ara…';
    search.setAttribute('aria-label', 'Görevlerde ara');
    search.dataset.organizerSearch = 'true';

    const agent = doc().createElement('select');
    agent.setAttribute('aria-label', 'Ajanına göre filtrele');
    agent.dataset.organizerAgent = 'true';

    const sort = doc().createElement('select');
    sort.setAttribute('aria-label', 'Görevleri sırala');
    sort.dataset.organizerSort = 'true';
    for (const [value, label] of [
      ['runAt-asc', 'Yaklaşan görevler'],
      ['runAt-desc', 'Uzaklaşan görevler'],
      ['status', 'Duruma göre'],
      ['task-asc', 'Görev adına göre']
    ]) {
      const option = make('option', label);
      option.value = value;
      sort.append(option);
    }

    const count = make('span', '', 'scheduled-tasks-organizer-count');
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
    count.dataset.organizerCount = 'true';

    const reset = make('button', 'Filtreleri sıfırla', 'mini-btn');
    reset.type = 'button';
    reset.dataset.organizerReset = 'true';

    const duplicateHint = make('small', 'Görev satırındaki "Çoğalt" yeni bir planlama oluşturur.', 'scheduled-tasks-organizer-hint');
    toolbar.append(search, agent, sort, count, reset, duplicateHint);

    const filterSection = panel.querySelector('.scheduled-tasks-filter');
    (filterSection || panel.querySelector('.scheduled-tasks-list'))?.after(toolbar);

    const view = readView();
    search.value = view.query;
    sort.value = view.sort;
    populateAgents(panel, agent, view.agent);

    search.addEventListener('input', () => {
      const next = { ...readView(), query: clamp(search.value, MAX_QUERY) };
      saveView(next); apply(panel);
    });
    agent.addEventListener('change', () => {
      const next = { ...readView(), agent: clamp(agent.value, MAX_AGENT) || 'all' };
      saveView(next); apply(panel);
    });
    sort.addEventListener('change', () => {
      const next = { ...readView(), sort: SORTS.has(sort.value) ? sort.value : DEFAULT_VIEW.sort };
      saveView(next); apply(panel);
    });
    reset.addEventListener('click', () => {
      saveView({ ...DEFAULT_VIEW });
      search.value = '';
      sort.value = DEFAULT_VIEW.sort;
      populateAgents(panel, agent, 'all');
      apply(panel);
      search.focus();
    });
    return toolbar;
  }

  function populateAgents(panel, select, selected) {
    const agents = new Map();
    const source = panel.querySelector('#scheduledTaskAgent');
    source?.querySelectorAll?.('option[value]').forEach((option) => {
      const value = clamp(option.value, MAX_AGENT);
      if (value) agents.set(value, option.textContent?.trim() || value);
    });
    panel.querySelectorAll('.scheduled-task-row').forEach((row) => {
      const value = clamp(row.dataset.agentId || agentText(row), MAX_AGENT);
      if (value) agents.set(value, value);
    });

    const nextValues = ['all', ...[...agents.keys()].sort((a, b) => a.localeCompare(b, 'tr'))];
    const currentValues = [...select.options].map((option) => option.value);
    if (currentValues.join('|') !== nextValues.join('|')) {
      select.replaceChildren();
      const all = make('option', 'Tüm ajanlar'); all.value = 'all'; select.append(all);
      for (const value of nextValues.slice(1)) {
        const option = make('option', agents.get(value) || value);
        option.value = value;
        select.append(option);
      }
    }
    select.value = nextValues.includes(selected) ? selected : 'all';
  }

  function apply(panel) {
    const toolbar = panel.querySelector('.scheduled-tasks-organizer');
    const list = panel.querySelector(LIST_SELECTOR);
    if (!toolbar || !list) return;
    const view = readView();
    const query = view.query.toLocaleLowerCase('tr-TR');
    const rows = [...list.querySelectorAll('.scheduled-task-row')];

    rows.forEach((row) => {
      const agent = clamp(row.dataset.agentId || agentText(row), MAX_AGENT);
      const haystack = `${taskText(row)} ${row.textContent || ''}`.toLocaleLowerCase('tr-TR');
      const matchesQuery = !query || haystack.includes(query);
      const matchesAgent = view.agent === 'all' || agent === view.agent;
      row.hidden = !(matchesQuery && matchesAgent);
    });

    rows.sort((a, b) => {
      if (view.sort === 'status') return statusRank(a.dataset.status) - statusRank(b.dataset.status) || timestampFor(a) - timestampFor(b);
      if (view.sort === 'task-asc') return taskText(a).localeCompare(taskText(b), 'tr') || timestampFor(a) - timestampFor(b);
      return view.sort === 'runAt-desc' ? timestampFor(b) - timestampFor(a) : timestampFor(a) - timestampFor(b);
    });
    rows.forEach((row) => list.append(row));

    const visible = rows.filter((row) => !row.hidden).length;
    const count = toolbar.querySelector('[data-organizer-count]');
    if (count) count.textContent = `${visible}/${rows.length} görev gösteriliyor.`;
  }

  async function duplicate(scheduleId) {
    const panel = doc().getElementById(PANEL_ID);
    if (!scheduleId || !panel) return;
    if (!root.confirm?.('Bu görevin 5 dakika sonrası için yeni bir kopyası planlansın mı?')) return;
    const row = panel.querySelector(`.scheduled-task-row[data-schedule-id="${CSS.escape(scheduleId)}"]`);
    const status = panel.querySelector('.scheduled-tasks-status');
    try {
      const payload = await apiRequest('/api/schedules');
      const source = Array.isArray(payload.schedules) ? payload.schedules.find((entry) => entry.scheduleId === scheduleId) : null;
      if (!source || !source.task || !source.agentId) throw new Error('SCHEDULE_NOT_FOUND');
      const target = Date.parse(source.runAt || '');
      const runAt = new Date(Math.max(Date.now() + 300_000, (Number.isFinite(target) ? target : Date.now()) + 300_000)).toISOString();
      await apiRequest('/api/schedules', {
        method: 'POST',
        body: JSON.stringify({ agentId: clamp(source.agentId, MAX_AGENT), task: clamp(source.task, 20_000), runAt, maxAttempts: Math.min(5, Math.max(1, Number(source.maxAttempts) || 1)) })
      });
      if (status) { status.textContent = 'Görev kopyası planlandı.'; status.dataset.tone = 'success'; }
      root.ScheduledTasksWorkspace?.refresh?.();
    } catch (error) {
      if (status) { status.textContent = error.status === 401 ? 'Oturum açılması gerekiyor.' : 'Görev kopyası planlanamadı.'; status.dataset.tone = 'error'; }
    }
    row?.focus?.();
  }

  function addDuplicateButtons(panel) {
    panel.querySelectorAll('.scheduled-task-row').forEach((row) => {
      const actions = row.querySelector('.scheduled-task-actions');
      if (!actions || actions.querySelector('[data-organizer-duplicate]')) return;
      const scheduleId = row.dataset.scheduleId || '';
      const button = make('button', 'Çoğalt', 'mini-btn');
      button.type = 'button';
      button.dataset.organizerDuplicate = scheduleId;
      button.setAttribute('aria-label', 'Görevi çoğalt');
      actions.append(button);
    });
  }

  function onPanelClick(event) {
    const target = event.target?.closest?.('[data-organizer-duplicate]');
    if (!target) return;
    event.preventDefault();
    duplicate(target.dataset.organizerDuplicate || '');
  }

  function enhance(panel) {
    ensureToolbar(panel);
    addAgentData();
    addDuplicateButtons(panel);
    populateAgents(panel, panel.querySelector('[data-organizer-agent]'), readView().agent);
    apply(panel);
  }

  function boot() {
    if (!doc()) return;
    let observer;
    const attach = () => {
      const panel = doc().getElementById(PANEL_ID);
      if (!panel) return;
      if (!panel.dataset.organizerBound) {
        panel.dataset.organizerBound = 'true';
        panel.addEventListener('click', onPanelClick);
        observer?.observe(panel, { childList: true, subtree: true });
      }
      enhance(panel);
    };
    observer = new MutationObserver(attach);
    observer.observe(doc().documentElement, { childList: true, subtree: true });
    attach();
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
  }

  root.ScheduledTasksOrganizer = Object.freeze({
    STORAGE_KEY,
    DEFAULT_VIEW,
    readView,
    saveView,
    apply: () => apply(doc()?.getElementById(PANEL_ID)),
    duplicate,
    boot
  });

  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
