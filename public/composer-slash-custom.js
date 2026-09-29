(function installHafizeComposerSlashCustom(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.composer.slash.custom.v1';
  const MAX_ITEMS = 30;
  const MAX_KEY = 32;
  const MAX_LABEL = 64;
  const MAX_DESCRIPTION = 160;
  const MAX_TEMPLATE = 6000;
  const MAX_FILE = 300_000;

  const api = () => root.HafizeComposerSlashCommands;
  const now = () => new Date().toISOString();
  const makeId = () => root.crypto?.randomUUID?.() || `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function clean(value, limit) {
    return typeof value === 'string'
      ? value.trim().replace(/[\\u0000\\r\\n]/g, ' ').slice(0, limit)
      : '';
  }

  function read() {
    try {
      const raw = root.localStorage?.getItem(STORAGE_KEY) || '[]';
      const value = JSON.parse(raw);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function normalize(input) {
    const key = clean(input?.key, MAX_KEY).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9_-]/g, '');
    const label = clean(input?.label, MAX_LABEL);
    const description = clean(input?.description, MAX_DESCRIPTION);
    const templateText = typeof input?.templateText === 'string'
      ? input.templateText.replace(/\\0/g, '').slice(0, MAX_TEMPLATE)
      : '';
    if (!key || !label || !templateText) return null;
    return Object.freeze({
      id: clean(input?.id, 120) || makeId(),
      key,
      label,
      description: description || 'Özel slash komutu',
      templateText,
      createdAt: clean(input?.createdAt, 40) || now(),
      updatedAt: clean(input?.updatedAt, 40) || now()
    });
  }

  function list() {
    const output = [];
    const keys = new Set();
    for (const item of read().slice(0, MAX_ITEMS * 2)) {
      const normalized = normalize(item);
      if (!normalized || keys.has(normalized.key)) continue;
      keys.add(normalized.key);
      output.push(normalized);
      if (output.length >= MAX_ITEMS) break;
    }
    return output;
  }

  function save(items) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
      return true;
    } catch {
      return false;
    }
  }

  function find(key) {
    const normalized = clean(key, MAX_KEY).toLocaleLowerCase('tr-TR');
    return list().find((item) => item.key === normalized) || null;
  }

  function text(doc, value, className = '') {
    const node = doc.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value ?? '');
    return node;
  }

  function button(doc, label, className = 'mini-btn') {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    return node;
  }

  function input(doc, label, value, maxLength) {
    const field = doc.createElement('input');
    field.type = 'text';
    field.value = value || '';
    field.maxLength = maxLength;
    field.setAttribute('aria-label', label);
    return field;
  }

  function install() {
    const documentRef = root.document;
    const slash = api();
    const menu = documentRef?.getElementById?.('composerSlashMenu');
    const composer = documentRef?.getElementById?.('composer');
    if (!documentRef || !slash || !menu || !composer || documentRef.getElementById('composerSlashCustomManager')) return null;

    const manageButton = button(documentRef, '⚙ Özel komutlar');
    manageButton.className = 'mini-btn composer-slash-custom-toggle';
    menu.append(manageButton);

    const panel = documentRef.createElement('section');
    panel.id = 'composerSlashCustomManager';
    panel.className = 'composer-slash-custom-manager';
    panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'composerSlashCustomTitle');

    const header = documentRef.createElement('div');
    header.className = 'composer-slash-custom-head';
    const title = documentRef.createElement('strong');
    title.id = 'composerSlashCustomTitle';
    title.textContent = 'Özel slash komutları';
    const close = button(documentRef, 'Kapat');
    header.append(title, close);

    const listNode = documentRef.createElement('div');
    listNode.className = 'composer-slash-custom-list';
    listNode.setAttribute('role', 'list');

    const actionBar = documentRef.createElement('div');
    actionBar.className = 'composer-slash-custom-actions';
    const add = button(documentRef, '＋ Yeni');
    const exportButton = button(documentRef, 'Dışa aktar');
    const importButton = button(documentRef, 'İçe aktar');
    actionBar.append(add, exportButton, importButton);

    const editor = documentRef.createElement('div');
    editor.className = 'composer-slash-custom-editor';
    editor.hidden = true;

    const status = documentRef.createElement('div');
    status.className = 'composer-slash-custom-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const file = documentRef.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;

    panel.append(header, listNode, actionBar, editor, file, status);
    composer.append(panel);

    let editing = null;

    function report(message) {
      status.textContent = clean(message, 180);
      root.setTimeout?.(() => { if (status.textContent === clean(message, 180)) status.textContent = ''; }, 3000);
    }

    function refreshRegistry(items) {
      for (const existing of api().listCommands().filter((entry) => entry.custom === true)) api().unregisterCommand(existing.key);
      for (const item of items) api().registerCommand(item);
      root.dispatchEvent?.(new root.CustomEvent('hafize:composer-slash-custom-changed'));
    }

    function renderList() {
      const items = list();
      listNode.replaceChildren();
      if (!items.length) {
        listNode.append(text(documentRef, 'Henüz özel komut yok.', 'composer-slash-custom-empty'));
        return;
      }
      for (const item of items) {
        const row = documentRef.createElement('article');
        row.className = 'composer-slash-custom-row';
        row.dataset.customCommand = item.key;
        row.setAttribute('role', 'listitem');
        const key = text(documentRef, '/' + item.key, 'composer-slash-custom-key');
        const label = text(documentRef, item.label, 'composer-slash-custom-label');
        const description = text(documentRef, item.description, 'composer-slash-custom-description');
        const edit = button(documentRef, 'Düzenle');
        const remove = button(documentRef, 'Sil');
        edit.addEventListener('click', () => openEditor(item));
        remove.addEventListener('click', () => {
          if (!root.confirm?.('Bu özel slash komutu silinsin mi?')) return;
          const next = list().filter((candidate) => candidate.id !== item.id);
          if (!save(next)) return report('Komut kaydedilemedi.');
          refreshRegistry(next);
          renderList();
          report('Özel komut silindi.');
        });
        row.append(key, label, description, edit, remove);
        listNode.append(row);
      }
    }

    function openEditor(item) {
      editing = item || null;
      editor.hidden = false;
      editor.replaceChildren();
      const key = input(documentRef, 'Komut anahtarı', item?.key || '', MAX_KEY);
      const label = input(documentRef, 'Komut etiketi', item?.label || '', MAX_LABEL);
      const description = input(documentRef, 'Komut açıklaması', item?.description || '', MAX_DESCRIPTION);
      const template = documentRef.createElement('textarea');
      template.rows = 7;
      template.maxLength = MAX_TEMPLATE;
      template.value = item?.templateText || '';
      template.setAttribute('aria-label', 'Komut şablonu');
      const hint = text(documentRef, '{{konu}} kullanırsan komuttan sonra yazılan ifade bu değişkene yerleşir.', 'composer-slash-custom-hint');
      const saveButton = button(documentRef, item ? 'Güncelle' : 'Kaydet', 'soft-btn');
      const cancel = button(documentRef, 'Vazgeç');
      const fields = documentRef.createElement('div');
      fields.className = 'composer-slash-custom-fields';
      fields.append(
        text(documentRef, 'Anahtar'), key,
        text(documentRef, 'Etiket'), label,
        text(documentRef, 'Açıklama'), description,
        text(documentRef, 'Şablon'), template,
        hint
      );
      const actions = documentRef.createElement('div');
      actions.className = 'composer-slash-custom-editor-actions';
      actions.append(saveButton, cancel);
      editor.append(fields, actions);
      cancel.addEventListener('click', () => { editor.hidden = true; editor.replaceChildren(); editing = null; });
      saveButton.addEventListener('click', () => {
        const normalized = normalize({
          id: item?.id,
          key: key.value,
          label: label.value,
          description: description.value,
          templateText: template.value,
          createdAt: item?.createdAt,
          updatedAt: now()
        });
        if (!normalized) return report('Anahtar, etiket ve şablon boş olamaz.');
        const builtIn = slash.commandByKey(normalized.key);
        if (builtIn && builtIn.custom !== true) return report('Bu anahtar yerleşik bir komut tarafından kullanılıyor.');
        const current = list().filter((candidate) => candidate.id !== item?.id);
        if (current.some((candidate) => candidate.key === normalized.key)) return report('Bu anahtar zaten kullanılıyor.');
        if (!item && current.length >= MAX_ITEMS) return report(`En fazla ${MAX_ITEMS} özel komut oluşturabilirsiniz.`);
        const next = [normalized, ...current].slice(0, MAX_ITEMS);
        if (!save(next)) return report('Özel komut kaydedilemedi.');
        refreshRegistry(next);
        editing = null;
        editor.hidden = true;
        editor.replaceChildren();
        renderList();
        report(item ? 'Özel komut güncellendi.' : 'Özel komut oluşturuldu.');
      });
      key.focus();
    }

    function exportCommands() {
      const payload = JSON.stringify({ version: 1, source: 'hafize-composer-slash-custom', exportedAt: now(), commands: list() }, null, 2);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = documentRef.createElement('a');
      link.href = url;
      link.download = 'hafize-slash-commands.json';
      link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      report('Özel komut yedeği dışa aktarıldı.');
    }

    function importCommands(fileObject) {
      if (!fileObject || fileObject.size > MAX_FILE) return report('Özel komut yedeği 300 KB sınırını aşamaz.');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const incoming = Array.isArray(parsed?.commands) ? parsed.commands.map(normalize).filter(Boolean) : [];
          const current = list();
          const merged = [...current];
          const keys = new Set(current.map((item) => item.key));
          let imported = 0;
          for (const item of incoming) {
            const existing = slash.commandByKey(item.key);
            if (merged.length >= MAX_ITEMS || keys.has(item.key) || (existing && existing.custom !== true)) continue;
            merged.push(item);
            keys.add(item.key);
            imported += 1;
          }
          if (!save(merged)) return report('İçe aktarılan komutlar kaydedilemedi.');
          refreshRegistry(merged);
          renderList();
          report(`${imported} özel komut içe aktarıldı.`);
        } catch { report('Geçersiz özel komut yedeği.'); }
      };
      reader.onerror = () => report('Özel komut yedeği okunamadı.');
      reader.readAsText(fileObject);
    }

    manageButton.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderList();
      if (!panel.hidden) documentRef.getElementById('composerSlashMenu').hidden = true;
    });
    close.addEventListener('click', () => { panel.hidden = true; });
    add.addEventListener('click', () => openEditor(null));
    exportButton.addEventListener('click', exportCommands);
    importButton.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { const selected = file.files?.[0]; file.value = ''; importCommands(selected); });
    root.addEventListener?.('hafize:composer-slash-menu-opened', () => { if (!panel.hidden) panel.hidden = true; });

    const initial = list();
    refreshRegistry(initial);
    renderList();

    return Object.freeze({
      mounted: true,
      list,
      normalize,
      save,
      exportCommands,
      importCommands,
      destroy: () => panel.remove()
    });
  }

  root.HafizeComposerSlashCustom = Object.freeze({ STORAGE_KEY, MAX_ITEMS, MAX_KEY, MAX_LABEL, MAX_DESCRIPTION, MAX_TEMPLATE, MAX_FILE, normalize, list, save, install });

  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self);
