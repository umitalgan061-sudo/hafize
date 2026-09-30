(function installHafizePromptSmartViews(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibrarySmartViews';
  const STORAGE_KEY = 'hafize.prompt-library.smart-views.v1';
  const STATE_KEY = `${STORAGE_KEY}.state`;
  const MAX_VIEWS = 24;
  const MAX_NAME = 72;
  const MAX_DESCRIPTION = 180;
  const MAX_QUERY = 180;
  const MAX_EXPORT = 300000;
  const MAX_TEXT = 120;

  const DEFAULT_STATE = Object.freeze({
    query: '',
    sort: 'updated-desc',
    collapsed: false,
    activeId: ''
  });

  const text = (doc, value, className) => {
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
  const clean = (value, max) => String(value ?? '').replace(/\\0/g, '').trim().slice(0, max);
  const lower = (value) => String(value ?? '').toLocaleLowerCase('tr-TR');

  function safeState(value) {
    if (!value || typeof value !== 'object') return { ...DEFAULT_STATE };
    return {
      query: clean(value.query, MAX_QUERY),
      sort: ['recent', 'name'].includes(value.sort) ? value.sort : DEFAULT_STATE.sort,
      collapsed: value.collapsed === true,
      activeId: clean(value.activeId, 120)
    };
  }

  function normalizeView(input) {
    if (!input || typeof input !== 'object') return null;
    const name = clean(input.name, MAX_NAME);
    if (!name) return null;
    const query = clean(input.query, MAX_QUERY);
    const description = clean(input.description, MAX_DESCRIPTION);
    const core = input.core && typeof input.core === 'object' ? input.core : {};
    const sort = ['updated-desc', 'favorite-first', 'created-desc', 'title-asc'].includes(core.sort)
      ? core.sort
      : 'updated-desc';
    const tag = core.tag === 'all' ? 'all' : clean(core.tag, 24) || 'all';
    return Object.freeze({
      id: clean(input.id, 120) || makeId(),
      name,
      description,
      query,
      favoriteOnly: core.favoriteOnly === true,
      tag,
      sort,
      minUse: Number.isFinite(Number(input.minUse)) ? Math.max(0, Math.min(9999, Math.floor(Number(input.minUse)))) : 0,
      maxUse: Number.isFinite(Number(input.maxUse)) ? Math.max(0, Math.min(9999, Math.floor(Number(input.maxUse)))) : 9999,
      hasVariables: input.hasVariables === true,
      pinned: input.pinned === true,
      createdAt: clean(input.createdAt, 40) || new Date().toISOString(),
      updatedAt: clean(input.updatedAt, 40) || new Date().toISOString()
    });
  }

  function normalizeViews(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const ids = new Set();
    for (const raw of value.slice(0, MAX_VIEWS * 2)) {
      const view = normalizeView(raw);
      if (!view || ids.has(view.id)) continue;
      ids.add(view.id);
      output.push(view);
      if (output.length >= MAX_VIEWS) break;
    }
    return output;
  }

  function load(storage = root.localStorage) {
    try {
      return normalizeViews(JSON.parse(storage?.getItem?.(STORAGE_KEY) || '[]'));
    } catch {
      return [];
    }
  }

  function save(views, storage = root.localStorage) {
    try {
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalizeViews(views)));
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-smart-views-changed'));
      return true;
    } catch {
      return false;
    }
  }

  function loadState(storage = root.localStorage) {
    try {
      return safeState(JSON.parse(storage?.getItem?.(STATE_KEY) || '{}'));
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  function saveState(value, storage = root.localStorage) {
    try {
      storage?.setItem?.(STATE_KEY, JSON.stringify(safeState(value)));
      return true;
    } catch {
      return false;
    }
  }

  function readCoreState(card) {
    return {
      query: clean(card.querySelector('#promptLibrarySearch')?.value || '', MAX_QUERY),
      tag: card.querySelector('.prompt-library-filters select')?.value || 'all',
      favoriteOnly: card.querySelector('#promptLibraryFavoriteFilter')?.getAttribute('aria-pressed') === 'true',
      sort: card.querySelector('.prompt-library-toolbar select')?.value || 'updated-desc'
    };
  }

  function parseUsageOperator(raw) {
    const match = String(raw || '').match(/^(>=|<=|=|>|<)?\\s*(\\d{1,4})$/);
    if (!match) return null;
    return { op: match[1] || '>=', value: Math.min(9999, Number(match[2])) };
  }

  function parseQuery(query) {
    const source = clean(query, MAX_QUERY);
    const tokens = [];
    let buffer = '';
    let quoted = false;
    for (const char of source) {
      if (char === '"' && (buffer === '' || !buffer.endsWith('\\\\'))) {
        quoted = !quoted;
        buffer += char;
      } else if (char === ' ' && !quoted) {
        if (buffer) tokens.push(buffer);
        buffer = '';
      } else {
        buffer += char;
      }
    }
    if (buffer) tokens.push(buffer);

    const result = { text: [], includeTags: [], excludeTags: [], favorite: null, hasVariables: null, usage: [] };
    for (const token of tokens) {
      const normalized = token.replace(/^"|"$/g, '');
      const lowerToken = lower(normalized);
      if (lowerToken.startsWith('tag:')) {
        const value = clean(normalized.slice(4), 24);
        if (value) result.includeTags.push(value);
        continue;
      }
      if (lowerToken.startsWith('-tag:')) {
        const value = clean(normalized.slice(5), 24);
        if (value) result.excludeTags.push(value);
        continue;
      }
      if (lowerToken === 'is:favorite' || lowerToken === 'favorite:true') {
        result.favorite = true;
        continue;
      }
      if (lowerToken === 'is:not-favorite' || lowerToken === 'favorite:false') {
        result.favorite = false;
        continue;
      }
      if (lowerToken === 'has:variable' || lowerToken === 'has:variables') {
        result.hasVariables = true;
        continue;
      }
      if (lowerToken === 'has:no-variable' || lowerToken === 'has:no-variables') {
        result.hasVariables = false;
        continue;
      }
      if (lowerToken.startsWith('used:')) {
        const usage = parseUsageOperator(normalized.slice(5));
        if (usage) result.usage.push(usage);
        else result.text.push(normalized);
        continue;
      }
      if (lowerToken.startsWith('usage:')) {
        const usage = parseUsageOperator(normalized.slice(6));
        if (usage) result.usage.push(usage);
        else result.text.push(normalized);
        continue;
      }
      if (lowerToken.startsWith('sort:')) continue;
      if (normalized) result.text.push(normalized);
    }
    return result;
  }

  function compareUsage(actual, rule) {
    if (rule.op === '>') return actual > rule.value;
    if (rule.op === '>=') return actual >= rule.value;
    if (rule.op === '<') return actual < rule.value;
    if (rule.op === '<=') return actual <= rule.value;
    return actual === rule.value;
  }

  function matches(item, spec) {
    if (!item || !spec) return false;
    if (spec.favorite !== null && item.favorite !== spec.favorite) return false;
    const names = Array.isArray(item.variables) ? item.variables : [];
    if (spec.hasVariables !== null && (names.length > 0) !== spec.hasVariables) return false;
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tagSet = new Set(tags.map(lower));
    if (spec.includeTags.some((tag) => !tagSet.has(lower(tag)))) return false;
    if (spec.excludeTags.some((tag) => tagSet.has(lower(tag)))) return false;
    if (spec.usage.some((rule) => !compareUsage(Number(item.useCount) || 0, rule))) return false;
    if (spec.text.length) {
      const haystack = lower([item.title, item.body, ...tags, ...names].join(' '));
      if (spec.text.some((part) => !haystack.includes(lower(part)))) return false;
    }
    return true;
  }

  function evaluate(items, view) {
    const spec = parseQuery(view?.query || '');
    const min = Math.max(0, Number(view?.minUse) || 0);
    const max = Math.max(min, Number(view?.maxUse) || 9999);
    const hasVariables = view?.hasVariables === true ? true : spec.hasVariables;
    const effective = { ...spec, hasVariables };
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (!matches(item, effective)) return false;
      const usage = Number(item.useCount) || 0;
      if (usage < min || usage > max) return false;
      if (view?.favoriteOnly === true && item.favorite !== true) return false;
      if (view?.tag && view.tag !== 'all' && !(item.tags || []).some((tag) => lower(tag) === lower(view.tag))) return false;
      return true;
    });
  }

  function currentFromDom(card) {
    const core = readCoreState(card);
    return {
      name: '',
      description: '',
      query: '',
      favoriteOnly: core.favoriteOnly,
      tag: core.tag,
      sort: core.sort,
      minUse: 0,
      maxUse: 9999,
      hasVariables: false,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function uniqueName(name, views) {
    let candidate = clean(name, MAX_NAME);
    if (!candidate) candidate = 'Yeni görünüm';
    const taken = new Set(views.map((view) => lower(view.name)));
    if (!taken.has(lower(candidate))) return candidate;
    let index = 2;
    while (taken.has(lower(`${candidate} ${index}`))) index += 1;
    return clean(`${candidate} ${index}`, MAX_NAME);
  }

  function sortViews(views, mode) {
    const copy = views.slice();
    if (mode === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return copy.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  }

  function exportPayload(views) {
    const payload = {
      version: 1,
      source: 'hafize-prompt-library-smart-views',
      exportedAt: new Date().toISOString(),
      views: normalizeViews(views)
    };
    const output = JSON.stringify(payload, null, 2);
    return output.length <= MAX_EXPORT
      ? output
      : JSON.stringify({ version: 1, source: payload.source, views: normalizeViews(views).slice(0, 8) }, null, 2);
  }

  function importPayload(payload, views = load()) {
    const incoming = normalizeViews(Array.isArray(payload) ? payload : payload?.views);
    const current = views.slice();
    const existing = new Set(current.map((view) => lower(view.name)));
    let imported = 0;
    let skipped = 0;
    for (const raw of incoming) {
      if (current.length >= MAX_VIEWS) {
        skipped += 1;
        continue;
      }
      if (existing.has(lower(raw.name))) {
        skipped += 1;
        continue;
      }
      const next = normalizeView({ ...raw, id: makeId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      current.push(next);
      existing.add(lower(next.name));
      imported += 1;
    }
    return { views: normalizeViews(current), imported, skipped };
  }

  function applyView(view, card) {
    if (!view || !card) return;
    const spec = parseQuery(view.query || '');
    const search = card.querySelector('#promptLibrarySearch') || card.querySelector('input[type="search"]');
    const tag = card.querySelector('.prompt-library-filters select');
    const favorite = card.querySelector('#promptLibraryFavoriteFilter');
    const sort = card.querySelector('.prompt-library-toolbar select');
    const plainText = spec.text.join(' ');
    if (search) {
      search.value = plainText;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (tag && view.tag) {
      tag.value = view.tag;
      tag.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const favoriteState = spec.favorite !== null ? spec.favorite : view.favoriteOnly === true;
    if (favorite && favorite.getAttribute('aria-pressed') !== String(favoriteState)) {
      favorite.click();
    }
    if (sort && view.sort) {
      sort.value = view.sort;
      sort.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function writeVisibleFilter(view, card) {
    const library = root.HafizePromptLibrary;
    const items = library?.loadItems?.(root.localStorage) || [];
    const rows = [...card.querySelectorAll('.prompt-item[data-prompt-id]')];
    const visible = new Set(evaluate(items, view).map((item) => item.id));
    for (const row of rows) row.hidden = visible.size ? !visible.has(row.dataset.promptId) : true;
    const status = card.querySelector('.prompt-library-status');
    if (status) {
      status.textContent = `${visible.size}/${items.length} kayıt görünümle eşleşti.`;
    }
  }

  function renderActive(view, card) {
    if (!view) {
      card.querySelectorAll('.prompt-item[data-prompt-id]').forEach((row) => { row.hidden = false; });
      return;
    }
    writeVisibleFilter(view, card);
  }

  function nodeField(doc, label, value, max, type = 'text') {
    const wrap = doc.createElement('label');
    wrap.className = 'prompt-smart-view-field';
    wrap.append(text(doc, label, 'prompt-smart-view-field-label'));
    const input = doc.createElement(type === 'number' ? 'input' : 'input');
    input.type = type;
    input.value = value ?? '';
    input.maxLength = max;
    if (type === 'number') {
      input.min = '0';
      input.max = '9999';
      input.inputMode = 'numeric';
    }
    wrap.append(input);
    return { wrap, input };
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-smart-views';
    section.setAttribute('aria-labelledby', 'promptLibrarySmartViewsTitle');

    const head = documentRef.createElement('div');
    head.className = 'prompt-smart-views-head';
    const title = text(documentRef, 'Akıllı görünümler', 'prompt-smart-views-title');
    title.id = 'promptLibrarySmartViewsTitle';
    const count = text(documentRef, '0', 'prompt-smart-views-count');
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.setAttribute('aria-controls', 'promptSmartViewsBody');
    head.append(title, count, collapse);

    const body = documentRef.createElement('div');
    body.id = 'promptSmartViewsBody';
    body.className = 'prompt-smart-views-body';

    const query = documentRef.createElement('input');
    query.type = 'search';
    query.maxLength = MAX_QUERY;
    query.placeholder = 'Görünüm ara…';
    query.setAttribute('aria-label', 'Akıllı görünümlerde ara');

    const sort = documentRef.createElement('select');
    sort.setAttribute('aria-label', 'Görünümleri sırala');
    for (const [value, label] of [['recent', 'Son kullanılan'], ['name', 'Ada göre']]) {
      const option = text(documentRef, label);
      option.value = value;
      sort.append(option);
    }

    const toolbar = documentRef.createElement('div');
    toolbar.className = 'prompt-smart-views-toolbar';
    const saveButton = button(documentRef, '＋ Mevcut durumu kaydet');
    const presetButton = button(documentRef, 'Hazır görünümler');
    const exportButton = button(documentRef, 'Dışa aktar');
    const importButton = button(documentRef, 'İçe aktar');
    toolbar.append(query, sort, saveButton, presetButton, exportButton, importButton);

    const list = documentRef.createElement('div');
    list.className = 'prompt-smart-views-list';
    list.setAttribute('role', 'list');

    const editor = documentRef.createElement('div');
    editor.className = 'prompt-smart-view-editor';
    editor.hidden = true;

    const status = text(documentRef, '', 'prompt-smart-views-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    body.append(toolbar, list, editor, status);
    section.append(head, body);
    card.append(section);

    let state = loadState(rootRef.localStorage);
    let editingId = '';
    let currentFile = null;

    function report(message) {
      status.textContent = clean(message, 180);
    }

    function updateCount() {
      const views = load(rootRef.localStorage);
      const active = views.find((item) => item.id === state.activeId);
      const items = rootRef.HafizePromptLibrary?.loadItems?.(rootRef.localStorage) || [];
      count.textContent = active ? `${evaluate(items, active).length}/${items.length}` : `${views.length} görünüm`;
    }

    function renderEditor(view) {
      editor.replaceChildren();
      editor.hidden = false;
      const titleInput = nodeField(documentRef, 'Ad', view?.name || '', MAX_NAME);
      const descriptionInput = nodeField(documentRef, 'Açıklama', view?.description || '', MAX_DESCRIPTION);
      const queryInput = nodeField(documentRef, 'Gelişmiş sorgu', view?.query || '', MAX_QUERY);
      const minUseInput = nodeField(documentRef, 'En az kullanım', String(view?.minUse ?? 0), 4, 'number');
      const maxUseInput = nodeField(documentRef, 'En fazla kullanım', String(view?.maxUse ?? 9999), 4, 'number');
      const variableInput = documentRef.createElement('select');
      variableInput.setAttribute('aria-label', 'Değişkenli istem filtresi');
      for (const [value, label] of [['all', 'Değişken filtresi yok'], ['with', 'Değişkenli'], ['without', 'Değişkensiz']]) {
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = label;
        variableInput.append(option);
      }
      variableInput.value = view?.hasVariables === true ? 'with' : 'all';

      const help = text(documentRef, 'Operatörler: tag:etiket, -tag:etiket, is:favorite, has:variable, used:>=3 ve normal metin.', 'prompt-smart-view-help');

      const actions = documentRef.createElement('div');
      actions.className = 'prompt-smart-view-editor-actions';
      const saveButton = button(documentRef, 'Kaydet');
      const cancelButton = button(documentRef, 'Vazgeç');
      actions.append(saveButton, cancelButton);
      editor.append(titleInput.wrap, descriptionInput.wrap, queryInput.wrap, minUseInput.wrap, maxUseInput.wrap, variableInput, help, actions);

      queryInput.input.addEventListener('input', () => {
        const preview = evaluate(rootRef.HafizePromptLibrary?.loadItems?.(rootRef.localStorage) || [], {
          ...currentFromDom(card),
          query: queryInput.input.value,
          minUse: Number(minUseInput.input.value) || 0,
          maxUse: Number(maxUseInput.input.value) || 9999,
          hasVariables: variableInput.value === 'with'
        });
        report(`Önizleme: ${preview.length} kayıt.`);
      });

      cancelButton.addEventListener('click', () => { editor.hidden = true; editor.replaceChildren(); });
      saveButton.addEventListener('click', () => {
        const name = uniqueName(titleInput.input.value, load(rootRef.localStorage).filter((item) => item.id !== (view?.id || '')));
        const minUse = Math.max(0, Math.min(9999, Number(minUseInput.input.value) || 0));
        const maxUse = Math.max(minUse, Math.min(9999, Number(maxUseInput.input.value) || 9999));
        const variableMode = variableInput.value;
        const core = readCoreState(card);
        const next = normalizeView({
          id: view?.id || makeId(),
          name,
          description: descriptionInput.input.value,
          query: queryInput.input.value,
          favoriteOnly: core.favoriteOnly,
          tag: core.tag,
          sort: core.sort,
          minUse,
          maxUse,
          hasVariables: variableMode === 'with',
          pinned: view?.pinned === true,
          createdAt: view?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        const views = load(rootRef.localStorage);
        const filtered = views.filter((item) => item.id !== next.id);
        filtered.unshift(next);
        if (!save(filtered.slice(0, MAX_VIEWS), rootRef.localStorage)) return report('Görünüm kaydedilemedi.');
        state = { ...state, activeId: next.id };
        saveState(state, rootRef.localStorage);
        editor.hidden = true;
        editor.replaceChildren();
        render();
        report('Akıllı görünüm kaydedildi.');
      });
      titleInput.input.focus();
    }

    function createPresets() {
      const views = load(rootRef.localStorage);
      const presets = [
        { name: 'Favori istemler', query: 'is:favorite' },
        { name: 'Sık kullanılanlar', query: 'used:>=3' },
        { name: 'Değişkenli istemler', query: 'has:variable' },
        { name: 'Etiketli istemler', query: 'tag:' }
      ];
      let added = 0;
      for (const preset of presets) {
        if (views.some((view) => lower(view.name) === lower(preset.name))) continue;
        const next = normalizeView({
          ...currentFromDom(card),
          ...preset,
          description: 'Hafize başlangıç akıllı görünümü',
          updatedAt: new Date().toISOString()
        });
        if (next.query === 'tag:') continue;
        views.push(next);
        added += 1;
        if (views.length >= MAX_VIEWS) break;
      }
      if (save(views.slice(0, MAX_VIEWS), rootRef.localStorage)) {
        render();
        report(added ? `${added} hazır görünüm eklendi.` : 'Hazır görünümler zaten mevcut.');
      }
    }

    function render() {
      state = loadState(rootRef.localStorage);
      const views = sortViews(load(rootRef.localStorage).filter((view) => lower(view.name).includes(lower(query.value))), sort.value || state.sort);
      count.textContent = views.length ? `${views.length} görünüm` : '0 görünüm';
      list.replaceChildren();
      if (!views.length) {
        list.append(text(documentRef, query.value ? 'Eşleşen görünüm yok.' : 'Henüz kaydedilmiş görünüm yok.', 'prompt-smart-views-empty'));
        updateCount();
        return;
      }
      for (const view of views) {
        const row = documentRef.createElement('article');
        row.className = 'prompt-smart-view-row';
        row.dataset.smartViewId = view.id;
        row.setAttribute('role', 'listitem');
        const info = documentRef.createElement('div');
        info.className = 'prompt-smart-view-info';
        info.append(text(documentRef, view.pinned ? '★' : '☆', 'prompt-smart-view-pin'));
        info.append(text(documentRef, view.name, 'prompt-smart-view-name'));
        if (view.description) info.append(text(documentRef, view.description, 'prompt-smart-view-description'));
        const details = text(documentRef, view.query || 'Temel filtreler', 'prompt-smart-view-query');
        info.append(details);
        const items = rootRef.HafizePromptLibrary?.loadItems?.(rootRef.localStorage) || [];
        info.append(text(documentRef, `${evaluate(items, view).length} kayıt`, 'prompt-smart-view-match'));
        const actions = documentRef.createElement('div');
        actions.className = 'prompt-smart-view-actions';
        const apply = button(documentRef, state.activeId === view.id ? 'Aktifi kaldır' : 'Uygula');
        const edit = button(documentRef, 'Düzenle');
        const pin = button(documentRef, view.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle');
        const duplicate = button(documentRef, 'Çoğalt');
        const remove = button(documentRef, 'Sil');
        actions.append(apply, edit, pin, duplicate, remove);
        row.append(info, actions);
        list.append(row);

        apply.addEventListener('click', () => {
          if (state.activeId === view.id) {
            state = { ...state, activeId: '' };
            saveState(state, rootRef.localStorage);
            renderActive(null, card);
            report('Akıllı görünüm kapatıldı.');
            render();
            return;
          }
          state = { ...state, activeId: view.id };
          saveState(state, rootRef.localStorage);
          applyView(view, card);
          renderActive(view, card);
          report(`“${view.name}” görünümü uygulandı.`);
          rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:prompt-library-smart-view-applied', { detail: { id: view.id, name: view.name } }));
          render();
        });
        edit.addEventListener('click', () => { editingId = view.id; renderEditor(view); });
        pin.addEventListener('click', () => {
          const next = load(rootRef.localStorage).map((candidate) => candidate.id === view.id
            ? normalizeView({ ...candidate, pinned: !candidate.pinned, updatedAt: new Date().toISOString() })
            : candidate);
          save(next, rootRef.localStorage);
          render();
        });
        duplicate.addEventListener('click', () => {
          const viewsNow = load(rootRef.localStorage);
          if (viewsNow.length >= MAX_VIEWS) return report('Akıllı görünüm sınırı dolu.');
          const name = uniqueName(`${view.name} kopyası`, viewsNow);
          const next = normalizeView({ ...view, id: makeId(), name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pinned: false });
          save([next, ...viewsNow].slice(0, MAX_VIEWS), rootRef.localStorage);
          render();
          report('Akıllı görünüm çoğaltıldı.');
        });
        remove.addEventListener('click', () => {
          if (!rootRef.confirm?.(`“${view.name}” görünümü silinsin mi?`)) return;
          const remaining = load(rootRef.localStorage).filter((candidate) => candidate.id !== view.id);
          save(remaining, rootRef.localStorage);
          if (state.activeId === view.id) {
            state = { ...state, activeId: '' };
            saveState(state, rootRef.localStorage);
            renderActive(null, card);
          }
          render();
          report('Akıllı görünüm silindi.');
        });
      }
      updateCount();
    }

    saveButton.addEventListener('click', () => renderEditor(currentFromDom(card)));
    presetButton.addEventListener('click', createPresets);
    exportButton.addEventListener('click', () => {
      const payload = exportPayload(load(rootRef.localStorage));
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = documentRef.createElement('a');
      link.href = url;
      link.download = 'hafize-prompt-smart-views.json';
      link.click();
      rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      report('Akıllı görünümler dışa aktarıldı.');
    });
    importButton.addEventListener('click', () => {
      currentFile ||= documentRef.createElement('input');
      currentFile.type = 'file';
      currentFile.accept = 'application/json,.json';
      currentFile.onchange = async () => {
        const file = currentFile.files?.[0];
        currentFile.value = '';
        if (!file || file.size > MAX_EXPORT) return report('Görünüm yedeği 300 KB sınırını aşamaz.');
        try {
          const payload = JSON.parse(await file.text());
          const result = importPayload(payload, load(rootRef.localStorage));
          if (save(result.views, rootRef.localStorage)) {
            render();
            report(`${result.imported} görünüm içe aktarıldı.`);
          } else {
            report('Görünüm yedeği kaydedilemedi.');
          }
        } catch {
          report('Geçersiz akıllı görünüm yedeği.');
        }
      };
      currentFile.click();
    });

    query.addEventListener('input', render);
    sort.addEventListener('change', render);
    collapse.addEventListener('click', () => {
      state = { ...state, collapsed: !state.collapsed };
      saveState(state, rootRef.localStorage);
      body.hidden = state.collapsed;
      collapse.textContent = state.collapsed ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!state.collapsed));
    });

    const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      const active = load(rootRef.localStorage).find((view) => view.id === state.activeId);
      if (active) renderActive(active, card);
    }) : null;
    observer?.observe(card, { childList: true, subtree: true });

    const onStorage = (event) => {
      if (event.key === STORAGE_KEY || event.key === STATE_KEY || event.key === rootRef.HafizePromptLibrary?.STORAGE_KEY) render();
    };
    rootRef.addEventListener?.('storage', onStorage);
    state.collapsed = state.collapsed === true;
    body.hidden = state.collapsed;
    collapse.textContent = state.collapsed ? 'Göster' : 'Gizle';
    render();

    return Object.freeze({
      mounted: true,
      refresh: render,
      evaluate,
      parseQuery,
      normalizeView,
      load: () => load(rootRef.localStorage),
      destroy: () => {
        observer?.disconnect();
        rootRef.removeEventListener?.('storage', onStorage);
        section.remove();
      }
    });
  }

  root.HafizePromptLibrarySmartViews = Object.freeze({
    STORAGE_KEY,
    STATE_KEY,
    MAX_VIEWS,
    MAX_NAME,
    MAX_DESCRIPTION,
    MAX_QUERY,
    MAX_EXPORT,
    normalizeView,
    normalizeViews,
    parseQuery,
    matches,
    evaluate,
    sortViews,
    load,
    save,
    loadState,
    saveState,
    exportPayload,
    importPayload,
    applyView,
    mount
  });

  const start = () => {
    if (root.document?.getElementById?.(CARD_ID)) mount(root.document, root);
  };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
