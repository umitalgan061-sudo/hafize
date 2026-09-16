(function installPromptLibraryFill(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const PREFS_KEY = 'hafize.prompt-library.fill.v1';
  const CARD_ID = 'promptLibraryCard';
  const DIALOG_ID = 'promptLibraryFillDialog';
  const MAX_VALUE = 1000;
  const MAX_SAVED = 30;
  const listeners = [];
  let booted = false;

  const trim = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const documentRef = () => root.document;
  const readItems = () => {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    } catch { return []; }
  };
  const readPrefs = () => {
    try {
      const value = JSON.parse(root.localStorage?.getItem(PREFS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  };
  const writePrefs = (value) => {
    try { root.localStorage?.setItem(PREFS_KEY, JSON.stringify(value)); return true; } catch { return false; }
  };
  const emitRefresh = () => {
    try {
      const event = typeof root.StorageEvent === 'function'
        ? new root.StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(readItems()), storageArea: root.localStorage })
        : new root.Event('hafize:prompt-library-refresh');
      root.dispatchEvent?.(event);
    } catch { /* storage refresh is best-effort */ }
  };
  const make = (tag, textValue, className) => {
    const node = documentRef().createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  };
  const button = (label, className = 'soft-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    return node;
  };
  const variables = (body) => root.HafizePromptLibrary?.extractVariables?.(body) || [];
  const replace = (body, values) => root.HafizePromptLibrary?.replaceVariables?.(body, values) ?? String(body || '');

  function itemFor(row) {
    const id = row?.closest?.('.prompt-item')?.dataset?.promptId;
    if (!id) return null;
    return readItems().find((item) => item.id === id) || null;
  }

  function remember(itemId, values) {
    const prefs = readPrefs();
    const current = prefs[itemId] && typeof prefs[itemId] === 'object' ? prefs[itemId] : {};
    const next = { ...current };
    for (const [name, value] of Object.entries(values)) {
      if (!trim(value, MAX_VALUE)) continue;
      next[name] = trim(value, MAX_VALUE);
    }
    prefs[itemId] = Object.fromEntries(Object.entries(next).slice(-12));
    const ids = Object.keys(prefs);
    if (ids.length > MAX_SAVED) delete prefs[ids[0]];
    writePrefs(prefs);
  }

  function valuesFor(itemId) {
    const prefs = readPrefs();
    return prefs[itemId] && typeof prefs[itemId] === 'object' ? prefs[itemId] : {};
  }

  function updateUsage(itemId) {
    const api = root.HafizePromptLibrary;
    if (!api?.loadItems || !api?.saveItems) return false;
    const items = api.loadItems(root.localStorage);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) return false;
    const current = items[index];
    items.splice(index, 1, api.normalizeItem({ ...current, useCount: (current.useCount || 0) + 1, updatedAt: new Date().toISOString() }));
    const ok = api.saveItems(root.localStorage, items);
    if (ok) emitRefresh();
    return ok;
  }

  function closeDialog() {
    const dialog = documentRef()?.getElementById?.(DIALOG_ID);
    if (!dialog) return;
    dialog.close?.();
    dialog.remove();
  }

  function renderPreview(preview, item, values) {
    preview.textContent = replace(item.body, values);
  }

  function openFill(item) {
    if (!item || !documentRef()) return;
    closeDialog();
    const names = variables(item.body);
    const dialog = make('dialog', undefined, 'prompt-library-fill-dialog');
    dialog.id = DIALOG_ID;
    dialog.setAttribute('aria-labelledby', 'promptLibraryFillTitle');
    const panel = make('form', undefined, 'prompt-library-fill-panel');
    panel.method = 'dialog';
    const heading = make('div', undefined, 'prompt-library-fill-head');
    const title = make('strong', 'İstemi doldur', 'prompt-library-fill-title');
    title.id = 'promptLibraryFillTitle';
    const close = button('Kapat', 'mini-btn');
    heading.append(title, close);
    const intro = make('p', item.title || 'İsimsiz istem', 'prompt-library-fill-intro');
    const saved = valuesFor(item.id);
    const fields = make('div', undefined, 'prompt-library-fill-fields');
    const values = {};
    const fieldNodes = [];

    names.forEach((name) => {
      const wrap = make('label', undefined, 'prompt-library-fill-field');
      const label = make('span', `{{${name}}}`, 'prompt-library-fill-label');
      const input = make('input');
      input.type = 'text';
      input.name = name;
      input.maxLength = MAX_VALUE;
      input.autocomplete = 'off';
      input.value = trim(saved[name], MAX_VALUE);
      input.setAttribute('aria-label', `${name} değişkeni`);
      values[name] = input.value;
      fieldNodes.push(input);
      input.addEventListener('input', () => { values[name] = input.value.slice(0, MAX_VALUE); renderPreview(preview, item, values); });
      wrap.append(label, input);
      fields.append(wrap);
    });

    const previewLabel = make('div', 'Önizleme', 'prompt-library-fill-preview-label');
    const preview = make('pre', '', 'prompt-library-fill-preview');
    renderPreview(preview, item, values);
    const rememberWrap = make('label', undefined, 'prompt-library-fill-remember');
    const rememberInput = make('input');
    rememberInput.type = 'checkbox';
    rememberInput.checked = names.some((name) => Boolean(saved[name]));
    rememberWrap.append(rememberInput, make('span', 'Dolu değerleri bu cihazda hatırla'));
    const actions = make('div', undefined, 'prompt-library-fill-actions');
    const cancel = button('Vazgeç', 'mini-btn');
    const use = button('Mesaja aktar', 'soft-btn');
    actions.append(cancel, use);

    panel.append(heading, intro, fields, previewLabel, preview, rememberWrap, actions);
    dialog.append(panel);
    documentRef().body.append(dialog);
    close.addEventListener('click', closeDialog);
    cancel.addEventListener('click', closeDialog);
    panel.addEventListener('submit', (event) => {
      event.preventDefault();
      const composer = documentRef().querySelector('#messageInput');
      if (!composer) return;
      const complete = replace(item.body, values);
      composer.value = complete;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.focus();
      if (rememberInput.checked) remember(item.id, values);
      updateUsage(item.id);
      closeDialog();
    });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
    if (names.length) fieldNodes[0].focus(); else use.focus();
    dialog.showModal?.();
  }

  function enhance() {
    const card = documentRef()?.getElementById?.(CARD_ID);
    if (!card) return;
    card.querySelectorAll('.prompt-item').forEach((row) => {
      const actions = row.querySelector('.prompt-item-actions');
      if (!actions || actions.querySelector('[data-prompt-fill]')) return;
      const item = readItems().find((candidate) => candidate.id === row.dataset.promptId);
      if (!item || !variables(item.body).length) return;
      const fill = button('Alanları doldur', 'soft-btn prompt-fill-action');
      fill.dataset.promptFill = row.dataset.promptId;
      fill.setAttribute('aria-label', `${item.title || 'İstem'} değişkenlerini doldur`);
      actions.append(fill);
    });
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-prompt-fill]');
    if (!target) return;
    const item = readItems().find((candidate) => candidate.id === target.dataset.promptFill);
    if (item) { event.preventDefault(); event.stopPropagation(); openFill(item); }
  }

  function boot() {
    if (booted || !documentRef()) return;
    if (!documentRef().getElementById(CARD_ID)) return;
    booted = true;
    documentRef().addEventListener('click', onClick);
    listeners.push(() => documentRef().removeEventListener('click', onClick));
    const card = documentRef().getElementById(CARD_ID);
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(enhance) : null;
    observer?.observe(card, { childList: true, subtree: true });
    listeners.push(() => observer?.disconnect());
    enhance();
  }

  const start = () => boot();
  if (documentRef()?.readyState === 'loading') documentRef().addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  root.HafizePromptLibraryFill = Object.freeze({ openFill, variables, valuesFor, remember });
  root.addEventListener?.('beforeunload', () => { for (const off of listeners.splice(0)) off(); });
})(typeof globalThis !== 'undefined' ? globalThis : self);
