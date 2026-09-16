(function installPromptLibraryFillHistoryUi(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-history-ui';
  const history = () => root.HafizePromptLibraryFillHistory;
  const api = () => root.HafizePromptLibraryFill;

  function itemFor(dialog) {
    const id = dialog?.dataset?.promptId || '';
    return root.HafizePromptLibrary?.loadItems?.(root.localStorage)?.find?.((item) => item.id === id) || null;
  }

  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    const item = itemFor(dialog);
    if (!item || !history()?.connect) return;
    dialog.setAttribute(MARKER, 'true');
    history().connect(dialog, item, api());
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
  root.HafizePromptLibraryFillHistoryUi = Object.freeze({ bind });
})(typeof globalThis !== 'undefined' ? globalThis : self);
