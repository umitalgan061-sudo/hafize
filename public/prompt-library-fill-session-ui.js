(function installPromptLibraryFillSessionUi(root) {
  'use strict';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MARKER = 'data-hafize-fill-session-ui';
  const session = () => root.HafizePromptLibraryFillSession;
  const make = (tag, textValue, className) => { const node = root.document.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; };

  function itemId(dialog) { return dialog?.dataset?.promptId || ''; }
  function inputs(dialog) { return [...dialog.querySelectorAll('.prompt-library-fill-field input[name]')]; }
  function values(dialog) { return Object.fromEntries(inputs(dialog).map((input) => [input.name, String(input.value || '').slice(0, 1000)])); }
  function apply(dialog, values) { inputs(dialog).forEach((input) => { if (Object.prototype.hasOwnProperty.call(values || {}, input.name)) { input.value = String(values[input.name] || '').slice(0, 1000); input.dispatchEvent(new Event('input', { bubbles: true })); } }); }

  function bind(dialog) {
    if (!dialog || dialog.hasAttribute(MARKER) || !session()?.get) return;
    const id = itemId(dialog);
    if (!id) return;
    dialog.setAttribute(MARKER, 'true');
    const saved = session().get(id);
    if (Object.keys(saved).length) apply(dialog, saved);
    const wrap = make('label', undefined, 'prompt-library-fill-session-remember');
    const check = make('input'); check.type = 'checkbox'; check.checked = Object.keys(saved).length > 0;
    const label = make('span', 'Bu oturumda hatırla'); wrap.append(check, label);
    dialog.querySelector('.prompt-library-fill-remember')?.after(wrap);
    inputs(dialog).forEach((input) => input.addEventListener('input', () => { if (check.checked) session().set(id, values(dialog)); }));
    check.addEventListener('change', () => { if (check.checked) session().set(id, values(dialog)); else session().clear?.(id); });
  }

  function boot() {
    if (!root.document?.body) return;
    const observer = new MutationObserver(() => bind(root.document.getElementById(DIALOG_ID)));
    observer.observe(root.document.body, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
    bind(root.document.getElementById(DIALOG_ID));
  }

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  root.HafizePromptLibraryFillSessionUi = Object.freeze({ bind, values, apply });
})(typeof globalThis !== 'undefined' ? globalThis : self);
