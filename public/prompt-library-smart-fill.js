(function installPromptLibrarySmartFill(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.smart-fill.v1';
  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibrarySmartFill';
  const MAX_VALUE = 1000;
  const MAX_PRESETS = 8;
  const MAX_NAME = 60;
  const MAX_VARIABLES = 12;
  const MAX_BODY = 8000;

  const clamp = (value, limit) => String(value ?? '').slice(0, limit);
  const core = () => root.HafizePromptLibrary;
  const storage = () => {
    try { return root.localStorage; } catch { return null; }
  };
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function readJson(key, fallback) {
    const store = storage();
    if (!store) return fallback;
    try { return JSON.parse(store.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function writeJson(key, value) {
    const store = storage();
    if (!store) return false;
    try { store.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function variableNames(prompt) {
    const names = core()?.extractVariables?.(prompt?.body || []) || [];
    return [...new Set(names.map((name) => clamp(name, 32)).filter(Boolean))].slice(0, MAX_VARIABLES);
  }

  function presetKey(promptId) {
    return `${STORAGE_KEY}.presets.${clamp(promptId, 120)}`;
  }

  function lastKey(promptId) {
    return `${STORAGE_KEY}.last.${clamp(promptId, 120)}`;
  }

  function readPresets(promptId) {
    const value = readJson(presetKey(promptId), []);
    if (!Array.isArray(value)) return [];
    return value.slice(0, MAX_PRESETS).map((raw) => ({
      id: clamp(raw?.id, 120),
      name: clamp(raw?.name, MAX_NAME).trim(),
      values: Object.fromEntries(
        Object.entries(raw?.values && typeof raw.values === 'object' ? raw.values : {})
          .slice(0, MAX_VARIABLES)
          .map(([name, value]) => [clamp(name, 32), clamp(value, MAX_VALUE)])
      )
    })).filter((item) => item.id && item.name);
  }

  function writePresets(promptId, presets) {
    return writeJson(presetKey(promptId), presets.slice(0, MAX_PRESETS));
  }

  function readLast(promptId) {
    const value = readJson(lastKey(promptId), {});
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).slice(0, MAX_VARIABLES).map(([name, value]) => [clamp(name, 32), clamp(value, MAX_VALUE)]));
  }

  function writeLast(promptId, values) {
    return writeJson(lastKey(promptId), Object.fromEntries(Object.entries(values).slice(0, MAX_VARIABLES)));
  }

  function node(doc, tag, value = '', className = '') {
    const item = doc.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined) item.textContent = value;
    return item;
  }

  function button(doc, label, className = 'soft-btn') {
    const item = node(doc, 'button', label, className);
    item.type = 'button';
    return item;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const panel = node(documentRef, 'section', undefined, 'prompt-smart-fill');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'promptSmartFillTitle');
    panel.setAttribute('aria-describedby', 'promptSmartFillDescription');

    const shell = node(documentRef, 'div', undefined, 'prompt-smart-fill-shell');
    const head = node(documentRef, 'div', undefined, 'prompt-smart-fill-head');
    const title = node(documentRef, 'strong', 'İstemi doldur', 'prompt-smart-fill-title');
    title.id = 'promptSmartFillTitle';
    const close = button(documentRef, 'Kapat', 'mini-btn');
    close.setAttribute('aria-label', 'İstem doldurma panelini kapat');
    head.append(title, close);

    const description = node(documentRef, 'p', 'Değişken değerlerini gir, önizlemeyi kontrol et ve yalnızca hazır olduğunda mesaja aktar.');
    description.id = 'promptSmartFillDescription';

    const activeTitle = node(documentRef, 'div', '', 'prompt-smart-fill-prompt-title');
    const form = node(documentRef, 'form', undefined, 'prompt-smart-fill-form');
    const fields = node(documentRef, 'div', undefined, 'prompt-smart-fill-fields');
    const tools = node(documentRef, 'div', undefined, 'prompt-smart-fill-tools');
    const presetName = documentRef.createElement('input');
    presetName.type = 'text';
    presetName.maxLength = MAX_NAME;
    presetName.placeholder = 'Değişken seti adı';
    presetName.setAttribute('aria-label', 'Değişken seti adı');
    const presetSelect = documentRef.createElement('select');
    presetSelect.setAttribute('aria-label', 'Kayıtlı değişken seti');
    const savePreset = button(documentRef, 'Seti kaydet', 'mini-btn');
    const deletePreset = button(documentRef, 'Seti sil', 'mini-btn');
    const restoreLast = button(documentRef, 'Son değerler', 'mini-btn');
    const clearValues = button(documentRef, 'Temizle', 'mini-btn');
    tools.append(presetName, presetSelect, savePreset, deletePreset, restoreLast, clearValues);

    const previewLabel = node(documentRef, 'div', 'Önizleme', 'prompt-smart-fill-preview-label');
    const preview = node(documentRef, 'pre', '', 'prompt-smart-fill-preview');
    preview.setAttribute('aria-live', 'polite');
    const previewCount = node(documentRef, 'small', '', 'prompt-smart-fill-preview-count');
    const errors = node(documentRef, 'div', '', 'prompt-smart-fill-errors');
    errors.setAttribute('role', 'alert');
    errors.setAttribute('aria-live', 'assertive');

    const actions = node(documentRef, 'div', undefined, 'prompt-smart-fill-actions');
    const copy = button(documentRef, 'Önizlemeyi kopyala');
    const cancel = button(documentRef, 'Vazgeç');
    const insert = button(documentRef, 'Mesaja aktar');
    actions.append(copy, cancel, insert);
    form.append(fields, tools, previewLabel, preview, previewCount, errors, actions);
    shell.append(head, description, activeTitle, form);
    panel.append(shell);
    card.append(panel);

    let activePrompt = null;
    let names = [];
    let inputs = new Map();
    let lastFocus = null;
    let activePresetId = '';

    const report = (message) => {
      errors.textContent = clamp(message, 220);
    };

    const values = () => Object.fromEntries(names.map((name) => [name, clamp(inputs.get(name)?.value, MAX_VALUE)]));

    const renderPreview = () => {
      if (!activePrompt) return;
      const output = core()?.replaceVariables?.(activePrompt.body, values()) || activePrompt.body;
      preview.textContent = output.slice(0, MAX_BODY);
      previewCount.textContent = `${preview.textContent.length}/${MAX_BODY} karakter`;
    };

    const renderPresets = () => {
      presetSelect.replaceChildren();
      const empty = node(documentRef, 'option', 'Kayıtlı set seç…');
      empty.value = '';
      presetSelect.append(empty);
      if (!activePrompt) return;
      readPresets(activePrompt.id).forEach((preset) => {
        const option = node(documentRef, 'option', preset.name);
        option.value = preset.id;
        presetSelect.append(option);
      });
      presetSelect.value = activePresetId;
    };

    const applyValues = (source) => {
      names.forEach((name) => {
        const input = inputs.get(name);
        if (input) input.value = clamp(source?.[name], MAX_VALUE);
      });
      renderPreview();
    };

    const closePanel = () => {
      panel.hidden = true;
      fields.replaceChildren();
      tools.hidden = false;
      errors.textContent = '';
      activePrompt = null;
      names = [];
      inputs = new Map();
      activePresetId = '';
      if (lastFocus instanceof HTMLElement) lastFocus.focus();
      lastFocus = null;
    };

    const openPanel = (prompt) => {
      if (!prompt) return;
      activePrompt = prompt;
      names = variableNames(prompt);
      inputs = new Map();
      activePresetId = '';
      lastFocus = documentRef.activeElement;
      activeTitle.textContent = prompt.title || 'İsimsiz istem';
      fields.replaceChildren();
      errors.textContent = '';

      if (!names.length) {
        fields.append(node(documentRef, 'div', 'Bu istem değişken içermiyor. Mesaja doğrudan aktarılabilir.', 'prompt-smart-fill-empty'));
      }

      names.forEach((name, index) => {
        const label = node(documentRef, 'label', undefined, 'prompt-smart-fill-field');
        const caption = node(documentRef, 'span', `{{${name}}}`, 'prompt-smart-fill-label');
        const input = documentRef.createElement('input');
        input.type = 'text';
        input.name = name;
        input.maxLength = MAX_VALUE;
        input.autocomplete = 'off';
        input.placeholder = `${name} değeri`;
        input.setAttribute('aria-label', `${name} değişken değeri`);
        input.addEventListener('input', renderPreview);
        input.addEventListener('keydown', (event) => {
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault();
          const controls = [...inputs.values()];
          const index = controls.indexOf(input);
          controls[event.key === 'ArrowUp' ? index - 1 : index + 1]?.focus();
        });
        label.append(caption, input);
        fields.append(label);
        inputs.set(name, input);
        if (index === 0) rootRef.setTimeout?.(() => input.focus(), 0);
      });

      applyValues(readLast(prompt.id));
      renderPresets();
      panel.hidden = false;
      if (!names.length) rootRef.setTimeout?.(() => insert.focus(), 0);
    };

    const save = () => {
      if (!activePrompt) return;
      const name = presetName.value.trim().slice(0, MAX_NAME);
      if (!name) return report('Kaydetmek için değişken seti adı gir.');
      const existing = readPresets(activePrompt.id);
      const next = { id: makeId(), name, values: values() };
      const result = writePresets(activePrompt.id, [next, ...existing]);
      if (!result) return report('Değişken seti cihazda kaydedilemedi.');
      activePresetId = next.id;
      presetName.value = '';
      renderPresets();
      report('Değişken seti kaydedildi.');
    };

    const removePreset = () => {
      if (!activePrompt || !activePresetId) return report('Silmek için kayıtlı bir set seç.');
      const existing = readPresets(activePrompt.id);
      const selected = existing.find((item) => item.id === activePresetId);
      if (!selected) return report('Kayıtlı set bulunamadı.');
      if (!rootRef.confirm?.(`“${selected.name}” değişken seti silinsin mi?`)) return;
      writePresets(activePrompt.id, existing.filter((item) => item.id !== activePresetId));
      activePresetId = '';
      renderPresets();
      report('Değişken seti silindi.');
    };

    const insertIntoComposer = () => {
      if (!activePrompt) return;
      const current = values();
      const missing = names.filter((name) => !current[name].trim());
      if (missing.length) return report(`Doldurulmamış değişkenler: ${missing.map((name) => `{{${name}}}`).join(', ')}`);
      const message = (core()?.replaceVariables?.(activePrompt.body, current) || activePrompt.body).slice(0, MAX_BODY);
      const composer = documentRef.querySelector('#messageInput');
      if (!composer) return report('Mesaj alanı bulunamadı.');
      writeLast(activePrompt.id, current);
      composer.value = message;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.focus();
      const id = activePrompt.id;
      const api = core();
      const store = storage();
      if (api?.loadItems && api?.normalizeItem && api?.saveItems && store) {
        const items = api.loadItems(store);
        const index = items.findIndex((item) => item.id === id);
        if (index >= 0) {
          const nextItem = api.normalizeItem({ ...items[index], useCount: Number(items[index].useCount) + 1, updatedAt: new Date().toISOString() });
          if (nextItem) {
            items[index] = nextItem;
            api.saveItems(store, items);
            try {
              rootRef.dispatchEvent(new rootRef.StorageEvent('storage', { key: api.STORAGE_KEY, newValue: JSON.stringify(items), storageArea: store }));
            } catch { /* local data is already persisted */ }
          }
        }
      }
      closePanel();
    };

    const trap = (event) => {
      if (panel.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closePanel(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...panel.querySelectorAll('button,input,select')].filter((item) => !item.disabled && !item.hidden);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    const interceptUse = (event) => {
      const target = event.target instanceof Element ? event.target.closest('.prompt-item-actions button') : null;
      if (!target || target.textContent.trim() !== 'Kullan') return;
      const row = target.closest('.prompt-item');
      const id = row?.dataset.promptId;
      if (!id) return;
      const prompt = core()?.loadItems?.(storage())?.find((item) => item.id === id);
      if (!prompt || !variableNames(prompt).length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openPanel(prompt);
    };

    const onPresetChange = () => {
      if (!activePrompt) return;
      const selected = readPresets(activePrompt.id).find((item) => item.id === presetSelect.value);
      if (!selected) return;
      activePresetId = selected.id;
      applyValues(selected.values);
      report('Değişken seti uygulandı.');
    };

    presetSelect.addEventListener('change', onPresetChange);
    savePreset.addEventListener('click', save);
    deletePreset.addEventListener('click', removePreset);
    restoreLast.addEventListener('click', () => {
      if (!activePrompt) return;
      applyValues(readLast(activePrompt.id));
      report('Son yerel değerler geri yüklendi.');
    });
    clearValues.addEventListener('click', () => { applyValues({}); report('Değişken alanları temizlendi.'); });
    insert.addEventListener('click', insertIntoComposer);
    copy.addEventListener('click', async () => {
      try {
        await rootRef.navigator?.clipboard?.writeText?.(preview.textContent || '');
        report('Önizleme panoya kopyalandı.');
      } catch { report('Panoya kopyalama kullanılamıyor.'); }
    });
    close.addEventListener('click', closePanel);
    cancel.addEventListener('click', closePanel);
    panel.addEventListener('keydown', trap);
    panel.addEventListener('click', (event) => { if (event.target === panel) closePanel(); });
    card.addEventListener('click', interceptUse, true);

    return Object.freeze({
      mounted: true,
      open: openPanel,
      close: closePanel,
      readPresets,
      readLast,
      destroy: () => { card.removeEventListener('click', interceptUse, true); closePanel(); panel.remove(); }
    });
  }

  const api = Object.freeze({ STORAGE_KEY, mount, readPresets, readLast, writePresets, writeLast, variableNames });
  root.HafizePromptLibrarySmartFill = api;

  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
