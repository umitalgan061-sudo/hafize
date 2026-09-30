// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskDuplicate(root) {
  'use strict';
  const WORKSPACE_ID = 'scheduledTasksWorkspace';
  const ROW_SELECTOR = '.scheduled-task-row[data-schedule-id]';
  const MAX_TASK = 20000;
  let mounted = false;
  let observer = null;
  const cleanups = [];
  const doc = function () { return root.document; };
  const make = function (tag, text, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = function (label) {
    const node = make('button', label, 'mini-btn scheduled-task-duplicate-button');
    node.type = 'button';
    node.dataset.scheduledDuplicate = 'true';
    node.setAttribute('aria-label', label);
    return node;
  };
  function futureTime(source) {
    const minimum = Date.now() + 5 * 60 * 1000;
    const parsed = Date.parse(source || '');
    const next = Number.isFinite(parsed) ? Math.max(minimum, parsed + 5 * 60 * 1000) : minimum;
    const date = new Date(next);
    const pad = function (value) { return String(value).padStart(2, '0'); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }
  function copyToForm(row) {
    const workspace = doc().getElementById(WORKSPACE_ID);
    const form = workspace && workspace.querySelector('.scheduled-tasks-create');
    if (!form) return false;
    const agent = form.querySelector('#scheduledTaskAgent');
    const task = form.querySelector('textarea');
    const when = form.querySelector('input[type="datetime-local"]');
    const attempts = form.querySelector('select[aria-label="Maksimum deneme sayısı"]');
    if (agent && row.dataset.agentId) agent.value = row.dataset.agentId;
    if (task) {
      const taskTitle = row.querySelector('.scheduled-task-row-head strong');
      task.value = String(taskTitle?.textContent || '').slice(0, MAX_TASK);
      task.focus();
    }
    if (when) when.value = futureTime(row.dataset.runAt);
    if (attempts) attempts.value = String(Math.max(1, Math.min(5, Number(row.dataset.maxAttempts) || 1)));
    return true;
  }
  function duplicate(row) {
    if (!row || !root.ScheduledTasksWorkspace?.open) return;
    root.ScheduledTasksWorkspace.open();
    root.setTimeout?.(function () {
      if (!copyToForm(row)) return;
      root.ScheduledTaskPreview?.open?.();
    }, 0);
  }
  function onClick(event) {
    const target = event.target?.closest?.('[data-scheduled-duplicate]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    duplicate(target.closest(ROW_SELECTOR));
  }
  function enhanceRows() {
    const workspace = doc()?.getElementById?.(WORKSPACE_ID);
    if (!workspace) return;
    workspace.querySelectorAll(ROW_SELECTOR).forEach(function (row) {
      const actions = row.querySelector('.scheduled-task-actions');
      if (!actions || actions.querySelector('[data-scheduled-duplicate]')) return;
      if (!['scheduled', 'completed', 'failed', 'cancelled'].includes(row.dataset.status)) return;
      actions.append(button('Tekrar planla'));
    });
  }
  function destroy() {
    observer?.disconnect();
    observer = null;
    cleanups.splice(0).forEach(function (cleanup) { cleanup(); });
    mounted = false;
  }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(enhanceRows) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    doc().addEventListener('click', onClick, true);
    cleanups.push(function () { doc().removeEventListener('click', onClick, true); });
    root.addEventListener?.('beforeunload', destroy, { once: true });
    enhanceRows();
  }
  root.ScheduledTaskDuplicate = Object.freeze({ mount: boot, futureTime, duplicate, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
