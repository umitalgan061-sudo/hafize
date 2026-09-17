(function installHafizePromptSmartFill(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.smart-fill.v1';
  const CARD_ID = 'promptLibraryCard';
  const DIALOG_ID = 'promptSmartFillDialog';
  const MAX_VALUE = 1000;
  const MAX_PRESETS = 12;
  const MAX_PRESET_NAME = 40;
  const MAX_FIELDS = 12;
  const api = root.HafizePromptLibrary;
  let mounted = false;
  let dialog = null;
  let listeners = [];

  const trim = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const uid = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function readStore() {
    try {
      const parsed = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}');
      if (!parsed || typeof parsed !== 'object') return { recent: {}, presets: [] };
      const recent = parsed.recent && typeof parsed.recent === 'object' ? parsed.recent : {};
      const presets = Array.isArray(parsed.presets) ? parsed.presets : [];
      return {
        recent,
        presets: presets.filter((item) => item && typeof item === 'object').slice(0, MAX_PRESETS).map(normalizePreset)
      };
    } catch {
      return { recent: {}, presets: [] };
    }
  }

  function writeStore(store) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeValues(values, variables) {
    const output = {};
    const allowed = new Set(variables.slice(0, MAX_FIELDS));
    if (!values || typeof values !== 'object') return output;
    for (const name of allowed) {
      output[name] = trim(values[name], MAX_VALUE);
    }
    return output;
  }

  function normalizePreset(item) {
    const variables = Array.isArray(item.variables) ? item.variables.map((v) => trim(v, 32)).filter(Boolean).slice(0, MAX_FIELDS) : [];
    return {
      id: trim(item.id, 120) || uid(),
      promptId: trim(item.promptId, 120),
      name: trim(item.name, MAX_PRESET_NAME) || 'Yeni preset',
      variables,
      values: normalizeValues(item.values, variables),
      updatedAt: trim(item.updatedAt, 40) || new Date().toISOString()
    };
  }

  function saveRecent(promptId, variables, values) {
    const store = readStore();
    store.recent[promptId] = normalizeValues(values, variables);
    return writeStore(store);
  }

  function recentValues(promptId, variables) {
    const store = readStore();
    return normalizeValues(store.recent[promptId], variables);
  }

  function presetsFor(promptId, variables) {
    return readStore().presets.filter((item) => item.promptId === promptId && item.variables.join('|') === variables.join('|'));
  }

  function upsertPreset(promptId, variables, name, values, presetId = '') {
    const store = readStore();
    const normalized = normalizePreset({
      id: presetId || uid(),
      promptId,
      name,
      variables,
      values,
      updatedAt: new Date().toISOString()
    });
    const index = store.presets.findIndex((item) => item.id === normalized.id && item.promptId === promptId);
    if (index >= 0) store.presets.splice(index, 1, normalized);
    else store.presets.unshift(normalized);
    store.presets = store.presets.slice(0, MAX_PRESETS);
    return writeStore(store);
  }

  function deletePreset(presetId) {
    const store = readStore();
    store.presets = store.presets.filter((item) => item.id !== presetId);
    return writeStore(store);
  }

  function element(doc, tag, textValue, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function button(doc, textValue, className = 'soft-btn') {
    const node = element(doc, 'button', textValue, className);
    node.type = 'button';
    return node;
  }

  function report(message) {
    const status = root.document?.querySelector?.('#promptLibraryCard .prompt-library-status');
    if (!status) return;
    status.textContent = trim(message, 180);
    root.setTimeout?.(() => { if (status.textContent === trim(message, 180)) status.textContent = ''; }, 3200);
  }

  function findItemFromTarget(target) {
    const row = target?.closest?.('.prompt-item');
    const id = row?.dataset?.promptId;
    if (!id) return null;
    return api?.loadItems?.(root.localStorage)?.find?.((item) => item.id === id) || null;
  }

  function setComposer(item, values) {
    const composer = root.document?.querySelector?.('#messageInput');
    if (!composer || !api) return false;
    composer.value = api.replaceVariables(item.body, values);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.focus();
    const items = api.loadItems(root.localStorage);
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) {
      items.splice(index, 1, api.normalizeItem({ ...items[index], useCount: items[index].useCount + 1, updatedAt: new Date().toISOString() }));
      api.saveItems(root.localStorage, items);
    }
    root.dispatchEvent?.(new Event('hafize:prompt-library-changed'));
    return true;
  }

  function copyFilled(textValue) {
    const pending = root.navigator?.clipboard?.writeText?.(textValue);
    if (!pending?.then) return Promise.reject(new Error('clipboard-unavailable'));
    return pending;
  }

  function closeDialog() {
    if (!dialog) return;
    for (const off of listeners.splice(0)) off();
    dialog.remove();
    dialog = null;
    root.document?.querySelector?.('#promptSmartFillRestoreFocus')?.remove();
    mounted = true;
  }

  function openDialog(item, anchor) {
    closeDialog();
    const documentRef = root.document;
    const variables = api.extractVariables(item.body).slice(0, MAX_FIELDS);
    if (!variables.length) return setComposer(item, {});

    dialog = element(documentRef, 'section', undefined, 'prompt-smart-fill-dialog');
    dialog.id = DIALOG_ID;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptSmartFillTitle');
    dialog.setAttribute('aria-describedby', 'promptSmartFillHint');

    const scrim = element(documentRef, 'div', undefined, 'prompt-smart-fill-scrim');
    const panel = element(documentRef, 'div', undefined, 'prompt-smart-fill-panel');
    const head = element(documentRef, 'header', undefined, 'prompt-smart-fill-head');
    const title = element(documentRef, 'h2', 'İstemi doldur', 'prompt-smart-fill-title');
    title.id = 'promptSmartFillTitle';
    const close = button(documentRef, '×', 'prompt-smart-fill-close');
    close.setAttribute('aria-label', 'Doldurma penceresini kapat');
    head.append(title, close);

    const hint = element(documentRef, 'p', `“${item.title}” için ${variables.length} değişkeni doldur.`, 'prompt-smart-fill-hint');
    hint.id = 'promptSmartFillHint';

    const form = element(documentRef, 'form', undefined, 'prompt-smart-fill-form');
    const fields = new Map();
    const initial = recentValues(item.id, variables);

    for (const name of variables) {
      const label = element(documentRef, 'label', name, 'prompt-smart-fill-label');
      label.htmlFor = `promptSmartFill-${name}`;
      const input = documentRef.createElement('textarea');
      input.id = `promptSmartFill-${name}`;
      input.name = name;
      input.rows = 2;
      input.maxLength = MAX_VALUE;
      input.placeholder = `${name} değeri…`;
      input.value = initial[name] || '';
      input.setAttribute('aria-label', `${name} değişkeni`);
      fields.set(name, input);
      const wrap = element(documentRef, 'div', undefined, 'prompt-smart-fill-field');
      wrap.append(label, input);
      form.append(wrap);
    }

    const presetBar = element(documentRef, 'div', undefined, 'prompt-smart-fill-presets');
    const presetSelect = documentRef.createElement('select');
    presetSelect.setAttribute('aria-label', 'Kayıtlı değer setini seç');
    const none = element(documentRef, 'option', 'Değer seti seç…');
    none.value = '';
    presetSelect.append(none);
    const renderPresets = () => {
      const current = presetSelect.value;
      presetSelect.replaceChildren(none);
      for (const preset of presetsFor(item.id, variables)) {
        const option = element(documentRef, 'option', preset.name);
        option.value = preset.id;
        presetSelect.append(option);
      }
      presetSelect.value = current;
    };
    renderPresets();
    const savePreset = button(documentRef, 'Preset kaydet', 'mini-btn');
    const deletePresetButton = button(documentRef, 'Preset sil', 'mini-btn');
    presetBar.append(presetSelect, savePreset, deletePresetButton);

    const rememberRow = element(documentRef, 'label', undefined, 'prompt-smart-fill-remember');
    const remember = documentRef.createElement('input');
    remember.type = 'checkbox';
    remember.checked = true;
    remember.id = 'promptSmartFillRemember';
    const rememberText = element(documentRef, 'span', 'Son değerleri bu cihazda hatırla');
    rememberRow.append(remember, rememberText);

    const previewTitle = element(documentRef, 'div', 'Canlı önizleme', 'prompt-smart-fill-section-title');
    const preview = element(documentRef, 'pre', '', 'prompt-smart-fill-preview');
    preview.setAttribute('aria-live', 'polite');

    const actions = element(documentRef, 'div', undefined, 'prompt-smart-fill-actions');
    const copy = button(documentRef, 'Doldurulmuş metni kopyala');
    const cancel = button(documentRef, 'Vazgeç', 'mini-btn');
    const apply = button(documentRef, 'Composer’a aktar');
    actions.append(cancel, copy, apply);

    const footer = element(documentRef, 'div', 'Enter değer girer, Esc kapatır · Gönderme işlemi yapılmaz', 'prompt-smart-fill-footer');
    form.append(presetBar, rememberRow, previewTitle, preview, actions, footer);
    panel.append(head, hint, form);
    scrim.append(panel);
    dialog.append(scrim);
    documentRef.body.append(dialog);

    const renderPreview = () => {
      const values = {};
      for (const [name, input] of fields) values[name] = trim(input.value, MAX_VALUE);
      preview.textContent = api.replaceVariables(item.body, values);
      return values;
    };

    const saveRecentIfNeeded = (values) => {
      if (remember.checked) saveRecent(item.id, variables, values);
    };

    const on = (target, type, handler) => {
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    };

    on(close, 'click', closeDialog);
    on(cancel, 'click', closeDialog);
    on(scrim, 'click', (event) => { if (event.target === scrim) closeDialog(); });
    on(form, 'input', renderPreview);
    on(presetSelect, 'change', () => {
      const chosen = presetsFor(item.id, variables).find((preset) => preset.id === presetSelect.value);
      if (!chosen) return;
      for (const name of variables) fields.get(name).value = chosen.values[name] || '';
      renderPreview();
    });
    on(savePreset, 'click', () => {
      const name = root.prompt?.('Preset adı:', 'Yeni preset');
      if (name === null) return;
      const values = renderPreview();
      const normalizedName = trim(name, MAX_PRESET_NAME);
      if (!normalizedName) return report('Preset adı boş olamaz.');
      if (!upsertPreset(item.id, variables, normalizedName, values)) return report('Preset kaydedilemedi.');
      renderPresets();
      report('Preset kaydedildi.');
    });
    on(deletePresetButton, 'click', () => {
      const presetId = presetSelect.value;
      if (!presetId) return report('Silinecek preset seçili değil.');
      const selected = presetsFor(item.id, variables).find((preset) => preset.id === presetId);
      if (!selected || !root.confirm?.(`“${selected.name}” silinsin mi?`)) return;
      if (!deletePreset(presetId)) return report('Preset silinemedi.');
      renderPresets();
      report('Preset silindi.');
    });
    on(copy, 'click', () => {
      const values = renderPreview();
      copyFilled(api.replaceVariables(item.body, values)).then(() => report('Doldurulmuş istem panoya kopyalandı.')).catch(() => report('Panoya kopyalama kullanılamıyor.'));
    });
    on(apply, 'click', (event) => {
      event.preventDefault();
      const values = renderPreview();
      const missing = variables.filter((name) => !trim(values[name], MAX_VALUE));
      if (missing.length) return report(`Eksik alanlar: ${missing.join(', ')}`);
      saveRecentIfNeeded(values);
      if (setComposer(item, values)) {
        closeDialog();
        report('Doldurulmuş istem mesaj alanına aktarıldı.');
      }
    });
    on(documentRef, 'keydown', (event) => {
      if (!dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); apply.click();
      }
    });

    renderPreview();
    const restore = element(documentRef, 'span');
    restore.id = 'promptSmartFillRestoreFocus';
    restore.hidden = true;
    anchor?.after?.(restore);
    fields.get(variables[0])?.focus?.();
  }

  function intercept(event) {
    if (!mounted || !api) return;
    const target = event.target?.closest?.('.prompt-item-actions button');
    if (!target || target.textContent?.trim() !== 'Kullan') return;
    const item = findItemFromTarget(target);
    if (!item) return;
    const variables = api.extractVariables(item.body);
    if (!variables.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openDialog(item, target);
  }

  function boot() {
    if (mounted || !api || !root.document) return;
    const card = root.document.getElementById(CARD_ID);
    if (!card) return;
    mounted = true;
    root.document.addEventListener('click', intercept, true);
    listeners.push(() => root.document.removeEventListener('click', intercept, true));
    root.addEventListener?.('beforeunload', closeDialog, { once: true });
  }

  const smartApi = Object.freeze({
    STORAGE_KEY,
    readStore,
    normalizeValues,
    normalizePreset,
    presetsFor,
    saveRecent,
    recentValues,
    upsertPreset,
    deletePreset,
    closeDialog,
    mount: boot
  });
  root.HafizePromptLibrarySmartFill = smartApi;
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
