(function installHafizeComposerHistoryBackup(root) {
  'use strict';
  const MAX_EXPORT = 512000;
  const MAX_IMPORT = 512000;
  const STORAGE_KEY = 'hafize.composer-history.v1';
  const core = () => root.HafizeComposerHistory;
  const controller = () => root.HafizeComposerHistoryController;
  const normalizeItems = (items) => (Array.isArray(items) ? items : []).filter((item) => typeof item === 'string' && item.trim()).map((item) => core()?.normalize?.(item) || String(item).slice(0, 12000));
  function exportPayload() {
    const items = normalizeItems(controller()?.getItems?.() || []);
    const value = JSON.stringify({ version: 1, source: 'hafize-composer-history', exportedAt: new Date().toISOString(), items }, null, 2);
    return value.slice(0, MAX_EXPORT);
  }
  function importPayload(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_IMPORT) return { ok: false, reason: 'size' };
    try {
      const data = JSON.parse(raw);
      const items = normalizeItems(Array.isArray(data) ? data : data?.items);
      if (!items.length) return { ok: true, items: [] };
      const current = normalizeItems(controller()?.getItems?.() || []);
      const merged = [...items, ...current.filter((item) => !items.includes(item))].slice(0, core()?.MAX_ITEMS || 40);
      return { ok: true, items: merged };
    } catch { return { ok: false, reason: 'json' }; }
  }
  function persistItems(items) {
    const list = normalizeItems(items);
    if (!controller()) return false;
    controller().clear();
    list.slice().reverse().forEach((item) => controller().add(item));
    return true;
  }
  function download() {
    const doc = root.document;
    const blob = new Blob([exportPayload()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = 'hafize-composer-history.json';
    link.click();
    root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
  }
  function boot() {
    const doc = root.document;
    const form = doc?.getElementById?.('composer');
    if (!doc || !form || doc.getElementById('composerHistoryBackup')) return null;
    const wrapper = doc.createElement('div');
    wrapper.id = 'composerHistoryBackup';
    wrapper.className = 'composer-history-backup';
    const exportButton = doc.createElement('button'); exportButton.type = 'button'; exportButton.className = 'mini-btn'; exportButton.textContent = 'Yedeği indir';
    const importButton = doc.createElement('button'); importButton.type = 'button'; importButton.className = 'mini-btn'; importButton.textContent = 'Yedeği yükle';
    const file = doc.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.setAttribute('aria-label', 'Gönderim geçmişi yedeği seç');
    wrapper.append(exportButton, importButton, file);
    const panel = doc.getElementById('composerHistoryPanel');
    panel?.querySelector('.composer-history-footer')?.prepend(wrapper) || form.after(wrapper);
    exportButton.addEventListener('click', download);
    importButton.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const selected = file.files?.[0]; file.value = '';
      if (!selected || selected.size > MAX_IMPORT) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = importPayload(String(reader.result || ''));
        if (!result.ok) return;
        persistItems(result.items);
        root.dispatchEvent?.(new root.CustomEvent('hafize:composer-history-changed', { detail: { size: result.items.length } }));
      };
      reader.readAsText(selected);
    });
    root.HafizeComposerHistoryBackup = Object.freeze({ exportPayload, importPayload, persistItems, download, destroy: () => wrapper.remove() });
    return root.HafizeComposerHistoryBackup;
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
