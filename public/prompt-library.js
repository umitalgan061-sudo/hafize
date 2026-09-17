(function exposeHafizePromptLibrary(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibrary = api;
  const mount = () => api.mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizePromptLibrary() {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.v1';
  const STATE_KEY = `${STORAGE_KEY}.state`;
  const LIMITS = Object.freeze({ maxItems: 120, maxSelection: 40, maxTitle: 100, maxBody: 8000, maxTags: 8, maxTag: 24, maxVariables: 12, maxVariable: 32, maxQuery: 120, maxImport: 1_000_000, maxExport: 1_000_000, maxVariableValue: 1000 });
  const SORTS = Object.freeze(['updated-desc', 'favorite-first', 'created-desc', 'title-asc']);
  const DEFAULT_STATE = Object.freeze({ query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' });

  const trim = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const timestamp = () => new Date().toISOString();
  const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safeTags = (values) => {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    const output = [];
    for (const raw of values) {
      const tag = trim(raw, LIMITS.maxTag).replace(/[,\r\n]/g, ' ');
      const key = tag.toLocaleLowerCase('tr-TR');
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      output.push(tag);
      if (output.length >= LIMITS.maxTags) break;
    }
    return output;
  };
  const safeVariables = (body, supplied) => {
    const values = Array.isArray(supplied) ? supplied : [];
    const names = values.length ? values : (String(body || '').match(/\{\{\s*[a-zA-Z0-9_-]{1,32}\s*\}\}/g) || []).map((match) => match.replace(/^\{\{\s*|\s*\}\}$/g, ''));
    const seen = new Set();
    const output = [];
    for (const raw of names) {
      const name = trim(raw, LIMITS.maxVariable).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!name || seen.has(name)) continue;
      seen.add(name);
      output.push(name);
      if (output.length >= LIMITS.maxVariables) break;
    }
    return output;
  };

  function normalizeItem(input) {
    if (!input || typeof input !== 'object') return null;
    const body = typeof input.body === 'string' ? input.body.slice(0, LIMITS.maxBody).replace(/\0/g, '') : '';
    if (!body) return null;
    const createdAt = trim(input.createdAt, 40) || timestamp();
    return Object.freeze({
      id: trim(input.id, 120) || id(),
      title: trim(input.title, LIMITS.maxTitle) || 'İsimsiz istem',
      body,
      tags: safeTags(input.tags),
      variables: safeVariables(body, input.variables),
      favorite: input.favorite === true,
      useCount: Number.isFinite(input.useCount) && input.useCount >= 0 ? Math.min(9999, Math.floor(input.useCount)) : 0,
      createdAt,
      updatedAt: trim(input.updatedAt, 40) || createdAt
    });
  }

  function normalizeCollection(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const output = [];
    for (const raw of value.slice(0, LIMITS.maxItems * 2)) {
      const item = normalizeItem(raw);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      output.push(item);
      if (output.length >= LIMITS.maxItems) break;
    }
    return output;
  }

  function safeState(value) {
    if (!value || typeof value !== 'object') return { ...DEFAULT_STATE };
    return {
      query: trim(value.query, LIMITS.maxQuery),
      tag: value.tag === 'all' ? 'all' : trim(value.tag, LIMITS.maxTag) || 'all',
      favoriteOnly: value.favoriteOnly === true,
      sort: SORTS.includes(value.sort) ? value.sort : DEFAULT_STATE.sort
    };
  }

  function read(storage, key, fallback) {
    try { return JSON.parse(storage?.getItem?.(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }
  function write(storage, key, value) {
    try { storage?.setItem?.(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function loadItems(storage) { return normalizeCollection(read(storage || globalThis.localStorage, STORAGE_KEY, [])); }
  function loadState(storage) { return safeState(read(storage || globalThis.localStorage, STATE_KEY, DEFAULT_STATE)); }
  function saveItems(storage, items) { return write(storage || globalThis.localStorage, STORAGE_KEY, normalizeCollection(items)); }
  function saveState(storage, state) { return write(storage || globalThis.localStorage, STATE_KEY, safeState(state)); }

  function matches(item, state) {
    if (!item) return false;
    if (state.favoriteOnly && !item.favorite) return false;
    if (state.tag !== 'all' && !item.tags.some((tag) => tag.toLocaleLowerCase('tr-TR') === state.tag.toLocaleLowerCase('tr-TR'))) return false;
    if (!state.query) return true;
    const q = state.query.toLocaleLowerCase('tr-TR');
    return [item.title, item.body, ...item.tags, ...item.variables].join('\n').toLocaleLowerCase('tr-TR').includes(q);
  }

  function sortItems(items, sort) {
    const output = items.slice();
    if (sort === 'title-asc') return output.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
    // Prompts restored or imported in one batch share a createdAt stamp, so the
    // newest-first list falls back to updatedAt and then to the title instead of
    // leaving the order up to how storage happened to hand them over.
    if (sort === 'created-desc') {
      return output.sort((a, b) => b.createdAt.localeCompare(a.createdAt)
        || b.updatedAt.localeCompare(a.updatedAt)
        || a.title.localeCompare(b.title, 'tr'));
    }
    if (sort === 'favorite-first') return output.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
    return output.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  function filterItems(items, state) { return sortItems(items.filter((item) => matches(item, state)), state.sort); }
  function collectTags(items) {
    const map = new Map();
    for (const item of items) for (const tag of item.tags) {
      const key = tag.toLocaleLowerCase('tr-TR');
      if (!map.has(key)) map.set(key, tag);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b, 'tr')).slice(0, 80);
  }
  function extractVariables(body) { return safeVariables(String(body || ''), null); }
  function replaceVariables(body, values) {
    const source = String(body || '');
    const input = values && typeof values === 'object' ? values : {};
    return source.replace(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g, (_match, name) => String(input[name] ?? '').slice(0, LIMITS.maxVariableValue)).slice(0, LIMITS.maxBody);
  }
  function normalizeImportedPayload(payload) {
    if (Array.isArray(payload)) return { items: normalizeCollection(payload), meta: {} };
    if (!payload || typeof payload !== 'object') return { items: [], meta: {} };
    return { items: normalizeCollection(payload.items), meta: { source: trim(payload.source, 80), exportedAt: trim(payload.exportedAt, 40) } };
  }
  function mergeImportedItems(current, incoming) {
    const result = normalizeCollection(current);
    const ids = new Set(result.map((item) => item.id));
    let imported = 0;
    // Imported prompts are normalized one by one instead of through
    // normalizeCollection: a backup that repeats an id would otherwise lose the
    // later prompt silently, where re-keying keeps every prompt in the file.
    for (const raw of Array.isArray(incoming) ? incoming.slice(0, LIMITS.maxItems * 2) : []) {
      // Checked before the push, not after: stopping afterwards accepted one
      // prompt past the capacity, which `normalizeCollection` then dropped,
      // leaving `imported` counting a prompt that never arrived.
      if (result.length >= LIMITS.maxItems) break;
      let item = normalizeItem(raw);
      if (!item) continue;
      let nextId = item.id;
      while (ids.has(nextId)) nextId = id();
      if (nextId !== item.id) item = Object.freeze({ ...item, id: nextId });
      ids.add(item.id); result.push(item); imported += 1;
    }
    return { items: normalizeCollection(result), imported };
  }
  function exportPayload(items) {
    const payload = { version: 1, source: 'hafize-prompt-library', exportedAt: timestamp(), items: normalizeCollection(items) };
    const output = JSON.stringify(payload, null, 2);
    return output.length <= LIMITS.maxExport ? output : JSON.stringify({ ...payload, items: payload.items.slice(0, 40) }, null, 2);
  }

  function element(doc, tag, textValue, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }
  function button(doc, textValue, className = 'soft-btn') { const node = element(doc, 'button', textValue, className); node.type = 'button'; return node; }

  function mount(documentRef = globalThis.document, rootRef = globalThis, options = {}) {
    const rail = documentRef?.querySelector?.('.utility-rail');
    const composer = documentRef?.querySelector?.('#messageInput');
    if (!documentRef || !rail || !composer) return null;
    if (documentRef.getElementById('promptLibraryCard')) return { mounted: false, reason: 'already-mounted' };
    const storage = options.storage || rootRef.localStorage;
    let items = loadItems(storage);
    let state = loadState(storage);
    let selected = new Set();
    let destroyed = false;
    const listeners = [];

    const card = element(documentRef, 'section', undefined, 'utility-card prompt-library-card');
    card.id = 'promptLibraryCard';
    card.setAttribute('aria-labelledby', 'promptLibraryTitle');
    const head = element(documentRef, 'div', undefined, 'utility-head prompt-library-head');
    head.append(element(documentRef, 'span', '✎', 'mini-icon'));
    head.append(element(documentRef, 'span', 'İstem kütüphanesi', 'prompt-library-title'));
    const count = element(documentRef, 'span', '', 'prompt-library-count'); head.append(count);
    const search = documentRef.createElement('input'); search.type = 'search'; search.maxLength = LIMITS.maxQuery; search.placeholder = 'İstem ara…'; search.setAttribute('aria-label', 'İstem kütüphanesinde ara');
    const sort = documentRef.createElement('select'); sort.setAttribute('aria-label', 'İstemleri sırala');
    for (const [value, label] of [['updated-desc', 'Son güncellenen'], ['favorite-first', 'Favoriler'], ['created-desc', 'Yeni oluşturulan'], ['title-asc', 'Başlığa göre']]) { const option = element(documentRef, 'option', label); option.value = value; sort.append(option); }
    const filterRow = element(documentRef, 'div', undefined, 'prompt-library-filters');
    const tag = documentRef.createElement('select'); tag.setAttribute('aria-label', 'Etikete göre filtrele');
    const favorite = button(documentRef, '★ Favoriler', 'mini-btn'); favorite.id = 'promptLibraryFavoriteFilter';
    filterRow.append(tag, favorite);
    const toolbar = element(documentRef, 'div', undefined, 'prompt-library-toolbar'); toolbar.append(search, sort);
    const list = element(documentRef, 'div', undefined, 'prompt-library-list'); list.id = 'promptLibraryList'; list.setAttribute('role', 'list');
    const actionRow = element(documentRef, 'div', undefined, 'prompt-library-actions');
    const create = button(documentRef, '＋ Yeni istem');
    const importButton = button(documentRef, 'İçe aktar');
    const exportButton = button(documentRef, 'Dışa aktar');
    actionRow.append(create, importButton, exportButton);
    const editor = element(documentRef, 'div', undefined, 'prompt-library-editor'); editor.hidden = true;
    const file = documentRef.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    const status = element(documentRef, 'div', '', 'prompt-library-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    card.append(head, toolbar, filterRow, list, actionRow, editor, file, status); rail.append(card);

    const on = (target, type, handler) => { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); };
    const report = (message) => { status.textContent = trim(message, 180); };
    const persist = () => { const ok = saveItems(storage, items) && saveState(storage, state); if (!ok) report('Kütüphane cihazda kalıcı kaydedilemedi.'); return ok; };

    function updateTagOptions() {
      const current = state.tag; tag.replaceChildren();
      const all = element(documentRef, 'option', 'Tüm etiketler'); all.value = 'all'; tag.append(all);
      for (const value of collectTags(items)) { const option = element(documentRef, 'option', value); option.value = value; tag.append(option); }
      tag.value = collectTags(items).some((value) => value.toLocaleLowerCase('tr-TR') === current.toLocaleLowerCase('tr-TR')) ? current : 'all';
    }
    function renderEditor(existing) {
      editor.hidden = false; editor.replaceChildren();
      const title = documentRef.createElement('input'); title.maxLength = LIMITS.maxTitle; title.value = existing?.title || ''; title.setAttribute('aria-label', 'İstem başlığı');
      const body = documentRef.createElement('textarea'); body.maxLength = LIMITS.maxBody; body.rows = 7; body.value = existing?.body || ''; body.setAttribute('aria-label', 'İstem metni');
      const tagsInput = documentRef.createElement('input'); tagsInput.maxLength = 220; tagsInput.value = existing?.tags?.join(', ') || ''; tagsInput.placeholder = 'etiket1, etiket2'; tagsInput.setAttribute('aria-label', 'İstem etiketleri');
      const hint = element(documentRef, 'div', existing ? `Değişkenler: ${extractVariables(existing.body).map((v) => `{{${v}}}`).join(' · ')}` : 'Değişkenleri {{konu}} biçiminde yazabilirsiniz.', 'prompt-library-variable-help');
      const save = button(documentRef, 'Kaydet'); const cancel = button(documentRef, 'Vazgeç');
      const actions = element(documentRef, 'div', undefined, 'prompt-library-editor-actions'); actions.append(save, cancel);
      editor.append(element(documentRef, 'label', 'Başlık'), title, element(documentRef, 'label', 'İstem metni'), body, element(documentRef, 'label', 'Etiketler'), tagsInput, hint, actions);
      body.addEventListener('input', () => { const vars = extractVariables(body.value); hint.textContent = vars.length ? `Değişkenler: ${vars.map((v) => `{{${v}}}`).join(' · ')}` : 'Değişken yok'; });
      cancel.addEventListener('click', () => { editor.hidden = true; editor.replaceChildren(); });
      save.addEventListener('click', () => {
        const next = normalizeItem({ id: existing?.id || id(), title: title.value, body: body.value, tags: tagsInput.value.split(','), favorite: existing?.favorite === true, useCount: existing?.useCount || 0, createdAt: existing?.createdAt || timestamp(), updatedAt: timestamp() });
        if (!next) return report('İstem metni boş olamaz.');
        const index = items.findIndex((candidate) => candidate.id === next.id); if (index >= 0) items.splice(index, 1, next); else items.unshift(next);
        items = normalizeCollection(items); persist(); editor.hidden = true; editor.replaceChildren(); render(); report('İstem kaydedildi.');
      });
      title.focus();
    }
    function use(existing) {
      const names = extractVariables(existing.body); const values = {};
      for (const name of names) { const value = rootRef.prompt?.(`${name} değerini gir:`, '') ?? ''; if (value === null) return; values[name] = String(value).slice(0, LIMITS.maxVariableValue); }
      composer.value = replaceVariables(existing.body, values); composer.dispatchEvent(new Event('input', { bubbles: true })); composer.focus();
      const index = items.findIndex((candidate) => candidate.id === existing.id); if (index >= 0) items.splice(index, 1, normalizeItem({ ...items[index], useCount: items[index].useCount + 1, updatedAt: timestamp() }));
      persist(); report('İstem mesaj alanına aktarıldı.');
    }
    function render() {
      if (destroyed) return; search.value = state.query; sort.value = state.sort; favorite.setAttribute('aria-pressed', String(state.favoriteOnly)); updateTagOptions();
      const visible = filterItems(items, state); count.textContent = `${visible.length}/${items.length}`; list.replaceChildren();
      if (!visible.length) { list.append(element(documentRef, 'div', items.length ? 'Filtreye uyan istem yok.' : 'Kayıtlı istem yok.', 'prompt-library-empty')); return; }
      for (const item of visible) {
        const row = element(documentRef, 'article', undefined, 'prompt-item'); row.dataset.promptId = item.id;
        const check = documentRef.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(item.id); check.setAttribute('aria-label', `${item.title} seç`);
        const content = element(documentRef, 'div', undefined, 'prompt-item-content'); const header = element(documentRef, 'div', undefined, 'prompt-item-header');
        header.append(element(documentRef, 'strong', item.title)); const star = button(documentRef, item.favorite ? '★' : '☆', 'prompt-item-star'); star.setAttribute('aria-label', item.favorite ? 'Favoriden çıkar' : 'Favoriye al'); star.setAttribute('aria-pressed', String(item.favorite)); header.append(star);
        content.append(header, element(documentRef, 'p', item.body.replace(/\s+/g, ' ').slice(0, 120)));
        const meta = element(documentRef, 'div', `${new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(new Date(item.updatedAt))} · ${item.useCount} kullanım`, 'prompt-item-meta');
        for (const value of item.tags) meta.append(' ', element(documentRef, 'span', value, 'prompt-item-tag'));
        content.append(meta);
        const actions = element(documentRef, 'div', undefined, 'prompt-item-actions'); const useButton = button(documentRef, 'Kullan'); const edit = button(documentRef, 'Düzenle'); const remove = button(documentRef, 'Sil'); actions.append(useButton, edit, remove); content.append(actions); row.append(check, content); list.append(row);
        on(check, 'change', () => { if (check.checked) { if (selected.size < LIMITS.maxSelection) selected.add(item.id); else check.checked = false; } else selected.delete(item.id); });
        on(star, 'click', () => { const index = items.findIndex((candidate) => candidate.id === item.id); if (index < 0) return; items.splice(index, 1, normalizeItem({ ...items[index], favorite: !items[index].favorite, updatedAt: timestamp() })); persist(); render(); });
        on(useButton, 'click', () => use(item)); on(edit, 'click', () => renderEditor(item));
        on(remove, 'click', () => { if (!rootRef.confirm?.(`“${item.title}” silinsin mi?`)) return; items = items.filter((candidate) => candidate.id !== item.id); selected.delete(item.id); persist(); render(); report('İstem silindi.'); });
      }
      if (selected.size) {
        const bulk = element(documentRef, 'div', undefined, 'prompt-library-bulk'); const makeFavorite = button(documentRef, 'Seçilenleri favorile'); const clear = button(documentRef, `${selected.size} seçimi temizle`); bulk.append(makeFavorite, clear); list.prepend(bulk);
        on(makeFavorite, 'click', () => { const ids = new Set(selected); items = items.map((item) => ids.has(item.id) ? normalizeItem({ ...item, favorite: true, updatedAt: timestamp() }) : item); selected.clear(); persist(); render(); });
        on(clear, 'click', () => { selected.clear(); render(); });
      }
    }
    function doImport(fileObject) {
      if (!fileObject || fileObject.size > LIMITS.maxImport) return report('İçe aktarma dosyası 1 MB sınırını aşamaz.');
      const reader = new FileReader();
      reader.onload = () => { try { const parsed = normalizeImportedPayload(JSON.parse(String(reader.result || ''))); const merged = mergeImportedItems(items, parsed.items); items = merged.items; persist(); render(); report(`${merged.imported} istem içe aktarıldı.`); } catch { report('Geçersiz istem yedeği.'); } };
      reader.onerror = () => report('İstem yedeği okunamadı.'); reader.readAsText(fileObject);
    }
    on(search, 'input', () => { state.query = trim(search.value, LIMITS.maxQuery); persist(); render(); });
    on(sort, 'change', () => { state.sort = sort.value; persist(); render(); });
    on(tag, 'change', () => { state.tag = tag.value; persist(); render(); });
    on(favorite, 'click', () => { state.favoriteOnly = !state.favoriteOnly; persist(); render(); });
    on(create, 'click', () => renderEditor(null));
    on(importButton, 'click', () => file.click()); on(file, 'change', () => { doImport(file.files?.[0]); file.value = ''; });
    on(exportButton, 'click', () => { const ids = selected.size ? selected : new Set(filterItems(items, state).map((item) => item.id).slice(0, LIMITS.maxSelection)); const chosen = items.filter((item) => ids.has(item.id)); if (!chosen.length) return report('Dışa aktarılacak istem yok.'); const blob = new Blob([exportPayload(chosen)], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = element(documentRef, 'a'); link.href = url; link.download = 'hafize-prompt-library.json'; link.click(); rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0); report(`${chosen.length} istem dışa aktarıldı.`); });
    on(rootRef, 'storage', (event) => { if (event.key === STORAGE_KEY) { items = loadItems(storage); render(); } if (event.key === STATE_KEY) { state = loadState(storage); render(); } });
    on(documentRef, 'keydown', (event) => { if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'p') return; event.preventDefault(); search.focus(); search.select(); });
    render();
    const controller = Object.freeze({ mounted: true, getItems: () => items.slice(), getState: () => ({ ...state }), getVisibleItems: () => filterItems(items, state), destroy: () => { destroyed = true; for (const off of listeners.splice(0)) off(); card.remove(); } });
    // The card outlives the page only through its window-level listeners, so
    // unload tears them down the same way every other Hafize surface does.
    rootRef.addEventListener?.('beforeunload', () => controller.destroy(), { once: true });
    return controller;
  }

  return Object.freeze({ STORAGE_KEY, STATE_KEY, LIMITS: Object.freeze(LIMITS), normalizeItem, normalizeCollection, safeState, loadItems, loadState, saveItems, saveState, extractVariables, replaceVariables, itemMatches: matches, sortItems, filterItems, collectTags, normalizeImportedPayload, mergeImportedItems, exportPayload, mount });
});
