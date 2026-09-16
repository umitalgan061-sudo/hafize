(function installPromptLibraryFillBackupUi(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-backup-ui';

  const make = (tag, textValue, className) => { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; };
  const button = (label) => { const node = make('button', label, 'mini-btn'); node.type = 'button'; return node; };
  const itemId = (dialog) => dialog?.dataset?.promptId || '';

  function exportPresetGroup(dialog) {
    const api = root.HafizePromptLibraryFillBackup;
    if (!api?.read || !api?.exportText || !api?.canExport) return;
    if (!api.canExport()) return;
    const item = itemId(dialog);
    const current = api.read();
    const payload = { version: 1, source: 'hafize-prompt-library-fill-presets', exportedAt: new Date().toISOString(), presets: item ? { [item]: current[item] || {} } : current };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = make('a'); link.href = url; link.download = 'hafize-prompt-presets.json'; link.click();
    root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
  }

  function importPresetGroup(dialog) {
    const input = make('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.hidden = true;
    root.document.body.append(input);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file || file.size > 250000) { input.remove(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          const incoming = parsed?.presets && typeof parsed.presets === 'object' ? parsed.presets : parsed;
          const api = root.HafizePromptLibraryFillBackup;
          if (!api?.merge || !api?.write) return;
          api.write(api.merge(api.read(), incoming));
          const event = root.Event ? new root.Event('hafize:prompt-library-fill-presets-refresh') : null;
          if (event) dialog.dispatchEvent(event);
        } catch { /* invalid backup is ignored */ }
        input.remove();
      };
      reader.onerror = () => input.remove();
      reader.readAsText(file);
    }, { once: true });
    input.click();
  }

  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    dialog.setAttribute(MARKER, 'true');
    const tools = make('div', undefined, 'prompt-library-backup-tools');
    const exportButton = button('Preset dışa aktar');
    const importButton = button('Preset içe aktar');
    const clearButton = button('Presetleri temizle');
    tools.append(exportButton, importButton, clearButton);
    dialog.querySelector('.prompt-library-fill-actions')?.before(tools);
    exportButton.addEventListener('click', () => exportPresetGroup(dialog));
    importButton.addEventListener('click', () => importPresetGroup(dialog));
    clearButton.addEventListener('click', () => {
      if (!root.confirm?.('Bu prompt için kayıtlı presetler temizlensin mi?')) return;
      const api = root.HafizePromptLibraryFillBackup;
      const item = itemId(dialog);
      if (!api?.read || !api?.write || !item) return;
      const data = api.read(); delete data[item]; api.write(data);
      dialog.dispatchEvent?.(new Event('hafize:prompt-library-fill-presets-refresh'));
    });
  }

  function boot() {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    bind(root.document.getElementById(DIALOG_ID));
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  root.HafizePromptLibraryFillBackupUi = Object.freeze({ bind, exportPresetGroup, importPresetGroup });
})(typeof globalThis !== 'undefined' ? globalThis : self);
