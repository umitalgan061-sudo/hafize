(() => {
  'use strict';

  const STORAGE_KEY = 'hafize.conversations.v1';
  const WORKSPACE_KEY = 'hafize.conversation-workspace.v1';
  const WORKSPACE_EVENT = 'hafize:conversation-workspace-changed';
  const MAX_CONVERSATIONS = 30;
  const MAX_TITLE = 80;
  const MAX_TAG = 24;
  const MAX_TAGS = 8;
  const MAX_IMPORT_BYTES = 1024 * 1024;
  const MAX_IMPORT_CONVERSATIONS = 30;
  const MAX_IMPORT_MESSAGES = 200;
  const MAX_MESSAGE_LENGTH = 12000;
  const MAX_IMPORTED_MESSAGE_LENGTH = 12000;
  const VALID_SORTS = new Set(['updated-desc', 'updated-asc', 'title-asc', 'created-desc', 'created-asc']);
  const VALID_FILTERS = new Set(['all', 'active', 'archived', 'pinned', 'tagged']);
  const DEFAULT_STATE = Object.freeze({ filter: 'all', sort: 'updated-desc', tag: '', query: '', selected: [] });

  const ui = {
    block: document.querySelector('.history-block'),
    history: document.querySelector('#conversationList'),
    toast: document.querySelector('#toast')
  };

  if (!ui.block || !ui.history) return;

  function cloneState(value) {
    return { filter: value.filter, sort: value.sort, tag: value.tag, query: value.query, selected: [...value.selected] };
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object') return cloneState(DEFAULT_STATE);
    const filter = VALID_FILTERS.has(value.filter) ? value.filter : DEFAULT_STATE.filter;
    const sort = VALID_SORTS.has(value.sort) ? value.sort : DEFAULT_STATE.sort;
    const tag = typeof value.tag === 'string' ? normalizeText(value.tag).slice(0, MAX_TAG) : '';
    const query = typeof value.query === 'string' ? normalizeText(value.query).slice(0, 120) : '';
    const selected = Array.isArray(value.selected)
      ? value.selected.filter((id) => typeof id === 'string').slice(0, MAX_CONVERSATIONS)
      : [];
    return { filter, sort, tag, query, selected };
  }

  function readWorkspace() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(WORKSPACE_KEY) || '{}'));
    } catch {
      return cloneState(DEFAULT_STATE);
    }
  }

  function writeWorkspace(next) {
    const state = normalizeState(next);
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state));
    } catch {
      // UI state is disposable; storage failure must not block conversation operations.
    }
    return state;
  }

  let state = readWorkspace();

  function normalizeText(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR') : '';
  }

  function cleanTitle(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE) || 'Yeni sohbet';
  }

  function cleanTag(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().replace(/^#+/, '').slice(0, MAX_TAG);
  }

  function readConversations(storage = localStorage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string') : [];
    } catch {
      return [];
    }
  }

  function safeDate(value, fallback) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeRole(value) {
    return value === 'assistant' ? 'assistant' : 'user';
  }

  function safeMessage(message, index) {
    if (!message || typeof message !== 'object') return null;
    const content = typeof message.content === 'string'
      ? message.content.slice(0, MAX_IMPORTED_MESSAGE_LENGTH)
      : '';
    if (!content) return null;
    const id = typeof message.id === 'string' && message.id ? message.id.slice(0, 120) : `imported-${index}-${Date.now()}`;
    const at = typeof message.at === 'string' ? message.at : new Date().toISOString();
    const normalized = { id, role: safeRole(message.role), content, at };
    if (Array.isArray(message.toolActivities)) {
      normalized.toolActivities = message.toolActivities
        .filter((activity) => activity && typeof activity === 'object')
        .slice(0, 4)
        .map((activity) => ({
          label: typeof activity.label === 'string' ? activity.label.slice(0, 80) : 'Araç',
          state: ['running', 'success', 'failure'].includes(activity.state) ? activity.state : 'success'
        }));
    }
    return normalized;
  }

  function normalizeConversation(input, index = 0) {
    if (!input || typeof input !== 'object') return null;
    const id = typeof input.id === 'string' ? input.id.trim().slice(0, 120) : '';
    if (!id) return null;
    const fallback = Date.now() - index;
    const messages = Array.isArray(input.messages)
      ? input.messages.slice(0, MAX_IMPORT_MESSAGES).map(safeMessage).filter(Boolean)
      : [];
    const tags = Array.isArray(input.tags)
      ? [...new Set(input.tags.map(cleanTag).filter(Boolean))].slice(0, MAX_TAGS)
      : [];
    return {
      id,
      title: cleanTitle(input.title),
      agentId: typeof input.agentId === 'string' ? input.agentId.slice(0, 120) : '',
      toolsEnabled: input.toolsEnabled === true,
      archived: input.archived === true,
      pinned: input.pinned === true,
      tags,
      createdAt: new Date(safeDate(input.createdAt, fallback)).toISOString(),
      updatedAt: new Date(safeDate(input.updatedAt, fallback)).toISOString(),
      messages
    };
  }

  function normalizeConversationList(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const normalized = [];
    for (const [index, item] of value.entries()) {
      const conversation = normalizeConversation(item, index);
      if (!conversation || seen.has(conversation.id)) continue;
      seen.add(conversation.id);
      normalized.push(conversation);
    }
    return normalized.slice(0, MAX_CONVERSATIONS);
  }

  function writeConversations(conversations, message) {
    const normalized = normalizeConversationList(conversations);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      announce(message);
      window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT, { detail: { reason: message } }));
      return true;
    } catch {
      announce('Sohbet verileri bu cihazda kaydedilemedi.');
      return false;
    }
  }

  function announce(message) {
    if (!ui.toast || !message) return;
    ui.toast.textContent = message;
    ui.toast.classList.remove('hidden');
    window.clearTimeout(announce.timeoutId);
    announce.timeoutId = window.setTimeout(() => ui.toast.classList.add('hidden'), 3000);
  }

  function getRows() {
    return Array.from(ui.history.querySelectorAll('.conversation-row'));
  }

  function getRowId(row) {
    return row.querySelector('.conversation-open')?.dataset?.conversationId || '';
  }

  function sortConversations(conversations, sort) {
    const list = [...conversations];
    const collator = new Intl.Collator('tr-TR', { sensitivity: 'base', numeric: true });
    list.sort((a, b) => {
      if (sort === 'title-asc') return collator.compare(cleanTitle(a.title), cleanTitle(b.title));
      const left = safeDate(sort.startsWith('created') ? a.createdAt : a.updatedAt, 0);
      const right = safeDate(sort.startsWith('created') ? b.createdAt : b.updatedAt, 0);
      return sort.endsWith('asc') ? left - right : right - left;
    });
    return list;
  }

  function conversationMatches(conversation, nextState) {
    const filter = nextState.filter;
    if (filter === 'active' && conversation.archived === true) return false;
    if (filter === 'archived' && conversation.archived !== true) return false;
    if (filter === 'pinned' && conversation.pinned !== true) return false;
    if (filter === 'tagged' && !Array.isArray(conversation.tags) || filter === 'tagged' && conversation.tags.length === 0) return false;
    if (nextState.tag && !(conversation.tags || []).some((tag) => normalizeText(tag) === nextState.tag)) return false;
    if (nextState.query) {
      const haystack = normalizeText([
        conversation.title,
        conversation.agentId,
        ...(Array.isArray(conversation.tags) ? conversation.tags : []),
        ...(Array.isArray(conversation.messages) ? conversation.messages.map((message) => message.content) : [])
      ].filter(Boolean).join(' '));
      if (!haystack.includes(nextState.query)) return false;
    }
    return true;
  }

  function collectTags(conversations) {
    const tags = new Map();
    for (const conversation of conversations) {
      for (const tag of Array.isArray(conversation.tags) ? conversation.tags : []) {
        const clean = cleanTag(tag);
        if (!clean) continue;
        const key = normalizeText(clean);
        const current = tags.get(key) || { label: clean, count: 0 };
        current.count += 1;
        tags.set(key, current);
      }
    }
    return [...tags.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr-TR'));
  }

  function currentSelectionVisible(rows) {
    const ids = new Set(state.selected);
    return rows.filter((row) => !row.hidden && ids.has(getRowId(row)));
  }

  function persistState() {
    state = writeWorkspace(state);
    return state;
  }

  function makeButton(text, label, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    if (className) button.className = className;
    return button;
  }

  function buildToolbar() {
    const old = ui.block.querySelector('.conversation-workspace');
    old?.remove();

    const wrap = document.createElement('section');
    wrap.className = 'conversation-workspace';
    wrap.setAttribute('aria-label', 'Sohbet çalışma alanı yönetimi');

    const head = document.createElement('div');
    head.className = 'conversation-workspace-head';

    const title = document.createElement('div');
    title.className = 'conversation-workspace-title';
    const heading = document.createElement('strong');
    heading.textContent = 'Sohbet çalışma alanı';
    const status = document.createElement('span');
    status.className = 'conversation-workspace-status';
    status.id = 'conversationWorkspaceStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    title.append(heading, status);

    const actions = document.createElement('div');
    actions.className = 'conversation-workspace-actions';
    const selectAll = makeButton('Tümünü seç', 'Görünen sohbetlerin tamamını seç', 'workspace-ghost');
    const clear = makeButton('Seçimi temizle', 'Sohbet seçimini temizle', 'workspace-ghost');
    actions.append(selectAll, clear);

    head.append(title, actions);

    const filters = document.createElement('div');
    filters.className = 'conversation-workspace-filters';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'workspace-search';
    search.id = 'conversationWorkspaceSearch';
    search.placeholder = 'Başlık, etiket veya mesaj…';
    search.maxLength = 120;
    search.value = state.query;
    search.setAttribute('aria-label', 'Sohbet çalışma alanında ara');

    const filter = document.createElement('select');
    filter.className = 'workspace-select';
    filter.setAttribute('aria-label', 'Sohbet filtresi');
    const filterOptions = [
      ['all', 'Tüm sohbetler'],
      ['active', 'Arşivlenmemiş'],
      ['archived', 'Arşivlenmiş'],
      ['pinned', 'Sabitlenmiş'],
      ['tagged', 'Etiketli']
    ];
    for (const [value, label] of filterOptions) filter.append(new Option(label, value, false, state.filter === value));

    const sort = document.createElement('select');
    sort.className = 'workspace-select';
    sort.setAttribute('aria-label', 'Sohbet sıralaması');
    const sortOptions = [
      ['updated-desc', 'Son güncellenen'],
      ['updated-asc', 'En eski güncellenen'],
      ['title-asc', 'Başlığa göre'],
      ['created-desc', 'Yeni oluşturulan'],
      ['created-asc', 'Eski oluşturulan']
    ];
    for (const [value, label] of sortOptions) sort.append(new Option(label, value, false, state.sort === value));

    const tag = document.createElement('select');
    tag.className = 'workspace-select workspace-tag-select';
    tag.setAttribute('aria-label', 'Etikete göre filtrele');
    tag.append(new Option('Tüm etiketler', ''));
    for (const item of collectTags(readConversations())) tag.append(new Option(`${item.label} · ${item.count}`, normalizeText(item.label), false, state.tag === normalizeText(item.label)));

    filters.append(search, filter, sort, tag);

    const batch = document.createElement('div');
    batch.className = 'conversation-workspace-batch';
    const count = document.createElement('span');
    count.className = 'workspace-batch-count';
    const archive = makeButton('Arşivle', 'Seçili sohbetleri arşivle');
    const restore = makeButton('Arşivden çıkar', 'Seçili sohbetleri arşivden çıkar');
    const pin = makeButton('Sabitle', 'Seçili sohbetleri sabitle');
    const unpin = makeButton('Sabitlemeyi kaldır', 'Seçili sohbetlerin sabitlemesini kaldır');
    const clone = makeButton('Kopyala', 'Seçili sohbetleri çoğalt');
    const tagButton = makeButton('Etiket ekle', 'Seçili sohbetlere etiket ekle');
    const deleteButton = makeButton('Sil', 'Seçili sohbetleri kalıcı olarak sil', 'workspace-danger');
    batch.append(count, archive, restore, pin, unpin, clone, tagButton, deleteButton);

    const io = document.createElement('div');
    io.className = 'conversation-workspace-io';
    const exportButton = makeButton('Seçilenleri dışa aktar', 'Seçili sohbetleri JSON olarak dışa aktar');
    const importButton = makeButton('Yedek içe aktar', 'JSON sohbet yedeği içe aktar');
    io.append(exportButton, importButton);

    const quota = document.createElement('div');
    quota.className = 'conversation-workspace-quota';
    const quotaLabel = document.createElement('span');
    quotaLabel.className = 'workspace-quota-label';
    const quotaBar = document.createElement('div');
    quotaBar.className = 'workspace-quota-bar';
    const quotaFill = document.createElement('span');
    quotaFill.className = 'workspace-quota-fill';
    quotaBar.append(quotaFill);
    quota.append(quotaLabel, quotaBar);

    wrap.append(head, filters, batch, io, quota);
    ui.block.insertBefore(wrap, ui.history);

    function selectedConversations() {
      const conversations = readConversations();
      return conversations.filter((conversation) => state.selected.includes(conversation.id));
    }

    function updateStatus() {
      const conversations = readConversations();
      const visible = conversations.filter((conversation) => conversationMatches(conversation, state)).length;
      const selected = selectedConversations().length;
      status.textContent = `${visible} sohbet · ${selected} seçili`;
      count.textContent = `${selected} seçili`;
      const disabled = selected === 0;
      for (const button of [archive, restore, pin, unpin, clone, tagButton, deleteButton, exportButton]) button.disabled = disabled;
      clear.disabled = selected === 0;
      const percent = Math.min(100, (conversations.length / MAX_CONVERSATIONS) * 100);
      quotaLabel.textContent = `Yerel sınır: ${conversations.length}/${MAX_CONVERSATIONS} sohbet · ${estimateStorage(conversations)} KB`;
      quotaFill.style.width = `${percent}%`;
      quotaFill.setAttribute('aria-valuenow', String(Math.round(percent)));
      quotaBar.setAttribute('role', 'progressbar');
      quotaBar.setAttribute('aria-valuemin', '0');
      quotaBar.setAttribute('aria-valuemax', '100');
    }

    function updateRows() {
      const conversations = readConversations();
      const matching = sortConversations(conversations.filter((conversation) => conversationMatches(conversation, state)), state.sort);
      const orderedIds = new Map(matching.map((conversation, index) => [conversation.id, index]));
      const rows = getRows();
      for (const row of rows) {
        const id = getRowId(row);
        const visible = orderedIds.has(id);
        row.hidden = !visible;
        row.style.order = visible ? String(orderedIds.get(id)) : '9999';
        const check = row.querySelector('.workspace-row-check');
        if (check) {
          check.checked = state.selected.includes(id);
          check.setAttribute('aria-checked', String(check.checked));
        }
        row.classList.toggle('workspace-selected', state.selected.includes(id));
      }
      const visibleIds = matching.map((conversation) => conversation.id);
      state.selected = state.selected.filter((id) => visibleIds.includes(id) || conversations.some((conversation) => conversation.id === id));
      persistState();
      updateStatus();
    }

    function refreshTagOptions() {
      const current = state.tag;
      tag.replaceChildren(new Option('Tüm etiketler', ''));
      for (const item of collectTags(readConversations())) tag.append(new Option(`${item.label} · ${item.count}`, normalizeText(item.label), false, current === normalizeText(item.label)));
    }

    function selectVisible(shouldSelect) {
      const rows = getRows().filter((row) => !row.hidden);
      const set = new Set(state.selected);
      for (const row of rows) {
        const id = getRowId(row);
        if (!id) continue;
        if (shouldSelect) set.add(id);
        else set.delete(id);
      }
      state.selected = [...set].slice(0, MAX_CONVERSATIONS);
      persistState();
      updateRows();
    }

    function mutateSelected(mutator, success) {
      const conversations = readConversations();
      const selected = new Set(state.selected);
      let changed = false;
      for (const conversation of conversations) {
        if (!selected.has(conversation.id)) continue;
        if (mutator(conversation)) changed = true;
      }
      if (!changed) return;
      writeConversations(conversations, success);
      state.selected = [];
      persistState();
      window.setTimeout(() => window.location.reload(), 50);
    }

    function onArchive(archived) {
      mutateSelected((conversation) => {
        if (conversation.archived === archived) return false;
        conversation.archived = archived;
        conversation.updatedAt = new Date().toISOString();
        return true;
      }, archived ? 'Seçili sohbetler arşivlendi.' : 'Seçili sohbetler arşivden çıkarıldı.');
    }

    function onPin(pinned) {
      mutateSelected((conversation) => {
        if (conversation.pinned === pinned) return false;
        conversation.pinned = pinned;
        return true;
      }, pinned ? 'Seçili sohbetler sabitlendi.' : 'Sabitlenen sohbetler güncellendi.');
    }

    function onDelete() {
      const selected = new Set(state.selected);
      if (!selected.size) return;
      const conversations = readConversations();
      if (!globalThis.confirm(`${selected.size} sohbet kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
      const kept = conversations.filter((conversation) => !selected.has(conversation.id));
      writeConversations(kept, `${selected.size} sohbet silindi.`);
      state.selected = [];
      persistState();
      window.setTimeout(() => window.location.reload(), 50);
    }

    function onClone() {
      const conversations = readConversations();
      const selected = new Set(state.selected);
      const clones = [];
      for (const conversation of conversations) {
        if (!selected.has(conversation.id)) continue;
        if (conversations.length + clones.length >= MAX_CONVERSATIONS) break;
        const suffix = ' · kopya';
        const cloneConversation = structuredCloneSafe(conversation);
        if (!cloneConversation) continue;
        cloneConversation.id = createId('copy');
        cloneConversation.title = cleanTitle(`${cleanTitle(conversation.title)}${suffix}`);
        cloneConversation.createdAt = new Date().toISOString();
        cloneConversation.updatedAt = new Date().toISOString();
        clones.push(cloneConversation);
      }
      if (!clones.length) return announce('Kopyalanacak sohbet bulunamadı veya yerel sınır dolu.');
      writeConversations([...clones, ...conversations], `${clones.length} sohbet kopyalandı.`);
      state.selected = clones.map((conversation) => conversation.id);
      persistState();
      window.setTimeout(() => window.location.reload(), 50);
    }

    function onTag() {
      const selected = selectedConversations();
      if (!selected.length) return;
      const value = globalThis.prompt('Eklenecek etiket:', state.tag || '');
      if (value === null) return;
      const tagValue = cleanTag(value);
      if (!tagValue) return announce('Etiket boş olamaz.');
      const conversations = readConversations();
      const selectedIds = new Set(state.selected);
      for (const conversation of conversations) {
        if (!selectedIds.has(conversation.id)) continue;
        const tags = Array.isArray(conversation.tags) ? conversation.tags.map(cleanTag).filter(Boolean) : [];
        if (!tags.some((tag) => normalizeText(tag) === normalizeText(tagValue))) tags.push(tagValue);
        conversation.tags = [...new Map(tags.map((tag) => [normalizeText(tag), tag])).values()].slice(0, MAX_TAGS);
      }
      writeConversations(conversations, 'Etiket seçili sohbetlere eklendi.');
      state.selected = [];
      persistState();
      refreshTagOptions();
      window.setTimeout(() => window.location.reload(), 50);
    }

    function downloadSelected() {
      const selected = selectedConversations();
      if (!selected.length) return announce('Dışa aktarılacak seçili sohbet yok.');
      const payload = JSON.stringify({
        format: 'hafize-conversations',
        version: 2,
        exportedAt: new Date().toISOString(),
        conversations: selected
      }, null, 2);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `hafize-sohbet-secili-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.rel = 'noopener';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce(`${selected.length} sohbet JSON olarak dışa aktarıldı.`);
    }

    function importBackup() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.hidden = true;
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;
        if (file.size <= 0 || file.size > MAX_IMPORT_BYTES) return announce('Yedek dosyası 1 MB sınırında olmalı.');
        try {
          const text = await file.text();
          if (text.length > MAX_IMPORT_BYTES) return announce('Yedek dosyası 1 MB sınırını aşıyor.');
          const parsed = JSON.parse(text);
          const incoming = Array.isArray(parsed) ? parsed : parsed?.conversations;
          const normalized = normalizeConversationList(incoming);
          if (!normalized.length) return announce('İçe aktarılabilir sohbet bulunamadı.');
          const current = readConversations();
          const byId = new Map(current.map((conversation) => [conversation.id, conversation]));
          const imported = [];
          for (const conversation of normalized) {
            if (imported.length >= MAX_IMPORT_CONVERSATIONS) break;
            const unique = byId.has(conversation.id) ? { ...conversation, id: createId('import') } : conversation;
            byId.set(unique.id, unique);
            imported.push(unique);
          }
          const merged = [...imported, ...current].slice(0, MAX_CONVERSATIONS);
          if (!writeConversations(merged, `${imported.length} sohbet içe aktarıldı.`)) return;
          state.selected = imported.map((conversation) => conversation.id);
          persistState();
          window.setTimeout(() => window.location.reload(), 50);
        } catch {
          announce('Yedek dosyası okunamadı veya geçersiz JSON içeriyor.');
        }
      }, { once: true });
      document.body.append(input);
      input.click();
    }

    search.addEventListener('input', () => {
      state.query = normalizeText(search.value).slice(0, 120);
      persistState();
      updateRows();
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && search.value) {
        event.preventDefault();
        search.value = '';
        state.query = '';
        persistState();
        updateRows();
      }
    });
    filter.addEventListener('change', () => {
      state.filter = filter.value;
      persistState();
      updateRows();
    });
    sort.addEventListener('change', () => {
      state.sort = sort.value;
      persistState();
      updateRows();
    });
    tag.addEventListener('change', () => {
      state.tag = normalizeText(tag.value).slice(0, MAX_TAG);
      if (state.tag) state.filter = 'tagged';
      persistState();
      updateRows();
    });
    selectAll.addEventListener('click', () => selectVisible(true));
    clear.addEventListener('click', () => { state.selected = []; persistState(); updateRows(); });
    archive.addEventListener('click', () => onArchive(true));
    restore.addEventListener('click', () => onArchive(false));
    pin.addEventListener('click', () => onPin(true));
    unpin.addEventListener('click', () => onPin(false));
    clone.addEventListener('click', onClone);
    tagButton.addEventListener('click', onTag);
    deleteButton.addEventListener('click', onDelete);
    exportButton.addEventListener('click', downloadSelected);
    importButton.addEventListener('click', importBackup);

    buildToolbar.rowControls = { updateRows, refreshTagOptions, updateStatus };
    updateRows();
  }

  function estimateStorage(conversations) {
    try {
      return Math.ceil(new Blob([JSON.stringify(conversations)]).size / 1024);
    } catch {
      return 0;
    }
  }

  function structuredCloneSafe(value) {
    try {
      return structuredClone(value);
    } catch {
      try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
    }
  }

  function createId(prefix) {
    const random = globalThis.crypto?.randomUUID?.();
    return `${prefix}-${random || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }

  function decorateRows() {
    for (const row of getRows()) {
      if (row.querySelector('.workspace-row-check')) continue;
      const id = getRowId(row);
      if (!id) continue;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'workspace-row-check';
      check.checked = state.selected.includes(id);
      check.setAttribute('aria-label', 'Sohbeti yönetim seçimine ekle');
      check.setAttribute('aria-checked', String(check.checked));
      check.addEventListener('click', (event) => {
        event.stopPropagation();
      });
      check.addEventListener('change', () => {
        const selected = new Set(state.selected);
        if (check.checked) selected.add(id);
        else selected.delete(id);
        state.selected = [...selected].slice(0, MAX_CONVERSATIONS);
        persistState();
        row.classList.toggle('workspace-selected', check.checked);
        buildToolbar.rowControls?.updateStatus?.();
      });
      row.prepend(check);
    }
  }

  function pruneMissingSelection() {
    const ids = new Set(readConversations().map((conversation) => conversation.id));
    const next = state.selected.filter((id) => ids.has(id));
    if (next.length !== state.selected.length) {
      state.selected = next;
      persistState();
    }
  }

  function refresh() {
    pruneMissingSelection();
    decorateRows();
    buildToolbar.rowControls?.refreshTagOptions?.();
    buildToolbar.rowControls?.updateRows?.();
  }

  function expose() {
    globalThis.HafizeConversationWorkspace = Object.freeze({
      readConversations,
      normalizeConversation,
      normalizeConversationList,
      normalizeState,
      estimateStorage,
      getState: () => cloneState(state),
      refresh,
      constants: Object.freeze({
        STORAGE_KEY,
        WORKSPACE_KEY,
        MAX_CONVERSATIONS,
        MAX_TITLE,
        MAX_TAG,
        MAX_TAGS,
        MAX_IMPORT_BYTES,
        MAX_IMPORT_CONVERSATIONS,
        MAX_IMPORT_MESSAGES,
        MAX_MESSAGE_LENGTH
      })
    });
  }

  buildToolbar();
  decorateRows();
  expose();

  const observer = new MutationObserver(() => {
    decorateRows();
    buildToolbar.rowControls?.updateRows?.();
  });
  observer.observe(ui.history, { childList: true, subtree: true });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === WORKSPACE_KEY) refresh();
  });

  window.addEventListener(WORKSPACE_EVENT, () => refresh());
})();
