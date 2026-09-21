(function installHafizeComposerAttachments(root) {
  'use strict';
  const PANEL_ID = 'composerAttachmentsPanel';
  const INPUT_ID = 'composerAttachmentInput';
  const ATTACH_BUTTON_ID = 'attachBtn';
  const MEMORY_TTL_MS = 15 * 60 * 1000;

  function policy() { return root.HafizeComposerAttachmentPolicy; }
  function make(doc, tag, textValue, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  }
  function button(doc, label, className = 'mini-btn') {
    const node = make(doc, 'button', label, className);
    node.type = 'button';
    return node;
  }
  function formatBytes(size) {
    const value = Number(size) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  function createId(file, name, size) { return `${name}:${size}:${Number(file?.lastModified || 0)}`; }

  function mount(documentRef = root.document, rootRef = root) {
    const doc = documentRef;
    const composer = doc?.getElementById?.('composer');
    const input = doc?.getElementById?.('messageInput');
    const attach = doc?.getElementById?.(ATTACH_BUTTON_ID);
    const api = policy();
    if (!doc || !composer || !input || !attach || !api) return null;
    if (doc.getElementById(PANEL_ID)) return rootRef.HafizeComposerAttachmentsController || null;

    const fileInput = doc.createElement('input');
    fileInput.type = 'file';
    fileInput.id = INPUT_ID;
    fileInput.hidden = true;
    fileInput.multiple = true;
    fileInput.accept = api.ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');
    fileInput.setAttribute('aria-label', 'Mesaja eklenecek metin veya kod dosyalarını seç');

    const panel = make(doc, 'section', undefined, 'composer-attachments-panel');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'composerAttachmentsTitle');
    const heading = make(doc, 'div', undefined, 'composer-attachments-head');
    const title = make(doc, 'strong', 'Dosya ekleri');
    title.id = 'composerAttachmentsTitle';
    const close = button(doc, 'Kapat');
    const choose = button(doc, 'Dosya seç');
    const totalHint = make(doc, 'small', 'Her ek için en fazla 400 satırlık bölüm seçilebilir.', 'composer-attachments-range-hint');
    const headingActions = make(doc, 'div', undefined, 'composer-attachments-heading-actions');
    headingActions.append(choose, close);
    heading.append(title, headingActions);
    const hint = make(doc, 'p', 'Metin/kod dosyaları cihazda okunur. İçeriği yalnız açıkça seçtiğinizde mesaja eklenir.', 'composer-attachments-hint');
    const drop = make(doc, 'div', 'Sürükle-bırak veya dosya seç', 'composer-attachments-drop');
    drop.tabIndex = 0;
    drop.setAttribute('role', 'button');
    drop.setAttribute('aria-label', 'Dosya eklemek için sürükle bırak alanı');
    const list = make(doc, 'div', undefined, 'composer-attachments-list');
    list.setAttribute('role', 'list');
    const footer = make(doc, 'div', undefined, 'composer-attachments-footer');
    const insert = button(doc, 'Seçilenleri mesaja ekle', 'soft-btn');
    const clear = button(doc, 'Tüm ekleri kaldır');
    footer.append(insert, clear);
    const status = make(doc, 'div', '', 'composer-attachments-status');
    status.id = 'composerAttachmentsStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-describedby', status.id);
    panel.append(heading, hint, drop, totalHint, list, footer, status);
    composer.after(panel);
    composer.append(fileInput);

    let items = [];
    let open = false;
    let expiryTimer = 0;
    let destroyed = false;

    const report = (message) => { status.textContent = String(message ?? '').slice(0, 220); };
    const scheduleExpiry = () => {
      rootRef.clearTimeout?.(expiryTimer);
      expiryTimer = rootRef.setTimeout?.(() => {
        items = [];
        render();
        report('Bekleyen dosya içerikleri gizlilik nedeniyle bellekten temizlendi.');
      }, MEMORY_TTL_MS) || 0;
    };
    const openPanel = () => { open = true; panel.hidden = false; attach.setAttribute('aria-expanded', 'true'); render(); };
    const closePanel = () => { open = false; panel.hidden = true; attach.setAttribute('aria-expanded', 'false'); attach.focus(); };

    function addFile(file) {
      const validation = api.validateFile(file, items);
      if (!validation.ok) {
        const messages = { type: 'desteklenmeyen tür', empty: 'boş dosya', size: '256 KB sınırı', duplicate: 'aynı dosya zaten eklendi' };
        report(`${validation.name}: ${messages[validation.reason] || 'dosya eklenemedi'}.`);
        return Promise.resolve(false);
      }
      return api.readText(file).then((raw) => {
        const content = api.normalizeContent(raw);
        if (!content) { report(`${validation.name}: okunabilir metin bulunamadı.`); return false; }
        if (api.binaryScore(content) > 0.01) { report(`${validation.name}: binary içerik olarak algılandı.`); return false; }
        if (api.totalChars(items) + content.length > api.MAX_COMBINED_CHARS) { report('Bekleyen dosya toplamı 200.000 karakteri aşamaz.'); return false; }
        items.push(Object.freeze({ id: createId(file, validation.name, validation.size), name: validation.name, size: validation.size, lastModified: Number(file.lastModified || 0), language: api.languageOf(validation.name), content, startLine: 1, endLine: Math.min(api.lineCount(content), api.MAX_RANGE_LINES), selected: true }));
        scheduleExpiry();
        render();
        return true;
      }).catch(() => { report(`${String(file?.name || 'Dosya').slice(0, 80)}: dosya okunamadı.`); return false; });
    }

    async function addFiles(files) {
      const candidates = [...(files || [])].slice(0, api.MAX_FILES);
      if (!candidates.length) return;
      openPanel();
      let added = 0;
      for (const file of candidates) {
        if (items.length >= api.MAX_FILES) break;
        if (await addFile(file)) added += 1;
      }
      report(added ? `${added} dosya eklendi.` : 'Uygun dosya eklenemedi.');
    }

    function render() {
      if (destroyed) return;
      list.replaceChildren();
      const selected = items.filter((item) => item.selected);
      const insertion = api.insertionSize(selected);
      const available = Math.max(0, Number(input.maxLength || 12000) - input.value.length);
      insert.disabled = !selected.length || insertion > Math.min(available, api.MAX_INSERT_CHARS);
      clear.disabled = !items.length;
      if (!items.length) { list.append(make(doc, 'div', 'Bekleyen dosya yok.', 'composer-attachments-empty')); report('Henüz dosya eklenmedi.'); return; }
      report(`${items.length}/${api.MAX_FILES} dosya · ${api.totalChars(items).toLocaleString('tr-TR')} karakter · seçili ek ${insertion.toLocaleString('tr-TR')} · composer boş alanı ${available.toLocaleString('tr-TR')}.`);
      items.forEach((item, index) => {
        const row = make(doc, 'article', undefined, 'composer-attachment-row');
        row.setAttribute('role', 'listitem');
        const include = doc.createElement('input');
        include.type = 'checkbox'; include.checked = item.selected; include.id = `composerAttachmentInclude${index}`;
        include.setAttribute('aria-label', `${item.name} dosyasını mesaja ekle`);
        const body = make(doc, 'div', undefined, 'composer-attachment-body');
        body.append(make(doc, 'strong', item.name, 'composer-attachment-name'));
        body.append(make(doc, 'div', `${formatBytes(item.size)} · ${item.language} · ${item.content.length.toLocaleString('tr-TR')} karakter · ${api.lineCount(item.content).toLocaleString('tr-TR')} satır`, 'composer-attachment-meta'));
        const range = make(doc, 'div', undefined, 'composer-attachment-range');
        const start = doc.createElement('input'); start.type = 'number'; start.min = '1'; start.max = String(api.MAX_LINE_NUMBER); start.value = String(item.startLine || 1); start.setAttribute('aria-label', `${item.name} başlangıç satırı`);
        const end = doc.createElement('input'); end.type = 'number'; end.min = '1'; end.max = String(api.MAX_LINE_NUMBER); end.value = String(item.endLine || Math.min(api.lineCount(item.content), api.MAX_RANGE_LINES)); end.setAttribute('aria-label', `${item.name} bitiş satırı`);
        const rangeInfo = make(doc, 'span', `${api.sliceLines(item.content, start.value, end.value).length.toLocaleString('tr-TR')} karakter seçili`, 'composer-attachment-range-info');
        const syncRange = () => { const max = api.lineCount(item.content); item.startLine = Math.max(1, Math.min(Number(start.value) || 1, max)); item.endLine = Math.max(item.startLine, Math.min(Number(end.value) || max, Math.min(max, item.startLine + api.MAX_RANGE_LINES - 1))); start.value = String(item.startLine); end.value = String(item.endLine); rangeInfo.textContent = `${api.sliceLines(item.content, item.startLine, item.endLine).length.toLocaleString('tr-TR')} karakter seçili`; render(); };
        start.addEventListener('change', syncRange); end.addEventListener('change', syncRange); range.append(make(doc, 'span', 'Satırlar'), start, make(doc, 'span', '–'), end, rangeInfo); body.append(range);
        const details = doc.createElement('details');
        const summary = make(doc, 'summary', 'Önizleme');
        const preview = make(doc, 'pre', api.previewLines(item.content).join('\n'), 'composer-attachment-preview');
        details.append(summary, preview); body.append(details);
        const remove = button(doc, 'Sil'); remove.setAttribute('aria-label', `${item.name} ekini kaldır`);
        include.addEventListener('change', () => { item.selected = include.checked; render(); });
        remove.addEventListener('click', () => { items.splice(index, 1); scheduleExpiry(); render(); });
        row.append(include, body, remove); list.append(row);
      });
    }

    function insertSelected() {
      const selected = items.filter((item) => item.selected);
      if (!selected.length) return report('Mesaja eklenecek dosya seçilmedi.');
      const payload = selected.map((item) => api.formatRangeForComposer(item, item.startLine, item.endLine)).join('');
      const available = Number(input.maxLength || 12000) - input.value.length;
      if (payload.length > available || payload.length > api.MAX_INSERT_CHARS) return report(`Dosya içeriği composer sınırına sığmıyor. Gereken ${payload.length.toLocaleString('tr-TR')}, uygun alan ${Math.max(0, available).toLocaleString('tr-TR')}.`);
      input.value += payload;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      items = items.filter((item) => !item.selected);
      if (items.length) scheduleExpiry(); else rootRef.clearTimeout?.(expiryTimer);
      render();
      report(`${selected.length} dosya içeriği mesaja eklendi. Gönderim otomatik yapılmadı.`);
      rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:composer-attachments-inserted', { detail: { count: selected.length } }));
    }

    const onAttach = () => openPanel();
    const onChoose = () => fileInput.click();
    const onDropClick = () => fileInput.click();
    const onClear = () => { items = []; rootRef.clearTimeout?.(expiryTimer); render(); report('Bekleyen ekler kaldırıldı.'); };
    const onFileChange = () => { const files = [...(fileInput.files || [])]; fileInput.value = ''; addFiles(files); };
    const onDragOver = (event) => { event.preventDefault(); drop.classList.add('drag-over'); };
    const onDragLeave = () => drop.classList.remove('drag-over');
    const onDrop = (event) => { event.preventDefault(); drop.classList.remove('drag-over'); addFiles(event.dataTransfer?.files || []); };
    const onPaste = (event) => { const files = [...(event.clipboardData?.files || [])]; if (!files.length) return; event.preventDefault(); addFiles(files); };
    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); open ? closePanel() : openPanel(); return; }
      if (event.key === 'Escape' && open) { event.preventDefault(); closePanel(); }
    };

    attach.setAttribute('aria-expanded', 'false');
    attach.addEventListener('click', onAttach);
    choose.addEventListener('click', onChoose);
    close.addEventListener('click', closePanel);
    insert.addEventListener('click', insertSelected);
    clear.addEventListener('click', onClear);
    fileInput.addEventListener('change', onFileChange);
    drop.addEventListener('click', onDropClick);
    drop.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } });
    drop.addEventListener('dragover', onDragOver); drop.addEventListener('dragleave', onDragLeave); drop.addEventListener('drop', onDrop);
    input.addEventListener('paste', onPaste); doc.addEventListener('keydown', onKeydown);

    const controller = Object.freeze({
      open: openPanel, close: closePanel, getItems: () => items.map((item) => ({ ...item })),
      addFiles, insertSelected, clear: () => { items = []; rootRef.clearTimeout?.(expiryTimer); render(); },
      getOpen: () => open, getMemoryTtlMs: () => MEMORY_TTL_MS,
      destroy: () => {
        destroyed = true; rootRef.clearTimeout?.(expiryTimer);
        attach.removeEventListener('click', onAttach); choose.removeEventListener('click', onChoose); close.removeEventListener('click', closePanel);
        insert.removeEventListener('click', insertSelected); clear.removeEventListener('click', onClear); fileInput.removeEventListener('change', onFileChange);
        drop.removeEventListener('click', onDropClick); drop.removeEventListener('dragover', onDragOver); drop.removeEventListener('dragleave', onDragLeave); drop.removeEventListener('drop', onDrop);
        input.removeEventListener('paste', onPaste); doc.removeEventListener('keydown', onKeydown); panel.remove(); fileInput.remove(); delete rootRef.HafizeComposerAttachmentsController;
      }
    });
    rootRef.HafizeComposerAttachmentsController = controller;
    render();
    return controller;
  }

  const start = () => mount(root.document, root);
  root.HafizeComposerAttachments = Object.freeze({ mount });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);