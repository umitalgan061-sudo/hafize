(function installScheduledTaskDraft(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.scheduled-task-draft.v1';
  const WORKSPACE_ID = 'scheduledTasksWorkspace';
  const MAX_TASK = 20000;
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  let mounted = false;
  let panel = null;
  const cleanups = [];

  const doc = () => root.document;
  const make = (tag, text, className) => {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  function readDraft() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || 'null');
      if (!value || typeof value !== 'object') return null;
      const savedAt = Date.parse(value.savedAt || '');
      if (!Number.isFinite(savedAt) || savedAt + MAX_AGE_MS < Date.now()) {
        root.localStorage?.removeItem(STORAGE_KEY);
        return null;
      }
      return {
        agentId: typeof value.agentId === 'string' ? value.agentId.slice(0, 120) : '',
        task: typeof value.task === 'string' ? value.task.slice(0, MAX_TASK) : '',
        maxAttempts: Math.max(1, Math.min(5, Number(value.maxAttempts) || 1)),
        savedAt: value.savedAt
      };
    } catch { return null; }
  }
  function clearDraft() {
    try { root.localStorage?.removeItem(STORAGE_KEY); } catch {}
  }
  function form() { return doc()?.querySelector?.('#' + WORKSPACE_ID + ' .scheduled-tasks-create') || null; }
  function values() {
    const current = form();
    if (!current) return null;
    return {
      agentId: String(current.querySelector('#scheduledTaskAgent')?.value || '').slice(0, 120),
      task: String(current.querySelector('textarea')?.value || '').slice(0, MAX_TASK),
      maxAttempts: Math.max(1, Math.min(5, Number(current.querySelector('select[aria-label="Maksimum deneme sayısı"]')?.value) || 1))
    };
  }
  function status(message) {
    const node = doc()?.querySelector?.('#' + WORKSPACE_ID + ' .scheduled-tasks-status');
    if (node) node.textContent = String(message).slice(0, 180);
  }
  function saveDraft() {
    const data = values();
    if (!data || (!data.task.trim() && !data.agentId)) return false;
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
      status('Görev taslağı cihaza kaydedildi.');
      return true;
    } catch {
      status('Görev taslağı kaydedilemedi.');
      return false;
    }
  }
  function restoreDraft() {
    const draft = readDraft();
    const current = form();
    if (!draft || !current) return false;
    const agent = current.querySelector('#scheduledTaskAgent');
    const task = current.querySelector('textarea');
    const attempts = current.querySelector('select[aria-label="Maksimum deneme sayısı"]');
    if (agent && draft.agentId) agent.value = draft.agentId;
    if (task) { task.value = draft.task; task.dispatchEvent(new Event('input', { bubbles: true })); }
    if (attempts) attempts.value = String(draft.maxAttempts);
    status('Yerel görev taslağı geri yüklendi.');
    return true;
  }
  function build() {
    panel = form();
    if (!panel || panel.querySelector('.scheduled-task-draft-tools')) return;
    const tools = make('div', undefined, 'scheduled-task-draft-tools');
    const title = make('span', 'Yerel taslak', 'scheduled-task-draft-title');
    const save = make('button', 'Taslağı kaydet', 'mini-btn');
    const restore = make('button', 'Taslağı geri yükle', 'mini-btn');
    const clear = make('button', 'Taslağı sil', 'mini-btn');
    save.type = restore.type = clear.type = 'button';
    tools.append(title, save, restore, clear);
    const anchor = panel.querySelector('.scheduled-tasks-form-grid');
    if (anchor) panel.insertBefore(tools, anchor); else panel.append(tools);
    const onSave = () => saveDraft();
    const onRestore = () => restoreDraft();
    const onClear = () => { clearDraft(); status('Yerel görev taslağı silindi.'); };
    save.addEventListener('click', onSave);
    restore.addEventListener('click', onRestore);
    clear.addEventListener('click', onClear);
    const shortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.altKey || event.key.toLowerCase() !== 's') return;
      if (event.target?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault();
      saveDraft();
    };
    doc().addEventListener('keydown', shortcut);
    cleanups.push(() => save.removeEventListener('click', onSave));
    cleanups.push(() => restore.removeEventListener('click', onRestore));
    cleanups.push(() => clear.removeEventListener('click', onClear));
    cleanups.push(() => doc().removeEventListener('keydown', shortcut));
  }
  function destroy() {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    panel = null;
    mounted = false;
  }
  function boot() {
    if (mounted || !doc()) return;
    mounted = true;
    build();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(build) : null;
    observer?.observe(doc().documentElement, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer?.disconnect?.(), { once: true });
  }
  root.ScheduledTaskDraft = Object.freeze({ STORAGE_KEY, boot, values, readDraft, saveDraft, restoreDraft, clearDraft, destroy });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
