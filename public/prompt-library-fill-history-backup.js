(function installPromptLibraryFillHistoryBackup(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.fill.history.v1';
  const MAX_BYTES = 150000;
  const MAX_ENTRIES = 24;
  const MAX_VALUE = 1000;
  const normalize = (value) => {
    const list = Array.isArray(value) ? value : [];
    return list.slice(0, MAX_ENTRIES).map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const values = {};
      for (const [name, raw] of Object.entries(entry.values || {}).slice(0, 12)) {
        const key = String(name || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
        if (key) values[key] = typeof raw === 'string' ? raw.slice(0, MAX_VALUE) : '';
      }
      return { id: typeof entry.id === 'string' ? entry.id.slice(0, 100) : `h${Date.now()}`, promptId: typeof entry.promptId === 'string' ? entry.promptId.slice(0, 120) : '', title: typeof entry.title === 'string' ? entry.title.slice(0, 72) : 'İsimsiz istem', values, usedAt: typeof entry.usedAt === 'string' ? entry.usedAt.slice(0, 40) : new Date().toISOString() };
    }).filter((entry) => entry?.promptId);
  };
  const read = () => { try { return normalize(JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '[]')); } catch { return []; } };
  const write = (value) => { try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); return true; } catch { return false; } };
  const exportText = () => JSON.stringify({ version: 1, source: 'hafize-prompt-library-fill-history', exportedAt: new Date().toISOString(), entries: read() }, null, 2);
  const canExport = () => exportText().length <= MAX_BYTES;
  const merge = (current, imported) => {
    const output = normalize(current);
    for (const entry of normalize(imported)) {
      if (output.some((candidate) => candidate.promptId === entry.promptId && JSON.stringify(candidate.values) === JSON.stringify(entry.values))) continue;
      output.unshift(entry);
      if (output.length >= MAX_ENTRIES) break;
    }
    return normalize(output);
  };
  root.HafizePromptLibraryFillHistoryBackup = Object.freeze({ STORAGE_KEY, MAX_BYTES, normalize, read, write, exportText, canExport, merge });
})(typeof globalThis !== 'undefined' ? globalThis : self);
