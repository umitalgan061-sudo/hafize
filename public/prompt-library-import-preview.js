/**
 * Prompt Library — import preview.
 *
 * `İçe aktar` used to merge a backup the moment the file was chosen. This layer
 * takes the file first, shows what the merge would do (how many records the file
 * carries, how many survive normalisation, how many ids have to be re-keyed and
 * how much of it does not fit the library's capacity) and only writes after the
 * user confirms. Nothing leaves the device: the file is read locally and the
 * merge goes through the Prompt Library core's own normaliser.
 */
(function installPromptLibraryImportPreview(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const DIALOG_ID = 'promptLibraryImportPreview';
  const MAX_FILE = 1000000;
  const MAX_SAMPLES = 8;
  const MAX_TITLE = 80;

  const core = () => root.HafizePromptLibrary;
  const storage = () => {
    try { return root.localStorage; } catch { return null; }
  };

  const element = (doc, tag, textValue, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue ?? '');
    return node;
  };

  const button = (doc, label, className = 'soft-btn') => {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
  };

  const clip = (value, limit) => String(value ?? '').slice(0, limit);

  /** Records the file claims to carry, before the library normaliser runs. */
  function rawCount(payload) {
    if (Array.isArray(payload)) return payload.length;
    if (payload && typeof payload === 'object' && Array.isArray(payload.items)) return payload.items.length;
    return 0;
  }

  /**
   * What the merge would do, computed without touching storage: the library
   * core does the normalising and the re-keying, so the numbers here are the
   * ones the user will actually get.
   */
  function planImport(currentItems, payload) {
    const api = core();
    const parsed = api?.normalizeImportedPayload?.(payload) ?? { items: [], meta: {} };
    const merged = api?.mergeImportedItems?.(currentItems, parsed.items) ?? { items: currentItems, imported: 0 };
    const existingIds = new Set(currentItems.map((item) => item.id));
    const rekeyed = parsed.items.filter((item) => existingIds.has(item.id)).length;
    const total = rawCount(payload);
    const valid = parsed.items.length;
    return {
      total,
      valid,
      skipped: Math.max(0, total - valid),
      rekeyed,
      imported: merged.imported,
      overflow: Math.max(0, valid - merged.imported),
      items: merged.items,
      samples: parsed.items.slice(0, MAX_SAMPLES).map((item) => clip(item.title || 'Adsız istem', MAX_TITLE)),
      meta: parsed.meta || {}
    };
  }

  function statTile(doc, value, label) {
    const tile = element(doc, 'div', undefined, 'prompt-library-import-stat');
    tile.append(element(doc, 'strong', value), element(doc, 'span', label));
    return tile;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    const input = card?.querySelector?.('input[type="file"]');
    if (!documentRef || !card || !input || documentRef.getElementById(DIALOG_ID)) return null;

    const dialog = element(documentRef, 'div', undefined, 'prompt-library-import-preview');
    dialog.id = DIALOG_ID;
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptLibraryImportPreviewTitle');

    const panel = element(documentRef, 'div', undefined, 'prompt-library-import-preview-panel');
    const header = element(documentRef, 'div', undefined, 'prompt-library-import-preview-header');
    const title = element(documentRef, 'h3', 'İçe aktarma önizlemesi');
    title.id = 'promptLibraryImportPreviewTitle';
    const close = button(documentRef, 'Kapat', 'mini-btn');
    close.setAttribute('aria-label', 'İçe aktarma önizlemesini kapat');
    header.append(title, close);

    const summary = element(documentRef, 'div', undefined, 'prompt-library-import-preview-summary');
    const meta = element(documentRef, 'p', '', 'prompt-library-import-preview-meta');
    const list = element(documentRef, 'div', undefined, 'prompt-library-import-preview-list');
    const note = element(
      documentRef,
      'p',
      'Aktarım yalnızca onayladığında yazılır. Mevcut istemler korunur; aynı id taşıyan kayıtlar yeni id ile eklenir.',
      'prompt-library-import-preview-note'
    );
    const feedback = element(documentRef, 'p', '', 'prompt-library-import-preview-feedback');
    feedback.setAttribute('role', 'status');

    const actions = element(documentRef, 'div', undefined, 'prompt-library-import-preview-actions');
    const cancel = button(documentRef, 'Vazgeç');
    const confirm = button(documentRef, 'Aktar', 'primary-btn');
    actions.append(cancel, confirm);

    panel.append(header, summary, meta, list, note, feedback, actions);
    dialog.append(panel);
    card.append(dialog);

    let plan = null;
    let lastFocus = null;

    const closeDialog = () => {
      dialog.hidden = true;
      summary.replaceChildren();
      list.replaceChildren();
      meta.textContent = '';
      plan = null;
      input.value = '';
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      lastFocus = null;
    };

    const renderPlan = (current) => {
      summary.replaceChildren(
        statTile(documentRef, current.total, 'Dosyada'),
        statTile(documentRef, current.valid, 'Geçerli'),
        statTile(documentRef, current.skipped, 'Atlanan'),
        statTile(documentRef, current.rekeyed, 'Yeni id'),
        statTile(documentRef, current.overflow, 'Kapasite dışı')
      );
      meta.textContent = current.meta.source
        ? `Kaynak: ${clip(current.meta.source, 80)}${current.meta.exportedAt ? ` · ${clip(current.meta.exportedAt, 40)}` : ''}`
        : 'Kaynak bilgisi olmayan bir yedek.';
      list.replaceChildren();
      if (!current.samples.length) {
        list.append(element(documentRef, 'p', 'Aktarılabilecek istem bulunamadı.', 'prompt-library-import-preview-empty'));
      } else {
        current.samples.forEach((name, index) => {
          const row = element(documentRef, 'div', undefined, 'prompt-library-import-preview-item');
          row.append(
            element(documentRef, 'span', String(index + 1)),
            element(documentRef, 'span', name, 'prompt-library-import-preview-name')
          );
          list.append(row);
        });
        if (current.valid > current.samples.length) {
          list.append(element(
            documentRef,
            'p',
            `ve ${current.valid - current.samples.length} istem daha`,
            'prompt-library-import-preview-more'
          ));
        }
      }
      confirm.disabled = current.imported === 0;
      feedback.textContent = current.imported === 0
        ? 'Bu dosyadan aktarılacak yeni istem yok.'
        : `${current.imported} istem aktarılacak.`;
    };

    const openWith = (fileObject) => {
      const api = core();
      if (!api?.normalizeImportedPayload || !api.mergeImportedItems) return;
      if (!fileObject) return;
      if (fileObject.size > MAX_FILE) {
        lastFocus = documentRef.activeElement;
        dialog.hidden = false;
        summary.replaceChildren();
        list.replaceChildren();
        confirm.disabled = true;
        feedback.textContent = 'İçe aktarma dosyası 1 MB sınırını aşamaz.';
        close.focus();
        return;
      }
      const reader = new rootRef.FileReader();
      reader.onload = () => {
        lastFocus = documentRef.activeElement;
        try {
          const payload = JSON.parse(String(reader.result || ''));
          plan = planImport(api.loadItems?.(storage()) ?? [], payload);
          dialog.hidden = false;
          renderPlan(plan);
        } catch {
          plan = null;
          dialog.hidden = false;
          summary.replaceChildren();
          list.replaceChildren();
          confirm.disabled = true;
          feedback.textContent = 'Geçersiz istem yedeği. Mevcut kütüphane değişmedi.';
        }
        close.focus();
      };
      reader.onerror = () => {
        plan = null;
        dialog.hidden = false;
        confirm.disabled = true;
        feedback.textContent = 'İstem yedeği okunamadı. Mevcut kütüphane değişmedi.';
      };
      reader.readAsText(fileObject);
    };

    // The library card imports as soon as the input changes, so the preview has
    // to win the event: it listens in the capture phase and stops the original
    // handler from seeing a change it would apply without asking.
    const onChange = (event) => {
      if (event.target !== input) return;
      const fileObject = input.files?.[0];
      if (!fileObject) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      openWith(fileObject);
    };

    const applyImport = () => {
      const api = core();
      const store = storage();
      if (!plan || !api?.saveItems || !store) return closeDialog();
      if (!api.saveItems(store, plan.items)) {
        feedback.textContent = 'İstemler kaydedilemedi.';
        return;
      }
      // Same-tab writes do not emit a storage event, and the library card
      // repaints from one, so the merge is announced explicitly.
      try {
        const detail = { key: api.STORAGE_KEY, newValue: JSON.stringify(plan.items), storageArea: store };
        if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
      } catch { /* the prompts are stored; a missed repaint is not fatal */ }
      closeDialog();
    };

    const onKeydown = (event) => {
      if (dialog.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...dialog.querySelectorAll('button')].filter((node) => !node.disabled && !node.hidden);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    card.addEventListener('change', onChange, true);
    dialog.addEventListener('keydown', onKeydown);
    close.addEventListener('click', closeDialog);
    cancel.addEventListener('click', closeDialog);
    confirm.addEventListener('click', applyImport);

    return Object.freeze({
      mounted: true,
      open: openWith,
      close: closeDialog,
      destroy: () => {
        card.removeEventListener('change', onChange, true);
        dialog.remove();
      }
    });
  }

  const api = Object.freeze({ MAX_FILE, MAX_SAMPLES, planImport, rawCount, mount });
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryImportPreview = api;

  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
