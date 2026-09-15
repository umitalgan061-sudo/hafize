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
  const MAX_EXPORT = 1_000_000;
  const core = () => root.HafizePromptLibrary;
  const storage = () => root.localStorage;
  const clamp = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
  const now = () => new Date().toISOString();
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const cleanTags = (value) => Array.isArray(value) ? [...new Set(value.map((tag) => clamp(tag, MAX_TAG).trim()).filter(Boolean))].slice(0, MAX_TAGS) : [];

  function normalizeRevision(input) {
    if (!input || typeof input !== 'object') return null;
    const promptId = clamp(input.promptId, 120).trim();
    const body = clamp(input.body, MAX_BODY).replace(/\0/g, '');
    if (!promptId || !body) return null;
    return Object.freeze({ id: clamp(input.id, 120).trim() || makeId(), promptId, savedAt: clamp(input.savedAt, 40).trim() || now(), reason: input.reason === 'manual' ? 'manual' : 'before-edit', title: clamp(input.title, MAX_TITLE).trim() || 'İsimsiz istem', body, tags: cleanTags(input.tags) });
  }

  function normalizeStore(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    for (const promptId of Object.keys(value).slice(0, MAX_PROMPTS)) {
      const revisions = Array.isArray(value[promptId]) ? value[promptId].map(normalizeRevision).filter(Boolean).filter((revision) => revision.promptId === promptId).slice(0, MAX_REVISIONS) : [];
      if (revisions.length) output[promptId] = revisions;
    }
    return output;
  }

  function readAll() {
    try { return normalizeStore(JSON.parse(storage()?.getItem?.(STORAGE_KEY) || '{}')); } catch { return {}; }
  }

  function writeAll(value) {
    try { storage()?.setItem?.(STORAGE_KEY, JSON.stringify(normalizeStore(value))); return true; } catch { return false; }
  }

  function list(promptId) {
    const id = clamp(promptId, 120).trim(); if (!id) return [];
    return (readAll()[id] || []).slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  function capture(item, reason = 'before-edit') {
    const revision = normalizeRevision({ ...item, id: makeId(), savedAt: now(), reason });
    if (!revision) return false;
    const store = readAll(); const current = store[revision.promptId] || [];
    if (current.some((candidate) => candidate.title === revision.title && candidate.body === revision.body && JSON.stringify(candidate.tags) === JSON.stringify(revision.tags))) return false;
    store[revision.promptId] = [revision, ...current].slice(0, MAX_REVISIONS);
    return writeAll(store);
  }

  function remove(promptId, revisionId) {
    const id = clamp(promptId, 120).trim(); const rid = clamp(revisionId, 120).trim(); if (!id || !rid) return false;
    const store = readAll(); const next = (store[id] || []).filter((revision) => revision.id !== rid);
    if (next.length) store[id] = next; else delete store[id]; return writeAll(store);
  }

  function clear(promptId) {
    const id = clamp(promptId, 120).trim(); if (!id) return false;
    const store = readAll(); delete store[id]; return writeAll(store);
  }

  function exportPrompt(promptId) {
    const id = clamp(promptId, 120).trim();
    const payload = { version: 1, source: 'hafize-prompt-library-revisions', promptId: id, exportedAt: now(), revisions: list(id) };
    const output = JSON.stringify(payload, null, 2);
    return output.length <= MAX_EXPORT ? output : JSON.stringify({ ...payload, revisions: payload.revisions.slice(0, 5) }, null, 2);
  }

  function dispatchRefresh(items) {
    try {
      if (typeof root.StorageEvent === 'function') root.dispatchEvent(new root.StorageEvent('storage', { key: core()?.STORAGE_KEY, newValue: JSON.stringify(items), storageArea: storage() }));
      else root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh'));
    } catch { root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh')); }
  }

  function restore(revision) {
    const api = core(); const items = api?.loadItems?.(storage()) || []; const target = items.find((item) => item.id === revision.promptId);
    if (!target) return { ok: false, reason: 'prompt-not-found' };
    const next = api.normalizeItem({ ...target, title: revision.title, body: revision.body, tags: revision.tags, favorite: target.favorite, useCount: target.useCount, createdAt: target.createdAt, updatedAt: now() });
    if (!next) return { ok: false, reason: 'invalid-revision' };
    const result = items.map((item) => item.id === target.id ? next : item);
    if (!api.saveItems(storage(), result)) return { ok: false, reason: 'storage-write-failed' };
    dispatchRefresh(result); return { ok: true, item: next };
  }

  const makeButton = (doc, label, action, id) => {
    const node = doc.createElement('button'); node.type = 'button'; node.className = 'soft-btn prompt-revision-action'; node.textContent = label; node.dataset.promptRevisionAction = action; if (id) node.dataset.promptRevisionId = id; node.setAttribute('aria-label', label); return node;
  };

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID); if (!documentRef || !card || card.dataset.revisionsMounted === 'true') return null;
    card.dataset.revisionsMounted = 'true';
    const panel = documentRef.createElement('section'); panel.id = 'promptLibraryRevisionPanel'; panel.className = 'prompt-revision-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'promptRevisionTitle');
    const shell = documentRef.createElement('div'); shell.className = 'prompt-revision-shell';
    const head = documentRef.createElement('div'); head.className = 'prompt-revision-head';
    const heading = documentRef.createElement('strong'); heading.id = 'promptRevisionTitle'; heading.textContent = 'İstem sürüm geçmişi';
    const close = makeButton(documentRef, 'Kapat', 'close'); close.className = 'mini-btn prompt-revision-action'; head.append(heading, close);
    const description = documentRef.createElement('p'); description.className = 'prompt-revision-description'; description.setAttribute('aria-live', 'polite');
    const currentTitle = documentRef.createElement('div'); currentTitle.className = 'prompt-revision-current-title'; currentTitle.setAttribute('aria-live', 'polite');
    const current = documentRef.createElement('pre'); current.className = 'prompt-revision-current';
    const comparison = documentRef.createElement('div'); comparison.className = 'prompt-revision-comparison'; comparison.hidden = true;
    const comparisonHeading = documentRef.createElement('strong'); comparisonHeading.className = 'prompt-revision-comparison-heading'; comparisonHeading.textContent = 'Karşılaştırma';
    const comparisonGrid = documentRef.createElement('div'); comparisonGrid.className = 'prompt-revision-comparison-grid';
    comparison.append(comparisonHeading, comparisonGrid);
    const listNode = documentRef.createElement('div'); listNode.className = 'prompt-revision-list'; listNode.setAttribute('role', 'list');
    const footer = documentRef.createElement('div'); footer.className = 'prompt-revision-footer';
    const exportButton = makeButton(documentRef, 'Geçmişi dışa aktar', 'export'); const clearButton = makeButton(documentRef, 'Geçmişi temizle', 'clear'); footer.append(exportButton, clearButton);
    const status = documentRef.createElement('div'); status.className = 'prompt-revision-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    shell.append(head, description, currentTitle, current, comparison, listNode, footer, status); panel.append(shell); card.append(panel);
    let activePrompt = null; let previousFocus = null; let observer = null;

    const report = (message) => { status.textContent = clamp(message, 180); };
    const closePanel = () => { panel.hidden = true; activePrompt = null; listNode.replaceChildren(); comparisonGrid.replaceChildren(); comparison.hidden = true; current.textContent = ''; status.textContent = ''; previousFocus?.focus?.(); previousFocus = null; };
    const render = () => {
      if (!activePrompt) return;
      const revisions = list(activePrompt.id);
      currentTitle.textContent = `Mevcut: ${activePrompt.title}`; current.textContent = activePrompt.body.slice(0, MAX_BODY); description.textContent = `${revisions.length} kayıtlı sürüm · geri yükleme favori ve kullanım sayısını korur.`; listNode.replaceChildren();
      if (!revisions.length) { const empty = documentRef.createElement('div'); empty.className = 'prompt-revision-empty'; empty.textContent = 'Bu istem için henüz geçmiş yok.'; listNode.append(empty); return; }
      revisions.forEach((revision, index) => {
        const row = documentRef.createElement('article'); row.className = 'prompt-revision-row'; row.setAttribute('role', 'listitem');
        const meta = documentRef.createElement('div'); meta.className = 'prompt-revision-meta'; meta.textContent = `${index + 1}. ${revision.reason === 'manual' ? 'Manuel' : 'Düzenleme öncesi'} · ${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(revision.savedAt))}`;
        const name = documentRef.createElement('strong'); name.className = 'prompt-revision-name'; name.textContent = revision.title;
        const preview = documentRef.createElement('pre'); preview.className = 'prompt-revision-preview'; preview.textContent = revision.body.slice(0, 260);
        const rowActions = documentRef.createElement('div'); rowActions.className = 'prompt-revision-row-actions'; rowActions.append(makeButton(documentRef, 'Karşılaştır', 'compare', revision.id), makeButton(documentRef, 'Geri yükle', 'restore', revision.id), makeButton(documentRef, 'Sil', 'remove', revision.id));
        row.append(meta, name, preview, rowActions); listNode.append(row);
      });
    };

    const showComparison = (revision) => {
      comparisonGrid.replaceChildren(); comparison.hidden = false;
      for (const [label, value, className] of [['Mevcut sürüm', activePrompt?.body || '', 'prompt-revision-diff-current'], [`Revision · ${revision.title}`, revision.body, 'prompt-revision-diff-old']]) {
        const box = documentRef.createElement('div'); box.className = `prompt-revision-diff ${className}`;
        const title = documentRef.createElement('strong'); title.textContent = label;
        const body = documentRef.createElement('pre'); body.textContent = value.slice(0, 2000);
        box.append(title, body); comparisonGrid.append(box);
      }
      const same = activePrompt?.body === revision.body && activePrompt?.title === revision.title && JSON.stringify(activePrompt?.tags || []) === JSON.stringify(revision.tags || []);
      report(same ? 'Bu revision mevcut içerikle aynı.' : 'Mevcut sürüm ile seçilen revision yan yana gösteriliyor.');
    };

    const open = (prompt) => { const found = prompt && core()?.loadItems?.(storage())?.find?.((item) => item.id === prompt.id); if (!found) return; previousFocus = documentRef.activeElement; activePrompt = found; panel.hidden = false; render(); close.focus(); };
    const handle = (event) => {
      const target = event.target?.closest?.('[data-prompt-revision-action]'); if (!target) return; const action = target.dataset.promptRevisionAction;
      if (action === 'close') return closePanel(); if (!activePrompt) return;
      if (action === 'export') { const payload = exportPrompt(activePrompt.id); const blob = new Blob([payload], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = documentRef.createElement('a'); link.href = url; link.download = 'hafize-prompt-revisions.json'; link.click(); rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0); return report('Sürüm geçmişi dışa aktarıldı.'); }
      if (action === 'clear') { if (!rootRef.confirm?.('Bu istemin tüm sürüm geçmişi temizlensin mi?')) return; clear(activePrompt.id); render(); return report('Sürüm geçmişi temizlendi.'); }
      const revision = list(activePrompt.id).find((item) => item.id === target.dataset.promptRevisionId); if (!revision) return;
      if (action === 'compare') return showComparison(revision);
      if (action === 'remove') { if (!rootRef.confirm?.('Bu eski sürüm silinsin mi?')) return; remove(activePrompt.id, revision.id); render(); return report('Eski sürüm silindi.'); }
      if (action === 'restore') { if (!rootRef.confirm?.(`“${revision.title}” sürümü geri yüklensin mi?`)) return; capture(activePrompt, 'manual'); const result = restore(revision); if (!result.ok) return report('Sürüm geri yüklenemedi.'); activePrompt = result.item; render(); return report('Sürüm geri yüklendi.'); }
    };
    const interceptEdit = (event) => { const target = event.target?.closest?.('.prompt-item-actions button'); if (!target || target.textContent?.trim() !== 'Düzenle') return; const id = target.closest('.prompt-item')?.dataset?.promptId; const item = id ? core()?.loadItems?.(storage())?.find?.((candidate) => candidate.id === id) : null; if (item) capture(item); };
    const enhanceRows = () => { card.querySelectorAll('.prompt-item').forEach((row) => { const id = row.dataset.promptId; const actions = row.querySelector('.prompt-item-actions'); if (!id || !actions || actions.querySelector('[data-prompt-revision-action="history"]')) return; actions.append(makeButton(documentRef, 'Geçmiş', 'history', id)); }); };
    const rowHandler = (event) => { const target = event.target?.closest?.('[data-prompt-revision-action="history"]'); if (!target) return; event.preventDefault(); event.stopImmediatePropagation(); const id = target.dataset.promptRevisionId; const item = id ? core()?.loadItems?.(storage())?.find?.((candidate) => candidate.id === id) : null; if (item) open(item); };
    const keydownHandler = (event) => {
      if (panel.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closePanel(); return; }
      if (event.key !== 'Tab') return;
      const focusables = [...panel.querySelectorAll('button')].filter((node) => !node.disabled && !node.hidden);
      if (!focusables.length) return;
      const first = focusables[0]; const last = focusables[focusables.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const storageHandler = (event) => { if (event.key === core()?.STORAGE_KEY && activePrompt) { activePrompt = core()?.loadItems?.(storage())?.find?.((item) => item.id === activePrompt.id) || activePrompt; render(); } };
    observer = typeof MutationObserver === 'function' ? new MutationObserver(enhanceRows) : null; observer?.observe(card, { childList: true, subtree: true }); enhanceRows();
    card.addEventListener('click', interceptEdit, true); card.addEventListener('click', rowHandler, true); panel.addEventListener('click', handle); documentRef.addEventListener('keydown', keydownHandler); rootRef.addEventListener?.('storage', storageHandler);
    return Object.freeze({ mounted: true, open, close: closePanel, list, capture, normalizeRevision, exportPrompt, restore, destroy: () => { observer?.disconnect(); card.removeEventListener('click', interceptEdit, true); card.removeEventListener('click', rowHandler, true); panel.removeEventListener('click', handle); documentRef.removeEventListener('keydown', keydownHandler); rootRef.removeEventListener?.('storage', storageHandler); closePanel(); panel.remove(); delete card.dataset.revisionsMounted; } });
  }

  root.HafizePromptLibraryRevisions = Object.freeze({ STORAGE_KEY, MAX_REVISIONS, normalizeRevision, normalizeStore, readAll, writeAll, list, capture, remove, clear, exportPrompt, restore, mount });
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
