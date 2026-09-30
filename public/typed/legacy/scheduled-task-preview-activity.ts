// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskPreviewActivity(root) {
  'use strict';
  const MAX_EVENTS = 8;
  const PANEL_ID = 'scheduledTaskPreviewDialog';
  let events = [];
  let observer = null;
  let mounted = false;

  const doc = function () { return root.document; };
  const make = function (tag, text, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function push(label) {
    events = [{ label: String(label).slice(0, 120), at: new Date().toISOString() }, ...events].slice(0, MAX_EVENTS);
    render();
  }

  function render() {
    const dialog = doc()?.getElementById?.(PANEL_ID);
    if (!dialog) return;
    let list = dialog.querySelector('.scheduled-task-preview-activity');
    if (!list) {
      list = make('div', undefined, 'scheduled-task-preview-activity');
      list.setAttribute('aria-live', 'polite');
      dialog.querySelector('.scheduled-task-preview-status')?.after(list);
    }
    list.replaceChildren();
    events.forEach(function (item) {
      const row = make('div', undefined, 'scheduled-task-preview-activity-row');
      row.append(make('span', item.label), make('time', new Intl.DateTimeFormat('tr-TR', { timeStyle: 'short' }).format(new Date(item.at))));
      list.append(row);
    });
  }

  function onActivity(event) {
    const label = event.detail?.label;
    if (typeof label === 'string' && label.trim()) push(label);
  }

  function scan() {
    const dialog = doc()?.getElementById?.(PANEL_ID);
    if (!dialog || dialog.dataset.activityReady === 'true') return;
    dialog.dataset.activityReady = 'true';
    push('Önizleme hazırlandı.');
  }

  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener?.('hafize:scheduled-preview-activity', onActivity);
    root.addEventListener?.('beforeunload', destroy, { once: true });
    scan();
  }

  function destroy() {
    observer?.disconnect();
    root.removeEventListener?.('hafize:scheduled-preview-activity', onActivity);
    observer = null;
    events = [];
    mounted = false;
  }

  root.ScheduledTaskPreviewActivity = Object.freeze({ boot, push, render, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
