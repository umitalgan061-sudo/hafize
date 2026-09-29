(function installHafizePromptCollectionsKeyboard(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const FILTER_ID = 'promptLibraryCollectionFilter';

  function isEditable(target) {
    if (!target) return false;
    const tag = String(target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
  }

  function focusFilter(documentRef) {
    const filter = documentRef?.getElementById?.(FILTER_ID);
    if (!filter) return false;
    filter.focus();
    return true;
  }

  function install(documentRef = root.document, rootRef = root) {
    if (!documentRef || !documentRef.getElementById(CARD_ID) || documentRef.getElementById('promptLibraryCollectionFilterShortcut')) return null;
    const marker = documentRef.createElement('span');
    marker.id = 'promptLibraryCollectionFilterShortcut';
    marker.hidden = true;
    marker.dataset.shortcut = 'Ctrl/Meta+Shift+O';
    documentRef.getElementById(CARD_ID).append(marker);
    const handler = (event) => {
      if (isEditable(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
      if (!focusFilter(documentRef)) return;
      event.preventDefault();
    };
    documentRef.addEventListener('keydown', handler);
    return Object.freeze({ destroy: () => documentRef.removeEventListener('keydown', handler) });
  }

  const start = () => install(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  root.HafizePromptLibraryCollectionsKeyboard = Object.freeze({ isEditable, focusFilter, install });
})(typeof globalThis !== 'undefined' ? globalThis : self);
