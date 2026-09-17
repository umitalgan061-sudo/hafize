(function installScheduledTasksDashboard(root) {
  'use strict';

  const PANEL_ID = 'scheduledTasksWorkspace';
  const STORAGE_KEY = 'hafize.scheduled-tasks.views.v1';
  const MAX_VIEWS = 6;
  const MAX_NAME = 60;
  const MAX_TEXT = 20_000;
  const MAX_TRACE = 128;
  const TIME_WINDOWS = new Set(['all', 'next24', 'today', 'next7', 'past']);

  const doc = () => root.document;
  const make = (tag, textValue, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  };
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);

  function safeView(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      query: clamp(source.query, 120),
      agent: source.agent === 'all' ? 'all' : clamp(source.agent, 80) || 'all',
      sort: ['runAt-asc', 'runAt-desc', 'status', 'task-asc'].includes(source.sort) ? source.sort : 'runAt-asc',
      status: ['all', 'scheduled', 'running', 'completed', 'failed', 'cancelled'].includes(source.status) ? source.status : 'all',
      time: TIME_WINDOWS.has(source.time) ? source.time : 'all'
    };
  }

  function readViews() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return [];
      return value.slice(0, MAX_VIEWS).map((entry) => ({
        id: clamp(entry?.id, 80),
        name: clamp(entry?.name, MAX_NAME),
        view: safeView(entry?.view),
        savedAt: clamp(entry?.savedAt, 40)
      })).filter((entry) => entry.id && entry.name);
    } catch {
      return [];
    }
  }

  function writeViews(views) {
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS))); return true; }
    catch { return false; }
  }

  function newId() { return root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function statusNode(panel) { return panel?.querySelector('.scheduled-tasks-status'); }
  function announce(panel, message, tone = 'info') { const node = statusNode(panel); if (!node) return; node.textContent = clamp(message, 220); node.dataset.tone = tone; }

  function currentView(panel) {
    const organizer = root.ScheduledTasksOrganizer?.readView?.() || {};
    const statusSelect = panel.querySelector('.scheduled-tasks-filter select');
    const timeSelect = panel.querySelector('[data-task-dashboard-time]');
    return safeView({ ...organizer, status: statusSelect?.value || 'all', time: timeSelect?.value || 'all' });
  }

  function populateTimeFilter(panel, selected) {
    const select = panel.querySelector('[data-task-dashboard-time]');
    if (!select) return;
    select.value = TIME_WINDOWS.has(selected) ? selected : 'all';
  }

  function timeMatches(row, selected) {
    if (selected === 'all') return true;
    const timestamp = Date.parse(row.dataset.runAt || '');
    if (!Number.isFinite(timestamp)) return false;
    const now = Date.now();
    if (selected === 'past') return timestamp < now;
    if (selected === 'next24') return timestamp >= now && timestamp <= now + 86_400_000;
    if (selected === 'next7') return timestamp >= now && timestamp <= now + 604_800_000;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const end = start + 86_400_000;
    return timestamp >= start && timestamp < end;
  }

  function applyTimeFilter(panel) {
    const select = panel.querySelector('[data-task-dashboard-time]');
    const selected = TIME_WINDOWS.has(select?.value) ? select.value : 'all';
    const rows = [...panel.querySelectorAll('.scheduled-task-row')];
    rows.forEach((row) => { row.dataset.dashboardTimeMatch = String(timeMatches(row, selected)); });
    const count = panel.querySelector('[data-task-dashboard-count]');
    const visible = rows.filter((row) => !row.hidden && row.dataset.dashboardTimeMatch !== 'false').length;
    if (count) count.textContent = `${visible}/${rows.length} görev görünür.`;
  }

  function setOrganizerControl(panel, selector, value) {
    const node = panel.querySelector(selector);
    if (!node) return;
    node.value = value;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyView(panel, view) {
    const next = safeView(view);
    const search = panel.querySelector('[data-organizer-search]');
    const agent = panel.querySelector('[data-organizer-agent]');
    const sort = panel.querySelector('[data-organizer-sort]');
    if (search) { search.value = next.query; search.dispatchEvent(new Event('input', { bubbles: true })); }
    if (agent) { agent.value = next.agent; agent.dispatchEvent(new Event('change', { bubbles: true })); }
    if (sort) { sort.value = next.sort; sort.dispatchEvent(new Event('change', { bubbles: true })); }
    const status = panel.querySelector('.scheduled-tasks-filter select');
    if (status) { status.value = next.status; status.dispatchEvent(new Event('change', { bubbles: true })); }
    populateTimeFilter(panel, next.time);
    try { root.localStorage?.setItem('hafize.scheduled-tasks.dashboard.time.v1', next.time); } catch { /* view preference is optional */ }
    applyTimeFilter(panel);
    root.ScheduledTasksOrganizer?.apply?.();
    root.ScheduledTasksActions?.refresh?.();
  }

  function ensureControls(panel) {
    let bar = panel.querySelector('.scheduled-tasks-dashboard');
    if (bar) return bar;
    bar = make('div', undefined, 'scheduled-tasks-dashboard');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Görev görünümleri ve zaman filtreleri');

    const time = doc().createElement('select');
    time.dataset.taskDashboardTime = 'true';
    time.setAttribute('aria-label', 'Zaman aralığına göre filtrele');
    for (const [value, label] of [['all', 'Tüm zamanlar'], ['today', 'Bugün'], ['next24', 'Sonraki 24 saat'], ['next7', 'Sonraki 7 gün'], ['past', 'Geçmiş']]) {
      const option = make('option', label); option.value = value; time.append(option);
    }

    const views = doc().createElement('select');
    views.dataset.taskDashboardViews = 'true';
    views.setAttribute('aria-label', 'Kayıtlı görev görünümü');

    const save = make('button', 'Görünümü kaydet', 'mini-btn');
    save.type = 'button'; save.dataset.taskDashboardSave = 'true';
    const remove = make('button', 'Görünümü sil', 'mini-btn');
    remove.type = 'button'; remove.dataset.taskDashboardDelete = 'true';
    remove.disabled = true;

    const count = make('span', '', 'scheduled-tasks-dashboard-count');
    count.dataset.taskDashboardCount = 'true';
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');

    bar.append(time, views, save, remove, count);
    const organizer = panel.querySelector('.scheduled-tasks-organizer');
    (organizer || panel.querySelector('.scheduled-tasks-filter') || panel.querySelector('.scheduled-tasks-list'))?.after(bar);

    function refreshViews(selectedId = '') {
      const entries = readViews();
      views.replaceChildren();
      const base = make('option', 'Görünüm seç…'); base.value = ''; views.append(base);
      entries.forEach((entry) => { const option = make('option', entry.name); option.value = entry.id; views.append(option); });
      views.value = entries.some((entry) => entry.id === selectedId) ? selectedId : '';
      remove.disabled = !views.value;
    }

    const savedTime = (() => { try { return root.localStorage?.getItem('hafize.scheduled-tasks.dashboard.time.v1') || 'all'; } catch { return 'all'; } })();
    const initial = currentView(panel);
    populateTimeFilter(panel, TIME_WINDOWS.has(savedTime) ? savedTime : initial.time);
    refreshViews();

    time.addEventListener('change', () => {
      const current = { ...currentView(panel), time: time.value };
      try { root.localStorage?.setItem('hafize.scheduled-tasks.dashboard.time.v1', time.value); } catch { /* optional */ }
      applyTimeFilter(panel);
      updatePresetSelection(panel, current);
    });

    views.addEventListener('change', () => {
      const entries = readViews();
      const entry = entries.find((candidate) => candidate.id === views.value);
      if (!entry) { remove.disabled = true; return; }
      applyView(panel, entry.view);
      refreshViews(entry.id);
      remove.disabled = false;
      announce(panel, `"${entry.name}" görünümü uygulandı.`, 'info');
    });

    save.addEventListener('click', () => {
      const raw = root.prompt?.('Görünüm adı:', '') ?? '';
      const name = clamp(raw.trim(), MAX_NAME);
      if (!name) return announce(panel, 'Görünüm adı boş olamaz.', 'error');
      const entries = readViews();
      const same = entries.find((entry) => entry.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
      const entry = { id: same?.id || newId(), name, view: currentView(panel), savedAt: new Date().toISOString() };
      const next = same ? entries.map((candidate) => candidate.id === same.id ? entry : candidate) : [entry, ...entries].slice(0, MAX_VIEWS);
      if (!writeViews(next)) return announce(panel, 'Görünüm kaydedilemedi.', 'error');
      refreshViews(entry.id);
      remove.disabled = false;
      announce(panel, `"${entry.name}" görünümü kaydedildi.`, 'success');
    });

    remove.addEventListener('click', () => {
      const id = views.value;
      if (!id) return;
      const entries = readViews();
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry || !root.confirm?.(`"${entry.name}" görünümü silinsin mi?`)) return;
      writeViews(entries.filter((candidate) => candidate.id !== id));
      refreshViews();
      announce(panel, 'Kayıtlı görünüm silindi.', 'success');
    });

    return bar;
  }

  function updatePresetSelection(panel, view) {
    const control = panel.querySelector('[data-task-dashboard-views]');
    if (!control) return;
    const entries = readViews();
    const current = JSON.stringify(safeView(view));
    const found = entries.find((entry) => JSON.stringify(safeView(entry.view)) === current);
    control.value = found?.id || '';
    const remove = panel.querySelector('[data-task-dashboard-delete]');
    if (remove) remove.disabled = !control.value;
  }

  function rowData(panel, row) {
    return {
      scheduleId: clamp(row.dataset.scheduleId, 120),
      task: clamp(row.querySelector('.scheduled-task-row-head strong')?.textContent, MAX_TEXT),
      status: clamp(row.dataset.status, 32),
      runAt: clamp(row.dataset.runAt, 40),
      agentId: clamp(row.dataset.agentId || row.querySelector('.scheduled-task-meta')?.textContent?.split('·')?.[1], 80),
      summary: clamp(row.querySelector('.scheduled-task-row p')?.textContent, 160),
      traceId: clamp(row.querySelector('[data-task-action="trace"]')?.getAttribute('title'), MAX_TRACE)
    };
  }

  function showDetail(panel, row) {
    let dialog = panel.querySelector('.scheduled-task-detail');
    if (!dialog) {
      dialog = make('section', undefined, 'scheduled-task-detail');
      dialog.hidden = true;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'scheduledTaskDetailTitle');
      panel.append(dialog);
    }
    dialog.replaceChildren();
    const shell = make('div', undefined, 'scheduled-task-detail-shell');
    const header = make('div', undefined, 'scheduled-task-detail-head');
    const title = make('strong', 'Görev ayrıntısı'); title.id = 'scheduledTaskDetailTitle';
    const close = make('button', 'Kapat', 'mini-btn'); close.type = 'button'; close.dataset.detailClose = 'true';
    header.append(title, close);

    const data = rowData(panel, row);
    const fields = [
      ['Görev', data.task], ['Durum', data.status], ['Ajan', data.agentId], ['Çalıştırma', data.runAt], ['Özet', data.summary || 'Yok'], ['Trace ID', data.traceId || 'Yok']
    ];
    const content = make('dl', undefined, 'scheduled-task-detail-fields');
    fields.forEach(([label, value]) => { content.append(make('dt', label), make('dd', value)); });

    const actions = make('div', undefined, 'scheduled-task-detail-actions');
    const copyTask = make('button', 'Görev metnini kopyala', 'mini-btn'); copyTask.type = 'button'; copyTask.dataset.detailCopyTask = 'true';
    const copyJson = make('button', 'JSON olarak kopyala', 'mini-btn'); copyJson.type = 'button'; copyJson.dataset.detailCopyJson = 'true';
    actions.append(copyTask, copyJson);
    shell.append(header, content, actions); dialog.append(shell); dialog.hidden = false;

    const closeDialog = () => { dialog.hidden = true; dialog.replaceChildren(); };
    close.addEventListener('click', closeDialog);
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeDialog(); } });
    copyTask.addEventListener('click', async () => {
      try { await root.navigator?.clipboard?.writeText?.(data.task); announce(panel, 'Görev metni panoya kopyalandı.', 'success'); }
      catch { announce(panel, 'Panoya kopyalama kullanılamıyor.', 'error'); }
    });
    copyJson.addEventListener('click', async () => {
      try { await root.navigator?.clipboard?.writeText?.(JSON.stringify(data, null, 2)); announce(panel, 'Görev özeti JSON olarak kopyalandı.', 'success'); }
      catch { announce(panel, 'Panoya kopyalama kullanılamıyor.', 'error'); }
    });
    close.focus();
  }

  function addDetailButtons(panel) {
    panel.querySelectorAll('.scheduled-task-row').forEach((row) => {
      const actions = row.querySelector('.scheduled-task-actions');
      if (!actions || actions.querySelector('[data-task-detail-open]')) return;
      const detail = make('button', 'Ayrıntı', 'mini-btn');
      detail.type = 'button';
      detail.dataset.taskDetailOpen = 'true';
      detail.setAttribute('aria-label', 'Görev ayrıntılarını aç');
      actions.append(detail);
    });
  }

  function onPanelClick(event) {
    const target = event.target?.closest?.('[data-task-detail-open]');
    if (!target) return;
    const panel = event.currentTarget;
    const row = target.closest('.scheduled-task-row');
    if (row) showDetail(panel, row);
  }

  function enhance(panel) {
    const bar = ensureControls(panel);
    addDetailButtons(panel);
    const view = currentView(panel);
    populateTimeFilter(panel, view.time);
    applyTimeFilter(panel);
    updatePresetSelection(panel, view);
    return Boolean(bar);
  }

  function boot() {
    if (!doc()) return;
    let observer;
    const attach = () => {
      const panel = doc().getElementById(PANEL_ID);
      if (!panel) return;
      if (!panel.dataset.dashboardBound) {
        panel.dataset.dashboardBound = 'true';
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

  root.ScheduledTasksDashboard = Object.freeze({ STORAGE_KEY, MAX_VIEWS, readViews, writeViews, currentView, applyView, boot });

  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
