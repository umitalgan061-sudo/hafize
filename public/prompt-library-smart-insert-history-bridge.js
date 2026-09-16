(function bridgePromptSmartInsertHistory(root) {
  'use strict';
  let installed = false;
  function install() {
    if (installed || !root.HafizePromptLibrarySmartInsert || !root.HafizePromptLibrarySmartInsertHistory) return;
    const api = root.HafizePromptLibrarySmartInsert;
    const history = root.HafizePromptLibrarySmartInsertHistory;
    const original = api.open;
    if (typeof original !== 'function') return;
    api.open = function wrappedOpen(item) {
      const result = original(item);
      if (item?.id && result !== false) history.record(item.id, item.title || 'İsimsiz istem', 'smart-insert');
      return result;
    };
    installed = true;
    root.HafizePromptLibrarySmartInsert = api;
  }
  const start = () => { install(); if (!installed) root.setTimeout?.(install, 0); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  root.addEventListener?.('load', install, { once: true });
})(typeof globalThis !== 'undefined' ? globalThis : self);
