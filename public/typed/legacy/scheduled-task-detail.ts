// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskDetail(root) {
  'use strict';
  const WORKSPACE_ID = 'scheduledTasksWorkspace';
  const DIALOG_ID = 'scheduledTaskDetailDialog';
  let dialog = null;
  let previousFocus = null;
  let mounted = false;
  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = (label, action, className = 'mini-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    node.dataset.detailAction = action;
    return node;
  };
  function open(row) {
    if (!row) return;
    if (!dialog) build();
    previousFocus = doc().activeElement;
    const values = {
      task: row.querySelector('.scheduled-task-row-head strong')?.textContent || '',
      status: row.querySelector('.scheduled-task-status')?.textContent || row.dataset.status || '',
      agent: row.dataset.agentId || '',
      runAt: row.dataset.runAt ? new Date(row.dataset.runAt).toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' }) : 'Bilinmiyor',
      attempts: (row.dataset.maxAttempts || '1') + ' deneme',
      trace: row.querySelector('[data-task-action="trace"]')?.getAttribute('title') || '',
      error: row.querySelector('.scheduled-task-row p')?.textContent || ''
    };
    Object.entries(values).forEach(([key, value]) => {
      const node = dialog.querySelector('[data-detail-field="' + key + '"]');
      if (node) node.textContent = value || '—';
    });
    dialog.hidden = false;
    dialog.querySelector('[data-detail-action="close"]')?.focus();
  }
  function close() {
    if (!dialog) return;
    dialog.hidden = true;
    previousFocus?.focus?.();
    previousFocus = null;
  }
  function build() {
    dialog = make('div', undefined, 'scheduled-task-detail-overlay');
    dialog.id = DIALOG_ID;
    dialog.hidden = true;
    const shell = make('section', undefined, 'scheduled-task-detail-shell');
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-labelledby', 'scheduledTaskDetailTitle');
    const title = make('h2', 'Görev ayrıntıları', 'scheduled-task-detail-title');
    title.id = 'scheduledTaskDetailTitle';
    const closeButton = button('Kapat', 'close');
    const head = make('div', undefined, 'scheduled-task-detail-head');
    head.append(title, closeButton);
    const body = make('dl', undefined, 'scheduled-task-detail-body');
    [['Görev', 'task'], ['Durum', 'status'], ['Ajan', 'agent'], ['Çalıştırma', 'runAt'], ['Deneme', 'attempts'], ['Trace ID', 'trace'], ['Son hata', 'error']].forEach(function (entry) {
      body.append(make('dt', entry[0]), make('dd', '', 'scheduled-task-detail-' + entry[1]));
      body.lastElementChild.dataset.detailField = entry[1];
    });
    shell.append(head, body);
    dialog.append(shell);
    doc().body.append(dialog);
    dialog.addEventListener('click', function (event) {
      const target = event.target?.closest?.('[data-detail-action="close"]');
      if (target || event.target === dialog) close();
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
  }
  function enhance() {
    const panel = doc()?.getElementById?.(WORKSPACE_ID);
    if (!panel) return;
    panel.querySelectorAll('.scheduled-task-row').forEach((row) => {
      const actions = row.querySelector('.scheduled-task-actions');
      if (!actions || actions.querySelector('[data-scheduled-detail]')) return;
      const node = button('Ayrıntı', '', 'mini-btn scheduled-task-detail-button');
      node.dataset.scheduledDetail = 'true';
      node.removeAttribute('data-detail-action');
      actions.append(node);
    });
  }
  function onClick(event) {
    const target = event.target?.closest?.('[data-scheduled-detail]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    open(target.closest('.scheduled-task-row'));
  }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    build();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(enhance) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    doc().addEventListener('click', onClick, true);
    root.addEventListener?.('beforeunload', () => observer?.disconnect?.(), { once: true });
    enhance();
  }
  root.ScheduledTaskDetail = Object.freeze({ boot, open, close });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
