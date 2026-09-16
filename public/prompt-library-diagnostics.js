/**
 * Prompt Library — health diagnostics.
 *
 * Storage written by an older build, a half-finished import or a hand-edited
 * backup can carry records the normaliser drops, repeated ids, or collection
 * members pointing at prompts that no longer exist. None of that is visible in
 * the library card: the prompts simply do not show up. This panel reads the two
 * storage keys, reports what it finds, and — only after an explicit
 * confirmation — rewrites both through the existing normalisers.
 *
 * Everything happens on the device: the panel never sends the library anywhere.
 */
(function installPromptLibraryDiagnostics(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryDiagnostics';
  const MAX_RECORDS = 120;
  const MAX_ORPHANS = 200;
  const MAX_MESSAGE = 200;

  const core = () => root.HafizePromptLibrary;
  const collectionsCore = () => root.HafizePromptLibraryCollections;

  const storage = () => {
    try { return root.localStorage; } catch { return null; }
  };

  const element = (doc, tag, textValue, className) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = String(textValue ?? '');
    return node;
  };

  const button = (doc, label, className = 'mini-btn') => {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
  };

  function readJson(key) {
    const store = storage();
    if (!store || !key) return { ok: false, value: null };
    try {
      const raw = store.getItem(key);
      if (raw === null || raw === undefined || raw === '') return { ok: true, value: [] };
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, value: null };
    }
  }

  /**
   * Reads both storage keys and counts what a repair would change. The work is
   * bounded so a large or hostile store cannot lock the panel up.
   */
  function inspect() {
    const api = core();
    const collections = collectionsCore();
    const promptRead = readJson(api?.STORAGE_KEY);
    // Collections are an optional layer: an install without them is not damaged,
    // it simply has nothing to cross-check prompt ids against.
    const collectionKey = collections?.STORAGE_KEY;
    const collectionRead = collectionKey ? readJson(collectionKey) : { ok: true, value: [] };
    const rawItems = Array.isArray(promptRead.value) ? promptRead.value.slice(0, MAX_RECORDS * 2) : [];
    const rootIsArray = promptRead.ok && Array.isArray(promptRead.value);

    const seen = new Set();
    let normalized = 0;
    let broken = 0;
    let duplicates = 0;
    const ids = new Set();
    for (const raw of rawItems) {
      const item = api?.normalizeItem?.(raw) ?? null;
      if (!item) { broken += 1; continue; }
      normalized += 1;
      if (seen.has(item.id)) duplicates += 1;
      else seen.add(item.id);
      ids.add(item.id);
    }

    const rawCollections = Array.isArray(collectionRead.value) ? collectionRead.value : [];
    const collectionRootValid = collectionRead.ok && Array.isArray(collectionRead.value);
    const orphans = [];
    let collectionCount = 0;
    for (const raw of rawCollections) {
      const collection = collections?.normalizeCollection?.(raw) ?? null;
      if (!collection) continue;
      collectionCount += 1;
      for (const promptId of collection.promptIds) {
        if (ids.has(promptId) || orphans.length >= MAX_ORPHANS) continue;
        orphans.push({ collection: collection.name, promptId });
      }
    }

    const healthy = rootIsArray && collectionRootValid && broken === 0 && duplicates === 0 && orphans.length === 0;
    return {
      rootIsArray,
      collectionRootValid,
      rawCount: rawItems.length,
      normalized,
      broken,
      duplicates,
      collectionCount,
      orphans,
      healthy
    };
  }

  /**
   * Rewrites both keys through the existing normalisers: readable prompts are
   * kept and re-bounded, unreadable ones are dropped, and collection members are
   * filtered down to prompts that still exist. Nothing is copied over blindly.
   */
  function repair() {
    const api = core();
    const collections = collectionsCore();
    const store = storage();
    if (!api?.saveItems || !store) return false;
    const promptRead = readJson(api.STORAGE_KEY);
    // A store that cannot be read is not an empty store: repairing it would
    // replace prompts that are still there with an empty list.
    if (!promptRead.ok || !Array.isArray(promptRead.value)) return false;
    const rawItems = promptRead.value.slice(0, MAX_RECORDS * 2);
    const items = [];
    const ids = new Set();
    for (const raw of rawItems) {
      const item = api.normalizeItem?.(raw) ?? null;
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id);
      items.push(item);
      if (items.length >= MAX_RECORDS) break;
    }
    const normalizedItems = api.normalizeCollection ? api.normalizeCollection(items) : items;
    if (!api.saveItems(store, normalizedItems)) return false;

    if (collections?.readCollections && collections.saveCollections) {
      const pruned = collections.pruneMembers
        ? collections.pruneMembers(collections.readCollections(store), store)
        : collections.readCollections(store);
      collections.saveCollections(store, pruned);
    }

    // The library card and the insight panels repaint from a storage event,
    // which a same-tab write does not emit on its own.
    try {
      const detail = { key: api.STORAGE_KEY, newValue: JSON.stringify(normalizedItems), storageArea: store };
      if (typeof root.StorageEvent === 'function') root.dispatchEvent(new root.StorageEvent('storage', detail));
    } catch { /* the prompts are stored; a missed repaint is not fatal */ }
    return true;
  }

  function reportLines(report) {
    return [
      ['Ham kayıt', report.rawCount],
      ['Okunabilir', report.normalized],
      ['Bozuk', report.broken],
      ['Yinelenen id', report.duplicates],
      ['Koleksiyon', report.collectionCount],
      ['Yetim üye', report.orphans.length]
    ];
  }

  function mount(documentRef = root.document) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = element(documentRef, 'section', undefined, 'prompt-library-diagnostics');
    section.id = PANEL_ID;
    section.setAttribute('aria-labelledby', 'promptLibraryDiagnosticsTitle');

    const head = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-head');
    const title = element(documentRef, 'strong', 'Kütüphane sağlığı', 'prompt-library-diagnostics-title');
    title.id = 'promptLibraryDiagnosticsTitle';
    const toggle = button(documentRef, 'Göster');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'promptLibraryDiagnosticsReport');
    head.append(title, toggle);

    const report = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-report');
    report.id = 'promptLibraryDiagnosticsReport';
    report.hidden = true;

    const list = element(documentRef, 'dl', undefined, 'prompt-library-diagnostics-list');
    const status = element(documentRef, 'p', '', 'prompt-library-diagnostics-status');
    status.setAttribute('role', 'status');

    const actions = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-actions');
    const refresh = button(documentRef, 'Yeniden tara');
    const repairButton = button(documentRef, 'Onar');
    repairButton.setAttribute('data-diagnostics-repair', 'true');
    repairButton.disabled = true;
    actions.append(refresh, repairButton);

    report.append(list, status, actions);
    section.append(head, report);
    card.append(section);

    const render = () => {
      const current = inspect();
      list.replaceChildren();
      for (const [label, value] of reportLines(current)) {
        list.append(element(documentRef, 'dt', label), element(documentRef, 'dd', value));
      }
      if (!current.rootIsArray) {
        status.textContent = 'İstem deposu okunamadı veya dizi biçiminde değil.';
      } else if (current.healthy) {
        status.textContent = 'Kütüphane sağlıklı.';
      } else {
        const parts = [];
        if (current.broken) parts.push(`${current.broken} bozuk kayıt`);
        if (current.duplicates) parts.push(`${current.duplicates} yinelenen id`);
        if (current.orphans.length) parts.push(`${current.orphans.length} yetim koleksiyon üyesi`);
        if (!current.collectionRootValid) parts.push('okunamayan koleksiyon deposu');
        status.textContent = String(`Onarılabilir sorunlar: ${parts.join(', ')}.`).slice(0, MAX_MESSAGE);
      }
      // Repair cannot salvage a store it could not read, so it stays disabled
      // there rather than offering a button that can only fail.
      repairButton.disabled = current.healthy || !current.rootIsArray;
      return current;
    };

    const onToggle = () => {
      const open = report.hidden;
      report.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Gizle' : 'Göster';
      if (open) render();
    };

    const onRepair = () => {
      if (!root.confirm?.('Bozuk istem kayıtları elenecek ve koleksiyon üyeleri yeniden doğrulanacak. Devam edilsin mi?')) return;
      status.textContent = repair()
        ? 'Onarım tamamlandı.'
        : 'Onarım yapılamadı; mevcut veriler değişmedi.';
      render();
    };

    toggle.addEventListener('click', onToggle);
    refresh.addEventListener('click', render);
    repairButton.addEventListener('click', onRepair);

    return Object.freeze({
      mounted: true,
      inspect,
      refresh: render,
      destroy: () => {
        toggle.removeEventListener('click', onToggle);
        refresh.removeEventListener('click', render);
        repairButton.removeEventListener('click', onRepair);
        section.remove();
      }
    });
  }

  const api = Object.freeze({ MAX_RECORDS, MAX_ORPHANS, inspect, repair, mount });
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryDiagnostics = api;

  const start = () => { if (root.document) mount(root.document); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
