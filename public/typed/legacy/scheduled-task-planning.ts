// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function enhanceScheduledTaskPlanning(root) {
  'use strict';
  const PANEL_ID = 'scheduledTasksWorkspace';
  let mounted = false;
  let observer = null;

  const doc = function () { return root.document; };
  const make = function (tag, text, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function pad(value) { return String(value).padStart(2, '0'); }
  function localValueFromNow(minutes) {
    const date = new Date(Date.now() + minutes * 60 * 1000);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }
  function tomorrowAt(hour) {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(hour, 0, 0, 0);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }
  function addQuickTimes(panel) {
    const create = panel.querySelector('.scheduled-tasks-create');
    const when = create?.querySelector('input[type="datetime-local"]');
    const submit = create?.querySelector('[data-task-action="create"]');
    if (!create || !when || create.querySelector('.scheduled-task-quick-times')) return;
    const wrap = make('div', undefined, 'scheduled-task-quick-times');
    wrap.append(make('span', 'Hızlı zaman', 'scheduled-task-quick-title'));
    [['5 dk', 5], ['30 dk', 30], ['1 saat', 60]].forEach(function (entry) {
      const btn = make('button', entry[0], 'mini-btn scheduled-task-quick-time');
      btn.type = 'button';
      btn.addEventListener('click', function () { when.value = localValueFromNow(entry[1]); when.focus(); });
      wrap.append(btn);
    });
    const tomorrow = make('button', 'Yarın 09:00', 'mini-btn scheduled-task-quick-time');
    tomorrow.type = 'button';
    tomorrow.addEventListener('click', function () { when.value = tomorrowAt(9); when.focus(); });
    wrap.append(tomorrow);
    if (submit) create.insertBefore(wrap, submit);
  }
  function addListControls(panel) {
    const section = panel.querySelector('.scheduled-tasks-list-section');
    const list = panel.querySelector('.scheduled-tasks-list');
    if (!section || !list || section.querySelector('.scheduled-task-list-controls')) return;
    const controls = make('div', undefined, 'scheduled-task-list-controls');
    const search = doc().createElement('input');
    search.type = 'search';
    search.maxLength = 120;
    search.placeholder = 'Görevlerde ara…';
    search.setAttribute('aria-label', 'Planlanmış görevlerde ara');
    const sort = doc().createElement('select');
    sort.setAttribute('aria-label', 'Görevleri sırala');
    [['run-asc', 'Yakın tarih'], ['run-desc', 'Uzak tarih'], ['status', 'Duruma göre'], ['task', 'Göreve göre']].forEach(function (entry) {
      const option = make('option', entry[1]); option.value = entry[0]; sort.append(option);
    });
    const info = make('span', '', 'scheduled-task-list-info');
    const clear = make('button', 'Filtreyi temizle', 'mini-btn scheduled-task-list-clear');
    clear.type = 'button';
    controls.append(search, sort, clear, info);
    section.insertBefore(controls, list);

    function apply() {
      const query = String(search.value || '').trim().toLocaleLowerCase('tr-TR').slice(0, 120);
      const mode = sort.value;
      const rows = Array.from(list.querySelectorAll('.scheduled-task-row'));
      rows.forEach(function (row) {
        const title = row.querySelector('.scheduled-task-row-head strong')?.textContent || '';
        const haystack = (title + ' ' + (row.dataset.agentId || '') + ' ' + (row.dataset.status || '')).toLocaleLowerCase('tr-TR');
        row.dataset.searchMatch = !query || haystack.includes(query) ? 'true' : 'false';
      });
      rows.sort(function (a, b) {
        if (mode === 'task') return (a.querySelector('.scheduled-task-row-head strong')?.textContent || '').localeCompare(b.querySelector('.scheduled-task-row-head strong')?.textContent || '', 'tr');
        if (mode === 'status') return String(a.dataset.status || '').localeCompare(String(b.dataset.status || ''), 'tr') || String(a.dataset.runAt || '').localeCompare(String(b.dataset.runAt || ''));
        const left = Date.parse(a.dataset.runAt || '');
        const right = Date.parse(b.dataset.runAt || '');
        return mode === 'run-desc' ? right - left : left - right;
      });
      rows.forEach(function (row) { list.append(row); });
      const visible = rows.filter(function (row) { return row.dataset.searchMatch === 'true' && !row.hidden; }).length;
      info.textContent = visible + ' görev gösteriliyor.';
    }
    search.addEventListener('input', apply);
    sort.addEventListener('change', apply);
    clear.addEventListener('click', function () { search.value = ''; sort.value = 'run-asc'; apply(); search.focus(); });
    apply();
  }
  function enhance() {
    const panel = doc()?.getElementById?.(PANEL_ID);
    if (!panel) return;
    addQuickTimes(panel);
    addListControls(panel);
  }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(enhance) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', function () { observer?.disconnect(); }, { once: true });
    enhance();
  }
  root.ScheduledTaskPlanning = Object.freeze({ mount: boot, localValueFromNow, tomorrowAt });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
