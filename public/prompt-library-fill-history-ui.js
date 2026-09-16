(function installPromptLibraryFillHistoryUi(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-history-ui';
  const history = () => root.HafizePromptLibraryFillHistory;
  function itemFor(dialog) { const id = dialog?.dataset?.promptId || ''; return root.HafizePromptLibrary?.loadItems?.(root.localStorage)?.find?.((item) => item.id === id) || null; }
  function valuesFor(dialog) { const values = {}; dialog.querySelectorAll('.prompt-library-fill-field input[name]').forEach((input) => { values[input.name] = String(input.value || '').slice(0, 1000); }); return values; }
  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    const item = itemFor(dialog);
    if (!item || !history()?.connect) return;
    dialog.setAttribute(MARKER, 'true');
    history().connect(dialog, item, root.HafizePromptLibraryFill);
    dialog.querySelector('.prompt-library-fill-panel')?.addEventListener('submit', () => {
      history().record({ promptId: item.id, title: item.title, values: valuesFor(dialog), usedAt: new Date().toISOString() });
    });
  }
  function boot() {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    bind(root.document.getElementById(DIALOG_ID));
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  root.HafizePromptLibraryFillHistoryUi = Object.freeze({ bind, valuesFor });
})(typeof globalThis !== 'undefined' ? globalThis : self);
