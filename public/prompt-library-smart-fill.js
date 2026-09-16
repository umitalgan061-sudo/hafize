(function installPromptSmartFill(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.smart-fill.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_VALUE = 1000;
  const MAX_VARIABLES = 12;
  const MAX_PRESETS = 6;
  const MAX_NAME = 60;
  const MAX_PREVIEW = 8000;
  const core = () => root.HafizePromptLibrary;
  const store = () => root.localStorage;
  const clamp = (value, limit) => String(value ?? '').slice(0, limit);

  function safeParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function keyForPrompt(promptId) {
    return `${STORAGE_KEY}.${clamp(promptId, 120)}`;
  }

  function readPresets(promptId) {
    // Reading storage can throw outright when site data is blocked, so the
    // panel falls back to "no saved sets" instead of failing to open.
    let raw = null;
    try { raw = store()?.getItem?.(keyForPrompt(promptId)); } catch { return []; }
    const data = safeParse(raw || '[]', []);
    if (!Array.isArray(data)) return [];
    return data.filter((preset) => preset && typeof preset === 'object')
      .slice(0, MAX_PRESETS)
      .map((preset) => ({
        id: clamp(preset.id, 120),
        name: clamp(preset.name, MAX_NAME).trim(),
        values: Object.fromEntries(Object.entries(preset.values || {}).slice(0, MAX_VARIABLES).map(([name, value]) => [clamp(name, 32), clamp(value, MAX_VALUE)]))
      }))
      .filter((preset) => preset.name && preset.id);
  }

  function writePresets(promptId, presets) {
    try {
      store()?.setItem?.(keyForPrompt(promptId), JSON.stringify(presets.slice(0, MAX_PRESETS)));
      return true;
    } catch {
      return false;
    }
  }

  function variableNames(body) {
    const found = core()?.extractVariables?.(body) || [];
    return [...new Set(found.map((name) => clamp(name, 32)).filter(Boolean))].slice(0, MAX_VARIABLES);
  }

  function randomId() {
    return root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function buildElement(doc, tag, textValue, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  }

  function buildButton(doc, label, className) {
    const node = buildElement(doc, 'button', label, className || 'soft-btn');
    node.type = 'button';
    return node;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || card.dataset.smartFillReady === 'true') return null;
    card.dataset.smartFillReady = 'true';

    const dialog = buildElement(documentRef, 'section', undefined, 'prompt-smart-fill');
    dialog.id = 'promptLibrarySmartFill';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptSmartFillTitle');
    dialog.setAttribute('aria-describedby', 'promptSmartFillDescription');

    const shell = buildElement(documentRef, 'div', undefined, 'prompt-smart-fill-shell');
    const head = buildElement(documentRef, 'div', undefined, 'prompt-smart-fill-head');
    const title = buildElement(documentRef, 'strong', 'İstemi doldur', 'prompt-smart-fill-title');
    title.id = 'promptSmartFillTitle';
    const close = buildButton(documentRef, 'Kapat', 'mini-btn');
    close.setAttribute('aria-label', 'İstem doldurma panelini kapat');
    head.append(title, close);
    const description = buildElement(documentRef, 'p', 'Değişken değerlerini gir. Önizlemeyi kontrol ettikten sonra istemi mesaj alanına aktar.', 'prompt-smart-fill-description');
    description.id = 'promptSmartFillDescription';
    const form = buildElement(documentRef, 'form', undefined, 'prompt-smart-fill-form');
    const fields = buildElement(documentRef, 'div', undefined, 'prompt-smart-fill-fields');
    const presetBar = buildElement(documentRef, 'div', undefined, 'prompt-smart-fill-presets');
    const previewLabel = buildElement(documentRef, 'div', 'Önizleme', 'prompt-smart-fill-preview-label');
    const preview = buildElement(documentRef, 'pre', '', 'prompt-smart-fill-preview');
    preview.setAttribute('aria-live', 'polite');
    const errors = buildElement(documentRef, 'div', '', 'prompt-smart-fill-errors');
    errors.setAttribute('role', 'alert');
    const actions = buildElement(documentRef, 'div', undefined, 'prompt-smart-fill-actions');
    const copy = buildButton(documentRef, 'Önizlemeyi kopyala', 'soft-btn');
    const insert = buildButton(documentRef, 'Mesaja aktar', 'soft-btn');
    const cancel = buildButton(documentRef, 'Vazgeç', 'soft-btn');
    actions.append(copy, cancel, insert);
    form.append(fields, presetBar, previewLabel, preview, errors, actions);
    shell.append(head, description, form);
    dialog.append(shell);
    card.append(dialog);

    let activePrompt = null;
    let activeNames = [];
    let activeInputs = new Map();
    let lastFocus = null;

    function closeDialog() {
      dialog.hidden = true;
      fields.replaceChildren(); presetBar.replaceChildren(); errors.textContent = '';
      activePrompt = null; activeNames = []; activeInputs = new Map();
      lastFocus?.focus?.(); lastFocus = null;
    }

    function showError(message) { errors.textContent = clamp(message, 180); }

    function currentValues() {
      const values = {};
      activeNames.forEach((name) => { values[name] = clamp(activeInputs.get(name)?.value, MAX_VALUE); });
      return values;
    }

    function renderPreview() {
      if (!activePrompt) return;
      const values = currentValues();
      preview.textContent = core()?.replaceVariables?.(activePrompt.body, values)?.slice(0, MAX_PREVIEW) || activePrompt.body.slice(0, MAX_PREVIEW);
    }

    function presetSelectOptions() {
      const select = buildElement(documentRef, 'select', undefined, 'prompt-smart-fill-preset-select');
      select.setAttribute('aria-label', 'Kaydedilmiş değişken seti');
      const empty = buildElement(documentRef, 'option', 'Değişken seti seç…'); empty.value = ''; select.append(empty);
      readPresets(activePrompt.id).forEach((preset) => {
        const option = buildElement(documentRef, 'option', preset.name); option.value = preset.id; option.dataset.name = preset.name; select.append(option);
      });
      select.addEventListener('change', () => {
        const found = readPresets(activePrompt.id).find((preset) => preset.id === select.value);
        if (!found) return;
        activeNames.forEach((name) => { const input = activeInputs.get(name); if (input) input.value = found.values[name] || ''; });
        renderPreview();
      });
      return select;
    }

    function savePreset() {
      const name = rootRef.prompt?.('Değişken seti adı:', '')?.trim?.() || '';
      if (!name) return;
      const presets = readPresets(activePrompt.id);
      const next = {
        id: randomId(),
        name: clamp(name, MAX_NAME),
        values: currentValues()
      };
      if (!writePresets(activePrompt.id, [next, ...presets].slice(0, MAX_PRESETS))) showError('Değişken seti kaydedilemedi.');
      else renderPresetBar();
    }

    function renderPresetBar() {
      presetBar.replaceChildren();
      if (!activePrompt || !activeNames.length) return;
      const select = presetSelectOptions();
      const save = buildButton(documentRef, 'Seti kaydet', 'mini-btn');
      const clear = buildButton(documentRef, 'Setleri temizle', 'mini-btn');
      presetBar.append(select, save, clear);
      save.addEventListener('click', savePreset);
      clear.addEventListener('click', () => { if (rootRef.confirm?.('Bu istemin kaydedilmiş değişken setleri silinsin mi?')) { writePresets(activePrompt.id, []); renderPresetBar(); } });
    }

    async function copyPreview() {
      const value = preview.textContent || '';
      try {
        await rootRef.navigator?.clipboard?.writeText?.(value);
        showError('Önizleme panoya kopyalandı.');
      } catch {
        showError('Önizleme panoya kopyalanamadı.');
      }
    }

    function openFor(prompt) {
      if (!prompt) return;
      lastFocus = documentRef.activeElement;
      activePrompt = prompt;
      activeNames = variableNames(prompt.body);
      activeInputs = new Map();
      fields.replaceChildren(); errors.textContent = '';
      if (!activeNames.length) {
        showError('Bu istem değişken içermiyor. Doğrudan mesaja aktarılabilir.');
      }
      activeNames.forEach((name, index) => {
        const row = buildElement(documentRef, 'label', undefined, 'prompt-smart-fill-field');
        const caption = buildElement(documentRef, 'span', `{{${name}}}`, 'prompt-smart-fill-label');
        const input = buildElement(documentRef, 'input');
        input.type = 'text'; input.maxLength = MAX_VALUE; input.autocomplete = 'off'; input.name = name;
        input.placeholder = `${name} değeri`;
        input.setAttribute('aria-label', `${name} değişken değeri`);
        input.addEventListener('input', renderPreview);
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const all = [...activeInputs.values()];
          const currentIndex = all.indexOf(input);
          const nextIndex = event.key === 'ArrowUp' ? Math.max(0, currentIndex - 1) : Math.min(all.length - 1, currentIndex + 1);
          all[nextIndex]?.focus?.();
        });
        row.append(caption, input);
        fields.append(row);
        activeInputs.set(name, input);
        if (index === 0) rootRef.setTimeout?.(() => input.focus(), 0);
      });
      renderPresetBar(); renderPreview(); dialog.hidden = false;
    }

    // Smart fill intercepts the library's own "Kullan" button, so the use that
    // button would have counted has to be counted here — otherwise every prompt
    // with variables stays at zero uses in the insights panel.
    function persist(items) {
      return core()?.saveItems?.(store(), items) === true;
    }

    function recordUse(promptId) {
      const api = core();
      if (!api?.loadItems || !api.normalizeItem || !promptId) return;
      let items = [];
      try { items = api.loadItems(store()) || []; } catch { return; }
      const index = items.findIndex((item) => item.id === promptId);
      if (index < 0) return;
      const next = items.slice();
      next[index] = api.normalizeItem({ ...items[index], useCount: items[index].useCount + 1, updatedAt: new Date().toISOString() });
      if (!persist(next)) return;
      // The library card and the insights panel both listen for a storage
      // change, which same-tab writes do not emit on their own.
      try {
        const detail = { key: api.STORAGE_KEY, newValue: JSON.stringify(next), storageArea: store() };
        if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
      } catch { /* the counter is already stored; a missed repaint is not fatal */ }
    }

    function insertIntoComposer() {
      if (!activePrompt) return;
      const values = currentValues();
      if (activeNames.some((name) => values[name].trim().length === 0)) return showError('Tüm değişken alanlarını doldur veya gerekli olmayan alanı boş bırakmak için istemi düzenle.');
      const text = core()?.replaceVariables?.(activePrompt.body, values) || activePrompt.body;
      const composer = /** @type {HTMLTextAreaElement | null} */ (documentRef.querySelector('#messageInput'));
      if (!composer) return showError('Mesaj alanı bulunamadı.');
      const usedPromptId = activePrompt.id;
      composer.value = text.slice(0, MAX_PREVIEW);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.focus();
      closeDialog();
      recordUse(usedPromptId);
    }

    function trapKeydown(event) {
      if (dialog.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...dialog.querySelectorAll('button,input,select')].filter((node) => !node.disabled && !node.hidden);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function interceptUse(event) {
      const target = event.target?.closest?.('.prompt-item-actions button');
      if (!target || target.textContent?.trim() !== 'Kullan') return;
      const row = target.closest('.prompt-item');
      const id = row?.dataset?.promptId;
      const promptItem = id ? core()?.loadItems?.(store())?.find?.((item) => item.id === id) : null;
      if (!promptItem) return;
      if (!variableNames(promptItem.body).length) return;
      event.preventDefault(); event.stopImmediatePropagation(); openFor(promptItem);
    }

    close.addEventListener('click', closeDialog);
    cancel.addEventListener('click', closeDialog);
    copy.addEventListener('click', copyPreview);
    insert.addEventListener('click', insertIntoComposer);
    dialog.addEventListener('keydown', trapKeydown);
    card.addEventListener('click', interceptUse, true);

    return Object.freeze({ mounted: true, open: openFor, close: closeDialog, destroy: () => { card.removeEventListener('click', interceptUse, true); closeDialog(); dialog.remove(); delete card.dataset.smartFillReady; } });
  }

  const api = Object.freeze({ STORAGE_KEY, mount, readPresets, writePresets, variableNames });
  root.HafizePromptLibrarySmartFill = api;
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
