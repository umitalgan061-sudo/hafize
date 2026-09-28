(function installScheduledTaskStatusSummary(root) {
  'use strict';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const SUMMARY_ID = 'scheduledTaskStatusSummary';
  const statuses = [['scheduled','Planlandı'],['running','Çalışıyor'],['completed','Tamamlandı'],['failed','Başarısız'],['cancelled','İptal edildi']];
  let observer = null;
  let mounted = false;
  let timer = 0;

  const doc = function () { return root.document; };
  const make = function (tag, text, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };

  function render() {
    const panel = doc()?.getElementById?.(PANEL_ID);
    const list = panel?.querySelector?.('.scheduled-tasks-list');
    if (!panel || !list) return;
    let section = panel.querySelector('#' + SUMMARY_ID);
    if (!section) {
      section = make('div', undefined, 'scheduled-task-status-summary');
      section.id = SUMMARY_ID;
      section.setAttribute('aria-label', 'Görev durum özeti');
      panel.querySelector('.scheduled-tasks-filter')?.before(section);
    }
    const counts = new Map(statuses.map(function (entry) { return [entry[0], 0]; }));
    list.querySelectorAll('.scheduled-task-row').forEach(function (row) {
      if (counts.has(row.dataset.status)) counts.set(row.dataset.status, counts.get(row.dataset.status) + 1);
    });
    section.replaceChildren();
    statuses.forEach(function (entry) {
      const item = make('span', undefined, 'scheduled-task-status-summary-item');
      item.dataset.status = entry[0];
      item.append(make('strong', String(counts.get(entry[0]) || 0)), make('span', entry[1]));
      section.append(item);
    });
  }

  function scheduleRender() {
    root.clearTimeout?.(timer);
    timer = root.setTimeout?.(render, 50) || 0;
  }

  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(scheduleRender) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', destroy, { once: true });
    render();
  }

  function destroy() {
    observer?.disconnect();
    root.clearTimeout?.(timer);
    observer = null;
    mounted = false;
  }

  root.ScheduledTaskStatusSummary = Object.freeze({ boot, render, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
