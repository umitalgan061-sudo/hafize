(function exposeHafizePromptSmartFill(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const CARD_ID = 'promptLibraryCard';
  const DIALOG_ID = 'promptLibrarySmartFill';
  const MAX_VARIABLES = 12;
  const MAX_VALUE = 1000;
  const MAX_BODY = 8000;
  const VALUE_PATTERN = /^[\s\S]{0,1000}$/;
  const VARIABLE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
  const DATE_NAMES = new Set(['tarih', 'date', 'gun', 'gün', 'son_tarih', 'deadline']);
  const EMAIL_NAMES = new Set(['eposta', 'e_posta', 'email', 'mail']);
  const URL_NAMES = new Set(['url', 'link', 'adres', 'site']);

  const api = root.HafizePromptLibrary;
  const trim = (value, limit = MAX_VALUE) => String(value ?? '').trim().slice(0, limit);
  const escapeValue = (value) => String(value ?? '').replace(/\0/g, '').slice(0, MAX_VALUE);

  function readItems() {
    try {
      const raw = root.localStorage?.getItem(STORAGE_KEY) || '[]';
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.body === 'string');
    } catch {
      return [];
    }
  }

  function getItem(id) {
    return readItems().find((item) => item.id === id) || null;
  }

  function variablesFor(body) {
    if (api?.extractVariables) return api.extractVariables(body).slice(0, MAX_VARIABLES);
    const names = [];
    const seen = new Set();
    const regex = /\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g;
    let match;
    while ((match = regex.exec(String(body || ''))) && names.length < MAX_VARIABLES) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
    return names;
  }

  function fill(body, values) {
    if (api?.replaceVariables) return api.replaceVariables(body, values).slice(0, MAX_BODY);
    return String(body || '')
      .replace(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g, (_match, name) => escapeValue(values?.[name] || ''))
      .slice(0, MAX_BODY);
  }

  function labelFor(name) {
    const pretty = String(name || '').replace(/[_-]+/g, ' ').trim();
    if (!pretty) return 'Değer';
    return pretty.charAt(0).toLocaleUpperCase('tr-TR') + pretty.slice(1);
  }

  function kindFor(name) {
    const key = String(name || '').toLocaleLowerCase('tr-TR');
    if (DATE_NAMES.has(key)) return 'date';
    if (EMAIL_NAMES.has(key)) return 'email';
    if (URL_NAMES.has(key)) return 'url';
    return 'text';
  }

  function validate(name, value) {
    const safe = escapeValue(value);
    if (!VARIABLE_PATTERN.test(String(name || ''))) return { ok: false, message: 'Geçersiz değişken adı.' };
    if (!VALUE_PATTERN.test(safe)) return { ok: false, message: 'Değer çok uzun.' };
    const kind = kindFor(name);
    if (kind === 'email' && safe && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe)) return { ok: false, message: 'Geçerli bir e-posta adresi gir.' };
    if (kind === 'url' && safe) {
      try {
        const url = new URL(safe);
        if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, message: 'Sadece http veya https adresi kullan.' };
      } catch {
        return { ok: false, message: 'Geçerli bir web adresi gir.' };
      }
    }
    if (kind === 'date' && safe && !/^\d{4}-\d{2}-\d{2}$/.test(safe)) return { ok: false, message: 'Tarih biçimi YYYY-AA-GG olmalı.' };
    return { ok: true, value: safe };
  }

  function node(doc, tag, text, className) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function button(doc, text, className) {
    const element = node(doc, 'button', text, className || 'soft-btn');
    element.type = 'button';
    return element;
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.hidden = true;
  }

  function focusTarget(dialog) {
    const first = dialog?.querySelector?.('[data-smart-fill-input]');
    first?.focus?.();
  }

  function makeDialog(documentRef) {
    if (!documentRef || documentRef.getElementById(DIALOG_ID)) return documentRef?.getElementById?.(DIALOG_ID) || null;
    const dialog = documentRef.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.className = 'prompt-library-smart-fill';
    dialog.setAttribute('aria-labelledby', 'promptLibrarySmartFillTitle');

    const shell = node(documentRef, 'div', undefined, 'prompt-library-smart-fill-shell');
    const header = node(documentRef, 'header', undefined, 'prompt-library-smart-fill-header');
    const title = node(documentRef, 'strong', 'İstemi akıllı doldur', 'prompt-library-smart-fill-title');
    title.id = 'promptLibrarySmartFillTitle';
    const close = button(documentRef, 'Kapat', 'mini-btn prompt-library-smart-fill-close');
    close.dataset.smartFillAction = 'close';
    header.append(title, close);

    const promptTitle = node(documentRef, 'div', '', 'prompt-library-smart-fill-prompt-title');
    const fields = node(documentRef, 'div', undefined, 'prompt-library-smart-fill-fields');
    fields.setAttribute('aria-live', 'polite');

    const previewLabel = node(documentRef, 'div', 'Canlı önizleme', 'prompt-library-smart-fill-section-title');
    const preview = node(documentRef, 'pre', '', 'prompt-library-smart-fill-preview');
    preview.setAttribute('aria-label', 'Doldurulmuş istem önizlemesi');
    const status = node(documentRef, 'div', '', 'prompt-library-smart-fill-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const footer = node(documentRef, 'footer', undefined, 'prompt-library-smart-fill-footer');
    const clear = button(documentRef, 'Alanları temizle', 'mini-btn');
    clear.dataset.smartFillAction = 'clear';
    const copy = button(documentRef, 'Önizlemeyi kopyala', 'mini-btn');
    copy.dataset.smartFillAction = 'copy';
    const insert = button(documentRef, 'Mesaj alanına ekle', 'soft-btn');
    insert.dataset.smartFillAction = 'insert';
    footer.append(clear, copy, insert);

    shell.append(header, promptTitle, fields, previewLabel, preview, status, footer);
    dialog.append(shell);
    documentRef.body.append(dialog);
    return dialog;
  }

  function writeStatus(dialog, value) {
    const status = dialog?.querySelector?.('.prompt-library-smart-fill-status');
    if (status) status.textContent = trim(value, 180);
  }

  function createField(documentRef, name, value, onInput) {
    const wrap = node(documentRef, 'div', undefined, 'prompt-library-smart-fill-field');
    const label = node(documentRef, 'label', labelFor(name));
    const note = node(documentRef, 'span', `{{${name}}}`, 'prompt-library-smart-fill-token');
    label.append(' ', note);
    const input = documentRef.createElement(kindFor(name) === 'text' ? 'textarea' : 'input');
    input.dataset.smartFillInput = name;
    input.name = name;
    input.value = escapeValue(value);
    input.maxLength = MAX_VALUE;
    input.setAttribute('aria-label', `${labelFor(name)} değeri`);
    if (kindFor(name) === 'date' || kindFor(name) === 'email' || kindFor(name) === 'url') input.type = kindFor(name);
    if (input.tagName === 'TEXTAREA') input.rows = 3;
    input.placeholder = kindFor(name) === 'date' ? 'YYYY-AA-GG' : `${labelFor(name)} değerini gir`;
    wrap.append(label, input);
    input.addEventListener('input', () => onInput?.());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && kindFor(name) !== 'text' && !event.shiftKey) event.preventDefault();
    });
    return wrap;
  }

  function listValues(dialog, names) {
    const values = {};
    const errors = [];
    for (const name of names) {
      const input = dialog.querySelector(`[data-smart-fill-input="${CSS.escape(name)}"]`);
      const result = validate(name, input?.value || '');
      values[name] = result.value || '';
      if (!result.ok) errors.push(`${labelFor(name)}: ${result.message}`);
      input?.setAttribute('aria-invalid', String(!result.ok));
    }
    return { values, errors };
  }

  function openFor(promptId, documentRef = root.document, rootRef = root) {
    const item = getItem(promptId);
    if (!item || !documentRef) return false;
    const names = variablesFor(item.body);
    const dialog = makeDialog(documentRef);
    if (!dialog) return false;

    const title = dialog.querySelector('.prompt-library-smart-fill-prompt-title');
    const fields = dialog.querySelector('.prompt-library-smart-fill-fields');
    const preview = dialog.querySelector('.prompt-library-smart-fill-preview');
    if (!title || !fields || !preview) return false;

    title.textContent = item.title || 'İsimsiz istem';
    fields.replaceChildren();
    const values = Object.create(null);

    if (!names.length) {
      fields.append(node(documentRef, 'div', 'Bu istemde değişken yok. Önizlemeyi doğrudan mesaj alanına ekleyebilirsin.', 'prompt-library-smart-fill-empty'));
    } else {
      for (const name of names) fields.append(createField(documentRef, name, '', () => renderPreview()));
    }

    function renderPreview() {
      const result = listValues(dialog, names);
      Object.assign(values, result.values);
      preview.textContent = fill(item.body, values);
      if (result.errors.length) writeStatus(dialog, result.errors.join(' '));
      else writeStatus(dialog, names.length ? 'Tüm alanlar geçerli.' : 'Değişken bulunmuyor.');
      return result;
    }

    renderPreview();

    const keydown = (event) => {
      if (event.key === 'Escape') closeDialog(dialog);
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        insertResult();
      }
    };

    function insertResult() {
      const result = renderPreview();
      if (result.errors.length) return;
      const composer = documentRef.querySelector('#messageInput');
      if (!composer) return writeStatus(dialog, 'Mesaj alanı bulunamadı.');
      composer.value = preview.textContent || item.body;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      composer.focus();
      closeDialog(dialog);
      rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:prompt-library-smart-fill', { detail: { promptId: item.id } }));
    }

    function clearValues() {
      dialog.querySelectorAll('[data-smart-fill-input]').forEach((input) => {
        input.value = '';
        input.setAttribute('aria-invalid', 'false');
      });
      renderPreview();
      focusTarget(dialog);
    }

    async function copyPreview() {
      const result = renderPreview();
      if (result.errors.length) return;
      const textValue = preview.textContent || '';
      try {
        await rootRef.navigator?.clipboard?.writeText?.(textValue);
        writeStatus(dialog, 'Önizleme panoya kopyalandı.');
      } catch {
        writeStatus(dialog, 'Panoya kopyalama kullanılamıyor.');
      }
    }

    const onAction = (event) => {
      const target = event.target?.closest?.('[data-smart-fill-action]');
      if (!target) return;
      const action = target.dataset.smartFillAction;
      if (action === 'close') closeDialog(dialog);
      if (action === 'clear') clearValues();
      if (action === 'copy') copyPreview();
      if (action === 'insert') insertResult();
    };

    dialog.addEventListener('click', onAction);
    dialog.addEventListener('keydown', keydown);

    const show = () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.hidden = false;
      focusTarget(dialog);
    };
    show();

    const cleanup = () => {
      dialog.removeEventListener('click', onAction);
      dialog.removeEventListener('keydown', keydown);
    };
    dialog.addEventListener('close', cleanup, { once: true });
    return true;
  }

  function enhanceCard(documentRef = root.document) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!card) return false;
    card.querySelectorAll('.prompt-item').forEach((row) => {
      const id = row.dataset.promptId;
      const actions = row.querySelector('.prompt-item-actions');
      if (!id || !actions || actions.querySelector('[data-smart-fill-id]')) return;
      const action = button(documentRef, 'Akıllı doldur', 'soft-btn prompt-smart-fill-button');
      action.dataset.smartFillId = id;
      action.setAttribute('aria-label', 'İstemi değişkenlerle akıllı doldur');
      action.addEventListener('click', () => openFor(id, documentRef, root));
      actions.append(action);
    });
    return true;
  }

  function boot() {
    if (!api || !root.document) return;
    const ready = enhanceCard(root.document);
    if (!ready) {
      const observer = new MutationObserver(() => {
        if (enhanceCard(root.document)) observer.disconnect();
      });
      observer.observe(root.document.body, { childList: true, subtree: true });
      return;
    }
    const card = root.document.getElementById(CARD_ID);
    if (card && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => enhanceCard(root.document));
      observer.observe(card, { childList: true, subtree: true });
      root.addEventListener?.('beforeunload', () => observer.disconnect(), { once: true });
    }
  }

  const publicApi = Object.freeze({
    STORAGE_KEY,
    MAX_VARIABLES,
    MAX_VALUE,
    labelFor,
    kindFor,
    variablesFor,
    fill,
    validate,
    openFor,
    enhanceCard
  });
  root.HafizePromptLibrarySmartFill = publicApi;
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
