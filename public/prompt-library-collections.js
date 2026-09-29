(function installHafizePromptCollections(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.collections.v1';
  const MAP_KEY = 'hafize.prompt-library.collections.map.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_COLLECTIONS = 24;
  const MAX_NAME = 36;
  const MAX_SELECTED = 40;
  const MAX_EXPORT = 500_000;
  const ALL = 'all';
  const NONE = 'none';
  const listeners = [];

  const api = root.HafizePromptLibrary;

  const now = () => new Date().toISOString();
  const id = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const clean = (value, limit = MAX_NAME) => typeof value === 'string' ? value.trim().replace(/[\\u0000\\r\\n]/g, ' ').slice(0, limit) : '';

  function readJson(key, fallback) {
    try { return JSON.parse(root.localStorage?.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { root.localStorage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function normalizeCollection(input) {
    if (!input || typeof input !== 'object') return null;
    const name = clean(input.name);
    if (!name) return null;
    const createdAt = clean(input.createdAt, 40) || now();
    return Object.freeze({
      id: clean(input.id, 120) || id(),
      name,
      createdAt,
      updatedAt: clean(input.updatedAt, 40) || createdAt
    });
  }

  function loadCollections() {
    const raw = readJson(STORAGE_KEY, []);
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const output = [];
    for (const entry of raw.slice(0, MAX_COLLECTIONS * 2)) {
      const item = normalizeCollection(entry);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      output.push(item);
      if (output.length >= MAX_COLLECTIONS) break;
    }
    return output;
  }

  function loadMap() {
    const raw = readJson(MAP_KEY, {});
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const output = {};
    for (const [promptId, collectionId] of Object.entries(raw).slice(0, 200)) {
      const p = clean(promptId, 120);
      const c = clean(collectionId, 120);
      if (p && c) output[p] = c;
    }
    return output;
  }

  function saveCollections(items) { return writeJson(STORAGE_KEY, loadCollectionsFrom(items)); }
  function loadCollectionsFrom(items) {
    const seen = new Set();
    const output = [];
    for (const entry of Array.isArray(items) ? items : []) {
      const item = normalizeCollection(entry);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      output.push(item);
      if (output.length >= MAX_COLLECTIONS) break;
    }
    return output;
  }
  function saveMap(map) { return writeJson(MAP_KEY, loadMapFrom(map)); }
  function loadMapFrom(map) {
    const output = {};
    for (const [promptId, collectionId] of Object.entries(map || {}).slice(0, 1000)) {
      const p = clean(promptId, 120);
      const c = clean(collectionId, 120);
      if (p && c) output[p] = c;
    }
    return output;
  }

  function findCollection(collections, collectionId) {
    return collections.find((item) => item.id === collectionId) || null;
  }

  function pruneMap(collections, map) {
    const valid = new Set(collections.map((item) => item.id));
    const output = {};
    for (const [promptId, collectionId] of Object.entries(map)) if (valid.has(collectionId)) output[promptId] = collectionId;
    return output;
  }

  function requestRefresh() {
    try {
      root.dispatchEvent?.(new root.Event('hafize:prompt-library-collections-changed'));
      if (typeof root.StorageEvent === 'function') {
        root.dispatchEvent(new root.StorageEvent('storage', { key: STORAGE_KEY }));
        root.dispatchEvent(new root.StorageEvent('storage', { key: MAP_KEY }));
      }
    } catch {
      root.dispatchEvent?.(new root.Event('hafize:prompt-library-collections-changed'));
    }
  }

  function text(doc, value, className) {
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

  function select(doc, label) {
    const node = doc.createElement('select');
    node.className = 'prompt-library-collection-select';
    node.setAttribute('aria-label', label);
    return node;
  }

  function summarize(collections, map, items) {
    const counts = new Map(collections.map((collection) => [collection.id, 0]));
    for (const item of Array.isArray(items) ? items : []) {
      const collectionId = map[item.id];
      if (counts.has(collectionId)) counts.set(collectionId, counts.get(collectionId) + 1);
    }
    return collections.map((collection) => Object.freeze({
      ...collection,
      count: counts.get(collection.id) || 0
    }));
  }

  function exportPayload(collections, map) {
    const payload = {
      version: 1,
      source: 'hafize-prompt-library-collections',
      exportedAt: now(),
      collections,
      assignments: map
    };
    const output = JSON.stringify(payload, null, 2);
    if (output.length <= MAX_EXPORT) return output;
    return JSON.stringify({
      ...payload,
      assignments: Object.fromEntries(Object.entries(map).slice(0, 400))
    }, null, 2);
  }

  function normalizeImported(payload) {
    if (!payload || typeof payload !== 'object') return { collections: [], assignments: {} };
    const collections = Array.isArray(payload.collections) ? loadCollectionsFrom(payload.collections) : [];
    const assignments = payload.assignments && typeof payload.assignments === 'object' && !Array.isArray(payload.assignments)
      ? loadMapFrom(payload.assignments)
      : {};
    return { collections, assignments };
  }

  function mergeImported(current, incoming, currentMap) {
    const collections = loadCollectionsFrom(current);
    const map = loadMapFrom(currentMap);
    const ids = new Set(collections.map((item) => item.id));
    const byName = new Map(collections.map((item) => [item.name.toLocaleLowerCase('tr-TR'), item]));
    let imported = 0;
    for (const raw of incoming.collections) {
      let item = normalizeCollection(raw);
      if (!item) continue;
      const nameKey = item.name.toLocaleLowerCase('tr-TR');
      if (byName.has(nameKey)) {
        item = byName.get(nameKey);
      } else {
        let nextId = item.id;
        while (ids.has(nextId)) nextId = id();
        item = Object.freeze({ ...item, id: nextId });
        collections.push(item);
        ids.add(item.id);
        byName.set(nameKey, item);
        imported += 1;
      }
      if (collections.length >= MAX_COLLECTIONS) break;
    }
    const incomingIds = new Map(incoming.collections.map((item) => [item.id, item]));
    for (const [promptId, incomingCollectionId] of Object.entries(incoming.assignments)) {
      const source = incomingIds.get(incomingCollectionId);
      if (!source) continue;
      const target = byName.get(source.name.toLocaleLowerCase('tr-TR'));
      if (target) map[promptId] = target.id;
    }
    return { collections: loadCollectionsFrom(collections), map: loadMapFrom(map), imported };
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById('promptLibraryCollections')) return null;

    let collections = loadCollections();
    let map = pruneMap(collections, loadMap());
    let activeFilter = ALL;
    const ensurePersisted = () => {
      const ok = saveCollections(collections) && saveMap(map);
      if (!ok) report('Koleksiyon bilgileri cihazda kalıcı kaydedilemedi.');
      return ok;
    };

    const panel = documentRef.createElement('section');
    panel.id = 'promptLibraryCollections';
    panel.className = 'prompt-library-collections';
    panel.setAttribute('aria-labelledby', 'promptLibraryCollectionsTitle');

    const head = documentRef.createElement('div');
    head.className = 'prompt-library-collections-head';
    const heading = documentRef.createElement('strong');
    heading.id = 'promptLibraryCollectionsTitle';
    heading.textContent = 'Koleksiyonlar';
    const count = text(documentRef, '', 'prompt-library-collections-count');
    const manage = button(documentRef, 'Yönet', 'mini-btn');
    head.append(heading, count, manage);

    const toolbar = documentRef.createElement('div');
    toolbar.className = 'prompt-library-collections-toolbar';
    const filter = select(documentRef, 'Prompt koleksiyonuna göre filtrele');
    filter.id = 'promptLibraryCollectionFilter';
    const create = button(documentRef, '＋ Koleksiyon', 'soft-btn');
    const exportButton = button(documentRef, 'Yedeği dışa aktar', 'soft-btn');
    const importButton = button(documentRef, 'Yedeği içe aktar', 'soft-btn');
    const file = documentRef.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;
    toolbar.append(filter, create, exportButton, importButton);

    const list = documentRef.createElement('div');
    list.className = 'prompt-library-collections-list';
    list.setAttribute('role', 'list');
    const editor = documentRef.createElement('div');
    editor.className = 'prompt-library-collections-editor';
    editor.hidden = true;
    const status = documentRef.createElement('div');
    status.className = 'prompt-library-collections-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    panel.append(head, toolbar, list, editor, file, status);
    card.append(panel);

    const on = (target, type, handler) => {
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    };
    const report = (message) => { status.textContent = clean(message, 180); };

    function setFilter(collectionId) {
      activeFilter = collectionId || ALL;
      const detail = { collectionId: activeFilter };
      rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:prompt-library-collection-filter', { detail }));
      applyFilterVisibility();
    }

    function applyFilterVisibility() {
      documentRef.querySelectorAll('#promptLibraryList .prompt-item').forEach((row) => {
        const promptId = row.dataset.promptId;
        const collectionId = promptId ? map[promptId] : undefined;
        row.hidden = activeFilter !== ALL && (activeFilter === NONE ? Boolean(collectionId) : collectionId !== activeFilter);
      });
    }

    function renderFilter() {
      filter.replaceChildren();
      const all = documentRef.createElement('option');
      all.value = ALL;
      all.textContent = 'Tüm koleksiyonlar';
      filter.append(all);
      const none = documentRef.createElement('option');
      none.value = NONE;
      none.textContent = 'Koleksiyonsuz';
      filter.append(none);
      for (const item of summarize(collections, map, api?.loadItems?.(rootRef.localStorage) || [])) {
        const option = documentRef.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.count})`;
        filter.append(option);
      }
      filter.value = filter.value && [...filter.options].some((option) => option.value === filter.value) ? filter.value : ALL;
      count.textContent = `${collections.length}/${MAX_COLLECTIONS}`;
    }

    function renderList() {
      list.replaceChildren();
      if (!collections.length) {
        list.append(text(documentRef, 'Henüz koleksiyon oluşturulmadı.', 'prompt-library-collection-empty'));
        return;
      }
      for (const item of collections) {
        const row = documentRef.createElement('div');
        row.className = 'prompt-library-collection-row';
        row.dataset.collectionId = item.id;
        row.setAttribute('role', 'listitem');
        const title = text(documentRef, item.name, 'prompt-library-collection-name');
        const usage = text(documentRef, `${summarize(collections, map, api?.loadItems?.(rootRef.localStorage) || []).find((entry) => entry.id === item.id)?.count || 0} istem`, 'prompt-library-collection-count');
        const rename = button(documentRef, 'Adını değiştir');
        const remove = button(documentRef, 'Sil');
        row.append(title, usage, rename, remove);
        on(rename, 'click', () => editCollection(item));
        on(remove, 'click', () => deleteCollection(item));
        list.append(row);
      }
    }

    function renderEditor(existing) {
      editor.hidden = false;
      editor.replaceChildren();
      const field = documentRef.createElement('input');
      field.type = 'text';
      field.maxLength = MAX_NAME;
      field.value = existing?.name || '';
      field.setAttribute('aria-label', 'Koleksiyon adı');
      const save = button(documentRef, existing ? 'Adı kaydet' : 'Koleksiyon oluştur', 'soft-btn');
      const cancel = button(documentRef, 'Vazgeç');
      editor.append(
        text(documentRef, existing ? 'Koleksiyon adını düzenle' : 'Yeni koleksiyon', 'prompt-library-collection-editor-title'),
        field,
        save,
        cancel
      );
      cancel.addEventListener('click', () => {
        editor.hidden = true;
        editor.replaceChildren();
      });
      save.addEventListener('click', () => {
        const name = clean(field.value);
        if (!name) return report('Koleksiyon adı boş olamaz.');
        const duplicate = collections.find((entry) => entry.id !== existing?.id && entry.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
        if (duplicate) return report('Bu isimde bir koleksiyon zaten var.');
        if (existing) {
          collections = collections.map((entry) => entry.id === existing.id
            ? Object.freeze({ ...entry, name, updatedAt: now() })
            : entry);
          report('Koleksiyon adı güncellendi.');
        } else {
          if (collections.length >= MAX_COLLECTIONS) return report(`En fazla ${MAX_COLLECTIONS} koleksiyon oluşturabilirsiniz.`);
          collections = [Object.freeze({ id: id(), name, createdAt: now(), updatedAt: now() }), ...collections];
          report('Koleksiyon oluşturuldu.');
        }
        ensurePersisted();
        editor.hidden = true;
        editor.replaceChildren();
        render();
        requestRefresh();
      });
      field.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') cancel.click();
        if (event.key === 'Enter') save.click();
      });
      field.focus();
    }

    function editCollection(item) { renderEditor(item); }

    function deleteCollection(item) {
      if (!rootRef.confirm?.(`“${item.name}” koleksiyonu silinsin mi? İstemler silinmez.`)) return;
      const nextMap = {};
      for (const [promptId, collectionId] of Object.entries(map)) if (collectionId !== item.id) nextMap[promptId] = collectionId;
      collections = collections.filter((entry) => entry.id !== item.id);
      map = nextMap;
      ensurePersisted();
      if (filter.value === item.id) {
        filter.value = ALL;
        setFilter(ALL);
      }
      render();
      requestRefresh();
      report('Koleksiyon silindi; istemler korunuyor.');
    }

    function assignPrompt(promptId, collectionId) {
      const cleanPromptId = clean(promptId, 120);
      if (!cleanPromptId) return;
      if (collectionId === ALL || collectionId === NONE || !findCollection(collections, collectionId)) {
        delete map[cleanPromptId];
      } else {
        map[cleanPromptId] = collectionId;
      }
      map = loadMapFrom(map);
      ensurePersisted();
      renderFilter();
      requestRefresh();
    }

    function populateRow(row) {
      const promptId = row.dataset.promptId;
      if (!promptId || row.querySelector('.prompt-library-collection-assignment')) return;
      const actionArea = row.querySelector('.prompt-item-actions');
      if (!actionArea) return;
      const wrapper = documentRef.createElement('label');
      wrapper.className = 'prompt-library-collection-assignment';
      const caption = text(documentRef, 'Koleksiyon', 'prompt-library-collection-caption');
      const picker = select(documentRef, 'İstemi koleksiyona ata');
      picker.dataset.promptCollection = promptId;
      const none = documentRef.createElement('option');
      none.value = NONE;
      none.textContent = 'Koleksiyonsuz';
      picker.append(none);
      for (const item of collections) {
        const option = documentRef.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        picker.append(option);
      }
      picker.value = map[promptId] || NONE;
      picker.addEventListener('change', () => assignPrompt(promptId, picker.value));
      wrapper.append(caption, picker);
      actionArea.append(wrapper);
    }

    function enhanceItems() {
      documentRef.querySelectorAll('#promptLibraryList .prompt-item').forEach(populateRow);
      renderFilter();
      applyFilterVisibility();
    }

    const observer = typeof rootRef.MutationObserver === 'function' ? new rootRef.MutationObserver(enhanceItems) : null;
    observer?.observe(documentRef.getElementById('promptLibraryList') || card, { childList: true, subtree: true });

    on(filter, 'change', () => setFilter(filter.value));
    on(create, 'click', () => renderEditor(null));
    on(manage, 'click', () => {
      editor.hidden = !editor.hidden;
      if (!editor.hidden && collections.length) renderList();
      else if (!editor.hidden) renderList();
      report(editor.hidden ? 'Koleksiyon yönetimi kapatıldı.' : 'Koleksiyon yönetimi açıldı.');
    });
    on(exportButton, 'click', () => {
      const content = exportPayload(collections, map);
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = documentRef.createElement('a');
      link.href = url;
      link.download = 'hafize-prompt-collections.json';
      link.click();
      rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      report('Koleksiyon yedeği dışa aktarıldı.');
    });
    on(importButton, 'click', () => file.click());
    on(file, 'change', () => {
      const selected = file.files?.[0];
      file.value = '';
      if (!selected || selected.size > MAX_EXPORT) return report('Koleksiyon yedeği 500 KB sınırını aşamaz.');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const incoming = normalizeImported(JSON.parse(String(reader.result || '')));
          const merged = mergeImported(collections, incoming, map);
          collections = merged.collections;
          map = merged.map;
          ensurePersisted();
          render();
          requestRefresh();
          report(`${merged.imported} yeni koleksiyon içe aktarıldı.`);
        } catch { report('Geçersiz koleksiyon yedeği.'); }
      };
      reader.onerror = () => report('Koleksiyon yedeği okunamadı.');
      reader.readAsText(selected);
    });

    function render() {
      collections = loadCollections();
      map = pruneMap(collections, loadMap());
      renderFilter();
      if (!editor.hidden) renderList();
      applyFilterVisibility();
      enhanceItems();
    }

    on(rootRef, 'storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === MAP_KEY) render();
    });
    on(rootRef, 'hafize:prompt-library-collections-changed', render);
    render();

    return Object.freeze({
      mounted: true,
      getCollections: () => loadCollections(),
      getAssignments: () => ({ ...loadMap() }),
      summarize: () => summarize(loadCollections(), loadMap(), api?.loadItems?.(rootRef.localStorage) || []),
      assign: assignPrompt,
      destroy: () => {
        observer?.disconnect();
        for (const off of listeners.splice(0)) off();
        panel.remove();
      }
    });
  }

  const exported = Object.freeze({
    STORAGE_KEY,
    MAP_KEY,
    MAX_COLLECTIONS,
    MAX_NAME,
    loadCollections,
    loadMap,
    saveCollections,
    saveMap,
    summarize,
    exportPayload,
    normalizeImported,
    mergeImported,
    mount
  });

  root.HafizePromptLibraryCollections = exported;
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
