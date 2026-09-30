(function installPromptSmartInsertActivity(root) {
  'use strict';
  const HISTORY_KEY = 'hafize.prompt-library.smart-insert-history.v1';
  const CARD_ID = 'promptLibraryCard';
  const SECTION_ID = 'promptLibrarySmartInsertActivity';
  const MAX_DAYS = 14;
  const MAX_ROWS = 7;

  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function readHistory() {
    try {
      const raw = JSON.parse(root.localStorage?.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry === 'object' && typeof entry.promptId === 'string') : [];
    } catch { return []; }
  }

  function usageFor(entries) {
    const byPrompt = new Map();
    for (const entry of entries) {
      const id = String(entry.promptId || '').slice(0, 120);
      if (!id) continue;
      const current = byPrompt.get(id) || { promptId: id, label: String(entry.label || 'İsimsiz istem').slice(0, 100), count: 0, latest: '' };
      current.count += 1;
      if (!current.latest || String(entry.usedAt || '') > current.latest) current.latest = String(entry.usedAt || '');
      byPrompt.set(id, current);
    }
    return [...byPrompt.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
  }

  function dailyFor(entries, days = MAX_DAYS) {
    const size = Math.max(1, Math.min(MAX_DAYS, Number(days) || MAX_DAYS));
    const now = new Date();
    const map = new Map();
    for (let offset = 0; offset < size; offset += 1) {
      const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(now.getDate() - offset);
      const key = date.toISOString().slice(0, 10);
      map.set(key, 0);
    }
    for (const entry of entries) {
      const key = new Date(String(entry.usedAt || '')).toISOString?.().slice(0, 10);
      if (map.has(key)) map.set(key, map.get(key) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function summary(entries = readHistory()) {
    const usage = usageFor(entries);
    const daily = dailyFor(entries);
    return Object.freeze({
      totalEntries: entries.length,
      uniquePrompts: usage.length,
      topPrompt: usage[0] || null,
      activeDays: daily.filter(([, count]) => count > 0).length,
      daily
    });
  }

  function exportDigest(entries = readHistory()) {
    return JSON.stringify({ version: 1, source: 'hafize-prompt-smart-insert-activity', exportedAt: new Date().toISOString(), summary: summary(entries), usage: usageFor(entries).slice(0, 20) }, null, 2);
  }

  function download(text, filename) {
    try {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = make('a'); link.href = url; link.download = filename; link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch { return false; }
  }

  function mount(documentRef = root.document) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(SECTION_ID)) return null;
    const section = make('section', undefined, 'prompt-smart-insert-activity');
    section.id = SECTION_ID; section.setAttribute('aria-labelledby', 'promptSmartInsertActivityTitle');
    const head = make('div', undefined, 'prompt-smart-insert-activity-head');
    const title = make('strong', 'Smart Insert etkinliği'); title.id = 'promptSmartInsertActivityTitle';
    const exportButton = make('button', 'Özeti dışa aktar', 'mini-btn'); exportButton.type = 'button';
    const refreshButton = make('button', 'Yenile', 'mini-btn'); refreshButton.type = 'button';
    head.append(title, refreshButton, exportButton);
    const stats = make('div', undefined, 'prompt-smart-insert-activity-stats');
    const top = make('div', undefined, 'prompt-smart-insert-activity-top');
    const daily = make('div', undefined, 'prompt-smart-insert-activity-daily'); daily.setAttribute('role', 'list');
    const status = make('div', '', 'prompt-smart-insert-activity-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    section.append(head, stats, top, daily, status); card.append(section);

    function render() {
      const entries = readHistory(); const data = summary(entries);
      stats.replaceChildren();
      for (const [label, value] of [['Aktivite', data.totalEntries], ['Farklı istem', data.uniquePrompts], ['Aktif gün', data.activeDays]]) {
        const cell = make('div', undefined, 'prompt-smart-insert-activity-stat');
        cell.append(make('strong', String(value)), make('span', label)); stats.append(cell);
      }
      top.replaceChildren();
      if (data.topPrompt) top.append(make('span', 'En sık kullanılan', 'prompt-smart-insert-activity-label'), make('strong', `${data.topPrompt.label} · ${data.topPrompt.count} kullanım`, 'prompt-smart-insert-activity-value'));
      else top.append(make('span', 'Henüz etkinlik yok.', 'prompt-smart-insert-activity-label'));
      daily.replaceChildren();
      for (const [date, count] of data.daily.slice(-MAX_ROWS)) {
        const row = make('div', undefined, 'prompt-smart-insert-activity-day'); row.setAttribute('role', 'listitem');
        row.append(make('span', date), make('strong', String(count))); daily.append(row);
      }
    }

    refreshButton.addEventListener('click', render);
    exportButton.addEventListener('click', () => { status.textContent = download(exportDigest(), 'hafize-smart-insert-activity.json') ? 'Etkinlik özeti dışa aktarıldı.' : 'Etkinlik özeti oluşturulamadı.'; });
    const onChange = () => render();
    root.addEventListener?.('hafize:prompt-library-smart-insert-history-changed', onChange);
    render();
    return Object.freeze({ summary, usageFor, dailyFor, exportDigest, render, destroy: () => { root.removeEventListener?.('hafize:prompt-library-smart-insert-history-changed', onChange); section.remove(); } });
  }

  root.HafizePromptLibrarySmartInsertActivity = Object.freeze({ HISTORY_KEY, MAX_DAYS, MAX_ROWS, usageFor, dailyFor, summary, exportDigest, mount });
  const start = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
