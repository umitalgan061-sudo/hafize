// TypeScript migration wave: compiled through Vite/Rolldown.\n// The browser-global surface is kept stable for compatibility with sibling modules.\n// @ts-nocheck\n(function installPromptLibraryCollections(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.collections.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const MAX_COLLECTIONS = 40;
  const MAX_MEMBERS = 120;
  const MAX_NAME = 80;
  const MAX_DESCRIPTION = 240;
  const MAX_QUERY = 100;
  const PANEL_ID = 'promptLibraryCollections';
  const PREVIEW_LIMIT = 80;

  const text = (doc, value, className = '') => {
    const node = doc.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value ?? '');
    return node;
  };

  const button = (doc, label, className = 'mini-btn') => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    return node;
  };

  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const isoNow = () => new Date().toISOString();
  const clip = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

  function normalizeCollection(input) {
    if (!input || typeof input !== 'object') return null;
    const name = clip(input.name, MAX_NAME);
    if (!name) return null;
    const members = Array.isArray(input.promptIds) ? [...new Set(input.promptIds.filter((id) => typeof id === 'string').map((id) => id.slice(0, 120)))].slice(0, MAX_MEMBERS) : [];
    const createdAt = clip(input.createdAt, 40) || isoNow();
    const updatedAt = clip(input.updatedAt, 40) || createdAt;
    return {
      id: clip(input.id, 120) || makeId(),
      name,
      description: clip(input.description, MAX_DESCRIPTION),
      color: clip(input.color, 32) || 'default',
      promptIds: members,
      createdAt,
      updatedAt
    };
  }

  function normalizeCollections(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const ids = new Set();
    for (const raw of value.slice(0, MAX_COLLECTIONS * 2)) {
      const collection = normalizeCollection(raw);
      if (!collection || ids.has(collection.id)) continue;
      ids.add(collection.id);
      output.push(collection);
      if (output.length >= MAX_COLLECTIONS) break;
    }
    return output;
  }

  function readCollections(storage = root.localStorage) {
    try {
      const raw = storage?.getItem?.(STORAGE_KEY);
      return normalizeCollections(raw ? JSON.parse(raw) : []);
    } catch {
      return [];
    }
  }

  function saveCollections(storage, collections) {
    try {
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalizeCollections(collections)));
      return true;
    } catch {
      return false;
    }
  }

  function readPromptIds(storage = root.localStorage) {
    try {
      const raw = storage?.getItem?.(PROMPT_KEY);
      const prompts = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(prompts) ? prompts.filter((item) => item && typeof item.id === 'string').map((item) => item.id) : []);
    } catch {
      return new Set();
    }
  }

  function pruneMembers(collections, storage) {
    const promptIds = readPromptIds(storage);
    return normalizeCollections(collections).map((collection) => normalizeCollection({
      ...collection,
      promptIds: collection.promptIds.filter((id) => promptIds.has(id))
    }));
  }

  function createCollection(input, storage = root.localStorage) {
    const collections = pruneMembers(readCollections(storage), storage);
    if (collections.length >= MAX_COLLECTIONS) return null;
    const candidate = normalizeCollection({ ...input, id: makeId(), createdAt: isoNow(), updatedAt: isoNow() });
    if (!candidate) return null;
    const lowerName = candidate.name.toLocaleLowerCase('tr-TR');
    if (collections.some((item) => item.name.toLocaleLowerCase('tr-TR') === lowerName)) return null;
    collections.unshift(candidate);
    return saveCollections(storage, collections) ? candidate : null;
  }

  function updateCollection(id, patch, storage = root.localStorage) {
    const collections = pruneMembers(readCollections(storage), storage);
    const index = collections.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = collections[index];
    const next = normalizeCollection({ ...current, ...patch, id: current.id, updatedAt: isoNow() });
    if (!next) return null;
    const lowerName = next.name.toLocaleLowerCase('tr-TR');
    if (collections.some((item, itemIndex) => itemIndex !== index && item.name.toLocaleLowerCase('tr-TR') === lowerName)) return null;
    collections.splice(index, 1, next);
    return saveCollections(storage, collections) ? next : null;
  }

  function deleteCollection(id, storage = root.localStorage) {
    const collections = pruneMembers(readCollections(storage), storage);
    const next = collections.filter((item) => item.id !== id);
    return next.length !== collections.length && saveCollections(storage, next);
  }

  function setMembership(collectionId, promptIds, storage = root.localStorage) {
    const collections = pruneMembers(readCollections(storage), storage);
    const index = collections.findIndex((item) => item.id === collectionId);
    if (index < 0) return null;
    const allowed = readPromptIds(storage);
    const members = [...new Set(Array.isArray(promptIds) ? promptIds : [])]
      .filter((id) => typeof id === 'string' && allowed.has(id)).slice(0, MAX_MEMBERS);
    const updated = normalizeCollection({ ...collections[index], promptIds: members, updatedAt: isoNow() });
    collections.splice(index, 1, updated);
    return saveCollections(storage, collections) ? updated : null;
  }

  function addMembers(collectionId, promptIds, storage = root.localStorage) {
    const collections = pruneMembers(readCollections(storage), storage);
    const current = collections.find((item) => item.id === collectionId);
    if (!current) return null;
    return setMembership(collectionId, [...current.promptIds, ...(Array.isArray(promptIds) ? promptIds : [])], storage);
  }

  function removeMembers(collectionId, promptIds, storage = root.localStorage) {
    const current = readCollections(storage).find((item) => item.id === collectionId);
    if (!current) return null;
    const remove = new Set(Array.isArray(promptIds) ? promptIds : []);
    return setMembership(collectionId, current.promptIds.filter((id) => !remove.has(id)), storage);
  }

  function collectionMatches(collection, query) {
    if (!query) return true;
    const value = query.toLocaleLowerCase('tr-TR');
    return [collection.name, collection.description].join('\n').toLocaleLowerCase('tr-TR').includes(value);
  }

  function exportPayload(storage = root.localStorage) {
    const collections = pruneMembers(readCollections(storage), storage);
    return JSON.stringify({ version: 1, source: 'hafize-prompt-library-collections', exportedAt: isoNow(), collections }, null, 2);
  }

  function importPayload(payload, storage = root.localStorage) {
    if (!payload || typeof payload !== 'object') return { imported: 0, skipped: 0 };
    const incoming = normalizeCollections(payload.collections);
    const current = pruneMembers(readCollections(storage), storage);
    const existingNames = new Set(current.map((item) => item.name.toLocaleLowerCase('tr-TR')));
    let imported = 0;
    let skipped = 0;
    for (const item of incoming) {
      if (current.length >= MAX_COLLECTIONS) { skipped += 1; continue; }
      if (existingNames.has(item.name.toLocaleLowerCase('tr-TR'))) { skipped += 1; continue; }
      const next = normalizeCollection({ ...item, id: makeId(), createdAt: isoNow(), updatedAt: isoNow() });
      current.push(next);
      existingNames.add(next.name.toLocaleLowerCase('tr-TR'));
      imported += 1;
    }
    saveCollections(storage, current);
    return { imported, skipped };
  }

  function dispatchChanged() {
    try { root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-collections-changed')); } catch {}
  }

  function promptRows(doc) {
    return [...doc.querySelectorAll('#promptLibraryList .prompt-item[data-prompt-id]')];
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.('promptLibraryCard');
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-collections';
    section.setAttribute('aria-labelledby', 'promptLibraryCollectionsTitle');

    const header = documentRef.createElement('div');
    header.className = 'prompt-library-collections-head';
    const title = documentRef.createElement('strong');
    title.id = 'promptLibraryCollectionsTitle';
    title.textContent = 'Koleksiyonlar';
    const status = text(documentRef, '', 'prompt-library-collections-status');
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    header.append(title, status, collapse);

    const body = documentRef.createElement('div');
    body.className = 'prompt-library-collections-body';

    const search = documentRef.createElement('input');
    search.type = 'search';
    search.maxLength = MAX_QUERY;
    search.placeholder = 'Koleksiyon ara…';
    search.setAttribute('aria-label', 'Koleksiyonlarda ara');

    const create = button(documentRef, '＋ Koleksiyon');
    const exportButton = button(documentRef, 'Dışa aktar');
    const importButton = button(documentRef, 'İçe aktar');
    const createRow = documentRef.createElement('div');
    createRow.className = 'prompt-library-collections-toolbar';
    createRow.append(search, create, exportButton, importButton);

    const list = documentRef.createElement('div');
    list.className = 'prompt-library-collections-list';
    list.setAttribute('role', 'list');

    const assignment = documentRef.createElement('div');
    assignment.className = 'prompt-library-collections-assignment';
    assignment.hidden = true;
    const assignmentTitle = text(documentRef, 'Seçili istemleri koleksiyona ekle', 'prompt-library-collections-assignment-title');
    const select = documentRef.createElement('select');
    select.setAttribute('aria-label', 'Hedef koleksiyon');
    const assign = button(documentRef, 'Ekle');
    const remove = button(documentRef, 'Çıkar');
    assignment.append(assignmentTitle, select, assign, remove);

    body.append(createRow, list, assignment);
    section.append(header, body);
    card.append(section);

    let hidden = false;
    let activeId = '';
    let lastSelection = [];
    let fileInput = null;

    function setStatus(message) {
      status.textContent = clip(message, 160);
      rootRef.setTimeout?.(() => { if (status.textContent === message) status.textContent = ''; }, 2600);
    }

    function selectedPromptIds() {
      return [...card.querySelectorAll('[data-prompt-selection]:checked')]
        .map((node) => node.dataset.promptSelection)
        .filter(Boolean)
        .slice(0, 40);
    }

    function renderAssignment() {
      lastSelection = selectedPromptIds();
      assignment.hidden = !lastSelection.length;
      select.replaceChildren();
      for (const collection of readCollections()) {
        const option = documentRef.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        select.append(option);
      }
    }

    function renderCollections() {
      const query = clip(search.value, MAX_QUERY);
      const collections = readCollections().filter((collection) => collectionMatches(collection, query));
      list.replaceChildren();
      if (!collections.length) {
        list.append(text(documentRef, query ? 'Eşleşen koleksiyon yok.' : 'Henüz koleksiyon yok.', 'prompt-library-collections-empty'));
        renderAssignment();
        return;
      }
      for (const collection of collections) {
        const row = documentRef.createElement('article');
        row.className = `prompt-library-collection-row${activeId === collection.id ? ' is-active' : ''}`;
        row.dataset.collectionId = collection.id;
        row.setAttribute('role', 'listitem');
        const info = documentRef.createElement('div');
        info.className = 'prompt-library-collection-info';
        info.append(text(documentRef, collection.name, 'prompt-library-collection-name'));
        if (collection.description) info.append(text(documentRef, collection.description, 'prompt-library-collection-description'));
        info.append(text(documentRef, `${collection.promptIds.length} istem`, 'prompt-library-collection-count'));
        const actions = documentRef.createElement('div');
        actions.className = 'prompt-library-collection-actions';
        const activate = button(documentRef, activeId === collection.id ? 'Filtreyi kaldır' : 'Filtrele');
        const edit = button(documentRef, 'Düzenle');
        const removeButton = button(documentRef, 'Sil');
        actions.append(activate, edit, removeButton);
        row.append(info, actions);
        list.append(row);

        activate.addEventListener('click', () => {
          activeId = activeId === collection.id ? '' : collection.id;
          const rows = promptRows(documentRef);
          for (const promptRow of rows) promptRow.hidden = Boolean(activeId) && !collection.promptIds.includes(promptRow.dataset.promptId);
          renderCollections();
          setStatus(activeId ? `“${collection.name}” filtresi etkin.` : 'Koleksiyon filtresi kaldırıldı.');
        });
        edit.addEventListener('click', () => {
          const nextName = rootRef.prompt?.('Koleksiyon adı:', collection.name);
          if (nextName === null || nextName === undefined) return;
          const nextDescription = rootRef.prompt?.('Açıklama:', collection.description || '');
          if (nextDescription === null || nextDescription === undefined) return;
          const updated = updateCollection(collection.id, { name: nextName, description: nextDescription });
          if (!updated) return setStatus('Koleksiyon güncellenemedi.');
          dispatchChanged();
          renderCollections();
          setStatus('Koleksiyon güncellendi.');
        });
        removeButton.addEventListener('click', () => {
          if (!rootRef.confirm?.(`“${collection.name}” silinsin mi?`)) return;
          if (!deleteCollection(collection.id)) return setStatus('Koleksiyon silinemedi.');
          if (activeId === collection.id) activeId = '';
          dispatchChanged();
          renderCollections();
          setStatus('Koleksiyon silindi.');
        });
      }
      renderAssignment();
    }

    create.addEventListener('click', () => {
      const name = rootRef.prompt?.('Koleksiyon adı:', 'Yeni koleksiyon');
      if (name === null || name === undefined) return;
      const description = rootRef.prompt?.('Açıklama:', '');
      if (description === null || description === undefined) return;
      const created = createCollection({ name, description });
      if (!created) return setStatus('Koleksiyon oluşturulamadı. Ad benzersiz ve gerekli.');
      dispatchChanged();
      renderCollections();
      setStatus('Koleksiyon oluşturuldu.');
    });

    assign.addEventListener('click', () => {
      if (!select.value || !lastSelection.length) return;
      if (!addMembers(select.value, lastSelection)) return setStatus('İstemler eklenemedi.');
      dispatchChanged();
      renderCollections();
      setStatus(`${lastSelection.length} istem koleksiyona eklendi.`);
    });

    remove.addEventListener('click', () => {
      if (!select.value || !lastSelection.length) return;
      if (!removeMembers(select.value, lastSelection)) return setStatus('İstemler çıkarılamadı.');
      dispatchChanged();
      renderCollections();
      setStatus(`${lastSelection.length} istem koleksiyondan çıkarıldı.`);
    });

    search.addEventListener('input', renderCollections);

    exportButton.addEventListener('click', () => {
      const blob = new Blob([exportPayload(rootRef.localStorage)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = documentRef.createElement('a');
      link.href = url;
      link.download = 'hafize-prompt-collections.json';
      link.click();
      rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      setStatus('Koleksiyonlar dışa aktarıldı.');
    });

    importButton.addEventListener('click', () => {
      fileInput ||= documentRef.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/json,.json';
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file || file.size > 500_000) return setStatus('Koleksiyon yedeği 500 KB sınırını aşamaz.');
        try {
          const payload = JSON.parse(await file.text());
          const result = importPayload(payload, rootRef.localStorage);
          dispatchChanged();
          renderCollections();
          setStatus(`${result.imported} koleksiyon içe aktarıldı.`);
        } catch {
          setStatus('Geçersiz koleksiyon yedeği.');
        }
        fileInput.value = '';
      };
      fileInput.click();
    });

    const onToggle = () => {
      hidden = !hidden;
      body.hidden = hidden;
      collapse.textContent = hidden ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!hidden));
    };
    collapse.addEventListener('click', onToggle);

    const onSelection = () => renderAssignment();
    const onExternalChange = () => renderCollections();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(onSelection) : null;
    observer?.observe(card, { childList: true, subtree: true });
    rootRef.addEventListener?.('hafize:prompt-library-collections-changed', onExternalChange);
    renderCollections();

    return Object.freeze({
      mounted: true,
      refresh: renderCollections,
      getCollections: () => readCollections(rootRef.localStorage),
      destroy: () => {
        observer?.disconnect();
        rootRef.removeEventListener?.('hafize:prompt-library-collections-changed', onExternalChange);
        section.remove();
      }
    });
  }

  const api = Object.freeze({
    STORAGE_KEY,
    MAX_COLLECTIONS,
    MAX_MEMBERS,
    normalizeCollection,
    normalizeCollections,
    readCollections,
    saveCollections,
    pruneMembers,
    createCollection,
    updateCollection,
    deleteCollection,
    setMembership,
    addMembers,
    removeMembers,
    exportPayload,
    importPayload,
    mount
  });
  root.HafizePromptLibraryCollections = api;

  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
