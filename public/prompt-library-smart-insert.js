(function installPromptSmartInsert(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const MODAL_ID = 'promptLibraryVariableDialog';
  const MAX_VALUE = 1000;
  let active = null;

  const api = () => root.HafizePromptLibrary;
  const composer = () => root.document?.querySelector?.('#messageInput');
  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const valuesFor = (body) => api()?.extractVariables?.(body) || [];
  const safeValue = (value) => String(value ?? '').slice(0, MAX_VALUE);

  function close(reason = 'cancel') {
    if (!active) return;
    const { dialog } = active;
    active = null;
    dialog.remove();
    root.document.querySelector('#promptLibraryCard')?.removeAttribute('aria-busy');
    root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-variable-dialog', { detail: { reason } }));
  }

  function open(item) {
    if (!item || active || !root.document) return;
    const names = valuesFor(item.body);
    if (!names.length) {
      const input = composer();
      if (!input) return;
      input.value = item.body;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return;
    }

    const dialog = make('div', undefined, 'prompt-library-variable-dialog');
    dialog.id = MODAL_ID;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptLibraryVariableTitle');
    const panel = make('div', undefined, 'prompt-library-variable-panel');
    const title = make('h3', 'İstemi doldur', undefined);
    title.id = 'promptLibraryVariableTitle';
    const help = make('p', 'Değişkenleri doldur; mesaj alanına göndermeden önce önizlemesini kontrol edebilirsin.', 'prompt-library-variable-help');
    const form = make('div', undefined, 'prompt-library-variable-form');
    const fields = [];
    const preview = make('pre', undefined, 'prompt-library-variable-preview');
    preview.setAttribute('aria-label', 'Doldurulmuş istem önizlemesi');
    const updatePreview = () => {
      const values = Object.fromEntries(fields.map(({ name, input }) => [name, safeValue(input.value)]));
      preview.textContent = api()?.replaceVariables?.(item.body, values) || item.body;
    };

    for (const name of names) {
      const label = make('label', name);
      label.htmlFor = `promptVariable-${name}`;
      const input = root.document.createElement('textarea');
      input.id = `promptVariable-${name}`;
      input.name = name;
      input.rows = 2;
      input.maxLength = MAX_VALUE;
      input.placeholder = `{{${name}}} değerini gir`;
      input.setAttribute('aria-label', `${name} değişkeni`);
      input.required = true;
      input.addEventListener('input', updatePreview);
      fields.push({ name, input });
      form.append(label, input);
    }

    const actions = make('div', undefined, 'prompt-library-variable-actions');
    const insert = make('button', 'Composer’a aktar', 'soft-btn');
    insert.type = 'button';
    const cancel = make('button', 'Vazgeç', 'soft-btn');
    cancel.type = 'button';
    actions.append(insert, cancel);
    panel.append(title, help, form, make('h4', 'Önizleme'), preview, actions);
    dialog.append(panel);
    (root.document.body || root.document.documentElement).append(dialog);
    active = { dialog, fields, trigger: root.document.activeElement };
    root.document.querySelector('#promptLibraryCard')?.setAttribute('aria-busy', 'true');
    updatePreview();
    const first = fields[0]?.input;
    first?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab' && active) {
        const focusables = [dialog.querySelectorAll('textarea,button')].flatMap((nodes) => [...nodes]);
        if (!focusables.length) return;
        const index = focusables.indexOf(root.document.activeElement);
        if (event.shiftKey && index <= 0) { event.preventDefault(); focusables.at(-1).focus(); }
        else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0].focus(); }
      }
    };
    const onBackdrop = (event) => { if (event.target === dialog) close(); };
    const onInsert = () => {
      const values = Object.fromEntries(fields.map(({ name, input }) => [name, safeValue(input.value)]));
      if (fields.some(({ input }) => !input.value.trim())) return;
      const input = composer();
      if (!input) return close('composer-missing');
      input.value = api()?.replaceVariables?.(item.body, values) || item.body;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      close('insert');
    };
    dialog.addEventListener('keydown', onKey);
    dialog.addEventListener('click', onBackdrop);
    insert.addEventListener('click', onInsert);
    cancel.addEventListener('click', () => close());
  }

  function enhance() {
    const card = root.document?.getElementById?.(CARD_ID);
    const list = card?.querySelector?.('#promptLibraryList');
    if (!card || !list) return;
    list.querySelectorAll('.prompt-item').forEach((row) => {
      const actions = row.querySelector('.prompt-item-actions');
      const itemId = row.dataset.promptId;
      if (!actions || !itemId || actions.querySelector('[data-prompt-smart-insert]')) return;
      const button = make('button', 'Akıllı doldur', 'soft-btn prompt-smart-insert');
      button.type = 'button';
      button.dataset.promptSmartInsert = itemId;
      button.setAttribute('aria-label', 'Değişkenleri doldurarak kullan');
      actions.append(button);
      button.addEventListener('click', () => {
        const item = api()?.loadItems?.(root.localStorage).find((candidate) => candidate.id === itemId);
        open(item);
      });
    });
  }

  function boot() {
    if (!root.document || !root.MutationObserver) return;
    const observer = new MutationObserver(enhance);
    const start = () => enhance();
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
    const card = root.document.getElementById(CARD_ID);
    if (card) observer.observe(card, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => { close('unload'); observer.disconnect(); });
  }
  boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
