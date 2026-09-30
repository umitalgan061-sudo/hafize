// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskActions(root) {
  'use strict';
  const PANEL_ID = 'scheduledTasksWorkspace';
  let mounted = false;
  const cleanups = [];
  const doc = () => root.document;
  const button = (label, action) => {
    const node = doc().createElement('button');
    node.type = 'button';
    node.className = 'mini-btn scheduled-task-quick-action';
    node.textContent = label;
    node.dataset.scheduleQuickAction = action;
    node.setAttribute('aria-label', label);
    return node;
  };
  function status(message) {
    const node = doc()?.querySelector?.('#' + PANEL_ID + ' .scheduled-tasks-status');
    if (node) node.textContent = String(message).slice(0, 180);
  }
  async function copy(text, success) {
    try {
      await root.navigator?.clipboard?.writeText?.(String(text || ''));
      status(success);
    } catch {
      status('Panoya kopyalama kullanılamıyor.');
    }
  }
  function enhance() {
    const panel = doc()?.getElementById?.(PANEL_ID);
    if (!panel) return;
    panel.querySelectorAll('.scheduled-task-row').forEach((row) => {
      const actions = row.querySelector('.scheduled-task-actions');
      if (!actions || actions.querySelector('[data-schedule-quick-action]')) return;
      const title = row.querySelector('.scheduled-task-row-head strong')?.textContent || '';
      const trace = row.querySelector('[data-task-action="trace"]')?.getAttribute('title') || '';
      if (title) actions.append(button('Görevi kopyala', 'copy-task'));
      if (trace) actions.append(button('Trace kopyala', 'copy-trace'));
    });
  }
  function onClick(event) {
    const target = event.target?.closest?.('[data-schedule-quick-action]');
    if (!target) return;
    event.preventDefault();
    const row = target.closest('.scheduled-task-row');
    if (!row) return;
    if (target.dataset.scheduleQuickAction === 'copy-task') {
      return copy(row.querySelector('.scheduled-task-row-head strong')?.textContent || '', 'Görev metni panoya kopyalandı.');
    }
    if (target.dataset.scheduleQuickAction === 'copy-trace') {
      return copy(row.querySelector('[data-task-action="trace"]')?.getAttribute('title') || '', 'Trace ID panoya kopyalandı.');
    }
  }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(enhance) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    doc().addEventListener('click', onClick);
    cleanups.push(() => doc().removeEventListener('click', onClick));
    root.addEventListener?.('beforeunload', () => observer?.disconnect(), { once: true });
    enhance();
  }
  function destroy() { cleanups.splice(0).forEach((cleanup) => cleanup()); mounted = false; }
  root.ScheduledTaskActions = Object.freeze({ boot, copy, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
