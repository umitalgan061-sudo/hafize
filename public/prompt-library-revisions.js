(function installPromptLibraryRevisions(root) {
  'use strict';

  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const PANEL_ID = 'promptLibraryRevisions';
  const MAX_REVISIONS_PER_PROMPT = 20;
  const MAX_REVISIONS_TOTAL = 600;
  const MAX_TITLE = 100;
  const MAX_BODY = 8000;
  const MAX_TAGS = 8;
  const MAX_TAG = 24;
  const MAX_REASON = 160;
  const MAX_ID = 120;
  const MAX_PREVIEW = 140;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isoNow = () => new Date().toISOString();
  const clip = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function readPrompts(storage = root.localStorage) {
    try {
      const raw = storage?.getItem?.(PROMPT_KEY);
      const value = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && typeof item.id === 'string') : [];
    } catch {
      return [];
    }
  }

  function normalizeSnapshot(item) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return null;
    const body = typeof item.body === 'string' ? item.body.slice(0, MAX_BODY).replace(/\0/g, '') : '';
    if (!body) return null;
    const tags = Array.isArray(item.tags) ? [...new Set(item.tags.filter((tag) => typeof tag === 'string').map((tag) => clip(tag, MAX_TAG)).filter(Boolean))].slice(0, MAX_TAGS) : [];
    return Object.freeze({
      id: clip(item.id, MAX_ID),
      title: clip(item.title, MAX_TITLE) || 'İsimsiz istem',
      body,
      tags,
      favorite: item.favorite === true,
      useCount: Number.isFinite(item.useCount) && item.useCount >= 0 ? Math.min(9999, Math.floor(item.useCount)) : 0,
      createdAt: clip(item.createdAt, 40) || isoNow(),
      updatedAt: clip(item.updatedAt, 40) || isoNow()
    });
  }

  function normalizeRevision(input) {
    if (!input || typeof input !== 'object') return null;
    const snapshot = normalizeSnapshot(input.snapshot);
    if (!snapshot) return null;
    return {
      id: clip(input.id, MAX_ID) || makeId(),
      promptId: clip(input.promptId, MAX_ID) || snapshot.id,
      createdAt: clip(input.createdAt, 40) || isoNow(),
      reason: clip(input.reason, MAX_REASON),
      snapshot
    };
  }

  function readRevisions(storage = root.localStorage) {
    try {
      const raw = storage?.getItem?.(REVISION_KEY);
      const value = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value.map(normalizeRevision).filter(Boolean).slice(0, MAX_REVISIONS_TOTAL) : [];
    } catch {
      return [];
    }
  }

  function saveRevisions(storage, revisions) {
    try {
      storage?.setItem?.(REVISION_KEY, JSON.stringify(revisions.slice(0, MAX_REVISIONS_TOTAL)));
      return true;
    } catch {
      return false;
    }
  }

  function revisionsFor(promptId, storage = root.localStorage) {
    return readRevisions(storage)
      .filter((revision) => revision.promptId === promptId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function sameContent(a, b) {
    if (!a || !b) return false;
    return a.title === b.title && a.body === b.body && JSON.stringify(a.tags || []) === JSON.stringify(b.tags || []) && a.favorite === b.favorite;
  }

  function capture(prompt, reason = 'edit', storage = root.localStorage) {
    const snapshot = normalizeSnapshot(prompt);
    if (!snapshot) return false;
    const revisions = readRevisions(storage);
    const prior = revisionsFor(snapshot.id, storage)[0];
    if (prior && sameContent(prior.snapshot, snapshot)) return false;
    const revision = normalizeRevision({ promptId: snapshot.id, snapshot: clone(snapshot), reason, createdAt: isoNow() });
    if (!revision) return false;
    const nextForPrompt = revisions.filter((item) => item.promptId === snapshot.id).slice(0, MAX_REVISIONS_PER_PROMPT - 1);
    const others = revisions.filter((item) => item.promptId !== snapshot.id);
    const next = [revision, ...nextForPrompt, ...others].slice(0, MAX_REVISIONS_TOTAL);
    return saveRevisions(storage, next);
  }

  function removePromptRevisions(promptId, storage = root.localStorage) {
    const current = readRevisions(storage);
    const next = current.filter((revision) => revision.promptId !== promptId);
    return next.length === current.length || saveRevisions(storage, next);
  }

  function pruneOrphans(storage = root.localStorage) {
    const validIds = new Set(readPrompts(storage).map((item) => item.id));
    const current = readRevisions(storage);
    const next = current.filter((revision) => validIds.has(revision.promptId));
    return next.length === current.length || saveRevisions(storage, next);
  }

  function restore(promptId, revisionId, storage = root.localStorage) {
    const revision = readRevisions(storage).find((item) => item.promptId === promptId && item.id === revisionId);
    if (!revision) return null;
    const prompts = readPrompts(storage);
    const index = prompts.findIndex((item) => item.id === promptId);
    if (index < 0) return null;
    const current = prompts[index];
    capture(current, 'before-restore', storage);
    const restored = {
      ...revision.snapshot,
      id: promptId,
      createdAt: current.createdAt,
      updatedAt: isoNow(),
      useCount: current.useCount
    };
    prompts.splice(index, 1, restored);
    try {
      storage?.setItem?.(PROMPT_KEY, JSON.stringify(prompts));
    } catch {
      return null;
    }
    capture(restored, 'restore', storage);
    return restored;
  }

  function exportPromptRevisions(promptId, storage = root.localStorage) {
    const revisions = revisionsFor(promptId, storage);
    return JSON.stringify({ version: 1, source: 'hafize-prompt-library-revisions', exportedAt: isoNow(), promptId, revisions }, null, 2);
  }

  function summarizeRevision(revision) {
    return {
      id: revision.id,
      promptId: revision.promptId,
      createdAt: revision.createdAt,
      reason: revision.reason,
      title: revision.snapshot.title,
      preview: revision.snapshot.body.replace(/\s+/g, ' ').slice(0, MAX_PREVIEW)
    };
  }

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

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.('promptLibraryCard');
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-revisions';
    section.setAttribute('aria-labelledby', 'promptLibraryRevisionsTitle');

    const header = documentRef.createElement('div');
    header.className = 'prompt-library-revisions-head';
    const title = documentRef.createElement('strong');
    title.id = 'promptLibraryRevisionsTitle';
    title.textContent = 'Sürüm geçmişi';
    const status = text(documentRef, '', 'prompt-library-revisions-status');
    const toggle = button(documentRef, 'Gizle');
    toggle.setAttribute('aria-expanded', 'true');
    header.append(title, status, toggle);

    const body = documentRef.createElement('div');
    body.className = 'prompt-library-revisions-body';
    const choose = documentRef.createElement('select');
    choose.setAttribute('aria-label', 'Sürüm geçmişi için istem seç');
    const refresh = button(documentRef, 'Yenile');
    const toolbar = documentRef.createElement('div');
    toolbar.className = 'prompt-library-revisions-toolbar';
    toolbar.append(choose, refresh);
    const list = documentRef.createElement('div');
    list.className = 'prompt-library-revisions-list';
    list.setAttribute('role', 'list');
    body.append(toolbar, list);
    section.append(header, body);
    card.append(section);

    let selectedPrompt = '';
    let hidden = false;
    let statusResetHandle;

    function clearStatusReset() {
      if (statusResetHandle === undefined) return;
      rootRef.clearTimeout?.(statusResetHandle);
      statusResetHandle = undefined;
    }

    function setStatus(value) {
      // A newer message replaces the pending reset instead of stacking another
      // timer behind it, and `destroy()` cancels whatever is still scheduled.
      clearStatusReset();
      status.textContent = clip(value, 160);
      statusResetHandle = rootRef.setTimeout?.(() => {
        statusResetHandle = undefined;
        if (status.textContent === value) status.textContent = '';
      }, 2600);
    }

    function updatePromptOptions() {
      const prompts = readPrompts(rootRef.localStorage);
      const previous = selectedPrompt;
      choose.replaceChildren();
      for (const prompt of prompts) {
        const option = documentRef.createElement('option');
        option.value = prompt.id;
        option.textContent = clip(prompt.title, 100) || 'İsimsiz istem';
        choose.append(option);
      }
      selectedPrompt = prompts.some((item) => item.id === previous) ? previous : (prompts[0]?.id || '');
      if (selectedPrompt) choose.value = selectedPrompt;
    }

    function render() {
      pruneOrphans(rootRef.localStorage);
      updatePromptOptions();
      selectedPrompt = choose.value || '';
      list.replaceChildren();
      if (!selectedPrompt) {
        list.append(text(documentRef, 'Sürüm geçmişi için kayıtlı istem yok.', 'prompt-library-revisions-empty'));
        return;
      }
      const revisions = revisionsFor(selectedPrompt, rootRef.localStorage);
      if (!revisions.length) {
        list.append(text(documentRef, 'Bu istem için henüz sürüm geçmişi yok.', 'prompt-library-revisions-empty'));
        return;
      }
      for (const revision of revisions) {
        const row = documentRef.createElement('article');
        row.className = 'prompt-library-revision-row';
        row.dataset.revisionId = revision.id;
        row.setAttribute('role', 'listitem');
        const meta = text(documentRef, `${new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(revision.createdAt))} · ${revision.reason || 'değişiklik'}`, 'prompt-library-revision-meta');
        const heading = text(documentRef, revision.snapshot.title, 'prompt-library-revision-title');
        const preview = text(documentRef, revision.snapshot.body.replace(/\s+/g, ' ').slice(0, MAX_PREVIEW), 'prompt-library-revision-preview');
        const actions = documentRef.createElement('div');
        actions.className = 'prompt-library-revision-actions';
        const restoreButton = button(documentRef, 'Geri yükle');
        const exportButton = button(documentRef, 'JSON');
        actions.append(restoreButton, exportButton);
        row.append(meta, heading, preview, actions);
        list.append(row);

        restoreButton.addEventListener('click', () => {
          if (!rootRef.confirm?.(`“${revision.snapshot.title}” sürümünü geri yüklemek istediğine emin misin?`)) return;
          const restored = restore(selectedPrompt, revision.id, rootRef.localStorage);
          if (!restored) return setStatus('Sürüm geri yüklenemedi.');
          try { rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:prompt-library-changed')); } catch {}
          render();
          setStatus('Sürüm geri yüklendi.');
        });
        exportButton.addEventListener('click', () => {
          const blob = new Blob([exportPromptRevisions(selectedPrompt, rootRef.localStorage)], { type: 'application/json;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = documentRef.createElement('a');
          link.href = url;
          link.download = `hafize-prompt-revisions-${selectedPrompt}.json`;
          link.click();
          rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0);
          setStatus('Sürüm geçmişi dışa aktarıldı.');
        });
      }
    }

    choose.addEventListener('change', render);
    refresh.addEventListener('click', render);
    const onStorage = (event) => { if (event.key === PROMPT_KEY || event.key === REVISION_KEY) render(); };
    rootRef.addEventListener?.('storage', onStorage);
    let previous = JSON.stringify(readPrompts(rootRef.localStorage));
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      const next = JSON.stringify(readPrompts(rootRef.localStorage));
      if (next === previous) return;
      try {
        const before = JSON.parse(previous);
        const after = JSON.parse(next);
        const beforeMap = new Map(before.map((item) => [item.id, item]));
        for (const item of after) {
          if (beforeMap.has(item.id) && !sameContent(beforeMap.get(item.id), item)) capture(item, 'edit', rootRef.localStorage);
          if (!beforeMap.has(item.id)) capture(item, 'create', rootRef.localStorage);
        }
        for (const item of before) if (!after.some((candidate) => candidate.id === item.id)) removePromptRevisions(item.id, rootRef.localStorage);
      } catch {}
      previous = next;
      render();
    }) : null;
    observer?.observe(card, { childList: true, subtree: true });

    toggle.addEventListener('click', () => {
      hidden = !hidden;
      body.hidden = hidden;
      toggle.textContent = hidden ? 'Göster' : 'Gizle';
      toggle.setAttribute('aria-expanded', String(!hidden));
    });
    render();

    return Object.freeze({
      mounted: true,
      refresh: render,
      revisionsFor: (id) => revisionsFor(id, rootRef.localStorage),
      export: (id) => exportPromptRevisions(id, rootRef.localStorage),
      destroy: () => {
        observer?.disconnect();
        rootRef.removeEventListener?.('storage', onStorage);
        clearStatusReset();
        section.remove();
      }
    });
  }

  const api = Object.freeze({
    PROMPT_KEY,
    REVISION_KEY,
    MAX_REVISIONS_PER_PROMPT,
    MAX_REVISIONS_TOTAL,
    normalizeSnapshot,
    normalizeRevision,
    readRevisions,
    saveRevisions,
    revisionsFor,
    sameContent,
    capture,
    removePromptRevisions,
    pruneOrphans,
    restore,
    exportPromptRevisions,
    summarizeRevision,
    mount
  });
  root.HafizePromptLibraryRevisions = api;
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
