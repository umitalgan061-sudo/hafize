(function installHafizePromptRevisions(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.prompt-library.revisions.v1';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const CARD_ID = 'promptLibraryCard';
  const MAX_PER_PROMPT = 8;
  const MAX_REVISIONS = 240;
  const MAX_BODY = 8000;
  const MAX_TITLE = 100;
  const MAX_TAGS = 8;
  const core = () => root.HafizePromptLibrary;
  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const now = () => new Date().toISOString();
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function read() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function normalizeItem(value) {
    if (!value || typeof value !== 'object') return null;
    const body = typeof value.body === 'string' ? value.body.slice(0, MAX_BODY).replace(/\0/g, '') : '';
    if (!body) return null;
    const tags = Array.isArray(value.tags) ? [...new Set(value.tags.map((tag) => clean(tag, 24)).filter(Boolean))].slice(0, MAX_TAGS) : [];
    return {
      id: clean(value.id, 120) || makeId(),
      promptId: clean(value.promptId, 120),
      version: Number.isInteger(value.version) && value.version > 0 ? Math.min(9999, value.version) : 1,
      title: clean(value.title, MAX_TITLE) || 'İsimsiz istem',
      body,
      tags,
      createdAt: clean(value.createdAt, 40) || now(),
      source: clean(value.source, 32) || 'edit'
    };
  }
  function normalize(value) {
    const seen = new Set(); const output = [];
    for (const raw of (Array.isArray(value) ? value : []).slice(0, MAX_REVISIONS * 2)) {
      const item = normalizeItem(raw);
      if (!item || !item.promptId || seen.has(item.id)) continue;
      seen.add(item.id); output.push(item);
      if (output.length >= MAX_REVISIONS) break;
    }
    return output;
  }
  function load() { return normalize(read()); }
  function save(value) {
    try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); return true; }
    catch { return false; }
  }
  function list(promptId) {
    const id = clean(promptId, 120);
    return load().filter((item) => item.promptId === id).sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_PER_PROMPT);
  }
  function capture(prompt, source = 'edit') {
    if (!prompt || !prompt.id || !prompt.body) return null;
    const versions = list(prompt.id);
    const latest = versions[0];
    if (latest && latest.title === prompt.title && latest.body === prompt.body && JSON.stringify(latest.tags) === JSON.stringify(prompt.tags || [])) return latest;
    const item = normalizeItem({ id: makeId(), promptId: prompt.id, version: (latest?.version || 0) + 1, title: prompt.title, body: prompt.body, tags: prompt.tags, createdAt: now(), source });
    if (!item) return null;
    const next = load().filter((candidate) => candidate.promptId !== prompt.id || candidate.id !== latest?.id);
    next.unshift(item);
    const perPrompt = list(prompt.id).filter((candidate) => candidate.id !== item.id).slice(0, MAX_PER_PROMPT - 1);
    const retained = next.filter((candidate) => candidate.promptId !== prompt.id).concat([item, ...perPrompt]);
    if (!save(retained)) return null;
    emit('hafize:prompt-library-revisions-changed', item);
    return item;
  }
  function get(id) { return load().find((item) => item.id === clean(id, 120)) || null; }
  function removePrompt(promptId) {
    const id = clean(promptId, 120); const next = load().filter((item) => item.promptId !== id);
    const ok = save(next); if (ok) emit('hafize:prompt-library-revisions-changed', { promptId: id, removed: true }); return ok;
  }
  function restore(promptId, revisionId) {
    const revision = get(revisionId);
    if (!revision || revision.promptId !== clean(promptId, 120) || !core()) return null;
    const prompts = core().loadItems(root.localStorage); const index = prompts.findIndex((item) => item.id === revision.promptId);
    if (index < 0) return null;
    const current = prompts[index];
    capture(current, 'before-restore');
    const restored = core().normalizeItem({ ...current, title: revision.title, body: revision.body, tags: revision.tags, updatedAt: now() });
    if (!restored) return null;
    prompts.splice(index, 1, restored);
    if (!core().saveItems(root.localStorage, prompts)) return null;
    capture(restored, 'restore');
    emit('hafize:prompt-library-changed', restored);
    return restored;
  }
  function emit(type, detail) { try { root.dispatchEvent?.(new root.CustomEvent(type, { detail })); } catch {} }
  function button(doc, text, action) {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = text; node.className = 'mini-btn prompt-revision-action'; node.dataset.revisionAction = action; return node;
  }
  let mounted = false; let observer = null;
  function openHistory(promptId, titleText) {
    root.document.getElementById('promptRevisionDialog')?.remove();
    const dialog = root.document.createElement('section'); dialog.id = 'promptRevisionDialog'; dialog.className = 'prompt-revision-dialog';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'promptRevisionTitle');
    const shell = root.document.createElement('div'); shell.className = 'prompt-revision-dialog-shell';
    const head = root.document.createElement('div'); head.className = 'prompt-revision-dialog-head';
    const title = root.document.createElement('strong'); title.id = 'promptRevisionTitle'; title.textContent = `Revizyonlar · ${clean(titleText, 72)}`;
    const close = button(root.document, 'Kapat', 'close'); head.append(title, close);
    const listNode = root.document.createElement('div'); listNode.className = 'prompt-revision-list';
    const status = root.document.createElement('div'); status.className = 'prompt-revision-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    shell.append(head, listNode, status); dialog.append(shell); root.document.body.append(dialog);
    function render() {
      listNode.replaceChildren();
      const entries = list(promptId);
      if (!entries.length) { const empty = root.document.createElement('p'); empty.textContent = 'Henüz revizyon yok.'; listNode.append(empty); return; }
      for (const entry of entries) {
        const row = root.document.createElement('article'); row.className = 'prompt-revision-row';
        const meta = root.document.createElement('div'); meta.className = 'prompt-revision-meta';
        const label = root.document.createElement('strong'); label.textContent = `v${entry.version}`;
        const date = root.document.createElement('span'); date.textContent = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt)); meta.append(label, date);
        const preview = root.document.createElement('p'); preview.textContent = entry.body.replace(/\s+/g, ' ').slice(0, 180);
        const restoreButton = button(root.document, 'Geri yükle', 'restore'); restoreButton.dataset.revisionId = entry.id;
        row.append(meta, preview, restoreButton); listNode.append(row);
      }
    }
    render(); close.focus?.();
    close.addEventListener('click', () => dialog.remove());
    listNode.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-revision-action="restore"]'); if (!target) return;
      if (!root.confirm?.('Bu revizyon mevcut istemin yerine geri yüklensin mi?')) return;
      const restored = restore(promptId, target.dataset.revisionId);
      status.textContent = restored ? 'Revizyon geri yüklendi.' : 'Revizyon geri yüklenemedi.';
    });
    dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); dialog.remove(); } });
  }
  function injectHistoryButtons() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card) return;
    for (const row of card.querySelectorAll('.prompt-item')) {
      const actions = row.querySelector('.prompt-item-actions'); const id = row.dataset.promptId;
      if (!actions || !id || actions.querySelector('[data-revision-action="open"]')) continue;
      const item = core()?.loadItems?.(root.localStorage)?.find((candidate) => candidate.id === id); if (!item) continue;
      const open = button(root.document, 'Geçmiş', 'open'); open.dataset.revisionId = id; open.setAttribute('aria-label', `${item.title} revizyon geçmişini aç`);
      open.addEventListener('click', () => openHistory(id, item.title)); actions.append(open);
    }
  }
  function boot() {
    if (mounted || !root.document || !core()) return;
    if (!root.document.getElementById(CARD_ID)) return;
    mounted = true; observer = typeof MutationObserver === 'function' ? new MutationObserver(injectHistoryButtons) : null;
    observer?.observe(root.document.getElementById(CARD_ID), { childList: true, subtree: true }); injectHistoryButtons();
    root.addEventListener?.('hafize:prompt-library-changed', injectHistoryButtons);
  }
  root.HafizePromptLibraryRevisions = Object.freeze({ STORAGE_KEY, MAX_PER_PROMPT, MAX_REVISIONS, load, save, list, capture, get, removePrompt, restore });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
