(function exposeHafizePromptRevisions(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.revisions.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_PROMPTS = 120;
  const MAX_REVISIONS = 10;
  const MAX_TITLE = 100;
  const MAX_BODY = 8000;
  const MAX_TAGS = 8;
  const MAX_TAG = 24;
  const MAX_REVISION_EXPORT = 1_000_000;
  const core = () => root.HafizePromptLibrary;
  const storage = () => root.localStorage;

  const clamp = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
  const cleanTags = (value) => Array.isArray(value)
    ? [...new Set(value.map((tag) => clamp(tag, MAX_TAG).trim()).filter(Boolean))].slice(0, MAX_TAGS)
    : [];
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = () => new Date().toISOString();

  function normalizeRevision(input) {
    if (!input || typeof input !== 'object') return null;
    const promptId = clamp(input.promptId, 120).trim();
    const body = clamp(input.body, MAX_BODY).replace(/\0/g, '');
    if (!promptId || !body) return null;
    return Object.freeze({
      id: clamp(input.id, 120).trim() || makeId(),
      promptId,
      savedAt: clamp(input.savedAt, 40).trim() || now(),
      reason: input.reason === 'manual' ? 'manual' : 'before-edit',
      title: clamp(input.title, MAX_TITLE).trim() || 'İsimsiz istem',
      body,
      tags: cleanTags(input.tags)
    });
  }

  function readAll() {
    try {
      const raw = storage()?.getItem?.(STORAGE_KEY) || '{}';
      const value = JSON.parse(raw);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function normalizeStore(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = {};
    for (const promptId of Object.keys(input).slice(0, MAX_PROMPTS)) {
      const entries = Array.isArray(input[promptId]) ? input[promptId] : [];
      const revisions = entries.map(normalizeRevision).filter((item) => item && item.promptId === promptId).slice(0, MAX_REVISIONS);
      if (revisions.length) output[promptId] = revisions;
    }
    return output;
  }

  function writeAll(value) {
    try {
      storage()?.setItem?.(STORAGE_KEY, JSON.stringify(normalizeStore(value)));
      return true;
    } catch {
      return false;
    }
  }

  function list(promptId) {
    const id = clamp(promptId, 120).trim();
    if (!id) return [];
    const store = normalizeStore(readAll());
    return (store[id] || []).slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  function capture(item, reason = 'before-edit') {
    const normalized = normalizeRevision({ ...item, id: makeId(), savedAt: now(), reason });
    if (!normalized) return false;
    const store = normalizeStore(readAll());
    const current = store[normalized.promptId] || [];
    const duplicate = current.find((revision) => revision.title === normalized.title && revision.body === normalized.body && JSON.stringify(revision.tags) === JSON.stringify(normalized.tags));
    if (duplicate) return false;
    store[normalized.promptId] = [normalized, ...current].slice(0, MAX_REVISIONS);
    return writeAll(store);
  }

  function remove(promptId, revisionId) {
    const id = clamp(promptId, 120).trim();
    const rid = clamp(revisionId, 120).trim();
    if (!id || !rid) return false;
    const store = normalizeStore(readAll());
    const next = (store[id] || []).filter((revision) => revision.id !== rid);
    if (next.length) store[id] = next;
    else delete store[id];
    return writeAll(store);
  }

  function clear(promptId) {
    const id = clamp(promptId, 120).trim();
    if (!id) return false;
    const store = normalizeStore(readAll());
    delete store[id];
    return writeAll(store);
  }

  function exportPrompt(promptId) {
    const id = clamp(promptId, 120).trim();
    const revisions = list(id);
    const payload = { version: 1, source: 'hafize-prompt-library-revisions', promptId: id, exportedAt: now(), revisions };
    const output = JSON.stringify(payload, null, 2);
    return output.length <= MAX_REVISION_EXPORT ? output : JSON.stringify({ ...payload, revisions: revisions.slice(0, 5) }, null, 2);
  }

  function dispatchCoreRefresh(api, items) {
    try {
      if (typeof root.StorageEvent === 'function') {
        root.dispatchEvent(new root.StorageEvent('storage', { key: api.STORAGE_KEY, newValue: JSON.stringify(items), storageArea: storage() }));
      } else {
        root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh'));
      }
    } catch {
      root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh'));
    }
  }

  function insertRevisionIntoPrompt(revision) {
    const api = core();
    const items = api?.loadItems?.(storage()) || [];
    const target = items.find((item) => item.id === revision.promptId);
    if (!target) return { ok: false, reason: 'prompt-not-found' };
    const next = api.normalizeItem({ ...target, title: revision.title, body: revision.body, tags: revision.tags, favorite: target.favorite, useCount: target.useCount, createdAt: target.createdAt, updatedAt: now() });
    if (!next) return { ok: false, reason: 'invalid-revision' };
    const nextItems = items.map((item) => item.id === target.id ? next : item);
    if (!api.saveItems(storage(), nextItems)) return { ok: false, reason: 'storage-write-failed' };
    dispatchCoreRefresh(api, nextItems);
    return { ok: true };
  }

  function button(doc, label, action) {
    const node = doc.createElement('button');
    node.type = 'button'; node.className = 'soft-btn prompt-revision-action'; node.textContent = label;
    node.dataset.promptRevisionAction = action;
    node.setAttribute('aria-label', label);
    return node;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || card.dataset.revisionReady === 'true') return null;
    card.dataset.revisionReady = 'true';

    const panel = documentRef.createElement('section');
    panel.id = 'promptLibraryRevisionPanel'; panel.hidden = true; panel.className = 'prompt-revision-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'promptRevisionTitle'); panel.setAttribute('aria-describedby', 'promptRevisionDescription');
    const shell = documentRef.createElement('div'); shell.className = 'prompt-revision-shell';
    const head = documentRef.createElement('div'); head.className = 'prompt-revision-head';
    const title = documentRef.createElement('strong'); title.id = 'promptRevisionTitle'; title.textContent = 'İstem sürüm geçmişi';
    const close = button(documentRef, 'Kapat', 'close'); close.className = 'mini-btn prompt-revision-action';
    head.append(title, close);
    const description = documentRef.createElement('p'); description.id = 'promptRevisionDescription'; description.className = 'prompt-revision-description';
    const currentTitle = documentRef.createElement('div'); currentTitle.className = 'prompt-revision-current-title';
    const currentPreview = documentRef.createElement('pre'); currentPreview.className = 'prompt-revision-current';
    const listNode = documentRef.createElement('div'); listNode.className = 'prompt-revision-list'; listNode.setAttribute('role', 'list');
    const status = documentRef.createElement('div'); status.className = 'prompt-revision-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const actions = documentRef.createElement('div'); actions.className = 'prompt-revision-footer';
    const exportButton = button(documentRef, 'Geçmişi dışa aktar', 'export');
    const clearButton = button(documentRef, 'Geçmişi temizle', 'clear');
    actions.append(exportButton, clearButton);
    shell.append(head, description, currentTitle, currentPreview, listNode, actions, status); panel.append(shell); card.append(panel);

    let activePrompt = null; let lastFocus = null;

    function report(message) { status.textContent = clamp(message, 180); }
    function closePanel() { panel.hidden = true; listNode.replaceChildren(); status.textContent = ''; activePrompt = null; lastFocus?.focus?.(); lastFocus = null; }

    function render() {
      if (!activePrompt) return;
      currentTitle.textContent = `Mevcut: ${activePrompt.title}`;
      currentPreview.textContent = activePrompt.body.slice(0, MAX_BODY);
      description.textContent = `${list(activePrompt.id).length} kayıtlı sürüm. Eski sürüm geri yüklenirken favori ve kullanım sayısı korunur.`;
      listNode.replaceChildren();
      const revisions = list(activePrompt.id);
      if (!revisions.length) { const empty = documentRef.createElement('div'); empty.className = 'prompt-revision-empty'; empty.textContent = 'Bu istem için henüz geçmiş yok.'; listNode.append(empty); return; }
      revisions.forEach((revision, index) => {
        const row = documentRef.createElement('article'); row.className = 'prompt-revision-row'; row.setAttribute('role', 'listitem');
        const meta = documentRef.createElement('div'); meta.className = 'prompt-revision-meta';
        meta.textContent = `${index + 1}. ${revision.reason === 'manual' ? 'Manuel' : 'Düzenleme öncesi'} · ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(revision.savedAt))}`;
        const name = documentRef.createElement('strong'); name.className = 'prompt-revision-name'; name.textContent = revision.title;
        const preview = documentRef.createElement('pre'); preview.className = 'prompt-revision-preview'; preview.textContent = revision.body.slice(0, 260);
        const rowActions = documentRef.createElement('div'); rowActions.className = 'prompt-revision-row-actions';
        const view = button(documentRef, 'Karşılaştır', 'view'); const restore = button(documentRef, 'Geri yükle', 'restore'); const removeButton = button(documentRef, 'Sil', 'remove');
        view.dataset.promptRevisionId = revision.id; restore.dataset.promptRevisionId = revision.id; removeButton.dataset.promptRevisionId = revision.id;
        rowActions.append(view, restore, removeButton); row.append(meta, name, preview, rowActions); listNode.append(row);
      });
    }

    function compare(revision) {
      const current = activePrompt?.body || '';
      if (current === revision.body) return report('Değişiklik yok: mevcut içerik bu sürümle aynı.');
      report(`Mevcut ${current.length} karakter · sürüm ${revision.body.length} karakter. Önizleme: ${revision.body.slice(0, 150)}`);
    }

    function handleClick(event) {
      const target = event.target?.closest?.('[data-prompt-revision-action]'); if (!target) return;
      const action = target.dataset.promptRevisionAction;
      if (action === 'close') return closePanel();
      if (!activePrompt) return;
      if (action === 'export') {
        const payload = exportPrompt(activePrompt.id); const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob); const link = documentRef.createElement('a'); link.href = url; link.download = 'hafize-prompt-revisions.json'; link.click(); rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0); report('Sürüm geçmişi dışa aktarıldı.'); return;
      }
      if (action === 'clear') {
        if (!rootRef.confirm?.('Bu istemin tüm sürüm geçmişi temizlensin mi?')) return;
        clear(activePrompt.id); render(); report('Sürüm geçmişi temizlendi.'); return;
      }
      const revisionId = target.dataset.promptRevisionId; const revision = list(activePrompt.id).find((item) => item.id === revisionId); if (!revision) return;
      if (action === 'view') return compare(revision);
      if (action === 'remove') { if (!rootRef.confirm?.('Bu eski sürüm silinsin mi?')) return; remove(activePrompt.id, revision.id); render(); report('Eski sürüm silindi.'); return; }
      if (action === 'restore') {
        if (!rootRef.confirm?.(`“${revision.title}” sürümü geri yüklensin mi?`)) return;
        const current = { ...activePrompt };
        capture(current, 'manual');
        const result = insertRevisionIntoPrompt(revision);
        if (!result.ok) return report('Sürüm geri yüklenemedi.');
        activePrompt = core().loadItems(storage()).find((item) => item.id === activePrompt.id) || activePrompt;
        render(); report('Sürüm geri yüklendi.');
      }
    }

    function open(prompt) {
      const current = prompt && core()?.loadItems?.(storage())?.find?.((item) => item.id === prompt.id);
      if (!current) return;
      lastFocus = documentRef.activeElement; activePrompt = current; panel.hidden = false; render(); close.focus();
    }

    function onKeydown(event) {
      if (!panel.hidden && event.key === 'Escape') { event.preventDefault(); closePanel(); return; }
      if (panel.hidden || event.key !== 'Tab') return;
      const focusables = [...panel.querySelectorAll('button')].filter((node) => !node.disabled && !node.hidden);
      if (!focusables.length) return;
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    function onCardClick(event) {
      const target = event.target?.closest?.('.prompt-item-actions button');
      if (!target || target.textContent?.trim() !== 'Düzenle') return;
      const row = target.closest('.prompt-item'); const id = row?.dataset?.promptId;
      const item = id ? core()?.loadItems?.(storage())?.find?.((candidate) => candidate.id === id) : null;
      if (!item) return;
      if (capture(item)) report('Önceki sürüm geçmişe kaydedildi.');
    }

    const onStorage = (event) => { if (event.key === core()?.STORAGE_KEY && activePrompt) { activePrompt = core()?.loadItems?.(storage())?.find?.((item) => item.id === activePrompt.id) || activePrompt; render(); } };
    card.addEventListener('click', onCardClick, true); panel.addEventListener('click', handleClick); documentRef.addEventListener('keydown', onKeydown); rootRef.addEventListener?.('storage', onStorage);
    return Object.freeze({ mounted: true, open, close: closePanel, list, capture, normalizeRevision, exportPrompt, destroy: () => { card.removeEventListener('click', onCardClick, true); panel.removeEventListener('click', handleClick); documentRef.removeEventListener('keydown', onKeydown); rootRef.removeEventListener?.('storage', onStorage); closePanel(); panel.remove(); delete card.dataset.revisionReady; } });
  }

  root.HafizePromptLibraryRevisions = Object.freeze({ STORAGE_KEY, MAX_REVISIONS, normalizeRevision, normalizeStore, readAll, writeAll, list, capture, remove, clear, exportPrompt, insertRevisionIntoPrompt, mount });
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
