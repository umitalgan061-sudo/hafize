(function installPromptLibraryFillCopy(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-copy';
  function make(tag, textValue, className) { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; }
  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    const preview = dialog.querySelector('.prompt-library-fill-preview');
    const actions = dialog.querySelector('.prompt-library-fill-actions');
    if (!preview || !actions) return;
    dialog.setAttribute(MARKER, 'true');
    const copy = make('button', 'Önizlemeyi kopyala', 'mini-btn');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const text = String(preview.textContent || '');
      try {
        await root.navigator?.clipboard?.writeText?.(text);
        copy.textContent = 'Kopyalandı';
        root.setTimeout?.(() => { if (copy.isConnected) copy.textContent = 'Önizlemeyi kopyala'; }, 1600);
      } catch {
        copy.textContent = 'Kopyalanamadı';
        root.setTimeout?.(() => { if (copy.isConnected) copy.textContent = 'Önizlemeyi kopyala'; }, 1600);
      }
    });
    actions.prepend(copy);
  }
  function boot() {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
    bind(root.document.getElementById(DIALOG_ID));
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  root.HafizePromptLibraryFillCopy = Object.freeze({ bind });
})(typeof globalThis !== 'undefined' ? globalThis : self);
