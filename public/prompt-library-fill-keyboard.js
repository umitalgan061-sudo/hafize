(function installPromptLibraryFillKeyboard(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const BOUND = 'data-hafize-fill-keyboard';
  let observer;

  function reset(dialog) {
    dialog.querySelectorAll('.prompt-library-fill-field input[name]').forEach((input) => {
      if (input.value) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  }

  function onKeydown(event) {
    const dialog = root.document?.getElementById?.(DIALOG_ID);
    if (!dialog || !dialog.open) return;
    if (event.key === 'Escape') return;
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'enter') {
      event.preventDefault();
      dialog.querySelector('.prompt-library-fill-actions .soft-btn')?.click();
    } else if (key === 'r') {
      event.preventDefault();
      reset(dialog);
    }
  }

  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(BOUND)) return;
    dialog.setAttribute(BOUND, 'true');
    dialog.addEventListener('keydown', onKeydown);
    dialog.addEventListener('close', () => dialog.removeEventListener('keydown', onKeydown), { once: true });
  }

  function boot() {
    if (!root.document?.body) return;
    observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    bind(root.document.getElementById(DIALOG_ID));
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  root.HafizePromptLibraryFillKeyboard = Object.freeze({ reset });
  root.addEventListener?.('beforeunload', () => observer?.disconnect());
})(typeof globalThis !== 'undefined' ? globalThis : self);
