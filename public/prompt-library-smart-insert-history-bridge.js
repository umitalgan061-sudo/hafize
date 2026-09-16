(function bridgePromptSmartInsertHistory(root) {
  'use strict';
  let pending = null;
  let installed = false;
  function install() {
    if (installed || !root.document || !root.HafizePromptLibrarySmartInsertHistory) return;
    const card = root.document.getElementById('promptLibraryCard');
    if (!card) return;
    installed = true;
    card.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-prompt-smart-insert]');
      if (!button) return;
      const row = button.closest('.prompt-item');
      const label = row?.querySelector('.prompt-item-header strong')?.textContent || 'İsimsiz istem';
      pending = { promptId: button.dataset.promptSmartInsert, label: String(label).slice(0, 100) };
    });
    root.addEventListener?.('hafize:prompt-library-variable-dialog', (event) => {
      if (event.detail?.reason !== 'insert' || !pending) return;
      const entry = pending; pending = null;
      root.HafizePromptLibrarySmartInsertHistory.record(entry.promptId, entry.label, 'smart-insert');
    });
    root.addEventListener?.('beforeunload', () => { pending = null; }, { once: true });
  }
  const start = () => { install(); if (!installed) root.setTimeout?.(install, 0); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  root.addEventListener?.('load', install, { once: true });
})(typeof globalThis !== 'undefined' ? globalThis : self);
