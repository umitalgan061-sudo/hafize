(function exposeHafizePromptImportPreview(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryImportPreview = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizePromptImportPreview(root) {
  'use strict';

  // Importing a backup used to write straight into the library: the file was read
  // and merged in one step, so a wrong file was only visible after it had already
  // landed. This layer steps in front of that change event, shows what the file
  // would do, and only then hands the prompts to the library's own writer.

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryImportPreview';
  const MAX_FILE = 1000000;
  const MAX_ROWS = 40;
  const MAX_NAME = 90;

  const KIND_LABEL = Object.freeze({
    new: 'Yeni',
    copy: 'Kopya',
    skipped: 'Atlanan',
    invalid: 'Geçersiz'
  });
  const KIND_BADGE = Object.freeze({ new: '+', copy: '±', skipped: '–', invalid: '!' });

  function core() {
    return root.HafizePromptLibrary;
  }

  function storage() {
    try { return root.localStorage; } catch { return null; }
  }

  function clip(value, limit) {
    return String(value ?? '').slice(0, limit);
  }

  function make(documentRef, tag, textValue, className) {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function button(documentRef, label, className = 'soft-btn') {
    const node = make(documentRef, 'button', label, className);
    node.type = 'button';
    return node;
  }

  /**
   * What the file would do to the library, without doing it.
   *
   * `mergeImportedItems` never overwrites: a prompt whose id is already taken is
   * re-keyed and kept alongside the existing one, and anything past the library's
   * item ceiling is dropped. The preview names both outcomes instead of reporting
   * a single "imported" number after the fact.
   */
  function analyze(currentItems, incoming) {
    const library = core();
    const limit = library?.LIMITS?.maxItems ?? 120;
    const existing = Array.isArray(currentItems) ? currentItems : [];
    const ids = new Set(existing.map((item) => item?.id));
    const rows = [];
    let total = 0;
    let added = 0;
    let copies = 0;
    let skipped = 0;
    let invalid = 0;
    let room = Math.max(0, limit - existing.length);

    for (const raw of Array.isArray(incoming) ? incoming : []) {
      total += 1;
      const item = library?.normalizeItem?.(raw) ?? null;
      if (!item) {
        invalid += 1;
        rows.push({ kind: 'invalid', name: clip(raw?.title ?? 'Okunamayan kayıt', MAX_NAME) });
        continue;
      }
      if (room <= 0) {
        skipped += 1;
        rows.push({ kind: 'skipped', name: clip(item.title, MAX_NAME) });
        continue;
      }
      room -= 1;
      if (ids.has(item.id)) {
        copies += 1;
        rows.push({ kind: 'copy', name: clip(item.title, MAX_NAME) });
      } else {
        ids.add(item.id);
        added += 1;
        rows.push({ kind: 'new', name: clip(item.title, MAX_NAME) });
      }
    }

    return { total, added, copies, skipped, invalid, importable: added + copies, rows };
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const overlay = make(documentRef, 'div', undefined, 'prompt-library-import-preview');
    overlay.id = PANEL_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'promptLibraryImportPreviewTitle');
    overlay.setAttribute('aria-describedby', 'promptLibraryImportPreviewMeta');

    const panel = make(documentRef, 'div', undefined, 'prompt-library-import-preview-panel');
    const header = make(documentRef, 'div', undefined, 'prompt-library-import-preview-header');
    const title = make(documentRef, 'h3', 'İçe aktarma önizlemesi');
    title.id = 'promptLibraryImportPreviewTitle';
    const close = button(documentRef, 'Kapat', 'mini-btn');
    close.setAttribute('aria-label', 'İçe aktarma önizlemesini kapat');
    header.append(title, close);

    const meta = make(documentRef, 'p', '', 'prompt-library-import-preview-meta');
    meta.id = 'promptLibraryImportPreviewMeta';
    const summary = make(documentRef, 'div', undefined, 'prompt-library-import-preview-summary');
    const list = make(documentRef, 'div', undefined, 'prompt-library-import-preview-list');
    list.setAttribute('role', 'list');
    const note = make(
      documentRef,
      'p',
      'Kimliği çakışan istemler mevcut kaydın üzerine yazılmaz; kopya olarak eklenir.',
      'prompt-library-import-preview-note'
    );
    const feedback = make(documentRef, 'p', '', 'prompt-library-import-preview-feedback');
    feedback.setAttribute('role', 'status');

    const actions = make(documentRef, 'div', undefined, 'prompt-library-import-preview-actions');
    const cancel = button(documentRef, 'Vazgeç');
    const confirm = button(documentRef, 'İçe aktar');
    confirm.disabled = true;
    actions.append(cancel, confirm);

    panel.append(header, meta, summary, list, note, feedback, actions);
    overlay.append(panel);
    card.append(overlay);

    let pending = null;
    let lastFocus = null;

    function renderSummary(report) {
      summary.replaceChildren();
      const stats = [
        ['Toplam', report.total],
        ['Yeni', report.added],
        ['Kopya', report.copies],
        ['Atlanan', report.skipped],
        ['Geçersiz', report.invalid]
      ];
      for (const [label, value] of stats) {
        const stat = make(documentRef, 'div', undefined, 'prompt-library-import-stat');
        stat.append(make(documentRef, 'strong', String(value)), make(documentRef, 'span', label));
        summary.append(stat);
      }
    }

    function renderRows(report) {
      list.replaceChildren();
      if (!report.rows.length) {
        list.append(make(documentRef, 'p', 'Dosyada istem bulunamadı.', 'prompt-library-import-preview-empty'));
        return;
      }
      for (const row of report.rows.slice(0, MAX_ROWS)) {
        const item = make(documentRef, 'div', undefined, 'prompt-library-import-preview-item');
        item.setAttribute('role', 'listitem');
        item.dataset.importKind = row.kind;
        const badge = make(documentRef, 'span', KIND_BADGE[row.kind] ?? '?', 'prompt-library-import-preview-badge');
        badge.setAttribute('aria-label', KIND_LABEL[row.kind] ?? 'Bilinmiyor');
        item.append(badge, make(documentRef, 'span', row.name, 'prompt-library-import-preview-name'));
        list.append(item);
      }
      if (report.rows.length > MAX_ROWS) {
        list.append(make(
          documentRef,
          'p',
          `${report.rows.length - MAX_ROWS} kayıt daha listede gösterilmiyor.`,
          'prompt-library-import-preview-more'
        ));
      }
    }

    function closeDialog() {
      overlay.hidden = true;
      pending = null;
      list.replaceChildren();
      summary.replaceChildren();
      feedback.textContent = '';
      confirm.disabled = true;
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      lastFocus = null;
    }

    function open(report, fileName, meta_) {
      pending = report;
      lastFocus = documentRef.activeElement;
      const source = meta_?.source ? ` · ${clip(meta_.source, 40)}` : '';
      meta.textContent = `${clip(fileName || 'yedek.json', 80)}${source} · ${report.importable} istem içe aktarılacak`;
      renderSummary(report);
      renderRows(report);
      feedback.textContent = report.importable ? '' : 'Bu dosyada içe aktarılabilir istem yok.';
      confirm.disabled = report.importable === 0;
      overlay.hidden = false;
      close.focus();
    }

    function applyImport() {
      const library = core();
      const store = storage();
      if (!pending || !library?.loadItems || !library.mergeImportedItems || !library.saveItems || !store) {
        feedback.textContent = 'İstem kitaplığı bu tarayıcıda yazılamıyor.';
        return;
      }
      const merged = library.mergeImportedItems(library.loadItems(store), pending.incoming);
      if (!library.saveItems(store, merged.items)) {
        feedback.textContent = 'İstemler kaydedilemedi.';
        return;
      }
      // The library repaints from its own storage listener, so the write is
      // announced the same way another tab would announce it.
      try {
        const detail = { key: library.STORAGE_KEY, newValue: JSON.stringify(merged.items), storageArea: store };
        if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
      } catch { /* the prompts are stored even when the repaint cannot be signalled */ }
      closeDialog();
    }

    function readFile(fileObject) {
      if (!fileObject) return;
      if (fileObject.size > MAX_FILE) {
        lastFocus = documentRef.activeElement;
        overlay.hidden = false;
        meta.textContent = clip(fileObject.name, 80);
        summary.replaceChildren();
        list.replaceChildren();
        feedback.textContent = 'İçe aktarma dosyası 1 MB sınırını aşamaz.';
        confirm.disabled = true;
        close.focus();
        return;
      }
      const reader = new (rootRef.FileReader || FileReader)();
      reader.onload = () => {
        const library = core();
        try {
          const parsed = library.normalizeImportedPayload(JSON.parse(String(reader.result || '')));
          const store = storage();
          const current = store && library.loadItems ? library.loadItems(store) : [];
          const report = analyze(current, parsed.items);
          report.incoming = parsed.items;
          open(report, fileObject.name, parsed.meta);
        } catch {
          lastFocus = documentRef.activeElement;
          overlay.hidden = false;
          meta.textContent = clip(fileObject.name, 80);
          summary.replaceChildren();
          list.replaceChildren();
          feedback.textContent = 'Geçersiz istem yedeği.';
          confirm.disabled = true;
          close.focus();
        }
      };
      reader.onerror = () => { feedback.textContent = 'İstem yedeği okunamadı.'; };
      reader.readAsText(fileObject);
    }

    /**
     * The library binds its own `change` handler on the hidden file input. A
     * capture-phase listener on the card runs first, so stopping propagation
     * here keeps the direct import from happening behind the preview.
     */
    function interceptChange(event) {
      const target = event.target;
      if (!target || target.type !== 'file' || !card.contains(target)) return;
      const fileObject = target.files?.[0];
      if (!fileObject) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      readFile(fileObject);
      target.value = '';
    }

    function trapKeydown(event) {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...overlay.querySelectorAll('button,input,select,a[href]')]
        .filter((node) => !node.hidden && !node.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    card.addEventListener('change', interceptChange, true);
    overlay.addEventListener('keydown', trapKeydown);
    close.addEventListener('click', closeDialog);
    cancel.addEventListener('click', closeDialog);
    confirm.addEventListener('click', applyImport);

    return Object.freeze({
      mounted: true,
      open,
      close: closeDialog,
      analyze,
      destroy: () => {
        card.removeEventListener('change', interceptChange, true);
        closeDialog();
        overlay.remove();
      }
    });
  }

  const api = Object.freeze({ MAX_FILE, MAX_ROWS, analyze, mount });
  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
  return api;
});
