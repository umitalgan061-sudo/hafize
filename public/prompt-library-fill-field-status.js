(function installPromptLibraryFillFieldStatus(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-field-status';
  const MAX_VALUE = 1000;
  function make(tag, textValue, className) { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; }
  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER)) return;
    const fields = [...dialog.querySelectorAll('.prompt-library-fill-field input[name]')];
    if (!fields.length) return;
    dialog.setAttribute(MARKER, 'true');
    const summary = make('div', '', 'prompt-library-fill-completion');
    const render = () => {
      const filled = fields.filter((input) => Boolean(String(input.value || '').trim())).length;
      summary.textContent = `${filled}/${fields.length} alan dolu`;
      fields.forEach((input) => {
        const wrap = input.closest('.prompt-library-fill-field');
        const status = wrap?.querySelector('.prompt-library-fill-field-status');
        if (status) status.textContent = `${String(input.value || '').length}/${MAX_VALUE}`;
      });
    };
    fields.forEach((input) => {
      const wrap = input.closest('.prompt-library-fill-field');
      if (!wrap || wrap.querySelector('.prompt-library-fill-field-status')) return;
      const status = make('span', '', 'prompt-library-fill-field-status');
      const id = `promptLibraryFillStatus${Math.random().toString(16).slice(2, 8)}`;
      status.id = id;
      status.setAttribute('aria-live', 'polite');
      input.setAttribute('aria-describedby', id);
      wrap.append(status);
      input.addEventListener('input', render);
    });
    dialog.querySelector('.prompt-library-fill-head')?.after(summary);
    render();
  }
  function boot() {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
    bind(root.document.getElementById(DIALOG_ID));
  }
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  root.HafizePromptLibraryFillFieldStatus = Object.freeze({ bind });
})(typeof globalThis !== 'undefined' ? globalThis : self);
