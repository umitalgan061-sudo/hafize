(function installPromptLibraryFillPresets(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.fill.presets.v1';
  const MAX_PRESETS = 8;
  const MAX_NAME = 48;
  const MAX_VALUE = 1000;
  const MAX_VARS = 12;
  const DIALOG_ID = 'promptLibraryFillDialog';
  const state = { activeDialog: null };

  const trim = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const read = () => {
    try {
      const raw = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch { return {}; }
  };
  const write = (value) => {
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value)); return true; } catch { return false; }
  };
  const namesFor = (itemId) => {
    const raw = read()[itemId];
    return raw && typeof raw === 'object' ? raw : {};
  };
  const safeValues = (inputs) => {
    const output = {};
    for (const [name, value] of Object.entries(inputs || {}).slice(0, MAX_VARS)) {
      const key = trim(name, 32).replace(/[^a-zA-Z0-9_-]/g, '');
      const text = trim(value, MAX_VALUE);
      if (key && text) output[key] = text;
    }
    return output;
  };
  const make = (tag, textValue, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  };
  const button = (label, className = 'mini-btn') => { const node = make('button', label, className); node.type = 'button'; return node; };

  function currentItem() {
    const dialog = root.document?.getElementById?.(DIALOG_ID);
    const title = dialog?.querySelector?.('.prompt-library-fill-intro')?.textContent || '';
    const item = root.HafizePromptLibrary?.loadItems?.(root.localStorage)?.find?.((candidate) => candidate.title === title);
    return item || null;
  }

  function formValues(dialog) {
    const output = {};
    dialog.querySelectorAll('.prompt-library-fill-field input[name]').forEach((input) => {
      output[input.name] = String(input.value || '').slice(0, MAX_VALUE);
    });
    return safeValues(output);
  }

  function presetList(itemId) {
    const entries = namesFor(itemId);
    return Object.entries(entries).map(([id, value]) => ({ id, ...(value || {}) })).filter((preset) => preset.name);
  }

  function savePreset(itemId, name, values) {
    if (!itemId) return false;
    const data = read();
    const collection = presetList(itemId);
    const normalizedName = trim(name, MAX_NAME);
    if (!normalizedName) return false;
    const id = `p${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
    const preset = { id, name: normalizedName, values: safeValues(values), updatedAt: new Date().toISOString() };
    const existing = collection.findIndex((entry) => entry.name.toLocaleLowerCase('tr-TR') === normalizedName.toLocaleLowerCase('tr-TR'));
    if (existing >= 0) collection.splice(existing, 1, { ...collection[existing], ...preset, id: collection[existing].id });
    else collection.unshift(preset);
    data[itemId] = Object.fromEntries(collection.slice(0, MAX_PRESETS).map((entry) => [entry.id, entry]));
    return write(data);
  }

  function deletePreset(itemId, presetId) {
    const data = read();
    const collection = presetList(itemId).filter((entry) => entry.id !== presetId);
    data[itemId] = Object.fromEntries(collection.map((entry) => [entry.id, entry]));
    return write(data);
  }

  function render(dialog, item) {
    if (!dialog || !item) return;
    const old = dialog.querySelector('.prompt-library-preset-tools');
    old?.remove();
    const tools = make('div', undefined, 'prompt-library-preset-tools');
    const label = make('span', 'Preset', 'prompt-library-preset-label');
    const select = make('select', undefined, 'prompt-library-preset-select');
    select.setAttribute('aria-label', 'Kayıtlı değişken presetini seç');
    const empty = make('option', 'Preset seç'); empty.value = ''; select.append(empty);
    for (const preset of presetList(item.id)) { const option = make('option', preset.name); option.value = preset.id; select.append(option); }
    const save = button('Preset kaydet', 'mini-btn');
    const remove = button('Preset sil', 'mini-btn');
    tools.append(label, select, save, remove);
    const fields = dialog.querySelector('.prompt-library-fill-fields');
    fields?.before(tools);

    select.addEventListener('change', () => {
      const preset = presetList(item.id).find((entry) => entry.id === select.value);
      if (!preset) return;
      dialog.querySelectorAll('.prompt-library-fill-field input[name]').forEach((input) => {
        if (Object.prototype.hasOwnProperty.call(preset.values || {}, input.name)) {
          input.value = trim(preset.values[input.name], MAX_VALUE);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
    save.addEventListener('click', () => {
      const name = root.prompt?.('Preset adı:', '') || '';
      if (!trim(name, MAX_NAME)) return;
      if (!savePreset(item.id, name, formValues(dialog))) return;
      render(dialog, item);
      select.value = presetList(item.id)[0]?.id || '';
    });
    remove.addEventListener('click', () => {
      if (!select.value) return;
      if (!root.confirm?.('Seçili preset silinsin mi?')) return;
      deletePreset(item.id, select.value);
      render(dialog, item);
    });
  }

  function observeDialog() {
    if (!root.document) return;
    const dialog = root.document.getElementById(DIALOG_ID);
    if (!dialog || state.activeDialog === dialog) return;
    state.activeDialog = dialog;
    const observer = new MutationObserver(() => {
      const item = currentItem();
      if (dialog.querySelector('.prompt-library-fill-fields') && item) render(dialog, item);
    });
    observer.observe(dialog, { childList: true, subtree: true });
    const item = currentItem();
    if (item) render(dialog, item);
    dialog.addEventListener('close', () => { observer.disconnect(); state.activeDialog = null; }, { once: true });
  }

  const boot = () => {
    if (!root.document) return;
    const observer = new MutationObserver(observeDialog);
    observer.observe(root.document.body, { childList: true, subtree: true });
    observeDialog();
  };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  root.HafizePromptLibraryFillPresets = Object.freeze({ read, write, presetList, savePreset, deletePreset, safeValues });
})(typeof globalThis !== 'undefined' ? globalThis : self);
