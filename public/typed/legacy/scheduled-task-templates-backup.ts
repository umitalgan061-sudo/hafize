// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskTemplateBackup(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.scheduled-task-templates.v1';
  const MAX_IMPORT = 200_000;
  const MAX_TEMPLATES = 12;
  const PANEL_ID = 'scheduledTaskTemplates';
  let mounted = false;
  let panel = null;
  let input = null;
  const cleanups = [];

  const doc = function () { return root.document; };
  const clip = function (value, limit) { return String(value == null ? '' : value).trim().slice(0, limit); };
  const safeItems = function (value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (item) { return item && typeof item === 'object'; }).slice(0, MAX_TEMPLATES);
  };
  const read = function () {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? safeItems(value) : [];
    } catch { return []; }
  };
  const write = function (items) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(safeItems(items)));
      return true;
    } catch { return false; }
  };
  const make = function (tag, text, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = function (label, action) {
    const node = make('button', label, 'mini-btn scheduled-task-template-backup-button');
    node.type = 'button';
    node.dataset.templateBackupAction = action;
    return node;
  };

  function normalized(items) {
    const result = [], names = new Set(), ids = new Set();
    for (const item of safeItems(items)) {
      const name = clip(item.name, 60);
      const task = clip(item.task, 5000);
      const agentId = clip(item.agentId, 120);
      if (!name || !task || !agentId) continue;
      const lower = name.toLocaleLowerCase('tr-TR');
      const id = clip(item.id, 120);
      if (names.has(lower) || (id && ids.has(id))) continue;
      names.add(lower);
      if (id) ids.add(id);
      result.push({ id: id || String(Date.now()) + '-' + Math.random().toString(16).slice(2), name, task, agentId, maxAttempts: Math.max(1, Math.min(5, Number(item.maxAttempts) || 1)) });
      if (result.length >= MAX_TEMPLATES) break;
    }
    return result;
  }

  function exportPayload() {
    const payload = { version: 1, source: 'hafize-scheduled-task-templates', exportedAt: new Date().toISOString(), templates: normalized(read()) };
    return JSON.stringify(payload, null, 2);
  }

  function importPayload(payload) {
    const incoming = normalized(payload?.templates);
    const current = normalized(read());
    const names = new Set(current.map(function (item) { return item.name.toLocaleLowerCase('tr-TR'); }));
    let imported = 0;
    for (const item of incoming) {
      if (current.length >= MAX_TEMPLATES) break;
      const key = item.name.toLocaleLowerCase('tr-TR');
      if (names.has(key)) continue;
      current.push({ ...item, id: String(Date.now()) + '-' + Math.random().toString(16).slice(2) });
      names.add(key);
      imported += 1;
    }
    return write(current) ? imported : 0;
  }

  function status(message) {
    const node = root.document?.querySelector?.('#scheduledTasksWorkspace .scheduled-tasks-status');
    if (node) node.textContent = clip(message, 200);
  }

  function ensureInput() {
    if (input) return input;
    input = doc().createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', function () {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT) {
        status('Şablon yedeği 200 KB sınırını aşamaz.');
        input.value = '';
        return;
      }
      file.text().then(function (raw) {
        let payload;
        try { payload = JSON.parse(raw); } catch { status('Geçersiz şablon yedeği.'); return; }
        const count = importPayload(payload);
        render();
        status(count + ' görev şablonu geri yüklendi.');
      }).catch(function () { status('Şablon yedeği okunamadı.'); }).finally(function () { input.value = ''; });
    });
    doc().body.append(input);
    cleanups.push(function () { input?.remove?.(); input = null; });
    return input;
  }

  function render() {
    if (!panel) return;
    const current = panel.querySelector('.scheduled-task-template-backup-count');
    if (current) current.textContent = read().length + '/' + MAX_TEMPLATES + ' şablon';
  }

  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    panel = doc().getElementById(PANEL_ID);
    if (!panel) return;
    const toolbar = panel.querySelector('.scheduled-task-template-toolbar');
    if (!toolbar || toolbar.querySelector('[data-template-backup-action]')) return;
    toolbar.append(button('Yedeği indir', 'export'), button('Yedeği içe aktar', 'import'), make('span', '', 'scheduled-task-template-backup-count'));
    const onClick = function (event) {
      const target = event.target?.closest?.('[data-template-backup-action]');
      if (!target) return;
      if (target.dataset.templateBackupAction === 'export') {
        const blob = new Blob([exportPayload()], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = doc().createElement('a');
        link.href = url;
        link.download = 'hafize-scheduled-task-templates.json';
        link.click();
        root.setTimeout?.(function () { URL.revokeObjectURL(url); }, 0);
        status('Görev şablonları yedeklendi.');
      } else {
        ensureInput().click();
      }
    };
    toolbar.addEventListener('click', onClick);
    cleanups.push(function () { toolbar.removeEventListener('click', onClick); });
    render();
  }

  function destroy() {
    cleanups.splice(0).forEach(function (cleanup) { cleanup(); });
    panel = null;
    mounted = false;
  }

  root.ScheduledTaskTemplateBackup = Object.freeze({ boot, read, write, exportPayload, importPayload, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
