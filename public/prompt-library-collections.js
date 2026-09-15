(function installHafizePromptCollections(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.collections.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_COLLECTIONS = 24;
  const MAX_NAME = 48;
  const MAX_ASSIGNMENTS = 120;
  const MAX_SELECTION = 40;
  const DEFAULT_ID = 'general';
  const core = () => root.HafizePromptLibrary;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = () => new Date().toISOString();

  function read() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  }

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const sourceCollections = Array.isArray(source.collections) ? source.collections : [];
    const collections = [{ id: DEFAULT_ID, name: 'Genel', createdAt: '' }];
    const seen = new Set([DEFAULT_ID]);
    for (const raw of sourceCollections.slice(0, MAX_COLLECTIONS)) {
      const id = clean(raw?.id, 120);
      const name = clean(raw?.name, MAX_NAME);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      collections.push({ id, name, createdAt: clean(raw?.createdAt, 40) });
      if (collections.length >= MAX_COLLECTIONS) break;
    }
    const assignments = {};
    const sourceAssignments = source.assignments && typeof source.assignments === 'object' ? source.assignments : {};
    let count = 0;
    for (const [promptId, collectionId] of Object.entries(sourceAssignments)) {
      const p = clean(promptId, 120);
      const c = clean(collectionId, 120);
      if (!p || !seen.has(c)) continue;
      assignments[p] = c;
      count += 1;
      if (count >= MAX_ASSIGNMENTS) break;
    }
    return { version: 1, collections, assignments };
  }

  function load() { return normalize(read()); }
  function save(value) {
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); return true; }
    catch { return false; }
  }
  function emit(type, detail) { try { root.dispatchEvent?.(new root.CustomEvent(type, { detail })); } catch {} }
  function collectionOf(promptId, data = load()) {
    const id = clean(promptId, 120);
    const assigned = data.assignments[id];
    return data.collections.some((item) => item.id === assigned) ? assigned : DEFAULT_ID;
  }
  function create(name) {
    const value = clean(name, MAX_NAME);
    if (!value) return null;
    const data = load();
    if (data.collections.length >= MAX_COLLECTIONS) return null;
    if (data.collections.some((item) => item.name.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) return null;
    const item = { id: makeId(), name: value, createdAt: now() };
    data.collections.push(item);
    if (!save(data)) return null;
    emit('hafize:prompt-library-collections-changed', item);
    return item;
  }
  function rename(id, name) {
    if (id === DEFAULT_ID) return false;
    const value = clean(name, MAX_NAME);
    if (!value) return false;
    const data = load();
    const item = data.collections.find((candidate) => candidate.id === id);
    if (!item || data.collections.some((candidate) => candidate.id !== id && candidate.name.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) return false;
    item.name = value;
    if (!save(data)) return false;
    emit('hafize:prompt-library-collections-changed', item);
    return true;
  }
  function remove(id) {
    if (id === DEFAULT_ID) return false;
    const data = load();
    if (!data.collections.some((item) => item.id === id)) return false;
    data.collections = data.collections.filter((item) => item.id !== id);
    for (const key of Object.keys(data.assignments)) if (data.assignments[key] === id) delete data.assignments[key];
    const ok = save(data);
    if (ok) emit('hafize:prompt-library-collections-changed', { id });
    return ok;
  }
  function assign(promptId, collectionId) {
    const data = load();
    const p = clean(promptId, 120);
    const c = data.collections.some((item) => item.id === collectionId) ? collectionId : DEFAULT_ID;
    if (!p) return false;
    if (c === DEFAULT_ID) delete data.assignments[p]; else data.assignments[p] = c;
    const ok = save(data);
    if (ok) emit('hafize:prompt-library-collections-changed', { promptId: p, collectionId: c });
    return ok;
  }
  function assignMany(promptIds, collectionId) {
    const ids = [...new Set((Array.isArray(promptIds) ? promptIds : []).map((value) => clean(value, 120)).filter(Boolean))].slice(0, MAX_SELECTION);
    let changed = 0;
    for (const id of ids) if (assign(id, collectionId)) changed += 1;
    return changed;
  }
  function filterItems(items, collectionId) {
    const id = clean(collectionId, 120);
    if (!id || id === 'all') return Array.isArray(items) ? items.slice() : [];
    const data = load();
    if (!data.collections.some((item) => item.id === id)) return [];
    return (Array.isArray(items) ? items : []).filter((item) => collectionOf(item.id, data) === id);
  }

  function button(doc, label, action, className = 'mini-btn') {
    const node = doc.createElement('button');
    node.type = 'button'; node.textContent = label; node.className = className; node.dataset.collectionAction = action; node.setAttribute('aria-label', label);
    return node;
  }
  function refreshSelect(select, selected) {
    const data = load(); select.replaceChildren();
    const all = root.document.createElement('option'); all.value = 'all'; all.textContent = 'Tüm koleksiyonlar'; select.append(all);
    for (const item of data.collections) { const option = root.document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option); }
    select.value = data.collections.some((item) => item.id === selected) || selected === 'all' ? selected : 'all';
  }
  let mounted = false;
  let observer = null;
  let filter = 'all';
  let toolbar = null;
  function updateRows() {
    const card = root.document?.getElementById?.(CARD_ID);
    if (!card) return;
    const data = load();
    for (const row of card.querySelectorAll('.prompt-item')) {
      const id = row.dataset.promptId;
      if (!id) continue;
      const actions = row.querySelector('.prompt-item-actions');
      const previous = row.querySelector('.prompt-collection-select');
      previous?.remove();
      const select = root.document.createElement('select');
      select.className = 'prompt-collection-select'; select.setAttribute('aria-label', 'İstemin koleksiyonunu seç'); select.dataset.collectionPrompt = id;
      for (const item of data.collections) { const option = root.document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option); }
      select.value = collectionOf(id, data);
      select.addEventListener('change', () => assign(id, select.value));
      actions?.append(select);
      row.hidden = filter !== 'all' && collectionOf(id, data) !== filter;
    }
  }
  function openManager() {
    const existing = root.document.getElementById('promptCollectionManager'); existing?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptCollectionManager'; dialog.className = 'prompt-collection-dialog';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptCollectionTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-collection-dialog-shell';
    const head = root.document.createElement('div'); head.className = 'prompt-collection-dialog-head';
    const title = root.document.createElement('strong'); title.id = 'promptCollectionTitle'; title.textContent = 'Koleksiyonları yönet';
    const close = button(root.document, 'Kapat', 'close'); head.append(title, close);
    const createRow = root.document.createElement('div'); createRow.className = 'prompt-collection-create';
    const input = root.document.createElement('input'); input.maxLength = MAX_NAME; input.placeholder = 'Yeni koleksiyon'; input.setAttribute('aria-label', 'Yeni koleksiyon adı');
    const add = button(root.document, 'Ekle', 'add'); createRow.append(input, add);
    const list = root.document.createElement('div'); list.className = 'prompt-collection-list';
    const status = root.document.createElement('div'); status.className = 'prompt-collection-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    shell.append(head, createRow, list, status); dialog.append(shell); root.document.body.append(dialog);
    function render() {
      list.replaceChildren();
      for (const item of load().collections) {
        const row = root.document.createElement('div'); row.className = 'prompt-collection-row';
        const name = root.document.createElement('strong'); name.textContent = item.name; row.append(name);
        if (item.id !== DEFAULT_ID) {
          const renameButton = button(root.document, 'Adlandır', 'rename'); renameButton.dataset.collectionId = item.id;
          const deleteButton = button(root.document, 'Sil', 'delete'); deleteButton.dataset.collectionId = item.id;
          row.append(renameButton, deleteButton);
        }
        list.append(row);
      }
    }
    render(); close.focus?.();
    close.addEventListener('click', () => dialog.remove());
    add.addEventListener('click', () => { const item = create(input.value); status.textContent = item ? `“${item.name}” oluşturuldu.` : 'Koleksiyon oluşturulamadı.'; render(); updateRows(); refreshToolbar(); input.focus(); });
    dialog.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-collection-action]'); if (!target) return;
      const action = target.dataset.collectionAction; const id = target.dataset.collectionId;
      if (action === 'close' || action === 'add' || !id) return;
      if (action === 'rename') {
        const current = load().collections.find((item) => item.id === id); const next = root.prompt?.('Yeni koleksiyon adı:', current?.name || '');
        if (next !== null) status.textContent = rename(id, next) ? 'Koleksiyon adlandırıldı.' : 'Ad değiştirilemedi.';
      }
      if (action === 'delete') {
        const current = load().collections.find((item) => item.id === id);
        if (current && root.confirm?.(`“${current.name}” silinsin mi? İstemler Genel koleksiyonuna döner.`)) status.textContent = remove(id) ? 'Koleksiyon silindi.' : 'Koleksiyon silinemedi.';
      }
      render(); updateRows(); refreshToolbar();
    });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function refreshToolbar() {
    if (!toolbar) return;
    const select = toolbar.querySelector('select'); if (select) refreshSelect(select, filter);
  }
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || card.querySelector('.prompt-collection-toolbar')) return;
    toolbar = root.document.createElement('div'); toolbar.className = 'prompt-collection-toolbar';
    const label = root.document.createElement('span'); label.className = 'prompt-collection-toolbar-label'; label.textContent = 'Koleksiyon';
    const select = root.document.createElement('select'); select.setAttribute('aria-label', 'Koleksiyona göre filtrele'); refreshSelect(select, filter);
    const manage = button(root.document, 'Yönet', 'manage'); toolbar.append(label, select, manage);
    card.querySelector('.prompt-workspace-toolbar, .prompt-library-enhancement-toolbar, .prompt-library-filters')?.after(toolbar);
    select.addEventListener('change', () => { filter = select.value; updateRows(); });
    manage.addEventListener('click', openManager);
    updateRows();
  }
  function boot() {
    if (mounted || !root.document || !core()) return;
    if (!root.document.getElementById(CARD_ID)) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(() => inject()) : null;
    observer?.observe(root.document.getElementById(CARD_ID), { childList: true, subtree: true });
    inject();
    root.addEventListener?.('hafize:prompt-library-changed', inject);
    root.addEventListener?.('hafize:prompt-library-collections-changed', updateRows);
  }
  root.HafizePromptLibraryCollections = Object.freeze({ STORAGE_KEY, DEFAULT_ID, MAX_COLLECTIONS, load, save, collectionOf, create, rename, remove, assign, assignMany, filterItems });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
