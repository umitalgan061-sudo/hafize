(function installPromptLibraryImportPreview(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryImportPreview';
  const MAX_FILE = 1000000;
  const MAX_BYTES = MAX_FILE;
  const safety = function () { return root.HafizePromptLibrarySafety; };
  const clip = function (value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; };
  const node = function (doc, tag, value, className) {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = String(value);
    return el;
  };
  const core = function () { return root.HafizePromptLibrary; };
  const normalizeImportedPayload = function (payload) {
    return core() && core().normalizeImportedPayload ? core().normalizeImportedPayload(payload) : { items: [], meta: {} };
  };
  const mergeImportedItems = function (current, incoming) {
    return core() && core().mergeImportedItems ? core().mergeImportedItems(current, incoming) : null;
  };
  const button = function (doc, label, className) {
    const el = node(doc, 'button', label, className || 'mini-btn');
    el.type = 'button';
    return el;
  };

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef && documentRef.getElementById ? documentRef.getElementById(CARD_ID) : null;
    if (!documentRef || !card || !safety() || documentRef.getElementById(PANEL_ID)) return null;

    let dialog = null;
    let previousFocus = null;
    let activePlan = null;
    let fileInput = null;

    function ensureFileInput() {
      if (fileInput && fileInput.isConnected) return fileInput;
      fileInput = card.querySelector('input[type="file"][accept*="json"]');
      return fileInput;
    }

    function clearFile() {
      if (fileInput) fileInput.value = '';
    }

    function close() {
      if (!dialog) return;
      dialog.hidden = true;
      dialog.setAttribute('aria-hidden', 'true');
      activePlan = null;
      rootRef.document && rootRef.document.body && rootRef.document.body.classList.remove('prompt-library-import-open');
      const focusTarget = previousFocus;
      previousFocus = null;
      clearFile();
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }

    function showError(message) {
      if (!dialog) createDialog();
      dialog.hidden = false;
      dialog.setAttribute('aria-hidden', 'false');
      dialog.querySelector('.prompt-import-preview-message').textContent = clip(message, 180);
      dialog.querySelector('.prompt-import-preview-body').replaceChildren();
      dialog.querySelector('.prompt-import-preview-list').replaceChildren();
      dialog.querySelector('[data-import-confirm]').disabled = true;
      dialog.querySelector('[data-import-cancel]').focus();
    }

    function renderPlan(plan, file) {
      const body = dialog.querySelector('.prompt-import-preview-body');
      const message = dialog.querySelector('.prompt-import-preview-message');
      const rows = dialog.querySelector('.prompt-import-preview-list');
      const confirm = dialog.querySelector('[data-import-confirm]');
      message.textContent = plan.validCount + ' uygun, ' + plan.invalidCount + ' geçersiz, ' + plan.collisions + ' id çakışması, ' + plan.capacitySkipped + ' kapasite dışında.';
      body.replaceChildren();
      rows.replaceChildren();

      const details = [
        ['Dosya', clip(file && file.name, 120) || 'JSON yedeği'],
        ['Dosya boyutu', Math.ceil((file && file.size || 0) / 1024) + ' KB'],
        ['Mevcut kayıt', plan.currentCount],
        ['Dosyadaki kayıt', plan.sourceCount],
        ['Aktarılacak', plan.acceptedCount],
        ['Çakışan id', plan.collisions],
        ['Geçersiz kayıt', plan.invalidCount],
        ['Kapasite dışında', plan.capacitySkipped]
      ];
      details.forEach(function (entry) {
        const row = node(documentRef, 'div', undefined, 'prompt-import-preview-stat');
        row.append(node(documentRef, 'span', entry[0], 'prompt-import-preview-label'));
        row.append(node(documentRef, 'strong', entry[1], 'prompt-import-preview-value'));
        body.append(row);
      });

      if (plan.invalidSamples && plan.invalidSamples.length) {
        body.append(node(documentRef, 'h4', 'Atlanan kayıt örnekleri', 'prompt-import-preview-subtitle'));
        plan.invalidSamples.forEach(function (item) {
          const row = node(documentRef, 'div', undefined, 'prompt-import-preview-invalid');
          row.append(node(documentRef, 'span', 'Kayıt #' + (Number(item.index) + 1), 'prompt-import-preview-invalid-index'));
          row.append(node(documentRef, 'span', item.reason, 'prompt-import-preview-invalid-reason'));
          body.append(row);
        });
      }

      if (plan.preview.length) {
        body.append(node(documentRef, 'h4', 'İlk aktarılacak istemler', 'prompt-import-preview-subtitle'));
        plan.preview.forEach(function (item) {
          const row = node(documentRef, 'article', undefined, 'prompt-import-preview-item');
          row.append(node(documentRef, 'strong', item.title, 'prompt-import-preview-item-title'));
          row.append(node(documentRef, 'span', item.bodyPreview, 'prompt-import-preview-item-body'));
          if (item.tags && item.tags.length) row.append(node(documentRef, 'span', item.tags.join(' · '), 'prompt-import-preview-item-tags'));
          rows.append(row);
        });
      }
      confirm.disabled = plan.acceptedCount === 0;
      dialog.querySelector('[data-import-cancel]').focus();
    }

    function open(file) {
      if (!file || file.size > MAX_BYTES) {
        showError('İçe aktarma dosyası 1 MB sınırını aşamaz.');
        return;
      }
      file.text().then(function (raw) {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          showError('Geçersiz JSON istem yedeği.');
          return;
        }
        const normalizedPayload = normalizeImportedPayload(parsed);
        const current = rootRef.HafizePromptLibrary && rootRef.HafizePromptLibrary.loadItems
          ? rootRef.HafizePromptLibrary.loadItems(rootRef.localStorage) : [];
        const previewMerge = mergeImportedItems(current, normalizedPayload.items);
        if (!previewMerge) {
          showError('İstem yedeği mevcut veri modeliyle uyumlu değil.');
          return;
        }
        activePlan = safety().buildImportPlan(normalizedPayload, current);
        previousFocus = documentRef.activeElement;
        if (!dialog) createDialog();
        dialog.hidden = false;
        dialog.setAttribute('aria-hidden', 'false');
        rootRef.document && rootRef.document.body && rootRef.document.body.classList.add('prompt-library-import-open');
        renderPlan(activePlan, file);
      }).catch(function () {
        showError('İstem yedeği okunamadı.');
      });
    }

    function createDialog() {
      dialog = node(documentRef, 'section', undefined, 'prompt-library-import-dialog');
      dialog.id = PANEL_ID;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-hidden', 'true');
      dialog.setAttribute('aria-labelledby', 'promptImportPreviewTitle');

      const panel = node(documentRef, 'div', undefined, 'prompt-import-preview-panel');
      const heading = node(documentRef, 'div', undefined, 'prompt-import-preview-head');
      const headingTitle = node(documentRef, 'h3', 'İçe aktarma önizlemesi', 'prompt-import-preview-title');
      headingTitle.id = 'promptImportPreviewTitle';
      const closeButton = button(documentRef, 'Kapat', 'prompt-import-preview-close');
      heading.append(headingTitle, closeButton);

      const message = node(documentRef, 'p', 'Dosya henüz seçilmedi.', 'prompt-import-preview-message');
      const body = node(documentRef, 'div', undefined, 'prompt-import-preview-body');
      const rows = node(documentRef, 'div', undefined, 'prompt-import-preview-list');
      const actions = node(documentRef, 'div', undefined, 'prompt-import-preview-actions');
      const cancel = button(documentRef, 'İptal', 'prompt-import-preview-cancel');
      const confirm = button(documentRef, 'İçe aktar', 'prompt-import-preview-confirm');
      cancel.dataset.importCancel = 'true';
      confirm.dataset.importConfirm = 'true';
      actions.append(cancel, confirm);
      panel.append(heading, message, body, rows, actions);
      dialog.append(panel);
      documentRef.body.append(dialog);

      closeButton.addEventListener('click', close);
      cancel.addEventListener('click', close);
      confirm.addEventListener('click', function () {
        if (!activePlan) return;
        const result = safety().applyImportPlan(activePlan, rootRef.localStorage);
        if (!result.ok) {
          showError('İçe aktarma kaydedilemedi. Mevcut kayıtlar korunuyor.');
          return;
        }
        try {
          if (typeof rootRef.StorageEvent === 'function') {
            rootRef.dispatchEvent(new rootRef.StorageEvent('storage', {
              key: rootRef.HafizePromptLibrary?.STORAGE_KEY || 'hafize.prompt-library.v1',
              newValue: rootRef.localStorage?.getItem?.(rootRef.HafizePromptLibrary?.STORAGE_KEY || 'hafize.prompt-library.v1') || null,
              storageArea: rootRef.localStorage
            }));
          }
        } catch {}
        close();
      });

      dialog.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusables = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
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
      });
    }

    function intercept(event) {
      const input = ensureFileInput();
      if (!input || event.target !== input) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const file = input.files && input.files[0];
      if (file) open(file);
    }

    documentRef.addEventListener('change', intercept, true);
    const observer = new MutationObserver(ensureFileInput);
    observer.observe(card, { childList: true, subtree: true });
    const beforeUnload = close;
    rootRef.addEventListener && rootRef.addEventListener('beforeunload', beforeUnload);
    ensureFileInput();

    return Object.freeze({
      mounted: true,
      open,
      close,
      destroy: function () {
        observer.disconnect();
        documentRef.removeEventListener('change', intercept, true);
        rootRef.removeEventListener && rootRef.removeEventListener('beforeunload', beforeUnload);
        dialog && dialog.remove();
      }
    });
  }

  root.HafizePromptLibraryImportPreview = Object.freeze({ mount });
  const start = function () {
    if (root.document && root.document.getElementById && root.document.getElementById(CARD_ID)) mount(root.document, root);
  };
  if (root.document && root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
