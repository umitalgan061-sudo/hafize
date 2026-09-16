(function installPromptLibraryKeyboard(root) {
  'use strict';
  let installed = false;
  function install() {
    if (installed || !root.document) return;
    const card = root.document.querySelector('#promptLibraryCard');
    if (!card) return;
    installed = true;
    root.document.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === 'p') {
        const search = /** @type {HTMLInputElement | null} */ (root.document.querySelector('#promptLibrarySearch'));
        if (!search) return;
        event.preventDefault();
        search.focus();
        search.select();
        return;
      }
      if (key === 'n') {
        const create = /** @type {HTMLButtonElement | null} */ (card.querySelector('.prompt-library-actions .soft-btn'));
        if (!create) return;
        event.preventDefault();
        create.click();
      }
    }, { passive: false });
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self);
