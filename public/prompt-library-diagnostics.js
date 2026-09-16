/* Prompt Library health diagnostics.
 *
 * The library and its collections live in two independent localStorage keys.
 * A half-written export, a hand-edited backup or a prompt deleted while the
 * collections panel was closed leaves the two out of step, and the symptom the
 * user sees is a collection that counts members it can no longer show.
 *
 * This panel reads both keys, reports what it found and — only after an
 * explicit confirmation — rewrites them through the normalizers that already
 * own those formats. It never invents data: a record that cannot be normalized
 * is dropped, not repaired, and nothing leaves the device. */
(function installPromptLibraryDiagnostics(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryDiagnostics';
  const REPORT_CLASS = 'prompt-library-diagnostics-report';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';

  // A broken storage blob can be arbitrarily large. Everything below reads a
  // bounded window of it so a diagnosis can never hang the panel.
  const MAX_PROMPTS = 120;
  const MAX_ORPHANS = 200;

  const library = () => root.HafizePromptLibrary;
  const collections = () => root.HafizePromptLibraryCollections;

  const storage = () => {
    try {
      return root.localStorage || null;
    } catch {
      return null;
    }
  };

  function readJson(key) {
    const store = storage();
    if (!store) return { ok: false, value: null };
    let raw = null;
    try {
      raw = store.getItem(key);
    } catch {
      return { ok: false, value: null };
    }
    if (raw === null || raw === '') return { ok: true, value: [] };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, value: null };
    }
  }

  function element(doc, tag, textValue = '', className = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (textValue !== '') node.textContent = String(textValue);
    return node;
  }

  function button(doc, label, className = 'mini-btn') {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
  }

  /**
   * Reads both storage keys and reports what is wrong with them.
   * Pure: it never writes, so it is safe to run on every panel open.
   */
  function diagnose() {
    const api = library();
    const promptStore = readJson(PROMPT_KEY);
    const collectionStore = readJson(COLLECTION_KEY);
    const rawPrompts = Array.isArray(promptStore.value) ? promptStore.value.slice(0, MAX_PROMPTS * 2) : [];
    const promptRootValid = promptStore.ok && Array.isArray(promptStore.value);

    const healthy = [];
    const seen = new Set();
    let broken = 0;
    let duplicates = 0;
    for (const raw of rawPrompts) {
      const item = api?.normalizeItem?.(raw) || null;
      if (!item) {
        broken += 1;
        continue;
      }
      if (seen.has(item.id)) {
        duplicates += 1;
        continue;
      }
      seen.add(item.id);
      healthy.push(item);
      if (healthy.length >= MAX_PROMPTS) break;
    }

    const rawCollections = Array.isArray(collectionStore.value) ? collectionStore.value : [];
    const collectionRootValid = collectionStore.ok && Array.isArray(collectionStore.value);
    const normalizedCollections = collections()?.normalizeCollections?.(rawCollections) || [];
    const orphans = [];
    for (const collection of normalizedCollections) {
      for (const promptId of collection.promptIds || []) {
        if (seen.has(promptId)) continue;
        if (orphans.length >= MAX_ORPHANS) break;
        orphans.push({ collection: collection.name, promptId });
      }
      if (orphans.length >= MAX_ORPHANS) break;
    }

    return {
      rawPrompts: rawPrompts.length,
      healthyPrompts: healthy.length,
      brokenPrompts: broken,
      duplicatePrompts: duplicates,
      collections: normalizedCollections.length,
      orphanMembers: orphans.length,
      orphans,
      promptRootValid,
      collectionRootValid,
      repairable: !promptRootValid || !collectionRootValid || broken > 0 || duplicates > 0 || orphans.length > 0
    };
  }

  /**
   * Rewrites both keys from the normalized view diagnose() produced.
   * Callers confirm first; this function does not ask.
   */
  function repair() {
    const api = library();
    const store = storage();
    if (!api?.loadItems || !api?.saveItems || !store) return false;

    const items = api.normalizeCollection?.(api.loadItems(store)) ?? api.loadItems(store);
    if (!api.saveItems(store, items)) return false;

    const ids = new Set(items.map((item) => item.id));
    const collectionApi = collections();
    if (collectionApi?.readCollections && collectionApi?.saveCollections) {
      const pruned = collectionApi.readCollections(store).map((collection) => ({
        ...collection,
        promptIds: (collection.promptIds || []).filter((promptId) => ids.has(promptId))
      }));
      if (!collectionApi.saveCollections(store, pruned)) return false;
    }
    return true;
  }

  function describe(report) {
    if (!report.promptRootValid) return 'İstem deposu okunamıyor; onarım geçerli kayıtları korur.';
    if (!report.collectionRootValid) return 'Koleksiyon deposu okunamıyor; onarım geçerli koleksiyonları korur.';
    const problems = [];
    if (report.brokenPrompts) problems.push(`${report.brokenPrompts} bozuk kayıt`);
    if (report.duplicatePrompts) problems.push(`${report.duplicatePrompts} yinelenen id`);
    if (report.orphanMembers) problems.push(`${report.orphanMembers} yetim koleksiyon üyesi`);
    return problems.length ? `Sorun bulundu: ${problems.join(', ')}.` : 'Kütüphane sağlıklı.';
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = element(documentRef, 'section', '', 'prompt-library-diagnostics');
    section.id = PANEL_ID;
    section.setAttribute('aria-labelledby', 'promptLibraryDiagnosticsTitle');

    const head = element(documentRef, 'div', '', 'prompt-library-diagnostics-head');
    const title = element(documentRef, 'strong', 'Kütüphane sağlığı', 'prompt-library-diagnostics-title');
    title.id = 'promptLibraryDiagnosticsTitle';
    const toggle = button(documentRef, 'Gizle');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', `${PANEL_ID}Body`);
    head.append(title, toggle);

    const body = element(documentRef, 'div', '', 'prompt-library-diagnostics-body');
    body.id = `${PANEL_ID}Body`;
    const report = element(documentRef, 'dl', '', REPORT_CLASS);
    const status = element(documentRef, 'p', '', 'prompt-library-diagnostics-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const actions = element(documentRef, 'div', '', 'prompt-library-diagnostics-actions');
    const refresh = button(documentRef, 'Yeniden tara');
    const fix = button(documentRef, 'Onar');
    fix.setAttribute('data-diagnostics-repair', 'true');
    actions.append(refresh, fix);

    body.append(report, status, actions);
    section.append(head, body);
    card.append(section);

    const listeners = [];
    const on = (target, type, handler) => {
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    };

    const rows = (current) => [
      ['Depodaki kayıt', current.rawPrompts],
      ['Geçerli kayıt', current.healthyPrompts],
      ['Bozuk kayıt', current.brokenPrompts],
      ['Yinelenen id', current.duplicatePrompts],
      ['Koleksiyon', current.collections],
      ['Yetim üye', current.orphanMembers]
    ];

    function render(message) {
      const current = diagnose();
      report.replaceChildren();
      for (const [label, value] of rows(current)) {
        report.append(element(documentRef, 'dt', label), element(documentRef, 'dd', String(value)));
      }
      // A repair that has nothing to fix would only rewrite healthy storage.
      fix.disabled = !current.repairable;
      status.textContent = message || describe(current);
      return current;
    }

    on(toggle, 'click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.textContent = expanded ? 'Göster' : 'Gizle';
      body.hidden = expanded;
    });
    on(refresh, 'click', () => render());
    on(fix, 'click', () => {
      if (fix.disabled) return;
      if (!rootRef.confirm?.('Bozuk istem kayıtları elenecek ve koleksiyon üyeleri güncellenecek. Devam edilsin mi?')) return;
      if (!repair()) return render('Onarım tamamlanamadı; depo değişmedi.');
      const store = storage();
      const api = library();
      // The prompt library repaints on `storage`, which the browser only fires
      // in other tabs. Dispatching it here keeps this tab in step too.
      try {
        if (typeof rootRef.StorageEvent === 'function' && store && api) {
          rootRef.dispatchEvent(new rootRef.StorageEvent('storage', {
            key: api.STORAGE_KEY,
            newValue: store.getItem(api.STORAGE_KEY),
            storageArea: store
          }));
        }
      } catch { /* the repair itself already succeeded */ }
      render('Onarım tamamlandı.');
    });

    render();

    const controller = Object.freeze({
      mounted: true,
      diagnose,
      refresh: () => render(),
      destroy: () => {
        for (const off of listeners.splice(0)) off();
        section.remove();
      }
    });
    rootRef.addEventListener?.('beforeunload', () => controller.destroy(), { once: true });
    return controller;
  }

  const api = Object.freeze({ PANEL_ID, MAX_PROMPTS, MAX_ORPHANS, diagnose, repair, describe, mount });
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryDiagnostics = api;

  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
