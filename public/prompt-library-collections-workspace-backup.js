(function installPromptCollectionWorkspaceBackup(root) {
  'use strict';

  const PANEL = '#promptLibraryCollectionsWorkspace';
  const MAX_IMPORT_BYTES = 500_000;
  let booted = false;
  let fileInput = null;

  const doc = () => root.document;
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);
  const workspace = () => root.HafizePromptLibraryCollectionsWorkspace;

  function status(message) {
    const panel = doc()?.querySelector?.(PANEL);
    const node = panel?.querySelector?.('.prompt-library-collections-workspace-status');
    if (!node) return;
    node.textContent = clamp(message, 180);
    root.setTimeout?.(() => { if (node.textContent === clamp(message, 180)) node.textContent = ''; }, 2800);
  }

  function button(label, action) {
    const node = doc().createElement('button');
    node.type = 'button';
    node.className = 'mini-btn prompt-library-collections-backup-action';
    node.textContent = label;
    node.dataset.collectionBackupAction = action;
    node.setAttribute('aria-label', label);
    return node;
  }

  function download() {
    const api = workspace();
    if (!api?.export) return status('Yedekleme modülü kullanılamıyor.');
    let payload = '';
    try { payload = String(api.export() || ''); } catch { return status('Koleksiyon yedeği hazırlanamadı.'); }
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = doc().createElement('a');
    link.href = url;
    link.download = 'hafize-prompt-collections-workspace.json';
    link.click();
    root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
    status('Koleksiyon çalışma alanı yedeği dışa aktarıldı.');
  }

  async function importFile(file) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) return status('Koleksiyon yedeği 500 KB sınırını aşamaz.');
    try {
      const payload = JSON.parse(await file.text());
      const api = workspace();
      if (!api?.import) return status('İçe aktarma modülü kullanılamıyor.');
      const result = api.import(payload) || {};
      status(`${Number(result.imported || 0)} koleksiyon içe aktarıldı; ${Number(result.skipped || 0)} kayıt atlandı.`);
    } catch {
      status('Geçersiz koleksiyon çalışma alanı yedeği.');
    } finally {
      fileInput.value = '';
    }
  }

  function render() {
    const panel = doc()?.querySelector?.(PANEL);
    if (!panel) return false;
    let toolbar = panel.querySelector('.prompt-library-collections-workspace-backup');
    if (!toolbar) {
      toolbar = doc().createElement('div');
      toolbar.className = 'prompt-library-collections-workspace-backup';
      panel.querySelector('.prompt-library-collections-workspace-toolbar')?.after(toolbar);
      toolbar.append(button('Yedeği dışa aktar', 'export'), button('Yedeği içe aktar', 'import'));
      toolbar.addEventListener('click', (event) => {
        const target = event.target?.closest?.('[data-collection-backup-action]');
        if (!target) return;
        if (target.dataset.collectionBackupAction === 'export') download();
        if (target.dataset.collectionBackupAction === 'import') {
          fileInput ||= doc().createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'application/json,.json';
          fileInput.hidden = true;
          fileInput.onchange = () => importFile(fileInput.files?.[0]);
          if (!fileInput.parentNode) panel.append(fileInput);
          fileInput.click();
        }
      });
    }
    return true;
  }

  function boot() {
    if (booted || !doc()) return;
    if (!render()) return;
    booted = true;
  }

  const start = () => boot();
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', start, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
