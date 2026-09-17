(function installPromptCollectionWorkspace(root) {
  'use strict';

  const CORE_KEY = 'hafize.prompt-library.collections.v1';
  const WORKSPACE_KEY = 'hafize.prompt-library.collections-workspace.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const PANEL_ID = 'promptLibraryCollectionsWorkspace';
  const LEGACY_ID = 'promptLibraryCollections';
  const MAX_SELECTED = 40;
  const MAX_QUERY = 100;
  const MAX_NAME = 80;
  const MAX_DESCRIPTION = 240;
  const MAX_MEMBER_QUERY = 100;
  const MAX_META_ITEMS = 40;
  const MAX_IMPORT_BYTES = 500_000;
  const MAX_EXPORT_BYTES = 750_000;
  const MAX_USE_COUNT = 9999;
  const COLORS = Object.freeze(['default', 'blue', 'green', 'gold', 'rose', 'violet']);
  const SORTS = Object.freeze(['updated-desc', 'name-asc', 'members-desc', 'usage-desc', 'favorite-first']);
  const FILTERS = Object.freeze(['all', 'favorite', 'active', 'archived']);
  const DEFAULT_STATE = Object.freeze({
    query: '',
    memberQuery: '',
    sort: 'updated-desc',
    filter: 'all',
    activeId: '',
    selectedIds: [],
    hidden: false
  });

  const doc = () => root.document;
  const storage = () => root.localStorage;
  const clip = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const now = () => new Date().toISOString();
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function readJson(key, fallback) {
    try {
      const raw = storage()?.getItem?.(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      storage()?.setItem?.(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function core() {
    return root.HafizePromptLibraryCollections;
  }

  function readCollections() {
    const api = core();
    return api?.readCollections?.(storage()) || [];
  }

  function promptRecords() {
    try {
      const raw = storage()?.getItem?.(PROMPT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string') : [];
    } catch {
      return [];
    }
  }

  function validPromptIds() {
    return new Set(promptRecords().map((item) => item.id));
  }

  function normalizeMeta(input) {
    if (!input || typeof input !== 'object') return null;
    const useCount = Number.isFinite(input.useCount) && input.useCount >= 0
      ? Math.min(MAX_USE_COUNT, Math.floor(input.useCount))
      : 0;
    return {
      favorite: input.favorite === true,
      archived: input.archived === true,
      useCount,
      lastUsedAt: clip(input.lastUsedAt, 40)
    };
  }

  function normalizeMetaMap(value, collections) {
    const valid = new Set(collections.map((item) => item.id));
    const source = value && typeof value === 'object' ? value : {};
    const output = {};
    for (const id of Object.keys(source).slice(0, MAX_META_ITEMS)) {
      if (!valid.has(id)) continue;
      const meta = normalizeMeta(source[id]);
      if (meta) output[id] = meta;
    }
    for (const item of collections) {
      if (!output[item.id]) output[item.id] = normalizeMeta({});
    }
    return output;
  }

  function normalizeState(input, collections = readCollections()) {
    const source = input && typeof input === 'object' ? input : {};
    const ids = new Set(collections.map((item) => item.id));
    const selected = Array.isArray(source.selectedIds)
      ? [...new Set(source.selectedIds.filter((id) => typeof id === 'string' && ids.has(id)))].slice(0, MAX_SELECTED)
      : [];
    const activeId = typeof source.activeId === 'string' && ids.has(source.activeId) ? source.activeId : '';
    return {
      query: clip(source.query, MAX_QUERY),
      memberQuery: clip(source.memberQuery, MAX_MEMBER_QUERY),
      sort: SORTS.includes(source.sort) ? source.sort : DEFAULT_STATE.sort,
      filter: FILTERS.includes(source.filter) ? source.filter : DEFAULT_STATE.filter,
      activeId,
      selectedIds: selected,
      hidden: source.hidden === true
    };
  }

  function loadWorkspace() {
    const collections = readCollections();
    const raw = readJson(WORKSPACE_KEY, {});
    return {
      state: normalizeState(raw?.state, collections),
      meta: normalizeMetaMap(raw?.meta, collections)
    };
  }

  function saveWorkspace(workspace) {
    const collections = readCollections();
    const state = normalizeState(workspace?.state, collections);
    const meta = normalizeMetaMap(workspace?.meta, collections);
    return writeJson(WORKSPACE_KEY, { version: 2, state, meta });
  }

  function metaFor(workspace, id) {
    return workspace.meta[id] || normalizeMeta({});
  }

  function collectionUseCount(workspace, collection) {
    return metaFor(workspace, collection.id).useCount;
  }

  function sortCollections(collections, workspace) {
    const output = collections.slice();
    const { sort } = workspace.state;
    if (sort === 'name-asc') return output.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    if (sort === 'members-desc') return output.sort((a, b) => b.promptIds.length - a.promptIds.length || a.name.localeCompare(b.name, 'tr'));
    if (sort === 'usage-desc') return output.sort((a, b) => collectionUseCount(workspace, b) - collectionUseCount(workspace, a) || b.updatedAt.localeCompare(a.updatedAt));
    if (sort === 'favorite-first') {
      return output.sort((a, b) => Number(metaFor(workspace, b.id).favorite) - Number(metaFor(workspace, a.id).favorite)
        || b.updatedAt.localeCompare(a.updatedAt));
    }
    return output.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'tr'));
  }

  function matchesFilter(collection, workspace) {
    const meta = metaFor(workspace, collection.id);
    if (workspace.state.filter === 'favorite') return meta.favorite;
    if (workspace.state.filter === 'active') return !meta.archived;
    if (workspace.state.filter === 'archived') return meta.archived;
    return true;
  }

  function matchesQuery(collection, workspace) {
    const query = workspace.state.query.toLocaleLowerCase('tr-TR');
    if (!query) return true;
    return [collection.name, collection.description].join('\n').toLocaleLowerCase('tr-TR').includes(query);
  }

  function visibleCollections(workspace) {
    return sortCollections(
      readCollections().filter((collection) => matchesFilter(collection, workspace) && matchesQuery(collection, workspace)),
      workspace
    );
  }

  function promptMap() {
    return new Map(promptRecords().map((item) => [item.id, item]));
  }

  function membersFor(collection, workspace) {
    const map = promptMap();
    const query = workspace.state.memberQuery.toLocaleLowerCase('tr-TR');
    return collection.promptIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .filter((item) => !query || [item.title, item.body, ...(Array.isArray(item.tags) ? item.tags : [])].join('\n').toLocaleLowerCase('tr-TR').includes(query));
  }

  function stats(workspace) {
    const collections = readCollections();
    const favorite = collections.filter((item) => metaFor(workspace, item.id).favorite).length;
    const archived = collections.filter((item) => metaFor(workspace, item.id).archived).length;
    const members = new Set(collections.flatMap((item) => item.promptIds));
    const uses = collections.reduce((sum, item) => sum + collectionUseCount(workspace, item), 0);
    return { total: collections.length, favorite, archived, members: members.size, uses };
  }

  function emitChanged() {
    try {
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-collections-workspace-changed', { detail: { key: WORKSPACE_KEY } }));
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-collections-changed', { detail: { key: CORE_KEY } }));
    } catch {}
  }

  function ensureWorkspaceState(workspace) {
    saveWorkspace(workspace);
    return loadWorkspace();
  }

  function mutateMeta(workspace, ids, patch) {
    const next = { ...workspace.meta };
    for (const id of ids.slice(0, MAX_SELECTED)) next[id] = normalizeMeta({ ...metaFor(workspace, id), ...patch });
    return { ...workspace, meta: normalizeMetaMap(next, readCollections()) };
  }

  function markUsed(workspace, id) {
    const current = metaFor(workspace, id);
    return mutateMeta(workspace, [id], { useCount: Math.min(MAX_USE_COUNT, current.useCount + 1), lastUsedAt: now() });
  }

  function reorderCollection(id, direction, workspace) {
    const collections = readCollections();
    const index = collections.findIndex((item) => item.id === id);
    if (index < 0) return workspace;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= collections.length) return workspace;
    [collections[index], collections[nextIndex]] = [collections[nextIndex], collections[index]];
    if (!core()?.saveCollections?.(storage(), collections)) return workspace;
    return ensureWorkspaceState({ ...workspace, state: { ...workspace.state, activeId: workspace.state.activeId } });
  }

  function deleteCollections(ids, workspace) {
    const selected = new Set(ids.slice(0, MAX_SELECTED));
    const collections = readCollections().filter((item) => !selected.has(item.id));
    if (!core()?.saveCollections?.(storage(), collections)) return workspace;
    return ensureWorkspaceState({
      ...workspace,
      state: {
        ...workspace.state,
        selectedIds: workspace.state.selectedIds.filter((id) => !selected.has(id)),
        activeId: selected.has(workspace.state.activeId) ? '' : workspace.state.activeId
      }
    });
  }

  function exportWorkspace(workspace) {
    const collections = readCollections();
    const metaByName = {};
    for (const collection of collections) metaByName[collection.name.toLocaleLowerCase('tr-TR')] = metaFor(workspace, collection.id);
    const payload = {
      version: 2,
      source: 'hafize-prompt-library-collections-workspace',
      exportedAt: now(),
      collections,
      metadataByName: metaByName
    };
    const output = JSON.stringify(payload, null, 2);
    return output.length <= MAX_EXPORT_BYTES ? output : JSON.stringify({ ...payload, collections: collections.slice(0, 20) }, null, 2);
  }

  function importWorkspace(payload, workspace) {
    const api = core();
    if (!api?.importPayload) return { workspace, imported: 0, skipped: 0 };
    const before = readCollections();
    const result = api.importPayload(payload, storage());
    const after = readCollections();
    const byName = payload && typeof payload.metadataByName === 'object' ? payload.metadataByName : {};
    const nextMeta = { ...workspace.meta };
    const beforeIds = new Set(before.map((item) => item.id));
    for (const collection of after) {
      if (beforeIds.has(collection.id)) continue;
      const saved = normalizeMeta(byName[collection.name.toLocaleLowerCase('tr-TR')]);
      if (saved) nextMeta[collection.id] = saved;
    }
    const next = ensureWorkspaceState({ ...workspace, meta: nextMeta });
    return { workspace: next, imported: result.imported || 0, skipped: result.skipped || 0 };
  }

  function element(tag, textValue, className) {
    const node = doc().createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue);
    return node;
  }

  function button(label, action, className = 'mini-btn') {
    const node = element('button', label, className);
    node.type = 'button';
    node.dataset.collectionWorkspaceAction = action;
    node.setAttribute('aria-label', label);
    return node;
  }

  function statusNode(panel) {
    return panel.querySelector('.prompt-library-collections-workspace-status');
  }

  function announce(panel, message) {
    const node = statusNode(panel);
    if (!node) return;
    const value = clip(message, 180);
    node.textContent = value;
    root.setTimeout?.(() => {
      if (node.textContent === value) node.textContent = '';
    }, 2800);
  }

  function buildDialog() {
    const panel = element('section');
    panel.className = 'prompt-collection-editor-overlay';
    panel.id = 'promptCollectionEditor';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'promptCollectionEditorTitle');

    const shell = element('div', undefined, 'prompt-collection-editor-shell');
    const head = element('div', undefined, 'prompt-collection-editor-head');
    const title = element('strong', 'Koleksiyon oluştur', 'prompt-collection-editor-title');
    title.id = 'promptCollectionEditorTitle';
    const close = button('Kapat', 'close-editor');
    head.append(title, close);

    const form = element('form', undefined, 'prompt-collection-editor-form');
    form.noValidate = true;
    const nameLabel = element('label', 'Ad');
    const name = element('input');
    name.type = 'text';
    name.maxLength = MAX_NAME;
    name.required = true;
    name.autocomplete = 'off';
    name.setAttribute('aria-label', 'Koleksiyon adı');
    nameLabel.append(name);

    const descriptionLabel = element('label', 'Açıklama');
    const description = element('textarea');
    description.rows = 4;
    description.maxLength = MAX_DESCRIPTION;
    description.setAttribute('aria-label', 'Koleksiyon açıklaması');
    descriptionLabel.append(description);

    const colorLabel = element('label', 'Renk');
    const color = element('select');
    color.setAttribute('aria-label', 'Koleksiyon rengi');
    for (const value of COLORS) { const option = element('option', value === 'default' ? 'Varsayılan' : value); option.value = value; color.append(option); }
    colorLabel.append(color);

    const favoriteLabel = element('label');
    const favorite = element('input');
    favorite.type = 'checkbox';
    favorite.setAttribute('aria-label', 'Favori koleksiyon');
    favoriteLabel.append(favorite, element('span', 'Favoriye ekle'));

    const archivedLabel = element('label');
    const archived = element('input');
    archived.type = 'checkbox';
    archived.setAttribute('aria-label', 'Koleksiyonu arşivle');
    archivedLabel.append(archived, element('span', 'Arşivle'));

    const error = element('div', '', 'prompt-collection-editor-error');
    error.setAttribute('role', 'alert');
    const actions = element('div', undefined, 'prompt-collection-editor-actions');
    const cancel = button('Vazgeç', 'close-editor');
    const save = button('Kaydet', 'save-editor');
    actions.append(cancel, save);
    form.append(nameLabel, descriptionLabel, colorLabel, favoriteLabel, archivedLabel, error, actions);
    shell.append(head, form);
    panel.append(shell);
    return { panel, title, name, description, color, favorite, archived, error, form };
  }

  function mount(documentRef = doc(), rootRef = root) {
    if (!documentRef || !rootRef.HafizePromptLibraryCollections) return null;
    const card = documentRef.getElementById('promptLibraryCard');
    if (!card) return null;
    documentRef.getElementById(LEGACY_ID)?.remove();
    documentRef.getElementById(PANEL_ID)?.remove();

    let workspace = loadWorkspace();
    const panel = element('section', undefined, 'prompt-library-collections-workspace');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-labelledby', 'promptLibraryCollectionsWorkspaceTitle');
    panel.dataset.workspaceVersion = '2';

    const head = element('div', undefined, 'prompt-library-collections-workspace-head');
    const title = element('strong', 'Koleksiyon çalışma alanı', 'prompt-library-collections-workspace-title');
    title.id = 'promptLibraryCollectionsWorkspaceTitle';
    const summary = element('span', '', 'prompt-library-collections-workspace-summary');
    const collapse = button('Gizle', 'toggle-workspace');
    collapse.setAttribute('aria-expanded', String(!workspace.state.hidden));
    head.append(title, summary, collapse);

    const toolbar = element('div', undefined, 'prompt-library-collections-workspace-toolbar');
    const search = element('input');
    search.type = 'search';
    search.maxLength = MAX_QUERY;
    search.placeholder = 'Koleksiyon ara…';
    search.setAttribute('aria-label', 'Koleksiyon çalışma alanında ara');
    const sort = element('select');
    sort.setAttribute('aria-label', 'Koleksiyonları sırala');
    for (const [value, label] of [['updated-desc', 'Son güncellenen'], ['name-asc', 'Ada göre'], ['members-desc', 'Üye sayısı'], ['usage-desc', 'Kullanım'], ['favorite-first', 'Favoriler']]) {
      const option = element('option', label); option.value = value; sort.append(option);
    }
    const filter = element('select');
    filter.setAttribute('aria-label', 'Koleksiyon filtresi');
    for (const [value, label] of [['all', 'Tümü'], ['active', 'Aktif'], ['favorite', 'Favoriler'], ['archived', 'Arşivliler']]) {
      const option = element('option', label); option.value = value; filter.append(option);
    }
    toolbar.append(search, sort, filter, button('＋ Koleksiyon', 'create-editor'));

    const statsRow = element('div', undefined, 'prompt-library-collections-workspace-stats');
    const statNodes = {};
    for (const [key, label] of [['total', 'Koleksiyon'], ['favorite', 'Favori'], ['archived', 'Arşiv'], ['members', 'İstem'], ['uses', 'Kullanım']]) {
      const stat = element('div', undefined, 'prompt-collection-workspace-stat');
      statNodes[key] = element('strong', '0', 'prompt-collection-workspace-stat-value');
      stat.append(statNodes[key], element('span', label, 'prompt-collection-workspace-stat-label'));
      statsRow.append(stat);
    }

    const bulk = element('div', undefined, 'prompt-library-collections-workspace-bulk');
    bulk.hidden = true;
    bulk.append(
      button('Favorile', 'bulk-favorite'),
      button('Arşivle', 'bulk-archive'),
      button('Arşivden çıkar', 'bulk-unarchive'),
      button('Sil', 'bulk-delete'),
      button('Seçimi kaldır', 'clear-selection')
    );

    const list = element('div', undefined, 'prompt-library-collections-workspace-list');
    list.setAttribute('role', 'list');
    const details = element('section', undefined, 'prompt-library-collection-details');
    details.hidden = true;
    details.setAttribute('aria-labelledby', 'promptCollectionDetailsTitle');
    const detailHead = element('div', undefined, 'prompt-library-collection-details-head');
    const detailTitle = element('strong', '', 'prompt-library-collection-details-title');
    detailTitle.id = 'promptCollectionDetailsTitle';
    const detailClose = button('Detayı kapat', 'close-details');
    detailHead.append(detailTitle, detailClose);
    const memberToolbar = element('div', undefined, 'prompt-library-collection-members-toolbar');
    const memberSearch = element('input');
    memberSearch.type = 'search';
    memberSearch.maxLength = MAX_MEMBER_QUERY;
    memberSearch.placeholder = 'Üye istem ara…';
    memberSearch.setAttribute('aria-label', 'Koleksiyon üyelerinde ara');
    memberToolbar.append(memberSearch, button('Seçili istemleri ekle', 'add-selected-members'), button('Üyeleri seç', 'select-members'));
    const memberList = element('div', undefined, 'prompt-library-collection-members');
    memberList.setAttribute('role', 'list');
    details.append(detailHead, memberToolbar, memberList);

    const status = element('div', '', 'prompt-library-collections-workspace-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    panel.append(head, toolbar, statsRow, bulk, list, details, status);
    card.append(panel);
    const editor = buildDialog();
    card.append(editor.panel);

    let editingId = '';
    let lastFocus = null;
    let destroyed = false;
    const disposers = [];
    let observer = null;

    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      disposers.push(() => target.removeEventListener(type, handler, options));
    };

    function persist(nextWorkspace) {
      if (!saveWorkspace(nextWorkspace)) {
        announce(panel, 'Koleksiyon çalışma alanı kaydedilemedi.');
        return workspace;
      }
      workspace = loadWorkspace();
      return workspace;
    }

    function updateSummary() {
      const data = stats(workspace);
      summary.textContent = `${data.total} koleksiyon · ${data.favorite} favori · ${data.archived} arşiv · ${data.uses} kullanım`;
      for (const key of Object.keys(statNodes)) statNodes[key].textContent = String(data[key]);
    }

    function selectedIds() {
      return workspace.state.selectedIds.slice(0, MAX_SELECTED);
    }

    function syncRowVisibility() {
      const activeId = workspace.state.activeId;
      const rows = [...list.querySelectorAll('.prompt-collection-workspace-row')];
      for (const row of rows) row.hidden = Boolean(activeId) && row.dataset.collectionId !== activeId;
    }

    function updateBulk() {
      bulk.hidden = !selectedIds().length;
    }

    function renderMembers() {
      const collection = readCollections().find((item) => item.id === workspace.state.activeId);
      if (!collection) {
        details.hidden = true;
        return;
      }
      details.hidden = workspace.state.hidden;
      detailTitle.textContent = collection.name;
      memberSearch.value = workspace.state.memberQuery;
      memberList.replaceChildren();
      const members = membersFor(collection, workspace);
      if (!members.length) {
        memberList.append(element('div', collection.promptIds.length ? 'Aramayla eşleşen üye yok.' : 'Bu koleksiyonda istem yok.', 'prompt-library-collection-members-empty'));
        return;
      }
      const current = new Set(collection.promptIds);
      for (const prompt of members) {
        const row = element('article', undefined, 'prompt-library-collection-member-row');
        row.dataset.promptId = prompt.id;
        row.setAttribute('role', 'listitem');
        const info = element('div', undefined, 'prompt-library-collection-member-info');
        info.append(element('strong', clip(prompt.title, 100), 'prompt-library-collection-member-title'));
        info.append(element('span', clip(String(prompt.body || '').replace(/\s+/g, ' '), 160), 'prompt-library-collection-member-preview'));
        const remove = button('Çıkar', 'remove-member');
        row.append(info, remove);
        memberList.append(row);
      }
      memberList.dataset.memberCount = String(current.size);
    }

    function render() {
      if (destroyed) return;
      workspace = loadWorkspace();
      search.value = workspace.state.query;
      sort.value = workspace.state.sort;
      filter.value = workspace.state.filter;
      panel.hidden = workspace.state.hidden;
      collapse.textContent = workspace.state.hidden ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!workspace.state.hidden));
      updateSummary();
      list.replaceChildren();
      const collections = visibleCollections(workspace);
      if (!collections.length) list.append(element('div', 'Eşleşen koleksiyon yok.', 'prompt-library-collections-workspace-empty'));
      for (const collection of collections) {
        const meta = metaFor(workspace, collection.id);
        const row = element('article', undefined, `prompt-collection-workspace-row${workspace.state.activeId === collection.id ? ' is-active' : ''}`);
        row.dataset.collectionId = collection.id;
        row.setAttribute('role', 'listitem');
        row.tabIndex = 0;
        const check = element('input');
        check.type = 'checkbox';
        check.checked = workspace.state.selectedIds.includes(collection.id);
        check.setAttribute('aria-label', `${collection.name} koleksiyonunu seç`);
        const color = element('span', '', `prompt-collection-workspace-color color-${COLORS.includes(collection.color) ? collection.color : 'default'}`);
        color.setAttribute('aria-hidden', 'true');
        const info = element('div', undefined, 'prompt-collection-workspace-info');
        const name = element('strong', clip(collection.name, MAX_NAME), 'prompt-collection-workspace-name');
        const description = element('span', clip(collection.description, MAX_DESCRIPTION), 'prompt-collection-workspace-description');
        const metaLine = element('span', `${collection.promptIds.length} istem · ${meta.useCount} kullanım${meta.lastUsedAt ? ` · ${new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(new Date(meta.lastUsedAt))}` : ''}`, 'prompt-collection-workspace-meta');
        info.append(name);
        if (collection.description) info.append(description);
        info.append(metaLine);
        const actions = element('div', undefined, 'prompt-collection-workspace-actions');
        const activate = button(workspace.state.activeId === collection.id ? 'Kapat' : 'Aç', 'activate');
        const favorite = button(meta.favorite ? '★' : '☆', 'favorite');
        favorite.setAttribute('aria-pressed', String(meta.favorite));
        favorite.setAttribute('aria-label', meta.favorite ? 'Favoriden çıkar' : 'Favoriye al');
        const archive = button(meta.archived ? 'Arşivden çıkar' : 'Arşivle', 'archive');
        const up = button('↑', 'move-up');
        const down = button('↓', 'move-down');
        const edit = button('Düzenle', 'edit');
        const duplicate = button('Çoğalt', 'duplicate');
        const remove = button('Sil', 'delete');
        for (const action of [activate, favorite, archive, up, down, edit, duplicate, remove]) actions.append(action);
        row.append(check, color, info, actions);
        list.append(row);

        on(check, 'change', () => {
          const ids = new Set(workspace.state.selectedIds);
          if (check.checked) ids.add(collection.id); else ids.delete(collection.id);
          workspace = persist({ ...workspace, state: { ...workspace.state, selectedIds: [...ids].slice(0, MAX_SELECTED) } });
          updateBulk();
        });

        on(row, 'keydown', (event) => {
          const active = doc().activeElement;
          if (active && active !== row && active.matches?.('input,button,select,textarea')) return;
          if (event.key === 'Enter') { event.preventDefault(); activate.click(); }
          else if (event.key.toLowerCase() === 'f') { event.preventDefault(); favorite.click(); }
          else if (event.key.toLowerCase() === 'a') { event.preventDefault(); archive.click(); }
          else if (event.key === 'Delete') { event.preventDefault(); remove.click(); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(row, -1); }
          else if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(row, 1); }
        });
        on(activate, 'click', () => {
          const isOpen = workspace.state.activeId === collection.id;
          workspace = persist({ ...workspace, state: { ...workspace.state, activeId: isOpen ? '' : collection.id, memberQuery: '' } });
          if (!isOpen) workspace = persist(markUsed(workspace, collection.id));
          render();
          announce(panel, isOpen ? 'Koleksiyon detayı kapatıldı.' : `“${collection.name}” açıldı.`);
        });
        on(favorite, 'click', () => {
          workspace = persist(mutateMeta(workspace, [collection.id], { favorite: !meta.favorite }));
          render();
        });
        on(archive, 'click', () => {
          workspace = persist(mutateMeta(workspace, [collection.id], { archived: !meta.archived }));
          render();
          announce(panel, meta.archived ? 'Koleksiyon arşivden çıkarıldı.' : 'Koleksiyon arşivlendi.');
        });
        on(up, 'click', () => { workspace = reorderCollection(collection.id, 'up', workspace); render(); });
        on(down, 'click', () => { workspace = reorderCollection(collection.id, 'down', workspace); render(); });
        on(edit, 'click', () => openEditor(collection.id));
        on(duplicate, 'click', () => {
          const created = core()?.createCollection?.({ name: `${collection.name} kopyası`, description: collection.description, color: collection.color }, storage());
          if (!created) return announce(panel, 'Koleksiyon çoğaltılamadı.');
          core()?.setMembership?.(created.id, collection.promptIds, storage());
          const sourceMeta = metaFor(workspace, collection.id);
          workspace = persist({ ...workspace, meta: { ...workspace.meta, [created.id]: normalizeMeta({ ...sourceMeta, useCount: 0, lastUsedAt: '' }) } });
          emitChanged();
          render();
          announce(panel, 'Koleksiyon çoğaltıldı.');
        });
        on(remove, 'click', () => {
          if (!rootRef.confirm?.(`“${collection.name}” silinsin mi?`)) return;
          workspace = persist(deleteCollections([collection.id], workspace));
          emitChanged();
          render();
          announce(panel, 'Koleksiyon silindi.');
        });
      }
      syncRowVisibility();
      updateBulk();
      renderMembers();
    }

    function moveFocus(row, direction) {
      const rows = [...list.querySelectorAll('.prompt-collection-workspace-row')].filter((item) => !item.hidden);
      const index = rows.indexOf(row);
      const target = rows[index + direction];
      target?.focus?.();
    }

    function openEditor(id = '') {
      const existing = id ? readCollections().find((item) => item.id === id) : null;
      editingId = id;
      lastFocus = doc().activeElement;
      editor.title.textContent = existing ? 'Koleksiyonu düzenle' : 'Koleksiyon oluştur';
      editor.name.value = existing?.name || '';
      editor.description.value = existing?.description || '';
      editor.color.value = COLORS.includes(existing?.color) ? existing.color : 'default';
      const meta = existing ? metaFor(workspace, existing.id) : normalizeMeta({});
      editor.favorite.checked = meta.favorite;
      editor.archived.checked = meta.archived;
      editor.error.textContent = '';
      editor.panel.hidden = false;
      editor.name.focus();
    }

    function closeEditor() {
      editor.panel.hidden = true;
      editor.error.textContent = '';
      editingId = '';
      lastFocus?.focus?.();
      lastFocus = null;
    }

    function saveEditor() {
      const name = clip(editor.name.value, MAX_NAME);
      const description = clip(editor.description.value, MAX_DESCRIPTION);
      if (!name) return editor.error.textContent = 'Koleksiyon adı gerekli.';
      const existing = editingId ? readCollections().find((item) => item.id === editingId) : null;
      const duplicate = readCollections().some((item) => item.id !== editingId && item.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
      if (duplicate) return editor.error.textContent = 'Bu adda bir koleksiyon zaten var.';
      if (existing) {
        const updated = core()?.updateCollection?.(editingId, { name, description, color: editor.color.value }, storage());
        if (!updated) return editor.error.textContent = 'Koleksiyon güncellenemedi.';
        workspace = persist(mutateMeta(workspace, [editingId], { favorite: editor.favorite.checked, archived: editor.archived.checked }));
        emitChanged();
        closeEditor();
        render();
        announce(panel, 'Koleksiyon güncellendi.');
        return;
      }
      const created = core()?.createCollection?.({ name, description, color: editor.color.value }, storage());
      if (!created) return editor.error.textContent = 'Koleksiyon oluşturulamadı.';
      workspace = persist(mutateMeta(workspace, [created.id], { favorite: editor.favorite.checked, archived: editor.archived.checked }));
      emitChanged();
      closeEditor();
      render();
      announce(panel, 'Koleksiyon oluşturuldu.');
    }

    function updateMemberQuery(value) {
      workspace = persist({ ...workspace, state: { ...workspace.state, memberQuery: clip(value, MAX_MEMBER_QUERY) } });
      renderMembers();
    }

    function currentCollection() {
      return readCollections().find((item) => item.id === workspace.state.activeId) || null;
    }

    function handleAction(action, target) {
      if (action === 'toggle-workspace') {
        workspace = persist({ ...workspace, state: { ...workspace.state, hidden: !workspace.state.hidden } });
        render();
        return;
      }
      if (action === 'create-editor') return openEditor();
      if (action === 'close-editor') return closeEditor();
      if (action === 'save-editor') return saveEditor();
      if (action === 'close-details') {
        workspace = persist({ ...workspace, state: { ...workspace.state, activeId: '', memberQuery: '' } });
        render();
        return;
      }
      if (action === 'bulk-favorite' || action === 'bulk-archive' || action === 'bulk-unarchive') {
        const patch = action === 'bulk-favorite' ? { favorite: true } : { archived: action === 'bulk-archive' };
        workspace = persist(mutateMeta(workspace, selectedIds(), patch));
        render();
        return;
      }
      if (action === 'clear-selection') {
        workspace = persist({ ...workspace, state: { ...workspace.state, selectedIds: [] } });
        render();
        return;
      }
      if (action === 'bulk-delete') {
        const ids = selectedIds();
        if (!ids.length || !rootRef.confirm?.(`${ids.length} koleksiyon silinsin mi?`)) return;
        workspace = persist(deleteCollections(ids, workspace));
        emitChanged();
        render();
        announce(panel, `${ids.length} koleksiyon silindi.`);
        return;
      }
      const row = target?.closest?.('[data-collection-id]');
      const collectionId = row?.dataset?.collectionId || '';
      const collection = readCollections().find((item) => item.id === collectionId);
      if (!collection) return;
      if (action === 'activate') return row.querySelector('[data-collection-workspace-action="activate"]')?.click();
      if (action === 'favorite') return row.querySelector('[data-collection-workspace-action="favorite"]')?.click();
      if (action === 'archive') return row.querySelector('[data-collection-workspace-action="archive"]')?.click();
      if (action === 'move-up') return row.querySelector('[data-collection-workspace-action="move-up"]')?.click();
      if (action === 'move-down') return row.querySelector('[data-collection-workspace-action="move-down"]')?.click();
      if (action === 'edit') return openEditor(collection.id);
      if (action === 'duplicate') return row.querySelector('[data-collection-workspace-action="duplicate"]')?.click();
      if (action === 'delete') return row.querySelector('[data-collection-workspace-action="delete"]')?.click();
      if (action === 'remove-member') {
        const promptId = target.closest('[data-prompt-id]')?.dataset.promptId;
        const active = currentCollection();
        if (!promptId || !active) return;
        const next = core()?.removeMembers?.(active.id, [promptId], storage());
        if (!next) return announce(panel, 'İstem koleksiyondan çıkarılamadı.');
        emitChanged();
        render();
        announce(panel, 'İstem koleksiyondan çıkarıldı.');
      }
      if (action === 'add-selected-members') {
        const active = currentCollection();
        if (!active) return;
        const selectedPrompts = [...documentRef.querySelectorAll('#promptLibraryList .prompt-item')]
          .filter((item) => item.querySelector('[data-prompt-selection]:checked') || item.querySelector('input[type="checkbox"]:checked'))
          .map((item) => item.dataset.promptId).filter(Boolean).slice(0, MAX_SELECTED);
        if (!selectedPrompts.length) return announce(panel, 'Önce istem seç.');
        const updated = core()?.addMembers?.(active.id, selectedPrompts, storage());
        if (!updated) return announce(panel, 'Seçili istemler eklenemedi.');
        emitChanged();
        render();
        announce(panel, `${selectedPrompts.length} istem koleksiyona eklendi.`);
      }
      if (action === 'select-members') {
        documentRef.querySelectorAll('#promptLibraryList .prompt-item input[type="checkbox"]').forEach((input) => { input.checked = true; });
        announce(panel, 'Görünen istemler seçildi.');
      }
    }

    function keydown(event) {
      const modifier = event.ctrlKey || event.metaKey;
      const active = documentRef.activeElement;
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'l') {
        if (active?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
        event.preventDefault();
        search.focus();
        search.select();
        return;
      }
      if (editor.panel.hidden && !workspace.state.hidden && event.key === 'Escape' && workspace.state.activeId) {
        event.preventDefault();
        workspace = persist({ ...workspace, state: { ...workspace.state, activeId: '', memberQuery: '' } });
        render();
        return;
      }
      if (!editor.panel.hidden) {
        if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
        if (event.key === 'Tab') trapDialogTab(event, editor.panel);
        return;
      }
      if (documentRef.querySelector('.prompt-library-collections-workspace') !== panel) return;
      if (active?.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    }

    function trapDialogTab(event, dialog) {
      const focusables = [...dialog.querySelectorAll('button,input,textarea,select')].filter((node) => !node.disabled && !node.hidden);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && doc().activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc().activeElement === last) { event.preventDefault(); first.focus(); }
    }

    on(panel, 'click', (event) => {
      const target = event.target?.closest?.('[data-collection-workspace-action]');
      if (!target || !panel.contains(target)) return;
      handleAction(target.dataset.collectionWorkspaceAction, target);
    });
    on(editor.panel, 'click', (event) => {
      const target = event.target?.closest?.('[data-collection-workspace-action]');
      if (!target) return;
      handleAction(target.dataset.collectionWorkspaceAction, target);
    });
    on(search, 'input', () => {
      workspace = persist({ ...workspace, state: { ...workspace.state, query: clip(search.value, MAX_QUERY) } });
      render();
    });
    on(memberSearch, 'input', () => updateMemberQuery(memberSearch.value));
    on(sort, 'change', () => {
      workspace = persist({ ...workspace, state: { ...workspace.state, sort: sort.value } });
      render();
    });
    on(filter, 'change', () => {
      workspace = persist({ ...workspace, state: { ...workspace.state, filter: filter.value } });
      render();
    });
    on(editor.form, 'submit', (event) => { event.preventDefault(); saveEditor(); });
    on(editor.panel, 'click', (event) => { if (event.target === editor.panel) closeEditor(); });
    on(documentRef, 'keydown', keydown, { passive: false });
    on(rootRef, 'hafize:prompt-library-collections-changed', () => { workspace = loadWorkspace(); render(); });
    on(rootRef, 'storage', (event) => {
      if (event.key === WORKSPACE_KEY || event.key === CORE_KEY) { workspace = loadWorkspace(); render(); }
    });

    const onSelectionMutation = () => { if (!destroyed) updateBulk(); };
    observer = typeof MutationObserver === 'function' ? new MutationObserver(onSelectionMutation) : null;
    const promptList = documentRef.getElementById('promptLibraryList');
    observer?.observe(promptList || card, { childList: true, subtree: true });

    rootRef.HafizePromptLibraryCollectionsWorkspace = Object.freeze({
      active: true,
      STORAGE_KEY: WORKSPACE_KEY,
      mount: () => controller,
      export: () => exportWorkspace(workspace),
      import: (payload) => { const result = importWorkspace(payload, workspace); workspace = result.workspace; emitChanged(); render(); return result; },
      refresh: render
    });

    function cleanup() {
      destroyed = true;
      observer?.disconnect();
      for (const off of disposers.splice(0)) off();
      editor.panel.remove();
      panel.remove();
    }

    const controller = Object.freeze({
      mounted: true,
      refresh: render,
      export: () => exportWorkspace(workspace),
      destroy: cleanup
    });

    render();
    return controller;
  }

  const start = () => {
    if (!root.document || !root.HafizePromptLibraryCollections || root.HafizePromptLibraryCollectionsWorkspace?.active) return;
    mount(root.document, root);
  };

  root.HafizePromptLibraryCollectionsWorkspace = Object.freeze({ active: false, mount: () => start() });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
