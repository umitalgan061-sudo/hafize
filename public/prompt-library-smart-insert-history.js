(function installPromptSmartInsertHistory(root) {
  'use strict';
  const HISTORY_KEY = 'hafize.prompt-library.smart-insert-history.v1';
  const MAX_ENTRIES = 40;
  const MAX_ID = 120;
  const MAX_LABEL = 100;
  const MAX_REASON = 100;

  const clean = (value, limit) => String(value ?? '').replace(/\0/g, '').trim().slice(0, limit);
  const now = () => new Date().toISOString();
  const id = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const promptId = clean(raw.promptId, MAX_ID);
    if (!promptId) return null;
    const timestamp = clean(raw.usedAt, 40) || now();
    return Object.freeze({
      id: clean(raw.id, MAX_ID) || id(),
      promptId,
      label: clean(raw.label, MAX_LABEL) || 'İsimsiz istem',
      usedAt: timestamp,
      reason: clean(raw.reason, MAX_REASON) || 'insert'
    });
  }

  function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    const seen = new Set();
    for (const candidate of raw.slice(0, MAX_ENTRIES * 3)) {
      const entry = normalizeEntry(candidate);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      result.push(entry);
      if (result.length >= MAX_ENTRIES) break;
    }
    return result.sort((a, b) => b.usedAt.localeCompare(a.usedAt));
  }

  function loadHistory() {
    try { return normalizeHistory(JSON.parse(root.localStorage?.getItem(HISTORY_KEY) || '[]')); }
    catch { return []; }
  }

  function saveHistory(entries) {
    try {
      const value = normalizeHistory(entries).slice(0, MAX_ENTRIES);
      root.localStorage?.setItem(HISTORY_KEY, JSON.stringify(value));
      root.dispatchEvent?.(new Event('hafize:prompt-library-smart-insert-history-changed'));
      return true;
    } catch { return false; }
  }

  function record(promptId, label, reason = 'insert') {
    const safeId = clean(promptId, MAX_ID);
    if (!safeId) return false;
    const previous = loadHistory();
    const next = normalizeEntry({ promptId: safeId, label, reason, usedAt: now() });
    if (!next) return false;
    const filtered = previous.filter((entry) => entry.promptId !== safeId);
    return saveHistory([next, ...filtered]);
  }

  function remove(promptId) {
    const safeId = clean(promptId, MAX_ID);
    return saveHistory(loadHistory().filter((entry) => entry.promptId !== safeId));
  }

  function clear() { return saveHistory([]); }

  function recent(limit = 8) {
    const size = Math.max(0, Math.min(MAX_ENTRIES, Number(limit) || 0));
    return loadHistory().slice(0, size);
  }

  function countFor(promptId) {
    const safeId = clean(promptId, MAX_ID);
    return loadHistory().filter((entry) => entry.promptId === safeId).length;
  }

  function renderList(documentRef, host, resolveItem) {
    if (!documentRef || !host) return;
    host.replaceChildren();
    const entries = recent();
    if (!entries.length) {
      const empty = documentRef.createElement('div');
      empty.className = 'prompt-smart-insert-history-empty';
      empty.textContent = 'Henüz Smart Insert kullanımı yok.';
      host.append(empty);
      return;
    }
    for (const entry of entries) {
      const row = documentRef.createElement('div');
      row.className = 'prompt-smart-insert-history-row';
      row.setAttribute('role', 'listitem');
      row.dataset.promptId = entry.promptId;
      const text = documentRef.createElement('span');
      text.className = 'prompt-smart-insert-history-label';
      text.textContent = entry.label;
      const meta = documentRef.createElement('span');
      meta.className = 'prompt-smart-insert-history-date';
      meta.textContent = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.usedAt));
      const open = documentRef.createElement('button');
      open.type = 'button'; open.className = 'mini-btn'; open.textContent = 'Tekrar aç';
      open.setAttribute('aria-label', `${entry.label} istemini tekrar aç`);
      open.addEventListener('click', () => { const item = resolveItem?.(entry.promptId); if (item) root.HafizePromptLibrarySmartInsert?.open?.(item); });
      const removeButton = documentRef.createElement('button');
      removeButton.type = 'button'; removeButton.className = 'mini-btn'; removeButton.textContent = 'Kaldır';
      removeButton.setAttribute('aria-label', `${entry.label} kullanım kaydını kaldır`);
      removeButton.addEventListener('click', () => { remove(entry.promptId); renderList(documentRef, host, resolveItem); });
      row.append(text, meta, open, removeButton); host.append(row);
    }
  }

  function mount(documentRef = root.document) {
    const card = documentRef?.getElementById?.('promptLibraryCard');
    if (!documentRef || !card || documentRef.getElementById('promptLibrarySmartInsertHistory')) return null;
    const section = documentRef.createElement('section');
    section.id = 'promptLibrarySmartInsertHistory';
    section.className = 'prompt-smart-insert-history';
    section.setAttribute('aria-labelledby', 'promptSmartInsertHistoryTitle');
    const head = documentRef.createElement('div'); head.className = 'prompt-smart-insert-history-head';
    const title = documentRef.createElement('strong'); title.id = 'promptSmartInsertHistoryTitle'; title.textContent = 'Son Smart Insert kullanımları';
    const clearButton = documentRef.createElement('button'); clearButton.type = 'button'; clearButton.className = 'mini-btn'; clearButton.textContent = 'Temizle';
    clearButton.setAttribute('aria-label', 'Smart Insert kullanım geçmişini temizle');
    head.append(title, clearButton);
    const list = documentRef.createElement('div'); list.className = 'prompt-smart-insert-history-list'; list.setAttribute('role', 'list');
    const status = documentRef.createElement('div'); status.className = 'prompt-smart-insert-history-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    section.append(head, list, status); card.append(section);
    const resolveItem = (promptId) => root.HafizePromptLibrary?.loadItems?.(root.localStorage).find((item) => item.id === promptId);
    const render = () => renderList(documentRef, list, resolveItem);
    clearButton.addEventListener('click', () => { if (!root.confirm?.('Smart Insert kullanım geçmişi temizlensin mi?')) return; if (clear()) status.textContent = 'Kullanım geçmişi temizlendi.'; render(); });
    root.addEventListener?.('hafize:prompt-library-smart-insert-history-changed', render);
    render();
    return Object.freeze({ record, loadHistory, recent, render, clear, destroy: () => { root.removeEventListener?.('hafize:prompt-library-smart-insert-history-changed', render); section.remove(); } });
  }

  root.HafizePromptLibrarySmartInsertHistory = Object.freeze({ HISTORY_KEY, limits: Object.freeze({ MAX_ENTRIES, MAX_ID, MAX_LABEL, MAX_REASON }), normalizeEntry, normalizeHistory, loadHistory, saveHistory, record, remove, clear, recent, countFor, renderList, mount });
  const start = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
