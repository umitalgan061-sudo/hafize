(function installPromptLibraryCollections(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.collections.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_COLLECTIONS = 24;
  const MAX_NAME = 48;
  const MAX_ASSIGNMENTS = 120;
  const DEFAULT_ID = 'general';
  const core = () => root.HafizePromptLibrary;

  const trim = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function read() {
    try {
      const value = JSON.parse(root.localStorage?.getItem?.(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function normalize(value) {
    const data = value && typeof value === 'object' ? value : {};
    const source = Array.isArray(data.collections) ? data.collections : [];
    const collections = [{ id: DEFAULT_ID, name: 'Genel', createdAt: '' }];
    const seen = new Set([DEFAULT_ID]);
    for (const raw of source.slice(0, MAX_COLLECTIONS)) {
      const id = trim(raw?.id, 120);
      const name = trim(raw?.name, MAX_NAME);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      collections.push({ id, name, createdAt: trim(raw?.createdAt, 40) });
      if (collections.length >= MAX_COLLECTIONS) break;
    }
    const assignments = {};
    const input = data.assignments && typeof data.assignments === 'object' ? data.assignments : {};
    let count = 0;
    for (const [promptId, collectionId] of Object.entries(input)) {
      if (!promptId || !seen.has(collectionId)) continue;
      assignments[trim(promptId, 120)] = collectionId;
      count += 1;
      if (count >= MAX_ASSIGNMENTS) break;
    }
    return { version: 1, collections, assignments };
  }

  function load() { return normalize(read()); }

  function save(value) {
    try {
      root.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(normalize(value)));
      return true;
    } catch {
      return false;
    }
  }

  function collectionOf(promptId, data = load()) {
    const id = data.assignments?.[promptId];
    return data.collections.some((item) => item.id === id) ? id : DEFAULT_ID;
  }

  function setCollection(promptId, collectionId) {
    const data = load();
    const valid = data.collections.some((item) => item.id === collectionId) ? collectionId : DEFAULT_ID;
    if (valid === DEFAULT_ID) delete data.assignments[promptId];
    else data.assignments[trim(promptId, 120)] = valid;
    if (!save(data)) return false;
    sync();
    return true;
  }

  function createCollection(name) {
    const clean = trim(name, MAX_NAME);
    if (!clean) return null;
    const data = load();
    if (data.collections.length >= MAX_COLLECTIONS) return null;
    if (data.collections.some((item) => item.name.toLocaleLowerCase('tr-TR') === clean.toLocaleLowerCase('tr-TR'))) return null;
    const item = { id: makeId(), name: clean, createdAt: new Date().toISOString() };
    data.collections.push(item);
    if (!save(data)) return null;
    sync();
    return item;
  }

  function renameCollection(id, name) {
    if (id === DEFAULT_ID) return false;
    const clean = trim(name, MAX_NAME);
    if (!clean) return false;
    const data = load();
    const item = data.collections.find((candidate) => candidate.id === id);
    if (!item || data.collections.some((candidate) => candidate.id !== id && candidate.name.toLocaleLowerCase('tr-TR') === clean.toLocaleLowerCase('tr-TR'))) return false;
    item.name = clean;
    const ok = save(data);
    if (ok) sync();
    return ok;
  }

  function removeCollection(id) {
    if (id === DEFAULT_ID) return false;
    const data = load();
    if (!data.collections.some((item) => item.id === id)) return false;
    data.collections = data.collections.filter((item) => item.id !== id);
    Object.keys(data.assignments).forEach((promptId) => { if (data.assignments[promptId] === id) delete data.assignments[promptId]; });
    const ok = save(data);
    if (ok) sync();
    return ok;
  }

  function sync() {
    try {
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-collections-changed', { detail: load() }));
    } catch {}
  }

  function createElement(doc, tag, text, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function actionButton(doc, text, action) {
    const node = createElement(doc, 'button', text, 'mini-btn prompt-collection-action');
    node.type = 'button';
    node.dataset.collectionAction = action;
    return node;
  }

  function collectionLabel(id, data) {
    return data.collections.find((item) => item.id === id)?.name || 'Genel';
  }

  function populateFilter(select, selected) {
    const data = load();
    select.replaceChildren();
    for (const optionData of [{ id: 'all', name: 'Tüm koleksiyonlar' }, ...data.collections]) {
      const option = createElement(root.document, 'option', optionData.name);
      option.value = optionData.id;
      select.append(option);
    }
    select.value = data.collections.some((item) => item.id === selected) || selected === 'all' ? selected : 'all';
  }

  function rowSelect(doc, promptId, selectedId) {
    const select = doc.createElement('select');
    select.className = 'prompt-collection-select';
    select.setAttribute('aria-label', 'İstemin koleksiyonu');
    const data = load();
    data.collections.forEach((item) => {
      const option = createElement(doc, 'option', item.name);
      option.value = item.id;
      select.append(option);
    });
    select.value = selectedId;
    select.dataset.collectionPrompt = promptId;
    select.addEventListener('change', () => {
      if (setCollection(promptId, select.value)) renderRows();
      else select.value = selectedId;
    });
    return select;
  }

  let card = null;
  let observer = null;
  let filter = 'all';
  let manageDialog = null;
  let mounted = false;

  function getVisibleRows() {
    return [...(card?.querySelectorAll?.('.prompt-item') || [])];
  }

  function renderRows() {
    if (!card) return;
    const data = load();
    const rows = getVisibleRows();
    rows.forEach((row) => {
      const promptId = row.dataset.promptId;
      if (!promptId) return;
      row.querySelector('.prompt-collection-select')?.remove();
      const actions = row.querySelector('.prompt-item-actions');
      if (!actions) return;
      const selectedId = collectionOf(promptId, data);
      if (filter !== 'all' && selectedId !== filter) row.hidden = true;
      else row.hidden = false;
      const picker = rowSelect(root.document, promptId, selectedId);
      actions.append(picker);
    });
    updateBulkSummary();
  }

  function updateBulkSummary() {
    if (!card) return;
    let bar = card.querySelector('.prompt-library-collection-bulk');
    const selected = [...card.querySelectorAll('[data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection).filter(Boolean).slice(0, 40);
    if (!selected.length) { bar?.remove(); return; }
    if (!bar) {
      bar = createElement(root.document, 'div', undefined, 'prompt-library-collection-bulk');
      card.querySelector('#promptLibraryList')?.before(bar);
      const select = root.document.createElement('select');
      select.setAttribute('aria-label', 'Seçilen istemleri koleksiyona taşı');
      bar.append(select);
      populateFilter(select, 'general');
      select.dataset.collectionBulk = 'true';
      select.addEventListener('change', () => {
        if (select.value === 'all') return;
        const data = load();
        selected.forEach((promptId) => {
          if (select.value === DEFAULT_ID) delete data.assignments[promptId];
          else data.assignments[promptId] = select.value;
        });
        if (save(data)) { sync(); renderRows(); }
      });
    }
  }

  function renderManageDialog() {
    if (!manageDialog) return;
    const body = manageDialog.querySelector('.prompt-collection-manage-body');
    if (!body) return;
    body.replaceChildren();
    const data = load();
    data.collections.forEach((item) => {
      const row = createElement(root.document, 'div', undefined, 'prompt-collection-manage-row');
      const name = createElement(root.document, 'span', item.name);
      row.append(name);
      if (item.id !== DEFAULT_ID) {
        row.append(actionButton(root.document, 'Yeniden adlandır', 'rename'));
        row.lastChild.dataset.collectionId = item.id;
        row.append(actionButton(root.document, 'Sil', 'delete'));
        row.lastChild.dataset.collectionId = item.id;
      }
      body.append(row);
    });
    const input = manageDialog.querySelector('[data-collection-new-name]');
    if (input) input.value = '';
  }

  function openManage() {
    if (manageDialog) { manageDialog.remove(); manageDialog = null; }
    manageDialog = createElement(root.document, 'section', undefined, 'prompt-collection-dialog');
    manageDialog.setAttribute('role', 'dialog');
    manageDialog.setAttribute('aria-modal', 'true');
    manageDialog.setAttribute('aria-labelledby', 'promptCollectionManageTitle');
    const shell = createElement(root.document, 'div', undefined, 'prompt-collection-dialog-shell');
    const head = createElement(root.document, 'div', undefined, 'prompt-collection-dialog-head');
    const title = createElement(root.document, 'strong', 'Koleksiyonları yönet');
    title.id = 'promptCollectionManageTitle';
    const close = actionButton(root.document, 'Kapat', 'close');
    head.append(title, close);
    const form = createElement(root.document, 'div', undefined, 'prompt-collection-create');
    const input = root.document.createElement('input');
    input.maxLength = MAX_NAME; input.placeholder = 'Yeni koleksiyon adı'; input.setAttribute('aria-label', 'Yeni koleksiyon adı'); input.dataset.collectionNewName = 'true';
    const add = actionButton(root.document, 'Ekle', 'add');
    form.append(input, add);
    const body = createElement(root.document, 'div', undefined, 'prompt-collection-manage-body');
    const status = createElement(root.document, 'div', '', 'prompt-collection-manage-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    shell.append(head, form, body, status); manageDialog.append(shell); root.document.body.append(manageDialog);
    renderManageDialog();
    close.focus?.();
    close.addEventListener('click', () => { manageDialog?.remove(); manageDialog = null; });
    add.addEventListener('click', () => {
      const item = createCollection(input.value);
      status.textContent = item ? `“${item.name}” oluşturuldu.` : 'Koleksiyon oluşturulamadı.';
      renderManageDialog(); renderRows(); refreshFilter();
      input.focus();
    });
    manageDialog.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-collection-action]');
      if (!target || target.dataset.collectionAction === 'close' || target.dataset.collectionAction === 'add') return;
      const id = target.dataset.collectionId;
      if (!id) return;
      if (target.dataset.collectionAction === 'rename') {
        const current = load().collections.find((item) => item.id === id);
        const next = root.prompt?.('Yeni koleksiyon adı:', current?.name || '');
        if (next === null) return;
        status.textContent = renameCollection(id, next) ? 'Koleksiyon yeniden adlandırıldı.' : 'Koleksiyon adı güncellenemedi.';
      } else if (target.dataset.collectionAction === 'delete') {
        const current = load().collections.find((item) => item.id === id);
        if (!current || !root.confirm?.(`“${current.name}” silinsin mi? İstemler Genel koleksiyonuna döner.`)) return;
        status.textContent = removeCollection(id) ? 'Koleksiyon silindi.' : 'Koleksiyon silinemedi.';
      }
      renderManageDialog(); renderRows(); refreshFilter();
    });
    manageDialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); manageDialog.remove(); manageDialog = null; } });
  }

  function refreshFilter() {
    const select = card?.querySelector?.('.prompt-collection-filter');
    if (!select) return;
    populateFilter(select, filter);
  }

  function injectToolbar() {
    if (!card || card.querySelector('.prompt-collection-toolbar')) return;
    const row = createElement(root.document, 'div', undefined, 'prompt-collection-toolbar');
    const label = createElement(root.document, 'span', 'Koleksiyon', 'prompt-collection-toolbar-label');
    const select = root.document.createElement('select');
    select.className = 'prompt-collection-filter';
    select.setAttribute('aria-label', 'Koleksiyona göre filtrele');
    populateFilter(select, filter);
    const manage = actionButton(root.document, 'Koleksiyonları yönet', 'manage');
    row.append(label, select, manage);
    card.querySelector('.prompt-library-enhancement-toolbar, .prompt-library-filters')?.after(row);
    select.addEventListener('change', () => { filter = select.value; renderRows(); });
    manage.addEventListener('click', openManage);
  }

  function enhance() {
    if (!card) return;
    injectToolbar();
    renderRows();
  }

  function boot() {
    if (mounted || !root.document || !core()) return;
    card = root.document.getElementById(CARD_ID);
    if (!card) return;
    mounted = true;
    observer = new MutationObserver(() => enhance());
    observer.observe(card, { childList: true, subtree: true });
    root.addEventListener?.('hafize:prompt-library-collections-changed', enhance);
    enhance();
  }

  const api = Object.freeze({ STORAGE_KEY, DEFAULT_ID, MAX_COLLECTIONS, load, save, collectionOf, setCollection, createCollection, renameCollection, removeCollection });
  root.HafizePromptLibraryCollections = api;
  const start = () => boot();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
