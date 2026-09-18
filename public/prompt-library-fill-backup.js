(function installPromptLibraryFillBackup(root) {
  'use strict';
  const STORAGE_KEY = 'hafize.prompt-library.fill.presets.v1';
  const MAX_BYTES = 250000;
  const MAX_NAME = 48;
  const MAX_VALUE = 1000;
  const MAX_PRESETS = 8;

  const normalize = (payload) => {
    const groups = payload && typeof payload === 'object' ? payload : {};
    const output = {};
    for (const [itemId, entries] of Object.entries(groups).slice(0, 120)) {
      if (typeof itemId !== 'string' || !itemId.trim() || !entries || typeof entries !== 'object') continue;
      const safe = [];
      for (const value of Object.values(entries).slice(0, MAX_PRESETS)) {
        if (!value || typeof value !== 'object') continue;
        const name = typeof value.name === 'string' ? value.name.trim().slice(0, MAX_NAME) : '';
        const values = {};
        for (const [key, raw] of Object.entries(value.values || {}).slice(0, 12)) {
          const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
          if (!safeKey) continue;
          const text = typeof raw === 'string' ? raw.slice(0, MAX_VALUE) : '';
          if (text) values[safeKey] = text;
        }
        if (name) safe.push({ id: typeof value.id === 'string' ? value.id.slice(0, 80) : `p${Date.now()}${safe.length}`, name, values, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt.slice(0, 40) : new Date().toISOString() });
      }
      if (safe.length) output[itemId.slice(0, 120)] = Object.fromEntries(safe.map((entry) => [entry.id, entry]));
    }
    return output;
  };

  const read = () => { try { return normalize(JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}')); } catch { return {}; } };
  const write = (value) => { try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); return true; } catch { return false; } };
  const exportText = () => JSON.stringify({ version: 1, source: 'hafize-prompt-library-fill-presets', exportedAt: new Date().toISOString(), presets: read() }, null, 2);
  const canExport = () => exportText().length <= MAX_BYTES;
  const merge = (current, imported) => {
    const output = normalize(current);
    for (const [itemId, entries] of Object.entries(normalize(imported))) {
      const existing = output[itemId] || {};
      const merged = Object.values(existing);
      for (const entry of Object.values(entries)) {
        const same = merged.findIndex((candidate) => candidate.name.toLocaleLowerCase('tr-TR') === entry.name.toLocaleLowerCase('tr-TR'));
        if (same >= 0) merged.splice(same, 1, { ...merged[same], ...entry, id: merged[same].id });
        else merged.unshift(entry);
      }
      output[itemId] = Object.fromEntries(merged.slice(0, MAX_PRESETS).map((entry) => [entry.id, entry]));
    }
    return output;
  };
  const api = Object.freeze({ STORAGE_KEY, MAX_BYTES, normalize, read, write, exportText, canExport, merge });
  root.HafizePromptLibraryFillBackup = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
