(function installPromptSmartFillUsage(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const MAX_USAGE = 9999;
  const api = root.HafizePromptLibrary;

  function readItems() {
    try {
      return api?.loadItems?.(root.localStorage) || [];
    } catch {
      return [];
    }
  }

  function saveItems(items) {
    try {
      return api?.saveItems?.(root.localStorage, items) === true;
    } catch {
      return false;
    }
  }

  function record(promptId) {
    if (typeof promptId !== 'string' || !promptId || !api?.normalizeItem) return false;
    const items = readItems();
    const index = items.findIndex((item) => item.id === promptId);
    if (index < 0) return false;
    const item = items[index];
    const next = api.normalizeItem({ ...item, useCount: Math.min(MAX_USAGE, Number(item.useCount || 0) + 1), updatedAt: new Date().toISOString() });
    if (!next) return false;
    items.splice(index, 1, next);
    return saveItems(items);
  }

  function onSmartFill(event) {
    const id = event?.detail?.promptId;
    if (!record(id)) return;
    try {
      const detail = { key: STORAGE_KEY, newValue: JSON.stringify(readItems()), storageArea: root.localStorage };
      if (typeof root.StorageEvent === 'function') root.dispatchEvent(new root.StorageEvent('storage', detail));
      else root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh'));
    } catch {
      root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh'));
    }
  }

  root.addEventListener?.('hafize:prompt-library-smart-fill', onSmartFill);
  root.addEventListener?.('beforeunload', () => root.removeEventListener?.('hafize:prompt-library-smart-fill', onSmartFill), { once: true });

  root.HafizePromptLibrarySmartFillUsage = Object.freeze({ STORAGE_KEY, record });
})(typeof globalThis !== 'undefined' ? globalThis : self);
