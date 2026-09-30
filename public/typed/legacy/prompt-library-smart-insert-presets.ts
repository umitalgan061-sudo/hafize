(function installPromptSmartInsertPresets(root) {
  'use strict';
  const PRESET_KEY = 'hafize.prompt-library.variable-presets.v1';
  const MAX_PRESETS = 32;
  const MAX_NAME = 60;
  const MAX_VALUES = 12;
  const MAX_KEY = 32;
  const MAX_VALUE = 1000;
  const MAX_QUERY = 80;
  const clean = (value, limit) => String(value ?? '').replace(/\0/g, '').trim().slice(0, limit);
  const presetId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const keyName = (value) => clean(value, MAX_NAME).toLocaleLowerCase('tr-TR');

  function normalizePreset(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = clean(raw.name, MAX_NAME); if (!name) return null;
    const values = Object.create(null); let count = 0;
    for (const [rawKey, rawValue] of Object.entries(raw.values && typeof raw.values === 'object' ? raw.values : {})) {
      const key = String(rawKey).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_KEY);
      if (!key || count >= MAX_VALUES) continue;
      values[key] = clean(rawValue, MAX_VALUE); count += 1;
    }
    return { id: clean(raw.id, 120) || presetId(), name, values, favorite: raw.favorite === true, updatedAt: clean(raw.updatedAt, 40) || new Date().toISOString() };
  }

  function normalizePresets(raw) {
    if (!Array.isArray(raw)) return [];
    const output = []; const seen = new Set();
    for (const candidate of raw.slice(0, MAX_PRESETS * 2)) {
      const preset = normalizePreset(candidate);
      if (!preset || seen.has(preset.id)) continue;
      seen.add(preset.id); output.push(preset); if (output.length >= MAX_PRESETS) break;
    }
    return output;
  }

  function load() {
    try { return normalizePresets(JSON.parse(root.localStorage?.getItem(PRESET_KEY) || '[]')); } catch { return []; }
  }

  function save(presets) {
    try { root.localStorage?.setItem(PRESET_KEY, JSON.stringify(normalizePresets(presets))); root.dispatchEvent?.(new Event('hafize:prompt-library-variable-presets-changed')); return true; }
    catch { return false; }
  }

  function upsert(name, values, favorite = false) {
    const cleanPresetName = clean(name, MAX_NAME); if (!cleanPresetName) return null;
    const presets = load(); const existing = presets.find((item) => keyName(item.name) === keyName(cleanPresetName));
    const next = normalizePreset({ id: existing?.id || presetId(), name: cleanPresetName, values, favorite: existing?.favorite || favorite, updatedAt: new Date().toISOString() });
    if (!next) return null;
    const nextPresets = existing ? presets.map((item) => item.id === existing.id ? next : item) : [next, ...presets].slice(0, MAX_PRESETS);
    return save(nextPresets) ? next : null;
  }

  function remove(id) { const value = clean(id, 120); return save(load().filter((preset) => preset.id !== value)); }
  function favorite(id, value) { return save(load().map((preset) => preset.id === id ? normalizePreset({ ...preset, favorite: value === undefined ? !preset.favorite : value, updatedAt: new Date().toISOString() }) : preset)); }
  function matches(preset, query) { const q = clean(query, MAX_QUERY).toLocaleLowerCase('tr-TR'); if (!q) return true; return [preset.name, ...Object.keys(preset.values)].join(' ').toLocaleLowerCase('tr-TR').includes(q); }
  function search(query = '') { return load().filter((preset) => matches(preset, query)).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt)); }
  function valuesForPreset(preset, variableNames) { const names = Array.isArray(variableNames) ? variableNames : Object.keys(preset?.values || {}); const result = Object.create(null); for (const name of names) result[name] = clean(preset?.values?.[name], MAX_VALUE); return result; }
  function diffMissing(preset, variableNames) { return (Array.isArray(variableNames) ? variableNames : []).filter((name) => !clean(preset?.values?.[name], MAX_VALUE)); }
  function exportText() { return JSON.stringify({ version: 1, source: 'hafize-prompt-variable-presets', exportedAt: new Date().toISOString(), presets: load() }, null, 2); }
  function importText(text) {
    const raw = String(text || ''); if (raw.length > 300000) throw new Error('oversize');
    const parsed = JSON.parse(raw); const incoming = normalizePresets(Array.isArray(parsed) ? parsed : parsed?.presets); const current = load(); const byName = new Map(current.map((preset) => [keyName(preset.name), preset])); const merged = current.slice();
    for (const candidate of incoming) {
      const existing = byName.get(keyName(candidate.name));
      if (existing) { const index = merged.findIndex((item) => item.id === existing.id); const next = normalizePreset({ ...existing, values: { ...existing.values, ...candidate.values }, favorite: existing.favorite || candidate.favorite, updatedAt: new Date().toISOString() }); if (index >= 0) merged.splice(index, 1, next); }
      else if (merged.length < MAX_PRESETS) { const next = normalizePreset({ ...candidate, id: presetId() }); if (next) { merged.push(next); byName.set(keyName(next.name), next); } }
    }
    if (!save(merged)) throw new Error('save'); return incoming.length;
  }

  function renderPicker(documentRef, host, variableNames, onApply) {
    if (!documentRef || !host) return null;
    const select = documentRef.createElement('select'); select.setAttribute('aria-label', 'Değişken ön ayarı');
    const empty = documentRef.createElement('option'); empty.value = ''; empty.textContent = 'Ön ayar seç'; select.append(empty);
    const options = search('');
    for (const preset of options) { const option = documentRef.createElement('option'); option.value = preset.id; option.textContent = preset.favorite ? `★ ${preset.name}` : preset.name; select.append(option); }
    const apply = documentRef.createElement('button'); apply.type = 'button'; apply.className = 'mini-btn'; apply.textContent = 'Uygula';
    apply.addEventListener('click', () => { const preset = load().find((item) => item.id === select.value); if (preset) onApply?.(valuesForPreset(preset, variableNames), preset); });
    host.append(select, apply); return { select, apply, refresh: () => { const value = select.value; select.replaceChildren(empty); for (const preset of search('')) { const option = documentRef.createElement('option'); option.value = preset.id; option.textContent = preset.favorite ? `★ ${preset.name}` : preset.name; select.append(option); } select.value = value; } };
  }

  root.HafizePromptLibrarySmartInsertPresets = Object.freeze({ PRESET_KEY, limits: Object.freeze({ MAX_PRESETS, MAX_NAME, MAX_VALUES, MAX_KEY, MAX_VALUE, MAX_QUERY }), normalizePreset, normalizePresets, load, save, upsert, remove, favorite, matches, search, valuesForPreset, diffMissing, exportText, importText, renderPicker });
})(typeof globalThis !== 'undefined' ? globalThis : self);
