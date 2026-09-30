// TypeScript migration wave 2026-09-30.
// Canonical browser source; @ts-nocheck is temporary while shared browser contracts are introduced.
// @ts-nocheck
(function installScheduledTaskTemplates(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.scheduled-task-templates.v1';
  const WORKSPACE_ID = 'scheduledTasksWorkspace';
  const PANEL_ID = 'scheduledTaskTemplates';
  const MAX_TEMPLATES = 12;
  const MAX_NAME = 60;
  const MAX_TASK = 5000;
  const MAX_ATTEMPTS = 5;
  let mounted = false;
  let observer = null;
  let panel = null;
  const cleanups = [];

  const doc = function () { return root.document; };
  const clip = function (value, limit) { return String(value == null ? '' : value).trim().slice(0, limit); };

  function normalize(input) {
    if (!input || typeof input !== 'object') return null;
    const name = clip(input.name, MAX_NAME);
    const task = clip(input.task, MAX_TASK);
    const agentId = clip(input.agentId, 120);
    if (!name || !task || !agentId) return null;
    return Object.freeze({
      id: clip(input.id, 120) || String(Date.now()) + '-' + Math.random().toString(16).slice(2),
      name: name,
      task: task,
      agentId: agentId,
      maxAttempts: Math.max(1, Math.min(MAX_ATTEMPTS, Number(input.maxAttempts) || 1))
    });
  }

  function load() {
    try {
      const raw = root.localStorage?.getItem(STORAGE_KEY) || '[]';
      const value = JSON.parse(raw);
      if (!Array.isArray(value)) return [];
      const ids = new Set(), names = new Set(), result = [];
      value.slice(0, MAX_TEMPLATES * 2).forEach(function (item) {
        const next = normalize(item);
        const key = next?.name.toLocaleLowerCase('tr-TR');
        if (!next || ids.has(next.id) || names.has(key)) return;
        ids.add(next.id); names.add(key); result.push(next);
      });
      return result.slice(0, MAX_TEMPLATES);
    } catch {
      return [];
    }
  }

  function save(value) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(loadNormalized(value)));
      return true;
    } catch {
      return false;
    }
  }

  function loadNormalized(value) {
    const result = [], ids = new Set(), names = new Set();
    for (const raw of Array.isArray(value) ? value : []) {
      const next = normalize(raw);
      const key = next?.name.toLocaleLowerCase('tr-TR');
      if (!next || ids.has(next.id) || names.has(key)) continue;
      ids.add(next.id); names.add(key); result.push(next);
      if (result.length >= MAX_TEMPLATES) break;
    }
    return result;
  }

  function add(input) {
    const template = normalize(input);
    if (!template) return null;
    const current = load();
    if (current.length >= MAX_TEMPLATES) return null;
    if (current.some(function (item) { return item.name.toLocaleLowerCase('tr-TR') === template.name.toLocaleLowerCase('tr-TR'); })) return null;
    return save([template].concat(current)) ? template : null;
  }

  function remove(id) {
    const current = load();
    const next = current.filter(function (item) { return item.id !== id; });
    return next.length !== current.length && save(next);
  }

  function form() {
    const workspace = doc()?.getElementById?.(WORKSPACE_ID);
    return workspace?.querySelector?.('.scheduled-tasks-create') || null;
  }

  function currentForm() {
    const current = form();
    if (!current) return null;
    const agent = current.querySelector('#scheduledTaskAgent');
    const task = current.querySelector('textarea');
    const attempts = current.querySelector('select[aria-label="Maksimum deneme sayısı"]');
    return {
      agentId: clip(agent?.value, 120),
      agentLabel: agent?.selectedOptions?.[0]?.textContent?.trim() || agent?.value || '',
      task: clip(task?.value, MAX_TASK),
      maxAttempts: Math.max(1, Math.min(MAX_ATTEMPTS, Number(attempts?.value) || 1))
    };
  }

  function setForm(template) {
    const current = form();
    if (!current || !template) return false;
    const agent = current.querySelector('#scheduledTaskAgent');
    const task = current.querySelector('textarea');
    const attempts = current.querySelector('select[aria-label="Maksimum deneme sayısı"]');
    if (agent) agent.value = template.agentId;
    if (task) {
      task.value = template.task;
      task.focus();
      task.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (attempts) attempts.value = String(template.maxAttempts);
    root.ScheduledTaskPreview?.close?.();
    return true;
  }

  const make = function (tag, text, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = function (label, action, className) {
    const node = make('button', label, className || 'mini-btn');
    node.type = 'button';
    if (action) node.dataset.templateAction = action;
    return node;
  };

  function status(message) {
    const node = panel?.querySelector?.('.scheduled-tasks-status');
    if (node) node.textContent = clip(message, 200);
  }

  function render() {
    if (!panel) return;
    const current = panel.querySelector('select[data-template-select]');
    const selectValue = current?.value || '';
    const templates = load();
    const existing = doc().getElementById(PANEL_ID);
    if (!existing) return;
    const select = existing.querySelector('select[data-template-select]');
    const list = existing.querySelector('[data-template-list]');
    if (!select || !list) return;
    select.replaceChildren();
    select.append(make('option', 'Kayıtlı şablon seç'));
    select.firstElementChild.value = '';
    templates.forEach(function (item) {
      const option = make('option', item.name);
      option.value = item.id;
      select.append(option);
    });
    select.value = templates.some(function (item) { return item.id === selectValue; }) ? selectValue : '';
    list.replaceChildren();
    templates.forEach(function (item) {
      const row = make('div', undefined, 'scheduled-task-template-row');
      row.append(make('strong', item.name), make('span', item.agentId + ' · deneme ' + item.maxAttempts));
      list.append(row);
    });
  }

  function build() {
    if (panel || !doc()) return;
    const create = doc().querySelector('#' + WORKSPACE_ID + ' .scheduled-tasks-create');
    if (!create) return;
    panel = make('section', undefined, 'scheduled-task-template-panel');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-labelledby', 'scheduledTaskTemplatesTitle');
    const title = make('strong', 'Kayıtlı görev şablonları', 'scheduled-task-template-title');
    title.id = 'scheduledTaskTemplatesTitle';

    const saveName = doc().createElement('input');
    saveName.type = 'text';
    saveName.maxLength = MAX_NAME;
    saveName.placeholder = 'Yeni şablon adı';
    saveName.setAttribute('aria-label', 'Yeni görev şablonu adı');

    const saveButton = button('Mevcut görevi kaydet', 'save');
    const select = doc().createElement('select');
    select.setAttribute('data-template-select', 'true');
    select.setAttribute('aria-label', 'Kayıtlı görev şablonu');
    const apply = button('Uygula', 'apply');
    const removeButton = button('Sil', 'remove');
    const toolbar = make('div', undefined, 'scheduled-task-template-toolbar');
    toolbar.append(saveName, saveButton, select, apply, removeButton);

    const list = make('div', undefined, 'scheduled-task-template-list');
    list.dataset.templateList = 'true';
    list.setAttribute('role', 'list');
    panel.append(title, toolbar, list);
    const anchor = create.querySelector('.scheduled-tasks-form-grid');
    if (anchor) create.insertBefore(panel, anchor);
    else create.append(panel);

    const onClick = function (event) {
      const target = event.target?.closest?.('[data-template-action]');
      if (!target) return;
      const action = target.dataset.templateAction;
      const item = load().find(function (entry) { return entry.id === select.value; });
      if (action === 'save') {
        const data = currentForm();
        const name = clip(saveName.value, MAX_NAME);
        if (!data?.agentId || !data.task || !name) return status('Şablon adı, ajan ve görev metni gerekli.');
        const created = add({ name, task: data.task, agentId: data.agentId, maxAttempts: data.maxAttempts });
        if (!created) return status('Şablon eklenemedi; ad benzersiz ve kapasite uygun olmalı.');
        saveName.value = '';
        render();
        select.value = created.id;
        status('Görev şablonu cihaza kaydedildi.');
      } else if (action === 'apply') {
        if (!item) return status('Uygulanacak şablon seçilmedi.');
        if (!setForm(item)) return status('Görev formu bulunamadı.');
        status('Şablon görev formuna aktarıldı.');
      } else if (action === 'remove') {
        if (!item) return status('Silinecek şablon seçilmedi.');
        if (!root.confirm?.('Bu görev şablonu silinsin mi?')) return;
        if (remove(item.id)) {
          render();
          status('Görev şablonu silindi.');
        }
      }
    };
    toolbar.addEventListener('click', onClick);
    cleanups.push(function () { toolbar.removeEventListener('click', onClick); });
    render();
  }

  function scan() {
    if (!panel) build();
    if (panel && !doc().getElementById(PANEL_ID)) panel = null;
    if (!panel) build();
  }

  function destroy() {
    observer?.disconnect();
    observer = null;
    cleanups.splice(0).forEach(function (cleanup) { cleanup(); });
    doc()?.getElementById?.(PANEL_ID)?.remove?.();
    panel = null;
    mounted = false;
  }

  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    scan();
    observer = typeof MutationObserver === 'function' ? new MutationObserver(scan) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', destroy, { once: true });
  }

  root.ScheduledTaskTemplates = Object.freeze({ STORAGE_KEY, MAX_TEMPLATES, load, add, remove, setForm, currentForm, boot, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
