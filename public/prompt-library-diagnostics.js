(function installPromptLibraryDiagnostics(root) {
  'use strict';

  const PANEL_ID = 'promptLibraryDiagnostics';
  const CARD_ID = 'promptLibraryCard';
  const MAX_ORPHANS = 240;
  const safety = function () { return root.HafizePromptLibrarySafety; };
  const library = function () { return root.HafizePromptLibrary; };
  const normalizeItem = function (item) { return library()?.normalizeItem?.(item); };
  const normalizeCollection = function (items) { return library()?.normalizeCollection?.(items) || []; };
  const saveItems = function (storage, items) { return library()?.saveItems?.(storage, items) === true; };

  const text = function (doc, value, className) {
    const el = doc.createElement('span');
    if (className) el.className = className;
    el.textContent = String(value == null ? '' : value);
    return el;
  };
  const button = function (doc, label, className) {
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = className || 'mini-btn';
    el.textContent = label;
    return el;
  };

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef && documentRef.getElementById ? documentRef.getElementById(CARD_ID) : null;
    if (!documentRef || !card || !safety() || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-diagnostics';
    section.setAttribute('aria-labelledby', 'promptLibraryDiagnosticsTitle');

    const header = documentRef.createElement('div');
    header.className = 'prompt-library-diagnostics-head';
    const title = text(documentRef, 'Kütüphane sağlığı', 'prompt-library-diagnostics-title');
    title.id = 'promptLibraryDiagnosticsTitle';
    const refresh = button(documentRef, 'Tara');
    header.append(title, refresh);

    const body = documentRef.createElement('div');
    body.className = 'prompt-library-diagnostics-body';
    const status = text(documentRef, 'Henüz taranmadı.', 'prompt-library-diagnostics-status');
    const reportList = documentRef.createElement('div');
    reportList.className = 'prompt-library-diagnostics-report';
    reportList.setAttribute('role', 'list');
    const backup = button(documentRef, 'Yedek indir');
    const repair = button(documentRef, 'Güvenli onarımı uygula');
    repair.dataset.diagnosticsRepair = 'true';
    const destructive = button(documentRef, 'Geçersiz kayıtları kaldır', 'mini-btn prompt-library-diagnostics-danger');
    const actions = documentRef.createElement('div');
    actions.className = 'prompt-library-diagnostics-actions';
    actions.append(backup, repair, destructive);
    body.append(status, reportList, actions);
    section.append(header, body);
    card.append(section);

    let lastReport = null;

    function metric(label, value, tone) {
      const row = documentRef.createElement('div');
      row.className = 'prompt-library-diagnostics-metric' + (tone ? ' ' + tone : '');
      row.append(text(documentRef, label, 'prompt-library-diagnostics-label'));
      row.append(text(documentRef, value, 'prompt-library-diagnostics-value'));
      return row;
    }

    function render(report) {
      lastReport = report;
      reportList.replaceChildren();
      const issues = [
        ['Bozuk/uygunsuz kayıt', report.invalidIndexes.length],
        ['Yinelenen id', report.duplicateIds.length],
        ['Geçersiz kullanım sayacı', report.invalidUseCounts],
        ['Koleksiyon yetim üyesi', report.collections.orphanMembers],
        ['Revizyon yetim referansı', report.revisions.orphanPromptRefs],
        ['Snapshot uyuşmazlığı', report.revisions.snapshotMismatches]
      ];
      reportList.append(metric('Kayıt', report.rawCount, 'is-neutral'));
      reportList.append(metric('Normalize edilebilir', report.normalizedCount, 'is-neutral'));
      reportList.append(metric('Kapasite aşıldı', report.overCapacity ? 'Evet' : 'Hayır', report.overCapacity ? 'is-warning' : 'is-ok'));
      issues.forEach(function (issue) {
        reportList.append(metric(issue[0], issue[1], issue[1] ? 'is-warning' : 'is-ok'));
      });
      repair.disabled = !report.storageReadable;
      destructive.disabled = !report.invalidIndexes.length;
      status.textContent = report.storageReadable
        ? 'Tarama tamamlandı; güvenli onarım geçerli kayıtları normalize eder ve yetim ilişkileri budar.'
        : 'İstem verisi okunamıyor; otomatik onarım yapılmadı.';
    }

    function scan() {
      try {
        render(safety().analyzeLibrary(rootRef.localStorage));
      } catch {
        status.textContent = 'Sağlık taraması başarısız.';
      }
    }

    refresh.addEventListener('click', scan);
    backup.addEventListener('click', function () {
      const payload = safety().exportRecoverySnapshot(rootRef.localStorage);
      if (!payload) {
        status.textContent = 'Kurtarma yedeği üretilemedi veya boyutu sınırı aşıyor.';
        return;
      }
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = documentRef.createElement('a');
      link.href = url;
      link.download = 'hafize-prompt-library-recovery.json';
      link.click();
      rootRef.setTimeout?.(function () { URL.revokeObjectURL(url); }, 0);
      status.textContent = 'Kurtarma yedeği indirildi.';
    });

    repair.addEventListener('click', function () {
      if (!lastReport) scan();
      if (!lastReport || !rootRef.confirm || !rootRef.confirm('Normalize edilebilir kayıtlar ve yetim ilişkiler güvenli biçimde onarılsın mı?')) return;
      const result = safety().applySafeRepair(rootRef.localStorage);
      status.textContent = result.ok ? 'Güvenli onarım tamamlandı.' : 'Onarım başarısız: ' + result.reason;
      scan();
    });

    destructive.addEventListener('click', function () {
      if (!lastReport || !lastReport.invalidIndexes.length) return;
      if (!rootRef.confirm || !rootRef.confirm(String(lastReport.invalidIndexes.length) + ' geçersiz kayıt kalıcı olarak kaldırılsın mı?')) return;
      const raw = safety().readRawPrompts(rootRef.localStorage);
      const indexes = new Set(lastReport.invalidIndexes);
      const kept = Array.isArray(raw.parsed) ? raw.parsed.filter(function (_item, index) { return !indexes.has(index); }) : [];
      try {
        const normalized = normalizeCollection(kept.map(normalizeItem).filter(Boolean));
        if (!saveItems(rootRef.localStorage, normalized)) throw new Error('SAVE_FAILED');
        rootRef.dispatchEvent && rootRef.dispatchEvent(new rootRef.CustomEvent('hafize:prompt-library-safety-changed'));
      } catch {
        status.textContent = 'Geçersiz kayıtlar kaldırılamadı.';
        return;
      }
      scan();
    });

    const onStorage = function (event) {
      if ([safety().PROMPT_KEY, safety().COLLECTION_KEY, safety().REVISION_KEY].includes(event.key)) scan();
    };
    rootRef.addEventListener && rootRef.addEventListener('storage', onStorage);
    scan();

    return Object.freeze({
      mounted: true,
      scan,
      getReport: function () { return lastReport; },
      destroy: function () {
        rootRef.removeEventListener && rootRef.removeEventListener('storage', onStorage);
        section.remove();
      }
    });
  }

  root.HafizePromptLibraryDiagnostics = Object.freeze({ mount });
  const start = function () {
    if (root.document && root.document.getElementById && root.document.getElementById(CARD_ID)) mount(root.document, root);
  };
  if (root.document && root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
