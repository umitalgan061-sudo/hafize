(function exposeHafizePromptDiagnostics(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else root.HafizePromptLibraryDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizePromptDiagnostics(root) {
  'use strict';

  // The prompt library, its collections and its revisions are three local stores
  // that can drift apart: a browser can truncate a write, a hand-edited backup
  // can carry a broken record, and deleting a prompt leaves its id behind in a
  // collection. Nothing in the app reports that today — a prompt simply stops
  // appearing. This panel reads the three stores, says what is wrong in plain
  // words, and repairs it only after an explicit confirmation.

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryDiagnostics';
  const REPORT_CLASS = 'prompt-library-diagnostics-report';
  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const MAX_ORPHANS = 60;
  const MAX_DETAIL = 12;
  const MAX_LABEL = 90;

  function core() {
    return root.HafizePromptLibrary;
  }

  function collections() {
    return root.HafizePromptLibraryCollections;
  }

  function storage() {
    try { return root.localStorage; } catch { return null; }
  }

  function clip(value, limit) {
    return String(value ?? '').slice(0, limit);
  }

  function readJson(store, key) {
    try {
      const raw = store?.getItem?.(key);
      if (!raw) return { value: null, bytes: 0, broken: false };
      return { value: JSON.parse(raw), bytes: raw.length, broken: false };
    } catch {
      return { value: null, bytes: 0, broken: true };
    }
  }

  function make(documentRef, tag, textValue, className) {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function button(documentRef, label, className = 'soft-btn') {
    const node = make(documentRef, 'button', label, className);
    node.type = 'button';
    return node;
  }

  /**
   * Reads the three stores and returns the findings. Nothing is written here:
   * a scan of a broken store must stay safe to run.
   */
  function scan(store = storage()) {
    const library = core();
    const findings = [];
    const prompts = readJson(store, PROMPT_KEY);
    const collectionStore = readJson(store, COLLECTION_KEY);
    const revisions = readJson(store, REVISION_KEY);

    if (prompts.broken) findings.push({ id: 'prompts-unreadable', severity: 'error', label: 'İstem deposu okunamıyor (bozuk JSON).', detail: [] });
    if (collectionStore.broken) findings.push({ id: 'collections-unreadable', severity: 'error', label: 'Koleksiyon deposu okunamıyor (bozuk JSON).', detail: [] });
    if (revisions.broken) findings.push({ id: 'revisions-unreadable', severity: 'warning', label: 'Sürüm geçmişi deposu okunamıyor (bozuk JSON).', detail: [] });

    const rawPrompts = Array.isArray(prompts.value) ? prompts.value : [];
    const valid = [];
    const invalid = [];
    const seen = new Set();
    const duplicates = [];
    for (const raw of rawPrompts) {
      const item = library?.normalizeItem?.(raw) ?? null;
      if (!item) {
        invalid.push(clip(raw?.title ?? raw?.id ?? 'İsimsiz kayıt', MAX_LABEL));
        continue;
      }
      if (seen.has(item.id)) duplicates.push(clip(item.title, MAX_LABEL));
      else seen.add(item.id);
      valid.push(item);
    }

    if (invalid.length) {
      findings.push({ id: 'invalid-prompts', severity: 'error', label: `${invalid.length} istem kaydı okunamıyor.`, detail: invalid.slice(0, MAX_DETAIL) });
    }
    if (duplicates.length) {
      findings.push({ id: 'duplicate-prompts', severity: 'warning', label: `${duplicates.length} istem aynı kimliği paylaşıyor.`, detail: duplicates.slice(0, MAX_DETAIL) });
    }

    const rawCollections = Array.isArray(collectionStore.value) ? collectionStore.value : [];
    const orphans = [];
    for (const rawCollection of rawCollections) {
      const collection = collections()?.normalizeCollection?.(rawCollection) ?? null;
      if (!collection) continue;
      for (const promptId of collection.promptIds || []) {
        if (seen.has(promptId)) continue;
        if (orphans.length >= MAX_ORPHANS) break;
        orphans.push(`${clip(collection.name, 40)} → ${clip(promptId, 40)}`);
      }
    }
    if (orphans.length) {
      findings.push({ id: 'orphan-members', severity: 'warning', label: `${orphans.length} koleksiyon üyeliği silinmiş isteme işaret ediyor.`, detail: orphans.slice(0, MAX_DETAIL) });
    }

    const bytes = prompts.bytes + collectionStore.bytes + revisions.bytes;
    if (bytes > 1_500_000) {
      findings.push({ id: 'storage-pressure', severity: 'warning', label: `Yerel istem verisi ${Math.round(bytes / 1024)} KB; tarayıcı kotasına yaklaşıyor.`, detail: [] });
    }

    return Object.freeze({
      checkedAt: new Date().toISOString(),
      prompts: valid.length,
      collections: rawCollections.length,
      revisionBytes: revisions.bytes,
      repairable: findings.some((finding) => finding.id === 'invalid-prompts' || finding.id === 'duplicate-prompts' || finding.id === 'orphan-members'),
      findings,
      valid
    });
  }

  /**
   * Rewrites the prompt store with the records that survive normalization and
   * drops collection members whose prompt is gone. Both writes go through the
   * owning module's writer, so their own bounds still apply.
   */
  function repair(report, store = storage()) {
    const library = core();
    if (!store || !library?.saveItems || !library.normalizeCollection) return false;
    const kept = library.normalizeCollection(report?.valid ?? []);
    if (!library.saveItems(store, kept)) return false;
    const collectionApi = collections();
    if (collectionApi?.pruneMembers && collectionApi.readCollections && collectionApi.saveCollections) {
      try {
        collectionApi.saveCollections(store, collectionApi.pruneMembers(collectionApi.readCollections(store), store));
      } catch { /* the prompt store is already repaired; collections stay as they are */ }
    }
    return true;
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = make(documentRef, 'section', undefined, 'prompt-library-diagnostics');
    section.id = PANEL_ID;
    section.setAttribute('aria-labelledby', 'promptLibraryDiagnosticsTitle');

    const head = make(documentRef, 'div', undefined, 'prompt-library-diagnostics-head');
    const title = make(documentRef, 'strong', 'İstem sağlık kontrolü', 'prompt-library-diagnostics-title');
    title.id = 'promptLibraryDiagnosticsTitle';
    const toggle = button(documentRef, 'Gizle', 'mini-btn');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', REPORT_CLASS);
    head.append(title, toggle);

    const report = make(documentRef, 'div', undefined, REPORT_CLASS);
    report.id = REPORT_CLASS;
    report.setAttribute('aria-live', 'polite');

    const actions = make(documentRef, 'div', undefined, 'prompt-library-diagnostics-actions');
    const rescan = button(documentRef, 'Yeniden tara', 'mini-btn');
    const fix = button(documentRef, 'Sorunları onar', 'mini-btn');
    fix.setAttribute('data-diagnostics-repair', 'true');
    fix.disabled = true;
    actions.append(rescan, fix);
    section.append(head, report, actions);
    card.append(section);

    let current = null;

    function render() {
      current = scan(storage());
      report.replaceChildren();
      const summary = make(
        documentRef,
        'p',
        `${current.prompts} istem · ${current.collections} koleksiyon · ${current.findings.length} bulgu`,
        'prompt-library-diagnostics-summary'
      );
      report.append(summary);
      if (!current.findings.length) {
        report.append(make(documentRef, 'p', 'Yerel istem verisi tutarlı görünüyor.', 'prompt-library-diagnostics-empty'));
        fix.disabled = true;
        return;
      }
      const list = make(documentRef, 'ul', undefined, 'prompt-library-diagnostics-list');
      for (const finding of current.findings) {
        const row = make(documentRef, 'li', undefined, 'prompt-library-diagnostics-item');
        row.dataset.severity = finding.severity;
        row.append(make(documentRef, 'span', finding.label, 'prompt-library-diagnostics-label'));
        if (finding.detail.length) {
          const detail = make(documentRef, 'span', finding.detail.join(', '), 'prompt-library-diagnostics-detail');
          row.append(detail);
        }
        list.append(row);
      }
      report.append(list);
      fix.disabled = !current.repairable;
    }

    function onRepair() {
      if (!current?.repairable) return;
      if (!rootRef.confirm?.('Bozuk istem kayıtları silinecek ve koleksiyon üyelikleri temizlenecek. Devam edilsin mi?')) return;
      const store = storage();
      if (!repair(current, store)) {
        report.append(make(documentRef, 'p', 'Onarım kaydedilemedi.', 'prompt-library-diagnostics-error'));
        return;
      }
      try {
        const library = core();
        const detail = { key: library?.STORAGE_KEY ?? PROMPT_KEY, newValue: JSON.stringify(current.valid), storageArea: store };
        if (typeof rootRef.StorageEvent === 'function') rootRef.dispatchEvent(new rootRef.StorageEvent('storage', detail));
      } catch { /* the repair is stored even when the repaint cannot be signalled */ }
      render();
    }

    toggle.addEventListener('click', () => {
      const hidden = !report.hidden;
      report.hidden = hidden;
      actions.hidden = hidden;
      toggle.textContent = hidden ? 'Göster' : 'Gizle';
      toggle.setAttribute('aria-expanded', String(!hidden));
    });
    rescan.addEventListener('click', render);
    fix.addEventListener('click', onRepair);

    const onStorage = (event) => {
      if (event?.key && event.key !== PROMPT_KEY && event.key !== COLLECTION_KEY && event.key !== REVISION_KEY) return;
      render();
    };
    rootRef.addEventListener?.('storage', onStorage);

    render();

    return Object.freeze({
      mounted: true,
      refresh: render,
      report: () => current,
      destroy: () => {
        rootRef.removeEventListener?.('storage', onStorage);
        section.remove();
      }
    });
  }

  const api = Object.freeze({ PROMPT_KEY, COLLECTION_KEY, REVISION_KEY, MAX_ORPHANS, scan, repair, mount });
  const start = () => { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else if (root.document) start();
  return api;
});
