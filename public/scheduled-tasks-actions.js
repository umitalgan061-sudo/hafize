(function installScheduledTasksActions(root) {
  'use strict';

  const PANEL_ID = 'scheduledTasksWorkspace';
  const LIST_SELECTOR = '.scheduled-tasks-list';
  const API_PATH = '/api/schedules';
  const MAX_SELECTED = 40;
  const MAX_EXPORT = 1_000_000;

  const doc = () => root.document;
  const make = (tag, textValue, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  };
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);
  const isVisible = (row) => !row.hidden && row.dataset.dashboardTimeMatch !== 'false';

  function status(message, tone = '') {
    const target = doc().querySelector(`#${PANEL_ID} .scheduled-tasks-status`);
    if (!target) return;
    target.textContent = clamp(message, 220);
    target.dataset.tone = tone;
  }

  async function request(path = API_PATH, options = {}) {
    const response = await root.fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const error = new Error(payload?.code || payload?.error || `HTTP_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function rows(panel) { return [...panel.querySelectorAll(`${LIST_SELECTOR} .scheduled-task-row`)]; }

  function selectedRows(panel) {
    return rows(panel).filter((row) => row.querySelector('[data-task-action-select]')?.checked).slice(0, MAX_SELECTED);
  }

  function taskOf(row) { return clamp(row.querySelector('.scheduled-task-row-head strong')?.textContent, 20_000); }
  function idOf(row) { return clamp(row.dataset.scheduleId, 120); }
  function isScheduled(row) { return row.dataset.status === 'scheduled'; }

  function copyText(value) {
    if (!root.navigator?.clipboard?.writeText) return Promise.reject(new Error('CLIPBOARD_UNAVAILABLE'));
    return root.navigator.clipboard.writeText(value);
  }

  function addRowControls(panel) {
    rows(panel).forEach((row) => {
      const head = row.querySelector('.scheduled-task-row-head');
      const actions = row.querySelector('.scheduled-task-actions');
      if (!head || !actions) return;
      if (!row.querySelector('[data-task-action-select]')) {
        const label = make('label', undefined, 'scheduled-task-select');
        const checkbox = doc().createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.taskActionSelect = 'true';
        checkbox.value = idOf(row);
        checkbox.setAttribute('aria-label', 'Görevi seç');
        checkbox.disabled = !isScheduled(row);
        label.append(checkbox, make('span', isScheduled(row) ? 'Seç' : 'İptal edilemez'));
        head.prepend(label);
      }
      if (!actions.querySelector('[data-task-action-copy]')) {
        const copy = make('button', 'Metni kopyala', 'mini-btn');
        copy.type = 'button';
        copy.dataset.taskActionCopy = idOf(row);
        copy.setAttribute('aria-label', 'Görev metnini kopyala');
        actions.append(copy);
      }
    });
  }

  function ensureToolbar(panel) {
    let toolbar = panel.querySelector('.scheduled-tasks-actions-bar');
    if (toolbar) return toolbar;
    toolbar = make('div', undefined, 'scheduled-tasks-actions-bar');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Toplu görev işlemleri');

    const visibleCount = make('span', '', 'scheduled-tasks-actions-count');
    visibleCount.dataset.taskActionsCount = 'true';
    visibleCount.setAttribute('role', 'status');
    visibleCount.setAttribute('aria-live', 'polite');

    const selectVisible = make('button', 'Planlananları seç', 'mini-btn');
    selectVisible.type = 'button';
    selectVisible.dataset.taskActionSelectVisible = 'true';

    const clear = make('button', 'Seçimleri temizle', 'mini-btn');
    clear.type = 'button';
    clear.dataset.taskActionClear = 'true';

    const cancel = make('button', 'Seçilenleri iptal et', 'mini-btn');
    cancel.type = 'button';
    cancel.dataset.taskActionCancel = 'true';

    const exportButton = make('button', 'Görünürleri dışa aktar', 'mini-btn');
    exportButton.type = 'button';
    exportButton.dataset.taskActionExport = 'true';

    toolbar.append(visibleCount, selectVisible, clear, cancel, exportButton);
    const list = panel.querySelector(LIST_SELECTOR);
    list?.before(toolbar);
    toolbar.addEventListener('click', onToolbarClick);
    return toolbar;
  }

  function updateCount(panel) {
    const toolbar = panel.querySelector('.scheduled-tasks-actions-bar');
    if (!toolbar) return;
    const visible = rows(panel).filter(isVisible).length;
    const selected = selectedRows(panel).length;
    const target = toolbar.querySelector('[data-task-actions-count]');
    if (target) target.textContent = `${visible} görünür · ${selected} seçili`;
    const cancel = toolbar.querySelector('[data-task-action-cancel]');
    if (cancel) cancel.disabled = selected === 0;
    const clear = toolbar.querySelector('[data-task-action-clear]');
    if (clear) clear.disabled = selected === 0;
  }

  function selectVisible(panel) {
    rows(panel).filter((row) => isVisible(row) && isScheduled(row)).slice(0, MAX_SELECTED).forEach((row) => {
      const checkbox = row.querySelector('[data-task-action-select]');
      if (checkbox) checkbox.checked = true;
    });
    updateCount(panel);
  }

  function clearSelected(panel) {
    selectedRows(panel).forEach((row) => {
      const checkbox = row.querySelector('[data-task-action-select]');
      if (checkbox) checkbox.checked = false;
    });
    updateCount(panel);
  }

  async function cancelSelected(panel) {
    const chosen = selectedRows(panel).filter(isScheduled);
    if (!chosen.length) return status('İptal edilecek planlı görev seçilmedi.', 'info');
    if (!root.confirm?.(`${chosen.length} planlanmış görev iptal edilsin mi?`)) return;
    let cancelled = 0;
    for (const row of chosen) {
      try {
        await request(`${API_PATH}/${encodeURIComponent(idOf(row))}`, { method: 'DELETE' });
        cancelled += 1;
      } catch (error) {
        if (error.status === 401) {
          status('Oturum açılması gerekiyor.', 'error');
          break;
        }
      }
    }
    clearSelected(panel);
    status(cancelled ? `${cancelled} görev iptal edildi.` : 'Görevler iptal edilemedi.', cancelled ? 'success' : 'error');
    await root.ScheduledTasksWorkspace?.refresh?.();
  }

  async function exportVisible(panel) {
    const ids = new Set(rows(panel).filter(isVisible).map(idOf).filter(Boolean));
    if (!ids.size) return status('Dışa aktarılacak görünür görev yok.', 'info');
    try {
      const payload = await request(API_PATH);
      const selected = Array.isArray(payload.schedules) ? payload.schedules.filter((entry) => ids.has(entry.scheduleId)).slice(0, MAX_SELECTED) : [];
      if (!selected.length) return status('Dışa aktarılacak görünür görev bulunamadı.', 'info');
      const output = JSON.stringify({ version: 1, source: 'hafize-scheduled-tasks', exportedAt: new Date().toISOString(), schedules: selected }, null, 2);
      if (output.length > MAX_EXPORT) return status('Dışa aktarma verisi 1 MB sınırını aşıyor.', 'error');
      const blob = new Blob([output], { type: 'application/json;charset=utf-8' });
      const url = root.URL.createObjectURL(blob);
      const link = make('a');
      link.href = url;
      link.download = 'hafize-scheduled-tasks.json';
      link.click();
      root.setTimeout?.(() => root.URL.revokeObjectURL(url), 0);
      status(`${selected.length} görev dışa aktarıldı.`, 'success');
    } catch (error) {
      status(error.status === 401 ? 'Oturum açılması gerekiyor.' : 'Görevler dışa aktarılamadı.', 'error');
    }
  }

  async function copyRowTask(panel, scheduleId) {
    const row = rows(panel).find((candidate) => idOf(candidate) === scheduleId);
    if (!row) return;
    try {
      await copyText(taskOf(row));
      status('Görev metni panoya kopyalandı.', 'success');
    } catch {
      status('Panoya kopyalama kullanılamıyor.', 'error');
    }
  }

  function onToolbarClick(event) {
    const panel = event.currentTarget.closest(`#${PANEL_ID}`);
    if (!panel) return;
    const target = event.target?.closest?.('button');
    if (!target) return;
    if (target.dataset.taskActionSelectVisible !== undefined) return selectVisible(panel);
    if (target.dataset.taskActionClear !== undefined) return clearSelected(panel);
    if (target.dataset.taskActionCancel !== undefined) return cancelSelected(panel);
    if (target.dataset.taskActionExport !== undefined) return exportVisible(panel);
  }

  function onPanelClick(event) {
    const target = event.target?.closest?.('[data-task-action-copy]');
    if (!target) return;
    event.preventDefault();
    copyRowTask(event.currentTarget, target.dataset.taskActionCopy || '');
  }

  function onSelectionChange(panel) { updateCount(panel); }

  function enhance(panel) {
    ensureToolbar(panel);
    addRowControls(panel);
    panel.querySelectorAll('[data-task-action-select]').forEach((node) => {
      if (node.dataset.taskActionBound) return;
      node.dataset.taskActionBound = 'true';
      node.addEventListener('change', () => onSelectionChange(panel));
    });
    updateCount(panel);
  }

  function boot() {
    if (!doc()) return;
    let observer;
    const attach = () => {
      const panel = doc().getElementById(PANEL_ID);
      if (!panel) return;
      if (!panel.dataset.actionsBound) {
        panel.dataset.actionsBound = 'true';
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

  root.ScheduledTasksActions = Object.freeze({
    API_PATH,
    MAX_SELECTED,
    boot,
    refresh: () => enhance(doc()?.getElementById(PANEL_ID))
  });

  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
