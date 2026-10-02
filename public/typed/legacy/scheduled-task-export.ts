// @ts-nocheck
(function installScheduledTaskExport(root) {
  'use strict';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const MAX_EXPORT = 250_000;
  let mounted = false;
  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function readVisible() {
    const panel = doc()?.getElementById?.(PANEL_ID);
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('.scheduled-task-row')).filter((row) => !row.hidden).map((row) => ({
      scheduleId: row.dataset.scheduleId || '',
      status: row.dataset.status || '',
      agentId: row.dataset.agentId || '',
      task: row.querySelector('.scheduled-task-row-head strong')?.textContent || '',
      runAt: row.dataset.runAt || '',
      maxAttempts: Number(row.dataset.maxAttempts) || 1
    })).slice(0, 128);
  }
  function payload() {
    return JSON.stringify({ version: 1, source: 'hafize-scheduled-tasks-visible', exportedAt: new Date().toISOString(), schedules: readVisible() }, null, 2);
  }
  function status(message) {
    const node = doc()?.querySelector?.('#' + PANEL_ID + ' .scheduled-tasks-status');
    if (node) node.textContent = String(message).slice(0, 180);
  }
  function exportVisible() {
    const output = payload();
    if (output.length > MAX_EXPORT) return status('Dışa aktarma sınırı aşıldı.');
    const blob = new Blob([output], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = doc().createElement('a');
    link.href = url;
    link.download = 'hafize-scheduled-tasks.json';
    link.click();
    root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
    status(readVisible().length + ' görev dışa aktarıldı.');
  }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    const panel = doc().getElementById(PANEL_ID);
    if (!panel) return;
    const listSection = panel.querySelector('.scheduled-tasks-list-section');
    if (!listSection || listSection.querySelector('[data-scheduled-export]')) return;
    const button = make('button', 'Görünenleri dışa aktar', 'mini-btn scheduled-task-export-button');
    button.type = 'button';
    button.dataset.scheduledExport = 'true';
    button.setAttribute('aria-label', 'Görünen görevleri JSON olarak dışa aktar');
    listSection.querySelector('.scheduled-task-list-controls')?.after(button);
    if (!button.parentElement) listSection.prepend(button);
    button.addEventListener('click', exportVisible);
  }
  root.ScheduledTaskExport = Object.freeze({ boot, readVisible, payload, exportVisible });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
