(function installPromptLibraryFillHistoryBackupUi(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-history-backup-ui';
  const make = (tag, textValue, className) => { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; };
  const button = (label) => { const node = make('button', label, 'mini-btn'); node.type = 'button'; return node; };
  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    const api = root.HafizePromptLibraryFillHistoryBackup;
    if (!api) return;
    dialog.setAttribute(MARKER, 'true');
    const tools = make('div', undefined, 'prompt-library-fill-history-backup-tools');
    const exportButton = button('Geçmişi dışa aktar');
    const clearButton = button('Geçmişi temizle');
    const importButton = button('Geçmişi içe aktar');
    tools.append(exportButton, importButton, clearButton);
    dialog.querySelector('.prompt-library-fill-history')?.prepend(tools);
    exportButton.addEventListener('click', () => {
      if (!api.canExport?.()) return;
      const blob = new Blob([api.exportText()], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = make('a'); link.href = url; link.download = 'hafize-prompt-fill-history.json'; link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
    });
    clearButton.addEventListener('click', () => {
      if (!root.confirm?.('Bu promptun doldurma geçmişi temizlensin mi?')) return;
      const id = dialog.dataset.promptId || '';
      root.HafizePromptLibraryFillHistory?.clearPrompt?.(id);
      root.HafizePromptLibraryFillHistoryUi?.bind?.(dialog);
    });
    importButton.addEventListener('click', () => {
      const input = make('input'); input.type = 'file'; input.accept = 'application/json,.json'; input.hidden = true; root.document.body.append(input);
      input.addEventListener('change', () => {
        const file = input.files?.[0]; if (!file || file.size > api.MAX_BYTES) { input.remove(); return; }
        const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result || '{}')); const incoming = Array.isArray(parsed?.entries) ? parsed.entries : parsed; api.write(api.merge(api.read(), incoming)); } catch { /* invalid backup ignored */ } finally { input.remove(); } }; reader.onerror = () => input.remove(); reader.readAsText(file);
      }, { once: true });
      input.click();
    });
  }
  function boot() { if (!root.document?.body) return; const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID))); observer.observe(root.document.body, { childList:true, subtree:true }); root.addEventListener?.('beforeunload', () => observer.disconnect(), { once:true }); bind(root.document.getElementById(DIALOG_ID)); }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  root.HafizePromptLibraryFillHistoryBackupUi = Object.freeze({ bind });
})(typeof globalThis !== 'undefined' ? globalThis : self);
