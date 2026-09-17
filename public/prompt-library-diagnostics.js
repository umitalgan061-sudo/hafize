/* Prompt Library health check.
 *
 * Prompt records and collections are two independent localStorage keys written
 * by two modules, and nothing keeps them consistent: a hand-edited backup, a
 * half-written quota failure or a prompt deleted while a collection still lists
 * it all leave the library in a state the panels silently paper over. This panel
 * reads both keys, reports what it finds and offers a repair that goes through
 * the same normalizers the modules already use.
 *
 * It only reads and writes localStorage; a diagnosis never leaves the device. */
(function installPromptLibraryDiagnostics(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryDiagnostics';
  const TITLE_ID = 'promptLibraryDiagnosticsTitle';
  // A corrupt key can hold far more than the library ever writes, so the report
  // is bounded: the panel must stay usable on data that the UI cannot.
  const MAX_RECORDS = 120;
  const MAX_ORPHANS = 200;

  const core = () => root.HafizePromptLibrary;
  const collections = () => root.HafizePromptLibraryCollections;
  const storage = () => {
    try { return root.localStorage; } catch { return null; }
  };

  function element(doc, tag, text, className) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(doc, label, className = 'mini-btn') {
    const node = element(doc, 'button', label, className);
    node.type = 'button';
    return node;
  }

  function readRaw(store, key) {
    try {
      const raw = store?.getItem?.(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return undefined;
    }
  }

  /**
   * Reads both keys and reports what is wrong with them.
   * `rootValid: false` means the stored JSON was not the array the library
   * writes, which is a different failure from records that will not normalize.
   */
  function inspect(store = storage()) {
    const api = core();
    const collectionApi = collections();
    const report = {
      rootValid: true,
      collectionRootValid: true,
      records: 0,
      normalized: 0,
      broken: 0,
      duplicates: 0,
      collections: 0,
      orphans: [],
      truncated: false
    };
    if (!api || !store) return Object.freeze({ ...report, rootValid: false, collectionRootValid: false });

    const rawItems = readRaw(store, api.STORAGE_KEY);
    if (rawItems === undefined || (rawItems !== null && !Array.isArray(rawItems))) report.rootValid = false;
    const list = Array.isArray(rawItems) ? rawItems : [];
    report.records = list.length;
    report.truncated = list.length > MAX_RECORDS;

    const ids = new Set();
    for (const raw of list.slice(0, MAX_RECORDS)) {
      const item = api.normalizeItem(raw);
      if (!item) { report.broken += 1; continue; }
      if (ids.has(item.id)) report.duplicates += 1;
      else ids.add(item.id);
      report.normalized += 1;
    }

    if (collectionApi) {
      const rawCollections = readRaw(store, collectionApi.STORAGE_KEY);
      if (rawCollections === undefined || (rawCollections !== null && !Array.isArray(rawCollections))) report.collectionRootValid = false;
      const known = collectionApi.readCollections(store);
      report.collections = known.length;
      for (const collection of known) {
        for (const promptId of collection.promptIds) {
          if (ids.has(promptId) || report.orphans.length >= MAX_ORPHANS) continue;
          report.orphans.push({ collection: collection.name, promptId });
        }
      }
    }
    return Object.freeze({ ...report, orphans: Object.freeze(report.orphans) });
  }

  /** True when nothing in the report needs a repair. */
  function healthy(report) {
    return report.rootValid
      && report.collectionRootValid
      && report.broken === 0
      && report.duplicates === 0
      && report.orphans.length === 0;
  }

  /**
   * Rewrites both keys through the existing normalizers.
   * Records that cannot be normalized are dropped rather than copied forward,
   * so a repair is a narrowing: a user who wants the raw data keeps it by
   * exporting before repairing.
   */
  function repair(store = storage()) {
    const api = core();
    const collectionApi = collections();
    if (!api || !store) return false;
    const items = api.normalizeCollection(readRaw(store, api.STORAGE_KEY) || []);
    if (!api.saveItems(store, items)) return false;
    if (collectionApi) {
      const pruned = collectionApi.pruneMembers(collectionApi.readCollections(store), store);
      if (!collectionApi.saveCollections(store, pruned)) return false;
    }
    return true;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById(CARD_ID);
    if (!card || documentRef.getElementById(PANEL_ID)) return null;

    const section = element(documentRef, 'section', undefined, 'prompt-library-diagnostics');
    section.id = PANEL_ID;
    section.setAttribute('aria-labelledby', TITLE_ID);

    const header = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-head');
    const title = element(documentRef, 'strong', 'Kütüphane sağlığı', 'prompt-library-diagnostics-title');
    title.id = TITLE_ID;
    const toggle = button(documentRef, 'Gizle');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', `${PANEL_ID}Body`);
    header.append(title, toggle);

    const body = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-body');
    body.id = `${PANEL_ID}Body`;
    const report = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-report');
    const status = element(documentRef, 'div', '', 'prompt-library-diagnostics-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const actions = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-actions');
    const refresh = button(documentRef, 'Yeniden tara');
    const fix = button(documentRef, 'Onar');
    // The repair is addressed by attribute rather than by label, so the click
    // handler and any automation keep working if the wording changes.
    fix.setAttribute('data-diagnostics-repair', 'true');
    actions.append(refresh, fix);

    body.append(report, actions, status);
    section.append(header, body);
    card.append(section);

    function line(label, value) {
      const row = element(documentRef, 'div', undefined, 'prompt-library-diagnostics-row');
      row.append(element(documentRef, 'span', label), element(documentRef, 'strong', String(value)));
      return row;
    }

    function render() {
      const current = inspect(storage());
      report.replaceChildren(
        line('Ham kayıt', current.records),
        line('Normalize edilebilen', current.normalized),
        line('Bozuk kayıt', current.broken),
        line('Yinelenen id', current.duplicates),
        line('Koleksiyon', current.collections),
        line('Yetim koleksiyon üyesi', current.orphans.length)
      );
      if (!current.rootValid) report.append(element(documentRef, 'p', 'İstem deposu dizi biçiminde değil.', 'prompt-library-diagnostics-note'));
      if (!current.collectionRootValid) report.append(element(documentRef, 'p', 'Koleksiyon deposu dizi biçiminde değil.', 'prompt-library-diagnostics-note'));
      if (current.truncated) report.append(element(documentRef, 'p', `Tanı ilk ${MAX_RECORDS} kaydı temel alır.`, 'prompt-library-diagnostics-note'));
      // The repair only writes when there is something to repair.
      fix.disabled = healthy(current);
      status.textContent = fix.disabled ? 'Kütüphane sağlıklı.' : 'Onarılabilir sorunlar bulundu.';
      return current;
    }

    function onRepair(event) {
      if (!event.target?.closest?.('[data-diagnostics-repair]') || fix.disabled) return;
      if (!rootRef.confirm?.('Bozuk istem kayıtları ve yetim koleksiyon üyeleri temizlensin mi? Bu işlem geri alınamaz.')) return;
      if (!repair(storage())) {
        status.textContent = 'Onarım cihazda kaydedilemedi.';
        return;
      }
      const api = core();
      const store = storage();
      try {
        const detail = { key: api.STORAGE_KEY, newValue: store?.getItem?.(api.STORAGE_KEY), storageArea: store };
        if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
      } catch {
        // The keys are repaired either way; only the live repaint is lost.
      }
      render();
      status.textContent = 'Kütüphane onarıldı.';
    }

    function onToggle() {
      const hidden = !body.hidden;
      body.hidden = hidden;
      toggle.textContent = hidden ? 'Göster' : 'Gizle';
      toggle.setAttribute('aria-expanded', String(!hidden));
      if (!hidden) render();
    }

    const onStorage = (event) => {
      if (body.hidden) return;
      if (!event?.key || event.key === core()?.STORAGE_KEY || event.key === collections()?.STORAGE_KEY) render();
    };

    toggle.addEventListener('click', onToggle);
    refresh.addEventListener('click', render);
    actions.addEventListener('click', onRepair);
    rootRef.addEventListener?.('storage', onStorage);
    render();

    return Object.freeze({
      mounted: true,
      refresh: render,
      inspect: () => inspect(storage()),
      destroy: () => {
        rootRef.removeEventListener?.('storage', onStorage);
        section.remove();
      }
    });
  }

  const api = Object.freeze({ MAX_RECORDS, MAX_ORPHANS, inspect, healthy, repair, mount });
  // Exported the same way as the modules it reads, so a suite can require it
  // in Node and drive the real inspection instead of a copy of it.
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryDiagnostics = api;
  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
