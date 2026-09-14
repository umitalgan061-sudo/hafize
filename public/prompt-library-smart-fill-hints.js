(function installPromptSmartFillHints(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibrarySmartFill';
  const MAX_VALUE = 1000;
  const MAX_PREVIEW = 8000;
  let observer = null;
  let active = false;

  const make = (doc, tag, text, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function paint(panel) {
    if (!panel || panel.hidden) return;
    panel.querySelectorAll('.prompt-smart-fill-field input').forEach((input) => {
      let hint = input.nextElementSibling;
      if (!hint?.classList?.contains('prompt-smart-fill-count')) {
        hint = make(panel.ownerDocument, 'small', '', 'prompt-smart-fill-count');
        input.after(hint);
      }
      hint.textContent = `${String(input.value || '').length}/${MAX_VALUE}`;
      hint.setAttribute('aria-label', `${String(input.value || '').length} / ${MAX_VALUE} karakter`);
    });

    const preview = panel.querySelector('.prompt-smart-fill-preview');
    if (preview) {
      let count = panel.querySelector('.prompt-smart-fill-preview-count');
      if (!count) {
        count = make(panel.ownerDocument, 'small', '', 'prompt-smart-fill-preview-count');
        preview.after(count);
      }
      count.textContent = `${String(preview.textContent || '').length}/${MAX_PREVIEW} karakter`;
    }
  }

  function boot() {
    if (active || !root.document) return;
    const card = root.document.getElementById(CARD_ID);
    const panel = root.document.getElementById(PANEL_ID);
    if (!card || !panel) return;
    active = true;
    const refresh = () => root.requestAnimationFrame?.(() => paint(panel));
    observer = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null;
    observer?.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true });
    panel.addEventListener('input', refresh);
    root.addEventListener?.('beforeunload', () => { observer?.disconnect(); panel.removeEventListener('input', refresh); });
    paint(panel);
  }

  root.HafizePromptSmartFillHints = Object.freeze({ mount: boot, paint });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
