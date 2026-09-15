(function installHafizePromptWorkspaceKeyboard(root) {
  'use strict';

  const isEditable = (target) => {
    const element = target?.closest?.('input,textarea,select,[contenteditable="true"]');
    return Boolean(element);
  };
  function help() {
    const card = root.document?.getElementById?.('promptLibraryCard');
    if (!card) return;
    const status = card.querySelector('.prompt-library-status');
    if (status) status.textContent = 'Workspace: Ctrl/⌘+Shift+W · Paket: Ctrl/⌘+Shift+B · Workflow: Ctrl/⌘+Shift+R';
  }
  function handler(event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || isEditable(event.target)) return;
    const key = event.key.toLowerCase();
    const card = root.document?.getElementById?.('promptLibraryCard'); if (!card) return;
    if (key === 'w') {
      const selector = card.querySelector('[data-prompt-workspace-selector]'); if (!selector) return;
      event.preventDefault(); selector.focus(); selector.click(); return;
    }
    if (key === 'b') {
      const button = card.querySelector('[data-pack-builder-action="open"]'); if (!button) return;
      event.preventDefault(); button.click(); return;
    }
    if (key === 'r') {
      const button = card.querySelector('[data-workflow-action="manage"]'); if (!button) return;
      event.preventDefault(); button.click();
    }
  }
  function boot() { if (!root.document) return; root.document.addEventListener('keydown', handler); root.addEventListener?.('beforeunload', () => root.document.removeEventListener('keydown', handler)); }
  root.HafizePromptLibraryWorkspaceKeyboard = Object.freeze({ isEditable, help });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
