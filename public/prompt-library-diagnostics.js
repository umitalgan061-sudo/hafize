(function installPromptLibraryDiagnostics(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryDiagnostics';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const LIMIT = 120;
  const MAX_ORPHANS = 200;
  const api = () => root.HafizePromptLibrary;

  const make = (tag, textValue, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  };
  const button = (label, className = 'soft-btn') => {
    const node = make('button', label, className);
    node.type = 'button';
    return node;
  };
  const readRaw = (key) => root.localStorage?.getItem(key) || '';
  const parse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
  const report = (value) => {
    const status = root.document?.querySelector?.(`#${CARD_ID} .prompt-library-status`);
    if (status) status.textContent = String(value || '').slice(0, 180);
  };

  function inspect() {
    const promptRaw = readRaw(PROMPT_KEY);
    const collectionRaw = readRaw(COLLECTION_KEY);
    const parsedPrompts = promptRaw ? parse(promptRaw) : [];
    const parsedCollections = collectionRaw ? parse(collectionRaw) : [];
    const prompts = Array.isArray(parsedPrompts) ? parsedPrompts : [];
    const collections = Array.isArray(parsedCollections) ? parsedCollections : [];
    const validPromptIds = new Set();
    let invalidPrompts = promptRaw && !Array.isArray(parsedPrompts) ? 1 : 0;
    let duplicatePrompts = 0;
    for (const item of prompts.slice(0, LIMIT * 3)) {
      if (!api()?.normalizeItem?.(item)) { invalidPrompts += 1; continue; }
      const id = typeof item.id === 'string' ? item.id : '';
      if (!id) continue;
      if (validPromptIds.has(id)) duplicatePrompts += 1;
      validPromptIds.add(id);
    }
    const orphanMembers = [];
    let invalidCollections = collectionRaw && !Array.isArray(parsedCollections) ? 1 : 0;
    for (const collection of collections.slice(0, 120)) {
      if (!collection || typeof collection !== 'object') { invalidCollections += 1; continue; }
      const members = Array.isArray(collection.promptIds) ? collection.promptIds : [];
      for (const id of members) {
        if (typeof id === 'string' && !validPromptIds.has(id)) {
          orphanMembers.push({ collectionId: String(collection.id || '').slice(0, 120), promptId: id.slice(0, 120) });
          if (orphanMembers.length >= MAX_ORPHANS) break;
        }
      }
      if (orphanMembers.length >= MAX_ORPHANS) break;
    }
    return {
      storageState: promptRaw ? 'present' : 'empty',
      promptCount: prompts.length,
      validPromptCount: validPromptIds.size,
      invalidPrompts,
      duplicatePrompts,
      collectionCount: collections.length,
      invalidCollections,
      orphanMembers,
      healthy: !invalidPrompts && !duplicatePrompts && !invalidCollections && !orphanMembers.length
    };
  }

  function repairPrompts() {
    const library = api();
    if (!library?.normalizeCollection || !library?.saveItems) return { changed: false, reason: 'unavailable' };
    const raw = parse(readRaw(PROMPT_KEY));
    if (!Array.isArray(raw)) return { changed: false, reason: 'invalid-root' };
    const normalized = library.normalizeCollection(raw);
    const changed = JSON.stringify(raw.slice(0, LIMIT)) !== JSON.stringify(normalized);
    if (!changed) return { changed: false, items: normalized };
    return library.saveItems(root.localStorage, normalized) ? { changed: true, items: normalized } : { changed: false, reason: 'write-failed' };
  }

  function repairCollections() {
    const library = root.HafizePromptLibraryCollections;
    if (library?.pruneMembers) {
      const current = library.readCollections?.(root.localStorage) || [];
      const next = library.pruneMembers(current, root.localStorage);
      try {
        root.localStorage?.setItem?.(COLLECTION_KEY, JSON.stringify(next));
        return { changed: JSON.stringify(current) !== JSON.stringify(next), collections: next };
      } catch { return { changed: false, reason: 'write-failed' }; }
    }
    const parsed = parse(readRaw(COLLECTION_KEY));
    const prompts = parse(readRaw(PROMPT_KEY));
    if (!Array.isArray(parsed) || !Array.isArray(prompts)) return { changed: false, reason: 'unavailable' };
    const ids = new Set(prompts.filter((item) => item && typeof item.id === 'string').map((item) => item.id));
    const next = parsed.map((collection) => {
      if (!collection || typeof collection !== 'object') return collection;
      const promptIds = Array.isArray(collection.promptIds) ? collection.promptIds.filter((id) => ids.has(id)) : [];
      return { ...collection, promptIds };
    });
    try { root.localStorage?.setItem?.(COLLECTION_KEY, JSON.stringify(next)); return { changed: JSON.stringify(parsed) !== JSON.stringify(next) }; }
    catch { return { changed: false, reason: 'write-failed' }; }
  }

  function dispatchRefresh() {
    try {
      const library = api();
      root.dispatchEvent?.(new root.StorageEvent('storage', { key: library?.STORAGE_KEY || PROMPT_KEY, newValue: readRaw(PROMPT_KEY), storageArea: root.localStorage }));
    } catch { root.dispatchEvent?.(new root.Event('hafize:prompt-library-refresh')); }
    root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-diagnostics-changed'));
  }

  function repair() {
    const before = inspect();
    if (before.healthy || !root.confirm?.('Yerel istem verilerindeki sorunlar düzeltilebilsin mi?')) return before;
    repairPrompts(); repairCollections(); dispatchRefresh(); return inspect();
  }

  function render(section) {
    const reportNode = section.querySelector('.prompt-library-diagnostics-report');
    const state = inspect();
    reportNode.replaceChildren();
    reportNode.append(make('div', state.healthy ? '✓ Kütüphane sağlıklı' : '⚠ Dikkat gerektiren kayıtlar bulundu', state.healthy ? 'is-healthy' : 'is-warning'));
    const grid = make('div', undefined, 'prompt-library-diagnostics-grid');
    for (const [label, value] of [['İstem', state.promptCount], ['Geçerli', state.validPromptCount], ['Bozuk', state.invalidPrompts], ['Tekrarlı id', state.duplicatePrompts], ['Koleksiyon', state.collectionCount], ['Yetim üye', state.orphanMembers.length]]) {
      const card = make('div', undefined, 'prompt-library-diagnostics-stat');
      card.append(make('strong', String(value)), make('span', label)); grid.append(card);
    }
    reportNode.append(grid);
    const repairButton = section.querySelector('[data-diagnostics-repair]');
    repairButton.disabled = state.healthy;
  }

  function mount(documentRef = root.document) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;
    const section = make('section', undefined, 'prompt-library-diagnostics');
    section.id = PANEL_ID; section.setAttribute('aria-labelledby', 'promptLibraryDiagnosticsTitle');
    const header = make('div', undefined, 'prompt-library-diagnostics-head');
    const title = make('strong', 'Kütüphane sağlığı'); title.id = 'promptLibraryDiagnosticsTitle';
    const toggle = button('Gizle', 'mini-btn'); toggle.setAttribute('aria-expanded', 'true'); header.append(title, toggle);
    const body = make('div', undefined, 'prompt-library-diagnostics-body');
    const reportNode = make('div', undefined, 'prompt-library-diagnostics-report');
    const actions = make('div', undefined, 'prompt-library-diagnostics-actions');
    const refresh = button('Yenile'); const repairButton = button('Sorunları onar'); repairButton.dataset.diagnosticsRepair = 'true';
    actions.append(refresh, repairButton); body.append(reportNode, actions); section.append(header, body); card.append(section);
    let hidden = false;
    toggle.addEventListener('click', () => { hidden = !hidden; body.hidden = hidden; toggle.textContent = hidden ? 'Göster' : 'Gizle'; toggle.setAttribute('aria-expanded', String(!hidden)); });
    refresh.addEventListener('click', () => { render(section); report('Kütüphane tanısı yenilendi.'); });
    repairButton.addEventListener('click', () => { const state = repair(); render(section); report(state.healthy ? 'Kütüphane onarıldı.' : 'Bazı kayıtlar kullanıcı müdahalesi gerektiriyor.'); });
    root.addEventListener?.('hafize:prompt-library-diagnostics-changed', () => render(section));
    render(section);
    return Object.freeze({ inspect, repair, refresh: () => render(section), destroy: () => section.remove() });
  }

  const apiExport = Object.freeze({ mount, inspect, repair, repairPrompts, repairCollections });
  root.HafizePromptLibraryDiagnostics = apiExport;
  const boot = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
