(function installHafizePromptPacks(root) {
  'use strict';

  const PACK_VERSION = 1;
  const MAX_BYTES = 1_500_000;
  const MAX_ITEMS = 120;
  const MAX_WORKSPACES = 16;
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const STATE_KEY = `${PROMPT_KEY}.state`;
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const WORKSPACE_KEY = 'hafize.prompt-library.workspaces.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const CARD_ID = 'promptLibraryCard';

  const clean = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const now = () => new Date().toISOString();
  const core = () => root.HafizePromptLibrary;
  const workspaces = () => root.HafizePromptLibraryWorkspaces;
  const collections = () => root.HafizePromptLibraryCollections;

  function read(key, fallback) {
    try { const value = JSON.parse(root.localStorage?.getItem(key) || 'null'); return value ?? fallback; }
    catch { return fallback; }
  }
  function write(key, value) {
    try { root.localStorage?.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function bounded(value, max) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, max);
  }
  function packageData(options = {}) {
    const prompts = core()?.loadItems?.(root.localStorage) || [];
    const state = core()?.loadState?.(root.localStorage) || {};
    const pack = {
      packVersion: PACK_VERSION,
      source: 'hafize-prompt-pack',
      exportedAt: now(),
      prompts: bounded(prompts, MAX_ITEMS),
      state,
      collections: options.includeCollections === false ? { version: 1, collections: [{ id: 'general', name: 'Genel', createdAt: '' }], assignments: {} } : read(COLLECTION_KEY, {}),
      workspaces: options.includeWorkspaces === false ? { version: 1, activeId: 'default', workspaces: [{ id: 'default', name: 'Genel', createdAt: '', updatedAt: '' }] } : read(WORKSPACE_KEY, {}),
      revisions: options.includeRevisions === false ? [] : bounded(read(REVISION_KEY, []), 240)
    };
    const output = JSON.stringify(pack, null, 2);
    return output.length <= MAX_BYTES ? output : null;
  }

  function validate(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'object' };
    if (payload.packVersion !== PACK_VERSION || payload.source !== 'hafize-prompt-pack') return { ok: false, reason: 'version' };
    if (!Array.isArray(payload.prompts)) return { ok: false, reason: 'prompts' };
    if (JSON.stringify(payload).length > MAX_BYTES) return { ok: false, reason: 'size' };
    return { ok: true };
  }

  function normalizePack(payload) {
    const check = validate(payload); if (!check.ok) return null;
    const normalizedPrompts = core()?.normalizeCollection?.(payload.prompts) || [];
    const promptIds = new Set(normalizedPrompts.map((item) => item.id));
    const workspaceData = workspaces()?.save ? payload.workspaces : {};
    const revisionData = Array.isArray(payload.revisions) ? payload.revisions.filter((item) => promptIds.has(item?.promptId)).slice(0, 240) : [];
    return {
      prompts: normalizedPrompts,
      state: core()?.safeState?.(payload.state) || {},
      collections: payload.collections && typeof payload.collections === 'object' ? payload.collections : {},
      workspaces: workspaceData && typeof workspaceData === 'object' ? workspaceData : {},
      revisions: revisionData
    };
  }

  function mergePrompts(existing, incoming) {
    const current = core()?.normalizeCollection?.(existing) || [];
    const ids = new Set(current.map((item) => item.id));
    let added = 0; let duplicates = 0;
    for (const item of incoming) {
      if (current.length >= MAX_ITEMS) break;
      if (ids.has(item.id)) { duplicates += 1; continue; }
      current.push(item); ids.add(item.id); added += 1;
    }
    return { items: core()?.normalizeCollection?.(current) || current, added, duplicates };
  }

  function mergeCollections(payload) {
    const api = collections(); if (!api?.load || !api.save) return { added: 0 };
    const current = api.load(); const incoming = payload && typeof payload === 'object' ? payload : {};
    const names = new Set(current.collections.map((item) => item.name.toLocaleLowerCase('tr-TR')));
    let added = 0;
    for (const raw of bounded(incoming.collections, 24)) {
      const name = clean(raw?.name, 48); if (!name || names.has(name.toLocaleLowerCase('tr-TR')) || current.collections.length >= 24) continue;
      current.collections.push({ id: clean(raw?.id, 120) || `import-${Date.now()}-${added}`, name, createdAt: clean(raw?.createdAt, 40) });
      names.add(name.toLocaleLowerCase('tr-TR')); added += 1;
    }
    api.save(current);
    return { added };
  }

  function mergeWorkspaces(payload) {
    const api = workspaces(); if (!api?.load || !api.save) return { added: 0 };
    const current = api.load(); const incoming = payload && typeof payload === 'object' ? payload : {};
    const names = new Set(current.workspaces.map((item) => item.name.toLocaleLowerCase('tr-TR')));
    let added = 0;
    for (const raw of bounded(incoming.workspaces, MAX_WORKSPACES)) {
      const name = clean(raw?.name, 56); if (!name || names.has(name.toLocaleLowerCase('tr-TR')) || current.workspaces.length >= MAX_WORKSPACES) continue;
      current.workspaces.push({ id: clean(raw?.id, 120) || `import-${Date.now()}-${added}`, name, tags: [], selectedIds: [], state: raw?.state || {}, createdAt: clean(raw?.createdAt, 40), updatedAt: clean(raw?.updatedAt, 40) });
      names.add(name.toLocaleLowerCase('tr-TR')); added += 1;
    }
    api.save(current); return { added };
  }

  function importPayload(payload) {
    const normalized = normalizePack(payload); if (!normalized) return null;
    const merged = mergePrompts(core()?.loadItems?.(root.localStorage) || [], normalized.prompts);
    if (!core()?.saveItems?.(root.localStorage, merged.items)) return null;
    mergeCollections(normalized.collections);
    mergeWorkspaces(normalized.workspaces);
    if (normalized.revisions.length) {
      const current = bounded(read(REVISION_KEY, []), 240);
      const keys = new Set(current.map((item) => item?.id));
      for (const revision of normalized.revisions) if (revision?.id && !keys.has(revision.id)) current.push(revision);
      write(REVISION_KEY, current.slice(-240));
    }
    core()?.saveState?.(root.localStorage, normalized.state);
    try { root.dispatchEvent?.(new root.StorageEvent('storage', { key: PROMPT_KEY, newValue: JSON.stringify(merged.items), storageArea: root.localStorage })); } catch {}
    root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-pack-imported', { detail: merged }));
    return merged;
  }

  function download(text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = root.URL.createObjectURL(blob); const link = root.document.createElement('a');
    link.href = url; link.download = 'hafize-prompt-pack.json'; link.click(); root.setTimeout?.(() => root.URL.revokeObjectURL(url), 0);
  }

  function button(doc, label, action) {
    const node = doc.createElement('button'); node.type = 'button'; node.className = 'mini-btn prompt-pack-action'; node.textContent = label; node.dataset.packAction = action; node.setAttribute('aria-label', label); return node;
  }

  let mounted = false;
  function setStatus(value) { const status = root.document.querySelector('#promptLibraryCard .prompt-library-status'); if (status) status.textContent = clean(value, 180); }
  function inject() {
    const card = root.document?.getElementById?.(CARD_ID); if (!card || card.querySelector('.prompt-pack-toolbar')) return;
    const row = root.document.createElement('div'); row.className = 'prompt-pack-toolbar';
    const heading = root.document.createElement('span'); heading.textContent = 'Yedek'; heading.className = 'prompt-pack-label';
    const exportButton = button(root.document, 'Paketi dışa aktar', 'export'); const importButton = button(root.document, 'Paketi içe aktar', 'import');
    const file = root.document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.setAttribute('aria-label', 'Prompt paketi dosyası');
    row.append(heading, exportButton, importButton, file); card.querySelector('.prompt-workspace-toolbar, .prompt-collection-toolbar, .prompt-library-enhancement-toolbar, .prompt-library-filters')?.after(row);
    exportButton.addEventListener('click', () => { const output = packageData(); if (!output) return setStatus('Paket 1,5 MB sınırını aşıyor.'); download(output); setStatus('Prompt paketi dışa aktarıldı.'); });
    importButton.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { const object = file.files?.[0]; file.value = ''; if (!object || object.size > MAX_BYTES) return setStatus('Paket dosyası çok büyük.'); const reader = new FileReader(); reader.onload = () => { try { const result = importPayload(JSON.parse(String(reader.result || ''))); setStatus(result ? `${result.added} istem eklendi, ${result.duplicates} tekrar atlandı.` : 'Paket geçersiz.'); } catch { setStatus('Paket okunamadı.'); } }; reader.onerror = () => setStatus('Paket okunamadı.'); reader.readAsText(object); });
  }
  function boot() { if (mounted || !root.document || !core()) return; if (!root.document.getElementById(CARD_ID)) return; mounted = true; const observer = new MutationObserver(inject); observer.observe(root.document.getElementById(CARD_ID), { childList: true, subtree: true }); inject(); }

  root.HafizePromptLibraryPacks = Object.freeze({ PACK_VERSION, MAX_BYTES, packageData, validate, normalizePack, importPayload, mergePrompts });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
