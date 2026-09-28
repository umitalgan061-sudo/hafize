(function installScheduledTaskInsights(root) {
  'use strict';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const INSIGHTS_ID = 'scheduledTaskInsights';
  const MAX_ROWS = 3;
  let mounted = false;
  let observer = null;
  let timer = 0;

  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function rows(panel) { return Array.from(panel.querySelectorAll('.scheduled-task-row')); }
  function dateValue(row) { const value = Date.parse(row.dataset.runAt || ''); return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER; }
  function render() {
    const panel = doc()?.getElementById?.(PANEL_ID);
    if (!panel) return;
    let section = panel.querySelector('#' + INSIGHTS_ID);
    if (!section) {
      section = make('section', undefined, 'scheduled-task-insights');
      section.id = INSIGHTS_ID;
      section.setAttribute('aria-label', 'Görev planlama özeti');
      const title = make('strong', 'Planlama özeti', 'scheduled-task-insights-title');
      const body = make('div', undefined, 'scheduled-task-insights-body');
      section.append(title, body);
      panel.querySelector('.scheduled-tasks-list-section')?.before(section);
    }
    const body = section.querySelector('.scheduled-task-insights-body');
    if (!body) return;
    const all = rows(panel);
    const counts = { scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    all.forEach((row) => { if (counts[row.dataset.status] !== undefined) counts[row.dataset.status] += 1; });
    const upcoming = all.filter((row) => row.dataset.status === 'scheduled').sort((a,b) => dateValue(a)-dateValue(b)).slice(0, MAX_ROWS);
    body.replaceChildren();
    [['Toplam', all.length], ['Yaklaşan', counts.scheduled], ['Çalışıyor', counts.running], ['Başarısız', counts.failed]].forEach(function (entry) {
      const stat = make('div', undefined, 'scheduled-task-insight-stat');
      stat.append(make('strong', String(entry[1])), make('span', entry[0]));
      body.append(stat);
    });
    const next = make('div', undefined, 'scheduled-task-insights-upcoming');
    next.append(make('span', upcoming.length ? 'Yaklaşan görevler' : 'Yaklaşan görev yok', 'scheduled-task-insights-subtitle'));
    upcoming.forEach(function (row) {
      const title = row.querySelector('.scheduled-task-row-head strong')?.textContent || 'Görev';
      const item = make('div', undefined, 'scheduled-task-insight-next');
      item.append(make('span', title), make('time', row.dataset.runAt ? new Date(row.dataset.runAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'Tarih yok'));
      next.append(item);
    });
    body.append(next);
  }
  function schedule() { root.clearTimeout?.(timer); timer = root.setTimeout?.(render, 60) || 0; }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', destroy, { once: true });
    render();
  }
  function destroy() { observer?.disconnect(); root.clearTimeout?.(timer); observer = null; mounted = false; }
  root.ScheduledTaskInsights = Object.freeze({ boot, render, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
