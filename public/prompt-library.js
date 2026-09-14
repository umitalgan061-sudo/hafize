(function exposeHafizePromptLibrary(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }
  root.HafizePromptLibrary = api;
  const install = () => api.mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizePromptLibrary() {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const STATE_KEY = `${STORAGE_KEY}.state`;
  const MAX_ITEMS = 120;
  const MAX_SELECTION = 40;
  const MAX_TITLE = 100;
  const MAX_BODY = 8_000;
  const MAX_TAGS = 8;
  const MAX_TAG = 24;
  const MAX_VARIABLES = 12;
  const MAX_VARIABLE = 32;
  const MAX_QUERY = 120;
  const MAX_EXPORT = 1_000_000;
  const MAX_IMPORT = 1_000_000;
  const VALID_SORTS = Object.freeze(['updated-desc', 'created-desc', 'title-asc', 'favorite-first']);
  const DEFAULT_STATE = Object.freeze({ query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' });

  function now() { return new Date().toISOString(); }
  function uid() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function text(value, limit) { return typeof value === 'string' ? value.trim().slice(0, limit) : ''; }
  function uniqueStrings(values, limit, itemLimit) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    const result = [];
    for (const value of values) {
      const item = text(value, itemLimit);
      if (!item) continue;
      const key = item.toLocaleLowerCase('tr-TR');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (result.length >= limit) break;
    }
    return result;
  }
  function normalizeVariableName(value) {
    const raw = text(value, MAX_VARIABLE).replace(/[^a-zA-Z0-9_-]/g, '');
    return raw.slice(0, MAX_VARIABLE);
  }
  function extractVariables(body) {
    const matches = String(body ?? '').match(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g) || [];
    const result = [];
    const seen = new Set();
    for (const match of matches) {
      const name = normalizeVariableName(match.replace(/^\{\{\s*|\s*\}\}$/g, ''));
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push(name);
      if (result.length >= MAX_VARIABLES) break;
    }
    return result;
  }
  function safeTitle(value) { return text(value, MAX_TITLE) || 'İsimsiz istem'; }
  function safeBody(value) { return typeof value === 'string' ? value.slice(0, MAX_BODY).replace(/\0/g, '') : ''; }
  function safeTag(value) { return text(value, MAX_TAG).replace(/[,\n\r]/g, ' '); }

  function normalizeItem(input) {
    if (!input || typeof input !== 'object') return null;
    const title = safeTitle(input.title);
    const body = safeBody(input.body);
    if (!body) return null;
    const id = text(input.id, 120) || uid();
    const createdAt = text(input.createdAt, 40) || now();
    const updatedAt = text(input.updatedAt, 40) || createdAt;
    const tags = uniqueStrings(input.tags?.map?.(safeTag) || [], MAX_TAGS, MAX_TAG);
    const variables = uniqueStrings(input.variables || extractVariables(body), MAX_VARIABLES, MAX_VARIABLE).filter(Boolean);
    return Object.freeze({
      id,
      title,
      body,
      tags,
      variables,
      favorite: input.favorite === true,
      useCount: Number.isFinite(input.useCount) && input.useCount >= 0 ? Math.min(9999, Math.floor(input.useCount)) : 0,
      createdAt,
      updatedAt
    });
  }

  function normalizeCollection(input) {
    if (!Array.isArray(input)) return [];
    const result = [];
    const ids = new Set();
    for (const raw of input.slice(0, MAX_ITEMS * 2)) {
      const item = normalizeItem(raw);
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id);
      result.push(item);
      if (result.length >= MAX_ITEMS) break;
    }
    return result;
  }

  function safeState(input) {
    if (!input || typeof input !== 'object') return { ...DEFAULT_STATE };
    const query = text(input.query, MAX_QUERY);
    const tag = input.tag === 'all' ? 'all' : text(input.tag, MAX_TAG) || 'all';
    const sort = VALID_SORTS.includes(input.sort) ? input.sort : DEFAULT_STATE.sort;
    return { query, tag, favoriteOnly: input.favoriteOnly === true, sort };
  }

  function readStorage(storage, key, fallback) {
    try {
      const raw = storage?.getItem?.(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(storage, key, value) {
    try {
      storage?.setItem?.(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function loadItems(storage = globalThis.localStorage) {
    return normalizeCollection(readStorage(storage, STORAGE_KEY, []));
  }

  function loadState(storage = globalThis.localStorage) {
    return safeState(readStorage(storage, STATE_KEY, DEFAULT_STATE));
  }

  function saveItems(storage, items) {
    return writeStorage(storage, STORAGE_KEY, normalizeCollection(items));
  }

  function saveState(storage, state) {
    return writeStorage(storage, STATE_KEY, safeState(state));
  }

  function itemMatches(item, state) {
    if (!item) return false;
    if (state.favoriteOnly && item.favorite !== true) return false;
    if (state.tag !== 'all' && !item.tags.some((tag) => tag.toLocaleLowerCase('tr-TR') === state.tag.toLocaleLowerCase('tr-TR'))) return false;
    if (!state.query) return true;
    const haystack = [item.title, item.body, ...item.tags, ...item.variables].join('\n').toLocaleLowerCase('tr-TR');
    return haystack.includes(state.query.toLocaleLowerCase('tr-TR'));
  }

  function sortItems(items, sort) {
    const copy = items.slice();
    if (sort === 'title-asc') return copy.sort((a, b) => a.title.localeCompare(b.title, 'tr')); 
    if (sort === 'created-desc') return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'favorite-first') return copy.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
    return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function filterItems(items, state) { return sortItems(items.filter((item) => itemMatches(item, state)), state.sort); }

  function collectTags(items) {
    const seen = new Map();
    for (const item of items) for (const tag of item.tags) {
      const key = tag.toLocaleLowerCase('tr-TR');
      if (!seen.has(key)) seen.set(key, tag);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'tr')).slice(0, 80);
  }

  function normalizeImportedPayload(payload) {
    if (Array.isArray(payload)) return { items: normalizeCollection(payload), meta: {} };
    if (!payload || typeof payload !== 'object') return { items: [], meta: {} };
    const items = normalizeCollection(payload.items);
    return { items, meta: { source: text(payload.source, 80), exportedAt: text(payload.exportedAt, 40) } };
  }

  function mergeImportedItems(current, incoming) {
    const result = current.slice();
    const byId = new Map(result.map((item) => [item.id, item]));
    let imported = 0;
    let updated = 0;
    for (const original of incoming) {
      const item = normalizeItem(original);
      if (!item) continue;
      let id = item.id;
      if (byId.has(id)) {
        id = uid();
        while (byId.has(id)) id = uid();
      }
      const copy = Object.freeze({ ...item, id });
      byId.set(id, copy);
      result.push(copy);
      imported += 1;
      if (result.length >= MAX_ITEMS) break;
    }
    return { items: normalizeCollection(result), imported, updated };
  }

  function renderPlainPreview(textValue, max = 120) {
    return String(textValue ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function formatDate(value) {
    try { return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
    catch { return ''; }
  }

  function replaceVariables(body, values) {
    let output = String(body ?? '');
    const safeValues = values && typeof values === 'object' ? values : {};
    output = output.replace(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g, (_match, name) => String(safeValues[name] ?? '').slice(0, 1000));
    return output.slice(0, MAX_BODY);
  }

  function exportPayload(items) {
    const payload = { version: 1, source: 'hafize-prompt-library', exportedAt: now(), items: normalizeCollection(items) };
    const serialized = JSON.stringify(payload, null, 2);
    return serialized.length <= MAX_EXPORT ? serialized : JSON.stringify({ ...payload, items: payload.items.slice(0, 40) }, null, 2);
  }

  function downloadJson(serialized, filename = 'hafize-prompt-library.json') {
    if (typeof Blob === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
    const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  }

  function getPromptTextarea(documentRef) { return documentRef?.querySelector?.('#messageInput') || null; }

  function install(documentRef = globalThis.document, rootRef = globalThis, options = {}) {
    const sidebar = documentRef?.querySelector?.('.sidebar');
    const rail = documentRef?.querySelector?.('.utility-rail');
    const textarea = getPromptTextarea(documentRef);
    const storage = options.storage || rootRef.localStorage;
    if (!documentRef || !rail || !textarea) return null;
    if (documentRef.getElementById('promptLibraryCard')) return { mounted: false, reason: 'already-mounted' };

    let items = loadItems(storage);
    let state = loadState(storage);
    let selected = new Set();
    let editingId = null;
    let fileInput = null;
    let destroyed = false;
    const listeners = [];

    const card = documentRef.createElement('section');
    card.id = 'promptLibraryCard';
    card.className = 'utility-card prompt-library-card';
    card.setAttribute('aria-labelledby', 'promptLibraryTitle');
    card.innerHTML = [
      '<div class="utility-head prompt-library-head"><span class="mini-icon">✎</span><span id="promptLibraryTitle">İstem kütüphanesi</span><span class="prompt-library-count" id="promptLibraryCount"></span></div>',
      '<div class="prompt-library-toolbar">',
      '<input id="promptLibrarySearch" maxlength="120" type="search" placeholder="İstem ara…" aria-label="İstem kütüphanesinde ara">',
      '<select id="promptLibrarySort" aria-label="İstemleri sırala"><option value="updated-desc">Son güncellenen</option><option value="favorite-first">Favoriler</option><option value="created-desc">Yeni oluşturulan</option><option value="title-asc">Başlığa göre</option></select>',
      '</div>',
      '<div class="prompt-library-filters">',
      '<select id="promptLibraryTag" aria-label="Etikete göre filtrele"><option value="all">Tüm etiketler</option></select>',
      '<button type="button" class="mini-btn" id="promptLibraryFavoriteFilter" aria-pressed="false">★ Favoriler</button>',
      '</div>',
      '<div id="promptLibraryList" class="prompt-library-list" role="list"></div>',
      '<div class="prompt-library-actions">',
      '<button type="button" class="soft-btn" id="promptLibraryNew">＋ Yeni istem</button>',
      '<button type="button" class="soft-btn" id="promptLibraryImport">İçe aktar</button>',
      '<button type="button" class="soft-btn" id="promptLibraryExport">Dışa aktar</button>',
      '</div>',
      '<div id="promptLibraryEditor" class="prompt-library-editor" hidden></div>',
      '<input id="promptLibraryFile" type="file" accept="application/json,.json" hidden>',
      '<div class="prompt-library-status" id="promptLibraryStatus" role="status" aria-live="polite"></div>'
    ].join('');
    rail.append(card);

    const els = {
      count: card.querySelector('#promptLibraryCount'),
      search: card.querySelector('#promptLibrarySearch'),
      sort: card.querySelector('#promptLibrarySort'),
      tag: card.querySelector('#promptLibraryTag'),
      favoriteFilter: card.querySelector('#promptLibraryFavoriteFilter'),
      list: card.querySelector('#promptLibraryList'),
      newBtn: card.querySelector('#promptLibraryNew'),
      importBtn: card.querySelector('#promptLibraryImport'),
      exportBtn: card.querySelector('#promptLibraryExport'),
      editor: card.querySelector('#promptLibraryEditor'),
      file: card.querySelector('#promptLibraryFile'),
      status: card.querySelector('#promptLibraryStatus')
    };
    fileInput = els.file;

    function persist() {
      const okItems = saveItems(storage, items);
      const okState = saveState(storage, state);
      if (!okItems || !okState) setStatus('Kütüphane cihazda kalıcı kaydedilemedi.');
      return okItems && okState;
    }

    function setStatus(message) {
      els.status.textContent = text(message, 180);
      if (message) globalThis.clearTimeout(setStatus.timer), setStatus.timer = globalThis.setTimeout(() => { els.status.textContent = ''; }, 3500);
    }

    function updateTags() {
      const current = state.tag;
      els.tag.replaceChildren();
      const all = documentRef.createElement('option');
      all.value = 'all'; all.textContent = 'Tüm etiketler'; els.tag.append(all);
      for (const tag of collectTags(items)) {
        const option = documentRef.createElement('option'); option.value = tag; option.textContent = tag; els.tag.append(option);
      }
      els.tag.value = collectTags(items).some((tag) => tag.toLocaleLowerCase('tr-TR') === current.toLocaleLowerCase('tr-TR')) ? current : 'all';
    }

    function renderEditor(item) {
      editingId = item?.id ?? null;
      els.editor.hidden = false;
      els.editor.replaceChildren();
      const titleLabel = documentRef.createElement('label'); titleLabel.textContent = 'Başlık';
      const title = documentRef.createElement('input'); title.maxLength = MAX_TITLE; title.value = item?.title || '';
      const bodyLabel = documentRef.createElement('label'); bodyLabel.textContent = 'İstem metni';
      const body = documentRef.createElement('textarea'); body.maxLength = MAX_BODY; body.rows = 7; body.value = item?.body || '';
      const tagLabel = documentRef.createElement('label'); tagLabel.textContent = 'Etiketler';
      const tags = documentRef.createElement('input'); tags.maxLength = MAX_TAG * MAX_TAGS + MAX_TAGS; tags.placeholder = 'ör. kodlama, araştırma'; tags.value = item?.tags?.join(', ') || '';
      const variables = documentRef.createElement('div'); variables.className = 'prompt-library-variable-help'; variables.textContent = 'Değişkenler: {{konu}} · {{dil}} · {{format}}';
      const actions = documentRef.createElement('div'); actions.className = 'prompt-library-editor-actions';
      const save = documentRef.createElement('button'); save.type = 'button'; save.className = 'soft-btn'; save.textContent = 'Kaydet';
      const cancel = documentRef.createElement('button'); cancel.type = 'button'; cancel.className = 'soft-btn'; cancel.textContent = 'Vazgeç';
      const favorite = documentRef.createElement('button'); favorite.type = 'button'; favorite.className = 'soft-btn'; favorite.textContent = item?.favorite ? '★ Favoriden çıkar' : '☆ Favoriye al';
      actions.append(save, favorite, cancel);
      els.editor.append(titleLabel, title, bodyLabel, body, tagLabel, tags, variables, actions);
      save.addEventListener('click', () => {
        const cleanTitle = safeTitle(title.value);
        const cleanBody = safeBody(body.value);
        if (!cleanBody) return setStatus('İstem metni boş olamaz.');
        const tagList = uniqueStrings(tags.value.split(','), MAX_TAGS, MAX_TAG).map(safeTag).filter(Boolean);
        const base = item ? { ...item } : { id: uid(), createdAt: now(), favorite: false, useCount: 0 };
        const next = normalizeItem({ ...base, title: cleanTitle, body: cleanBody, tags: tagList, variables: extractVariables(cleanBody), updatedAt: now() });
        if (!next) return setStatus('İstem kaydedilemedi.');
        const index = items.findIndex((candidate) => candidate.id === next.id);
        if (index >= 0) items.splice(index, 1, next); else items.unshift(next);
        if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);
        persist(); render(); els.editor.hidden = true; editingId = null;
        setStatus('İstem kaydedildi.');
      });
      favorite.addEventListener('click', () => {
        if (!item) return;
        const index = items.findIndex((candidate) => candidate.id === item.id);
        if (index < 0) return;
        const next = normalizeItem({ ...items[index], favorite: !items[index].favorite, updatedAt: now() });
        items.splice(index, 1, next); persist(); renderEditor(next); render();
      });
      cancel.addEventListener('click', () => { els.editor.hidden = true; editingId = null; });
      body.addEventListener('input', () => { variables.textContent = extractVariables(body.value).length ? `Değişkenler: ${extractVariables(body.value).map((v) => `{{${v}}}`).join(' · ')}` : 'Değişken yok'; });
      title.focus();
    }

    function useItem(item) {
      if (!item) return;
      const names = extractVariables(item.body);
      const values = {};
      for (const name of names) {
        const answer = rootRef.prompt?.(`${name} değerini gir:`, '') ?? '';
        if (answer === null) return;
        values[name] = String(answer).slice(0, 1000);
      }
      textarea.value = replaceVariables(item.body, values);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      const index = items.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) items.splice(index, 1, normalizeItem({ ...items[index], useCount: items[index].useCount + 1, updatedAt: now() }));
      persist();
      setStatus('İstem mesaj alanına aktarıldı.');
    }

    function removeItem(item) {
      if (!item || !rootRef.confirm?.(`“${item.title}” istemi silinsin mi?`)) return;
      items = items.filter((candidate) => candidate.id !== item.id);
      selected.delete(item.id);
      persist(); render(); setStatus('İstem silindi.');
    }

    function render() {
      if (destroyed) return;
      state = safeState(state);
      els.search.value = state.query;
      els.sort.value = state.sort;
      els.favoriteFilter.setAttribute('aria-pressed', String(state.favoriteOnly));
      updateTags();
      els.count.textContent = `${filterItems(items, state).length}/${items.length}`;
      els.list.replaceChildren();
      const visible = filterItems(items, state);
      if (!visible.length) {
        const empty = documentRef.createElement('div'); empty.className = 'prompt-library-empty'; empty.textContent = items.length ? 'Filtreye uyan istem yok.' : 'Henüz kayıtlı istem yok.'; els.list.append(empty); return;
      }
      for (const item of visible) {
        const row = documentRef.createElement('article'); row.className = 'prompt-item'; row.setAttribute('role', 'listitem'); row.dataset.promptId = item.id;
        const check = documentRef.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(item.id); check.setAttribute('aria-label', `${item.title} seç`);
        const content = documentRef.createElement('div'); content.className = 'prompt-item-content';
        const header = documentRef.createElement('div'); header.className = 'prompt-item-header';
        const title = documentRef.createElement('strong'); title.textContent = item.title;
        const star = documentRef.createElement('button'); star.type = 'button'; star.className = 'prompt-item-star'; star.textContent = item.favorite ? '★' : '☆'; star.setAttribute('aria-label', item.favorite ? 'Favoriden çıkar' : 'Favoriye al'); star.setAttribute('aria-pressed', String(item.favorite));
        header.append(title, star);
        const preview = documentRef.createElement('p'); preview.textContent = renderPlainPreview(item.body);
        const meta = documentRef.createElement('div'); meta.className = 'prompt-item-meta'; meta.textContent = `${formatDate(item.updatedAt)} · ${item.useCount} kullanım`;
        for (const tag of item.tags) { const badge = documentRef.createElement('span'); badge.className = 'prompt-item-tag'; badge.textContent = tag; meta.append(' ', badge); }
        const actions = documentRef.createElement('div'); actions.className = 'prompt-item-actions';
        const use = documentRef.createElement('button'); use.type = 'button'; use.className = 'soft-btn'; use.textContent = 'Kullan';
        const edit = documentRef.createElement('button'); edit.type = 'button'; edit.className = 'soft-btn'; edit.textContent = 'Düzenle';
        const remove = documentRef.createElement('button'); remove.type = 'button'; remove.className = 'soft-btn'; remove.textContent = 'Sil';
        actions.append(use, edit, remove);
        content.append(header, preview, meta, actions);
        row.append(check, content); els.list.append(row);
        check.addEventListener('change', () => { if (check.checked) selected.add(item.id); else selected.delete(item.id); selected = new Set([...selected].slice(0, MAX_SELECTION)); });
        star.addEventListener('click', () => { const index = items.findIndex((candidate) => candidate.id === item.id); if (index < 0) return; items.splice(index, 1, normalizeItem({ ...items[index], favorite: !items[index].favorite, updatedAt: now() })); persist(); render(); });
        use.addEventListener('click', () => useItem(item));
        edit.addEventListener('click', () => renderEditor(item));
        remove.addEventListener('click', () => removeItem(item));
      }
      if (selected.size) {
        const bulk = documentRef.createElement('div'); bulk.className = 'prompt-library-bulk';
        const bulkDelete = documentRef.createElement('button'); bulkDelete.type = 'button'; bulkDelete.className = 'soft-btn'; bulkDelete.textContent = `${selected.size} seçimi sil`;
        const bulkFavorite = documentRef.createElement('button'); bulkFavorite.type = 'button'; bulkFavorite.className = 'soft-btn'; bulkFavorite.textContent = 'Seçilenleri favorile';
        bulk.append(bulkDelete, bulkFavorite); els.list.prepend(bulk);
        bulkDelete.addEventListener('click', () => { if (!rootRef.confirm?.(`${selected.size} istem silinsin mi?`)) return; items = items.filter((item) => !selected.has(item.id)); selected.clear(); persist(); render(); setStatus('Seçilen istemler silindi.'); });
        bulkFavorite.addEventListener('click', () => { const selectedIds = new Set(selected); items = items.map((item) => selectedIds.has(item.id) ? normalizeItem({ ...item, favorite: true, updatedAt: now() }) : item); persist(); render(); setStatus('Seçilen istemler favorilere eklendi.'); });
      }
    }

    function importFile(file) {
      if (!file || file.size > MAX_IMPORT) return setStatus('Dosya 1 MB sınırını aşamaz.');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = String(reader.result || '');
          if (raw.length > MAX_IMPORT) throw new Error('IMPORT_TOO_LARGE');
          const payload = normalizeImportedPayload(JSON.parse(raw));
          const merged = mergeImportedItems(items, payload.items);
          items = merged.items;
          persist();
          render();
          setStatus(`${merged.imported} istem içe aktarıldı.`);
        } catch {
          setStatus('Geçersiz istem yedeği.');
        }
      };
      reader.onerror = () => setStatus('İstem yedeği okunamadı.');
      reader.readAsText(file);
    }

    function addListener(target, type, handler) { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); }
    addListener(els.search, 'input', () => { state.query = text(els.search.value, MAX_QUERY); persist(); render(); });
    addListener(els.sort, 'change', () => { state.sort = els.sort.value; persist(); render(); });
    addListener(els.tag, 'change', () => { state.tag = els.tag.value; persist(); render(); });
    addListener(els.favoriteFilter, 'click', () => { state.favoriteOnly = !state.favoriteOnly; persist(); render(); });
    addListener(els.newBtn, 'click', () => renderEditor(null));
    addListener(els.importBtn, 'click', () => els.file.click());
    addListener(els.file, 'change', () => { importFile(els.file.files?.[0]); els.file.value = ''; });
    addListener(els.exportBtn, 'click', () => { const ids = selected.size ? selected : new Set(filterItems(items, state).map((item) => item.id)); const chosen = items.filter((item) => ids.has(item.id)).slice(0, MAX_SELECTION); if (!chosen.length) return setStatus('Dışa aktarılacak istem yok.'); if (!downloadJson(exportPayload(chosen))) setStatus('Bu tarayıcıda dosya dışa aktarılamıyor.'); else setStatus(`${chosen.length} istem dışa aktarıldı.`); });
    addListener(rootRef, 'storage', (event) => { if (event.key === STORAGE_KEY) { items = loadItems(storage); render(); } if (event.key === STATE_KEY) { state = loadState(storage); render(); } });
    addListener(rootRef, 'beforeunload', () => persist());
    addListener(documentRef, 'keydown', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (!event.shiftKey || event.key.toLowerCase() !== 'p') return;
      event.preventDefault();
      els.search.focus();
      els.search.select();
    });

    render();
    return Object.freeze({
      mounted: true,
      getItems: () => items.slice(),
      getState: () => ({ ...state }),
      getVisibleItems: () => filterItems(items, state),
      setState: (next) => { state = safeState(next); persist(); render(); },
      create: (input) => { const item = normalizeItem({ ...input, id: uid(), createdAt: now(), updatedAt: now() }); if (!item) return null; items.unshift(item); items = normalizeCollection(items); persist(); render(); return item.id; },
      destroy: () => { destroyed = true; for (const off of listeners.splice(0)) off(); card.remove(); fileInput = null; selected.clear(); editingId = null; }
    });
  }

  const api = Object.freeze({
    STORAGE_KEY,
    STATE_KEY,
    LIMITS: Object.freeze({ MAX_ITEMS, MAX_SELECTION, MAX_TITLE, MAX_BODY, MAX_TAGS, MAX_TAG, MAX_VARIABLES, MAX_VARIABLE, MAX_QUERY, MAX_EXPORT, MAX_IMPORT }),
    normalizeItem,
    normalizeCollection,
    safeState,
    loadItems,
    loadState,
    saveItems,
    saveState,
    extractVariables,
    replaceVariables,
    itemMatches,
    filterItems,
    sortItems,
    collectTags,
    normalizeImportedPayload,
    mergeImportedItems,
    exportPayload,
    mount: install
  });
  return api;
});
