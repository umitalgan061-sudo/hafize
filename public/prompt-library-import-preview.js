/* Prompt Library import preview.
 *
 * `İçe aktar` used to merge a backup into the library the moment a file was
 * chosen, with no way back: a file that repeated ids, overflowed the 120 prompt
 * capacity or was not a library export at all was only discoverable afterwards.
 * This module intercepts that change event, computes the merge in memory and
 * shows what the import would do, so the write only happens on a deliberate
 * confirmation.
 *
 * Everything happens on the device: the file is read with FileReader and the
 * result is written back through the core library's own `saveItems`. */
(function installPromptImportPreview(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryImportPreview';
  const TITLE_ID = 'promptLibraryImportPreviewTitle';
  const MAX_FILE = 1000000;
  const MAX_SAMPLES = 8;
  const MAX_TITLE = 80;

  const core = () => root.HafizePromptLibrary;
  const clip = (value, limit) => String(value ?? '').slice(0, limit);

  // The document is threaded through rather than read off the global, the same
  // way the core library builds its card, so the panel can be mounted on a
  // stand-in document.
  function element(doc, tag, text, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(doc, label, className = 'soft-btn') {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
  }

  function stat(doc, value, label) {
    const cell = element(doc, 'div', undefined, 'prompt-library-import-stat');
    cell.append(element(doc, 'strong', String(value)), element(doc, 'span', label));
    return cell;
  }

  /**
   * What importing `incoming` into `current` would do, without writing.
   * `mergeImportedItems` re-keys repeated ids and stops at the capacity limit,
   * so the difference between what the file offers and what the merge reports
   * is exactly what would not fit.
   */
  function describeMerge(current, incoming) {
    const api = core();
    const merged = api.mergeImportedItems(current, incoming);
    const existing = new Set(current.map((item) => item.id));
    const duplicates = incoming.filter((item) => existing.has(item.id)).length;
    return {
      items: merged.items,
      imported: merged.imported,
      duplicates,
      dropped: Math.max(0, incoming.length - merged.imported)
    };
  }

  function mount(documentRef = root.document, rootRef = root) {
    // Everything below reads the host window through `rootRef`, so a suite can
    // mount the panel on a stand-in window instead of the real global.
    const store = () => {
      try { return rootRef.localStorage; } catch { return null; }
    };
    const card = documentRef?.getElementById(CARD_ID);
    const input = card?.querySelector('input[type="file"]');
    if (!card || !input || card.dataset.importPreviewReady === 'true') return null;
    card.dataset.importPreviewReady = 'true';

    let overlay = null;
    let lastFocus = null;
    let pending = null;

    const close = () => {
      overlay?.remove();
      overlay = null;
      pending = null;
      if (typeof lastFocus?.focus === 'function') lastFocus.focus();
      lastFocus = null;
    };

    const trapKeydown = (event) => {
      if (!overlay) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...overlay.querySelectorAll('button')].filter((node) => !node.disabled);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    /** Writes the merged library and tells the open panel to repaint. */
    function commit() {
      const api = core();
      const current = store();
      if (!pending || !api || !current) return false;
      if (!api.saveItems(current, pending.items)) return false;
      try {
        const detail = { key: api.STORAGE_KEY, newValue: JSON.stringify(pending.items), storageArea: current };
        if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
      } catch {
        // The prompts are saved either way; only the live repaint is lost.
      }
      return true;
    }

    function open(summary, meta) {
      close();
      lastFocus = documentRef.activeElement;
      pending = summary;

      overlay = element(documentRef, 'div', undefined, 'prompt-library-import-preview');
      overlay.id = PANEL_ID;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', TITLE_ID);

      const panel = element(documentRef, 'div', undefined, 'prompt-library-import-preview-panel');
      const header = element(documentRef, 'div', undefined, 'prompt-library-import-preview-header');
      const title = element(documentRef, 'h3', 'İçe aktarma önizlemesi');
      title.id = TITLE_ID;
      const dismiss = button(documentRef, 'Kapat', 'mini-btn');
      dismiss.setAttribute('aria-label', 'İçe aktarma önizlemesini kapat');
      header.append(title, dismiss);

      const totals = element(documentRef, 'div', undefined, 'prompt-library-import-preview-summary');
      totals.append(
        stat(documentRef, summary.total, 'dosyadaki kayıt'),
        stat(documentRef, summary.valid, 'geçerli kayıt'),
        stat(documentRef, summary.imported, 'aktarılacak'),
        stat(documentRef, summary.duplicates, 'yinelenen id'),
        stat(documentRef, summary.dropped, 'kapasite dışı')
      );

      const metaLine = element(
        documentRef,
        'p',
        meta.source || meta.exportedAt
          ? `Kaynak: ${clip(meta.source || 'bilinmiyor', 80)} · Tarih: ${clip(meta.exportedAt || 'bilinmiyor', 40)}`
          : 'Dosyada kaynak bilgisi yok.',
        'prompt-library-import-preview-meta'
      );

      const list = element(documentRef, 'div', undefined, 'prompt-library-import-preview-list');
      if (summary.samples.length) {
        summary.samples.forEach((sample, index) => {
          const row = element(documentRef, 'div', undefined, 'prompt-library-import-preview-item');
          row.append(element(documentRef, 'span', String(index + 1)), element(documentRef, 'span', sample, 'prompt-library-import-preview-name'));
          list.append(row);
        });
        if (summary.valid > summary.samples.length) {
          list.append(element(documentRef, 'div', `ve ${summary.valid - summary.samples.length} kayıt daha`, 'prompt-library-import-preview-more'));
        }
      } else {
        list.append(element(documentRef, 'div', 'Dosyada içe aktarılabilir istem bulunamadı.', 'prompt-library-import-preview-empty'));
      }

      const note = element(
        documentRef,
        'p',
        'Yinelenen id taşıyan kayıtlar yeni id ile eklenir; mevcut istemlerin üzerine yazılmaz. Onaylamadan hiçbir değişiklik kaydedilmez.',
        'prompt-library-import-preview-note'
      );
      const feedback = element(documentRef, 'p', '', 'prompt-library-import-preview-feedback');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');

      const actions = element(documentRef, 'div', undefined, 'prompt-library-import-preview-actions');
      const cancel = button(documentRef, 'Vazgeç');
      const confirm = button(documentRef, 'İçe aktar');
      // Nothing to import means nothing to confirm, so the action stays off
      // instead of writing the library back unchanged.
      confirm.disabled = summary.imported === 0;
      actions.append(cancel, confirm);

      panel.append(header, totals, metaLine, list, note, feedback, actions);
      overlay.append(panel);
      documentRef.body.append(overlay);

      dismiss.addEventListener('click', close);
      cancel.addEventListener('click', close);
      confirm.addEventListener('click', () => {
        if (commit()) close();
        else feedback.textContent = 'İstemler cihazda kaydedilemedi.';
      });
      overlay.addEventListener('keydown', trapKeydown);
      overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
      (confirm.disabled ? cancel : confirm).focus();
    }

    function report(message) {
      const status = card.querySelector('.prompt-library-status');
      if (status) status.textContent = clip(message, 180);
    }

    function preview(file) {
      const api = core();
      const current = store();
      if (!api || !current) return report('İstem kütüphanesi hazır değil.');
      if (!file) return;
      // Checked before reading, so an oversized file is never pulled into memory.
      if (file.size > MAX_FILE) return report('İçe aktarma dosyası 1 MB sınırını aşamaz.');
      const reader = new rootRef.FileReader();
      reader.onerror = () => report('İstem yedeği okunamadı.');
      reader.onload = () => {
        let raw;
        try {
          raw = JSON.parse(String(reader.result || ''));
        } catch {
          return report('Geçersiz istem yedeği.');
        }
        const parsed = api.normalizeImportedPayload(raw);
        // Counted from the file rather than from the normalizer, so the summary
        // can show how many records were dropped as unreadable.
        const total = Array.isArray(raw) ? raw.length : (Array.isArray(raw?.items) ? raw.items.length : 0);
        const merge = describeMerge(api.loadItems(current), parsed.items);
        open({
          total,
          valid: parsed.items.length,
          imported: merge.imported,
          duplicates: merge.duplicates,
          dropped: merge.dropped,
          items: merge.items,
          samples: parsed.items.slice(0, MAX_SAMPLES).map((item) => clip(item.title, MAX_TITLE))
        }, parsed.meta || {});
      };
      reader.readAsText(file);
    }

    function interceptChange(event) {
      if (event.target !== input) return;
      // The core library imports straight from this event; the preview replaces
      // that path, so its handler must not also run.
      event.stopImmediatePropagation();
      const file = input.files?.[0];
      input.value = '';
      preview(file);
    }

    card.addEventListener('change', interceptChange, true);

    return Object.freeze({
      mounted: true,
      preview,
      close,
      destroy: () => {
        close();
        card.removeEventListener('change', interceptChange, true);
        delete card.dataset.importPreviewReady;
      }
    });
  }

  const api = Object.freeze({ MAX_FILE, describeMerge, mount });
  // Exported the same way as the core library, so a suite can require it in
  // Node and drive the real merge preview instead of a copy of it.
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptImportPreview = api;
  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
