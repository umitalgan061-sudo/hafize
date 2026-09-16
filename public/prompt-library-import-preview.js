/* Import preview for the Prompt Library.
 *
 * The plain import writes the file into the library as soon as it is picked:
 * the first time the user sees what a backup contained is after it is already
 * merged. This module takes over the file selection, parses the backup in
 * memory and shows what would change — how many records are valid, how many
 * are broken, how many fit in the remaining capacity — before anything is
 * written. Cancelling, closing or pressing Escape leaves storage untouched.
 *
 * The file never leaves the device: it is read with FileReader and parsed
 * locally, and titles are rendered as text nodes so a backup can never inject
 * markup into the preview. */
(function installPromptLibraryImportPreview(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const DIALOG_ID = 'promptLibraryImportPreview';
  // Matches the core library's own import ceiling, so a file this module
  // accepts is a file the library would accept.
  const MAX_FILE = 1000000;
  const MAX_SAMPLE = 8;
  const MAX_TITLE = 90;

  const library = () => root.HafizePromptLibrary;

  const storage = () => {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  };

  function element(doc, tag, textValue = '', className = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== '') node.textContent = String(textValue);
    return node;
  }

  function button(doc, label, className = 'mini-btn') {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
  }

  function stat(doc, value, label) {
    const box = element(doc, 'div', '', 'prompt-library-import-stat');
    box.append(element(doc, 'strong', String(value)), element(doc, 'span', label));
    return box;
  }

  function rawRecordCount(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (payload && typeof payload === 'object' && Array.isArray(payload.items)) return payload.items.length;
    return 0;
  }

  /**
   * What importing this payload would do, without doing it.
   * `accepted` is what actually lands: the library caps its size, so a backup
   * larger than the remaining capacity is partially imported, and the user is
   * told how much was left out before confirming.
   */
  function preview(payload, current) {
    const api = library();
    const parsed = api?.normalizeImportedPayload?.(payload) || { items: [], meta: {} };
    const items = parsed.items || [];
    const merged = api?.mergeImportedItems?.(current, items) || { items: current, imported: 0 };
    const raw = rawRecordCount(payload);
    return {
      raw,
      valid: items.length,
      invalid: Math.max(0, raw - items.length),
      accepted: merged.imported,
      rejected: Math.max(0, items.length - merged.imported),
      items,
      merged: merged.items,
      meta: parsed.meta || {}
    };
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(DIALOG_ID)) return null;

    const overlay = element(documentRef, 'div', '', 'prompt-library-import-preview');
    overlay.id = DIALOG_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'promptLibraryImportPreviewTitle');

    const panel = element(documentRef, 'div', '', 'prompt-library-import-preview-panel');
    const header = element(documentRef, 'div', '', 'prompt-library-import-preview-header');
    const title = element(documentRef, 'h3', 'İçe aktarma önizlemesi');
    title.id = 'promptLibraryImportPreviewTitle';
    const close = button(documentRef, 'Kapat');
    close.setAttribute('aria-label', 'Önizlemeyi kapat');
    header.append(title, close);

    const summary = element(documentRef, 'div', '', 'prompt-library-import-preview-summary');
    const meta = element(documentRef, 'p', '', 'prompt-library-import-preview-meta');
    const list = element(documentRef, 'div', '', 'prompt-library-import-preview-list');
    const note = element(documentRef, 'p', '', 'prompt-library-import-preview-note');
    const feedback = element(documentRef, 'p', '', 'prompt-library-import-preview-feedback');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');

    const actions = element(documentRef, 'div', '', 'prompt-library-import-preview-actions');
    const cancel = button(documentRef, 'Vazgeç');
    const confirm = button(documentRef, 'İçe aktar', 'soft-btn');
    actions.append(cancel, confirm);

    panel.append(header, summary, meta, list, note, feedback, actions);
    overlay.append(panel);
    card.append(overlay);

    const listeners = [];
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      listeners.push(() => target.removeEventListener(type, handler, options));
    };

    let pending = null;
    let lastFocus = null;

    const closeDialog = () => {
      overlay.hidden = true;
      pending = null;
      summary.replaceChildren();
      list.replaceChildren();
      meta.textContent = '';
      note.textContent = '';
      if (typeof lastFocus?.focus === 'function') lastFocus.focus();
      lastFocus = null;
    };

    const openDialog = () => {
      if (!overlay.hidden) return;
      lastFocus = documentRef.activeElement;
      overlay.hidden = false;
      close.focus();
    };

    function showError(message) {
      pending = null;
      summary.replaceChildren();
      list.replaceChildren();
      meta.textContent = '';
      note.textContent = '';
      // Nothing was written: the library the user already has is still intact.
      feedback.textContent = `${message} Kütüphane değişmedi.`;
      confirm.disabled = true;
      openDialog();
    }

    function showPreview(payload) {
      const api = library();
      const store = storage();
      const current = api?.loadItems?.(store) || [];
      const result = preview(payload, current);
      pending = result;

      summary.replaceChildren(
        stat(documentRef, result.raw, 'Dosyada'),
        stat(documentRef, result.valid, 'Geçerli'),
        stat(documentRef, result.invalid, 'Bozuk'),
        stat(documentRef, result.accepted, 'Aktarılacak'),
        stat(documentRef, result.rejected, 'Kapasite dışı')
      );

      const source = result.meta.source ? `Kaynak: ${result.meta.source}. ` : '';
      const exportedAt = result.meta.exportedAt ? `Dışa aktarma: ${result.meta.exportedAt}. ` : '';
      meta.textContent = `${source}${exportedAt}Mevcut kütüphanede ${current.length} istem var.`;

      list.replaceChildren();
      if (!result.items.length) {
        list.append(element(documentRef, 'div', 'Aktarılabilecek istem yok.', 'prompt-library-import-preview-empty'));
      } else {
        result.items.slice(0, MAX_SAMPLE).forEach((item, index) => {
          const row = element(documentRef, 'div', '', 'prompt-library-import-preview-item');
          row.append(
            element(documentRef, 'span', String(index + 1)),
            // Titles come from the file: they are written as text, never markup.
            element(documentRef, 'span', String(item.title || '').slice(0, MAX_TITLE), 'prompt-library-import-preview-name')
          );
          list.append(row);
        });
        if (result.items.length > MAX_SAMPLE) {
          list.append(element(documentRef, 'div', `+${result.items.length - MAX_SAMPLE} istem daha`, 'prompt-library-import-preview-more'));
        }
      }

      const notes = [];
      if (result.invalid) notes.push(`${result.invalid} kayıt okunamadığı için atlanacak.`);
      if (result.rejected) notes.push(`${result.rejected} kayıt kapasite sınırı nedeniyle aktarılmayacak.`);
      notes.push('Aynı id taşıyan kayıtlar mevcut istemi ezmez; yeni id ile eklenir.');
      note.textContent = notes.join(' ');

      feedback.textContent = '';
      confirm.disabled = result.accepted === 0;
      openDialog();
    }

    function read(fileObject) {
      if (!fileObject) return;
      // The size check happens before the read, so an oversized file is never
      // pulled into memory.
      if (fileObject.size > MAX_FILE) return showError('İçe aktarma dosyası 1 MB sınırını aşamaz.');
      const Reader = rootRef.FileReader;
      if (typeof Reader !== 'function') return showError('Bu tarayıcı dosya okumayı desteklemiyor.');
      const reader = new Reader();
      reader.onload = () => {
        try {
          showPreview(JSON.parse(String(reader.result || '')));
        } catch {
          showError('Geçersiz istem yedeği.');
        }
      };
      reader.onerror = () => showError('İstem yedeği okunamadı.');
      reader.readAsText(fileObject);
    }

    function commit() {
      if (!pending || confirm.disabled) return;
      const api = library();
      const store = storage();
      if (!api?.saveItems || !store) return showError('Kütüphane cihazda kaydedilemedi.');
      if (!api.saveItems(store, pending.merged)) return showError('Kütüphane cihazda kaydedilemedi.');
      const imported = pending.accepted;
      try {
        if (typeof rootRef.StorageEvent === 'function') {
          rootRef.dispatchEvent(new rootRef.StorageEvent('storage', {
            key: api.STORAGE_KEY,
            newValue: store.getItem(api.STORAGE_KEY),
            storageArea: store
          }));
        }
      } catch { /* the import itself already succeeded */ }
      closeDialog();
      return imported;
    }

    // The library imports on the hidden file input's own `change` handler.
    // Listening in the capture phase on the card lets the preview take the
    // file first; stopImmediatePropagation keeps the direct import from
    // running behind it.
    const interceptChange = (event) => {
      const input = event.target;
      if (!input || input.type !== 'file' || !input.files?.length) return;
      const fileObject = input.files[0];
      event.preventDefault();
      event.stopImmediatePropagation();
      input.value = '';
      read(fileObject);
    };

    const trapKeydown = (event) => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [...panel.querySelectorAll('button')].filter((node) => !node.disabled && !node.hidden);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    on(card, 'change', interceptChange, true);
    on(overlay, 'keydown', trapKeydown);
    on(close, 'click', closeDialog);
    on(cancel, 'click', closeDialog);
    on(confirm, 'click', commit);

    const controller = Object.freeze({
      mounted: true,
      open: showPreview,
      close: closeDialog,
      commit,
      destroy: () => {
        for (const off of listeners.splice(0)) off();
        overlay.remove();
      }
    });
    rootRef.addEventListener?.('beforeunload', () => controller.destroy(), { once: true });
    return controller;
  }

  const api = Object.freeze({ DIALOG_ID, MAX_FILE, MAX_SAMPLE, preview, rawRecordCount, mount });
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryImportPreview = api;

  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
