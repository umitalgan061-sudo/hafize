(function installHafizePromptWorkspaces(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.workspaces.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const STATE_KEY = `${PROMPT_KEY}.state`;
  const CARD_ID = 'promptLibraryCard';
  const MAX_WORKSPACES = 16;
  const MAX_NAME = 56;
  const MAX_TAGS = 12;
  const MAX_SELECTED = 40;
  const MAX_PAYLOAD = 180_000;
  const DEFAULT_ID = 'default';

  const core = () => root.HafizePromptLibrary;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = () => new Date().toISOString();

  function readJson(key, fallback) {
    try {
      const raw = root.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function normalize(value) {
    const source = value && typeof value === 'object' ? value : {};
    const raw = Array.isArray(source.workspaces) ? source.workspaces : [];
    const workspaces = [{ id: DEFAULT_ID, name: 'Genel', createdAt: '', updatedAt: '' }];
    const seen = new Set([DEFAULT_ID]);
    for (const item of raw.slice(0, MAX_WORKSPACES)) {
      const id = clean(item?.id, 120);
      const name = clean(item?.name, MAX_NAME);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      const tags = Array.isArray(item?.tags)
        ? [...new Set(item.tags.map((tag) => clean(tag, 24).toLocaleLowerCase('tr-TR')).filter(Boolean))].slice(0, MAX_TAGS)
        : [];
      const selected = Array.isArray(item?.selectedIds)
        ? [...new Set(item.selectedIds.map((idValue) => clean(idValue, 120)).filter(Boolean))].slice(0, MAX_SELECTED)
        : [];
      const state = item?.state && typeof item.state === 'object' ? {
        query: clean(item.state.query, 120),
        tag: clean(item.state.tag, 24) || 'all',
        favoriteOnly: item.state.favoriteOnly === true,
        sort: ['updated-desc', 'favorite-first', 'created-desc', 'title-asc'].includes(item.state.sort) ? item.state.sort : 'updated-desc'
      } : { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' };
      workspaces.push({ id, name, tags, selectedIds: selected, state, createdAt: clean(item?.createdAt, 40), updatedAt: clean(item?.updatedAt, 40) });
      if (workspaces.length >= MAX_WORKSPACES) break;
    }
    const activeId = seen.has(clean(source.activeId, 120)) ? clean(source.activeId, 120) : DEFAULT_ID;
    return { version: 1, activeId, workspaces };
  }

  function load() {
    return normalize(readJson(STORAGE_KEY, {}));
  }

  function save(value) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value)));
      return true;
    } catch {
      return false;
    }
  }

  function currentPromptData() {
    return {
      items: core()?.loadItems?.(root.localStorage) || [],
      state: core()?.loadState?.(root.localStorage) || { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' }
    };
  }

  function emit(type, detail = {}) {
    try { root.dispatchEvent?.(new root.CustomEvent(type, { detail })); } catch {}
  }

  function snapshotSelected() {
    const card = root.document?.getElementById?.(CARD_ID);
    const ids = card ? [...card.querySelectorAll('[data-prompt-selection]:checked')].map((node) => node.dataset.promptSelection).filter(Boolean).slice(0, MAX_SELECTED) : [];
    const data = currentPromptData();
    return { selectedIds: ids, state: { ...data.state }, updatedAt: now() };
  }

  function create(name) {
    const cleanName = clean(name, MAX_NAME);
    if (!cleanName) return null;
    const data = load();
    if (data.workspaces.length >= MAX_WORKSPACES) return null;
    if (data.workspaces.some((item) => item.name.toLocaleLowerCase('tr-TR') === cleanName.toLocaleLowerCase('tr-TR'))) return null;
    const item = { id: makeId(), name: cleanName, tags: [], selectedIds: [], state: currentPromptData().state, createdAt: now(), updatedAt: now() };
    data.workspaces.push(item);
    data.activeId = item.id;
    if (!save(data)) return null;
    emit('hafize:prompt-workspace-changed', item);
    return item;
  }

  function rename(id, name) {
    if (id === DEFAULT_ID) return false;
    const cleanName = clean(name, MAX_NAME);
    if (!cleanName) return false;
    const data = load();
    const target = data.workspaces.find((item) => item.id === id);
    if (!target || data.workspaces.some((item) => item.id !== id && item.name.toLocaleLowerCase('tr-TR') === cleanName.toLocaleLowerCase('tr-TR'))) return false;
    target.name = cleanName;
    target.updatedAt = now();
    if (!save(data)) return false;
    emit('hafize:prompt-workspace-changed', target);
    return true;
  }

  function remove(id) {
    if (id === DEFAULT_ID) return false;
    const data = load();
    if (!data.workspaces.some((item) => item.id === id)) return false;
    data.workspaces = data.workspaces.filter((item) => item.id !== id);
    if (data.activeId === id) data.activeId = DEFAULT_ID;
    const ok = save(data);
    if (ok) emit('hafize:prompt-workspace-changed', { id });
    return ok;
  }

  function saveCurrent(id) {
    const data = load();
    const target = data.workspaces.find((item) => item.id === id);
    if (!target) return false;
    const snap = snapshotSelected();
    target.selectedIds = snap.selectedIds;
    target.state = snap.state;
    target.updatedAt = snap.updatedAt;
    data.activeId = id;
    const ok = save(data);
    if (ok) emit('hafize:prompt-workspace-saved', target);
    return ok;
  }

  function activate(id) {
    const data = load();
    const target = data.workspaces.find((item) => item.id === id);
    if (!target) return false;
    if (!saveCurrent(data.activeId)) return false;
    data.activeId = id;
    if (!save(data)) return false;
    if (core()) core().saveState(root.localStorage, target.state);
    emit('hafize:prompt-workspace-activated', target);
    return true;
  }

  function active() {
    const data = load();
    return data.workspaces.find((item) => item.id === data.activeId) || data.workspaces[0];
  }

  function packWorkspace(id = active().id) {
    const data = load();
    const workspace = data.workspaces.find((item) => item.id === id);
    if (!workspace) return null;
    return { version: 1, source: 'hafize-prompt-workspace', exportedAt: now(), workspace };
  }

  function serializePack(id = active().id) {
    const pack = packWorkspace(id);
    if (!pack) return null;
    const output = JSON.stringify(pack, null, 2);
    return output.length <= MAX_PAYLOAD ? output : null;
  }

  function importPack(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const workspace = source.workspace && typeof source.workspace === 'object' ? source.workspace : null;
    if (!workspace) return null;
    const data = load();
    if (data.workspaces.length >= MAX_WORKSPACES) return null;
    const name = clean(workspace.name, MAX_NAME);
    if (!name) return null;
    let id = clean(workspace.id, 120) || makeId();
    const ids = new Set(data.workspaces.map((item) => item.id));
    if (ids.has(id)) id = makeId();
    const names = new Set(data.workspaces.map((item) => item.name.toLocaleLowerCase('tr-TR')));
    const finalName = names.has(name.toLocaleLowerCase('tr-TR')) ? `${name} kopyası` .slice(0, MAX_NAME) : name;
    const item = normalize({ workspaces: [{ id, name: finalName, createdAt: now(), updatedAt: now(), tags: workspace.tags, selectedIds: workspace.selectedIds, state: workspace.state }] }).workspaces[1];
    if (!item) return null;
    data.workspaces.push(item);
    data.activeId = item.id;
    if (!save(data)) return null;
    emit('hafize:prompt-workspace-changed', item);
    return item;
  }

  function makeButton(doc, label, action) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'mini-btn prompt-workspace-action';
    button.textContent = label;
    button.dataset.workspaceAction = action;
    button.setAttribute('aria-label', label);
    return button;
  }

  let mounted = false;
  let observer = null;
  let container = null;

  function renderManageList(body, status) {
    body.replaceChildren();
    for (const item of load().workspaces) {
      const row = root.document.createElement('div');
      row.className = 'prompt-workspace-manage-row';
      row.appendChild(Object.assign(root.document.createElement('strong'), { textContent: item.name }));
      if (item.id !== DEFAULT_ID) {
        const renameButton = makeButton(root.document, 'Yeniden adlandır', 'rename');
        const removeButton = makeButton(root.document, 'Sil', 'delete');
        renameButton.dataset.workspaceId = item.id;
        removeButton.dataset.workspaceId = item.id;
        row.append(renameButton, removeButton);
      }
      body.append(row);
    }
    if (!body.childElementCount) status.textContent = 'Çalışma alanı bulunmuyor.';
  }

  function openManager() {
    const existing = root.document.getElementById('promptWorkspaceManager');
    if (existing) { existing.remove(); return; }
    const dialog = root.document.createElement('section');
    dialog.id = 'promptWorkspaceManager';
    dialog.className = 'prompt-workspace-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptWorkspaceManagerTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-workspace-dialog-shell';
    const head = root.document.createElement('div'); head.className = 'prompt-workspace-dialog-head';
    const title = root.document.createElement('strong'); title.id = 'promptWorkspaceManagerTitle'; title.textContent = 'Çalışma alanları';
    const close = makeButton(root.document, 'Kapat', 'close');
    head.append(title, close);
    const createRow = root.document.createElement('div'); createRow.className = 'prompt-workspace-create-row';
    const input = root.document.createElement('input'); input.maxLength = MAX_NAME; input.placeholder = 'Yeni çalışma alanı'; input.setAttribute('aria-label', 'Yeni çalışma alanı adı');
    const add = makeButton(root.document, 'Ekle', 'add'); createRow.append(input, add);
    const body = root.document.createElement('div'); body.className = 'prompt-workspace-manage-body';
    const status = root.document.createElement('div'); status.className = 'prompt-workspace-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    shell.append(head, createRow, body, status); dialog.append(shell); root.document.body.append(dialog);
    const rerender = () => renderManageList(body, status);
    rerender();
    close.focus?.();
    close.addEventListener('click', () => dialog.remove());
    add.addEventListener('click', () => { const item = create(input.value); status.textContent = item ? `“${item.name}” oluşturuldu.` : 'Çalışma alanı oluşturulamadı.'; rerender(); input.focus(); refreshSelector(); });
    dialog.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-workspace-action]');
      if (!target) return;
      const action = target.dataset.workspaceAction;
      if (action === 'close' || action === 'add') return;
      const id = target.dataset.workspaceId;
      if (action === 'rename') {
        const item = load().workspaces.find((candidate) => candidate.id === id);
        const next = root.prompt?.('Yeni çalışma alanı adı:', item?.name || '');
        if (next !== null) status.textContent = rename(id, next) ? 'Çalışma alanı yeniden adlandırıldı.' : 'Ad güncellenemedi.';
      }
      if (action === 'delete') {
        const item = load().workspaces.find((candidate) => candidate.id === id);
        if (item && root.confirm?.(`“${item.name}” silinsin mi?`)) status.textContent = remove(id) ? 'Çalışma alanı silindi.' : 'Çalışma alanı silinemedi.';
      }
      rerender(); refreshSelector();
    });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }

  function refreshSelector() {
    const select = container?.querySelector?.('[data-prompt-workspace-selector]');
    if (!select) return;
    const data = load();
    select.replaceChildren();
    for (const item of data.workspaces) { const option = root.document.createElement('option'); option.value = item.id; option.textContent = item.name; select.append(option); }
    select.value = data.activeId;
  }

  function inject() {
    const card = root.document.getElementById(CARD_ID);
    if (!card || card.querySelector('.prompt-workspace-toolbar')) return;
    container = root.document.createElement('div');
    container.className = 'prompt-workspace-toolbar';
    const label = root.document.createElement('span'); label.className = 'prompt-workspace-label'; label.textContent = 'Çalışma alanı';
    const select = root.document.createElement('select'); select.setAttribute('aria-label', 'Çalışma alanı seç'); select.dataset.promptWorkspaceSelector = 'true';
    const manage = makeButton(root.document, 'Yönet', 'manage');
    const save = makeButton(root.document, 'Kaydet', 'save');
    const exportButton = makeButton(root.document, 'Dışa aktar', 'export');
    const importButton = makeButton(root.document, 'İçe aktar', 'import');
    const file = root.document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.setAttribute('aria-label', 'Çalışma alanı yedeği');
    container.append(label, select, manage, save, exportButton, importButton, file);
    card.querySelector('.prompt-library-enhancement-toolbar, .prompt-library-filters')?.after(container);
    refreshSelector();
    select.addEventListener('change', () => { activate(select.value); });
    manage.addEventListener('click', openManager);
    save.addEventListener('click', () => { const ok = saveCurrent(select.value); setStatus(ok ? 'Çalışma alanı kaydedildi.' : 'Çalışma alanı kaydedilemedi.'); });
    exportButton.addEventListener('click', () => {
      const output = serializePack(select.value);
      if (!output) return setStatus('Çalışma alanı yedeği oluşturulamadı.');
      const blob = new Blob([output], { type: 'application/json;charset=utf-8' });
      const url = root.URL.createObjectURL(blob); const link = root.document.createElement('a'); link.href = url; link.download = 'hafize-prompt-workspace.json'; link.click();
      root.setTimeout?.(() => root.URL.revokeObjectURL(url), 0); setStatus('Çalışma alanı dışa aktarıldı.');
    });
    importButton.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const object = file.files?.[0]; file.value = '';
      if (!object || object.size > 180_000) return setStatus('Çalışma alanı yedeği çok büyük.');
      const reader = new FileReader(); reader.onload = () => {
        try { const item = importPack(JSON.parse(String(reader.result || ''))); refreshSelector(); setStatus(item ? `“${item.name}” içe aktarıldı.` : 'Yedek geçersiz.'); }
        catch { setStatus('Yedek okunamadı.'); }
      }; reader.onerror = () => setStatus('Yedek okunamadı.'); reader.readAsText(object);
    });
  }

  function setStatus(message) {
    const target = root.document?.querySelector?.('#promptLibraryCard .prompt-library-status');
    if (target) target.textContent = clean(message, 180);
  }

  function enhance() { if (root.document?.getElementById?.(CARD_ID)) inject(); refreshSelector(); }

  function boot() {
    if (mounted || !root.document || !core()) return;
    if (!root.document.getElementById(CARD_ID)) return;
    mounted = true;
    observer = typeof MutationObserver === 'function' ? new MutationObserver(() => inject()) : null;
    observer?.observe(root.document.getElementById(CARD_ID), { childList: true, subtree: true });
    enhance();
    root.addEventListener?.('hafize:prompt-library-changed', enhance);
    root.addEventListener?.('hafize:prompt-library-collections-changed', enhance);
  }

  root.HafizePromptLibraryWorkspaces = Object.freeze({ STORAGE_KEY, MAX_WORKSPACES, load, save, active, create, rename, remove, saveCurrent, activate, packWorkspace, serializePack, importPack });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
