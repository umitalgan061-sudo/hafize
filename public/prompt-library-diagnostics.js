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
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.setAttribute('aria-controls', 'promptLibraryDiagnosticsBody');
    header.append(title, refresh, collapse);

    const body = documentRef.createElement('div');
    body.className = 'prompt-library-diagnostics-body';
    body.id = 'promptLibraryDiagnosticsBody';
    const status = text(documentRef, 'Henüz taranmadı.', 'prompt-library-diagnostics-status');
    const reportList = documentRef.createElement('div');
    reportList.className = 'prompt-library-diagnostics-report';
    reportList.setAttribute('role', 'list');
    const repairPreview = documentRef.createElement('div');
    repairPreview.className = 'prompt-library-diagnostics-repair-preview';
    repairPreview.setAttribute('aria-live', 'polite');
    const backup = button(documentRef, 'Yedek indir');
    const repair = button(documentRef, 'Güvenli onarımı uygula');
    repair.dataset.diagnosticsRepair = 'true';
    const destructive = button(documentRef, 'Geçersiz kayıtları kaldır', 'mini-btn prompt-library-diagnostics-danger');
    const restore = button(documentRef, 'Karantinayı geri al');
    const undo = button(documentRef, 'Son onarımı geri al');
    const copyReport = button(documentRef, 'Raporu kopyala');
    const copyRepairPlan = button(documentRef, 'Onarım planını kopyala');
    const actions = documentRef.createElement('div');
    actions.className = 'prompt-library-diagnostics-actions';
    actions.append(backup, repair, destructive, restore, undo, copyReport, copyRepairPlan);
    body.append(status, reportList, repairPreview, actions);
    section.append(header, body);
    card.append(section);

    let lastReport = null;
    let hidden = false;

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
      restore.disabled = safety().readQuarantine(rootRef.localStorage).items.length === 0;
      undo.disabled = !safety().hasRepairCheckpoint(rootRef.localStorage);
      try {
        const preview = safety().buildRepairPreview(rootRef.localStorage);
        repairPreview.textContent = '';
        const summary = [
          ['Onarım sonrası kayıt', preview.normalizedCount],
          ['Yinelenen ID yeniden anahtarlama', preview.duplicateCount],
          ['Koleksiyon yetimi budama', preview.orphanCollectionMembers],
          ['Revizyon yetimi budama', preview.orphanRevisionRefs],
          ['Checkpoint gerekecek', Object.values(preview.rewrites).some(Boolean) ? 'Evet' : 'Hayır']
        ];
        const heading = documentRef.createElement('strong');
        heading.textContent = 'Onarım önizlemesi';
        repairPreview.append(heading);
        summary.forEach(function (entry) {
          const row = documentRef.createElement('div');
          row.className = 'prompt-library-diagnostics-repair-item';
          row.append(text(documentRef, entry[0], 'prompt-library-diagnostics-label'));
          row.append(text(documentRef, entry[1], 'prompt-library-diagnostics-value'));
          repairPreview.append(row);
        });
      } catch {
        repairPreview.textContent = 'Onarım önizlemesi üretilemedi.';
      }
      status.textContent = report.storageReadable
        ? 'Tarama tamamlandı; güvenli onarım geçerli kayıtları normalize eder ve yetim ilişkileri budar.'
        : 'İstem verisi okunamıyor; otomatik onarım yapılmadı.';
    }

    collapse.addEventListener('click', function () {
      hidden = !hidden;
      body.hidden = hidden;
      collapse.textContent = hidden ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!hidden));
    });

    function scan() {
      try {
        render(safety().analyzeLibrary(rootRef.localStorage));
      } catch {
        status.textContent = 'Sağlık taraması başarısız.';
      }
    }

    restore.disabled = true;
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

    copyRepairPlan.addEventListener('click', function () {
      let preview;
      try { preview = safety().buildRepairPreview(rootRef.localStorage); }
      catch {
        status.textContent = 'Onarım planı üretilemedi.';
        return;
      }
      const plan = {
        generatedAt: new Date().toISOString(),
        rawCount: preview.rawCount,
        normalizedCount: preview.normalizedCount,
        invalidCount: preview.invalidCount,
        duplicateCount: preview.duplicateCount,
        orphanCollectionMembers: preview.orphanCollectionMembers,
        orphanRevisionRefs: preview.orphanRevisionRefs,
        rewrites: preview.rewrites
      };
      const clipboard = rootRef.navigator?.clipboard?.writeText;
      if (typeof clipboard !== 'function') {
        status.textContent = 'Onarım planı kopyalama kullanılamıyor.';
        return;
      }
      Promise.resolve(clipboard.call(rootRef.navigator.clipboard, JSON.stringify(plan, null, 2)))
        .then(function () { status.textContent = 'Onarım planı panoya kopyalandı.'; })
        .catch(function () { status.textContent = 'Onarım planı kopyalanamadı.'; });
    });

    copyReport.addEventListener('click', function () {
      if (!lastReport) scan();
      if (!lastReport) return;
      const summary = {
        generatedAt: new Date().toISOString(),
        rawCount: lastReport.rawCount,
        normalizedCount: lastReport.normalizedCount,
        overCapacity: lastReport.overCapacity,
        invalidCount: lastReport.invalidIndexes.length,
        duplicateIdCount: lastReport.duplicateIds.length,
        invalidUseCount: lastReport.invalidUseCounts,
        orphanCollectionMembers: lastReport.collections.orphanMembers,
        orphanRevisionRefs: lastReport.revisions.orphanPromptRefs,
        snapshotMismatches: lastReport.revisions.snapshotMismatches
      };
      const payload = JSON.stringify(summary, null, 2);
      const clipboard = rootRef.navigator?.clipboard?.writeText;
      if (typeof clipboard !== 'function') {
        status.textContent = 'Rapor kopyalama kullanılamıyor.';
        return;
      }
      Promise.resolve(clipboard.call(rootRef.navigator.clipboard, payload))
        .then(function () { status.textContent = 'Rapor panoya kopyalandı.'; })
        .catch(function () { status.textContent = 'Rapor kopyalanamadı.'; });
    });

    undo.addEventListener('click', function () {
      if (!rootRef.confirm || !rootRef.confirm('Son güvenli onarım geri alınsın mı?')) return;
      const result = safety().undoLastRepair(rootRef.localStorage);
      if (!result.ok) {
        status.textContent = 'Son onarım geri alınamadı: ' + result.reason;
        return;
      }
      status.textContent = String(result.restored) + ' kayıt son checkpoint üzerinden geri alındı.';
      scan();
    });

    restore.addEventListener('click', function () {
      if (!rootRef.confirm || !rootRef.confirm('Karantinadaki geçersiz kayıtlar yeniden kütüphaneye aktarılsın mı?')) return;
      const result = safety().restoreQuarantine(rootRef.localStorage);
      if (!result.ok) {
        status.textContent = 'Karantina geri yüklenemedi: ' + result.reason;
        return;
      }
      status.textContent = result.imported + ' karantina kaydı geri alındı.';
      scan();
    });

    refresh.addEventListener('click', scan);
    repair.addEventListener('click', function () {
      if (!lastReport) scan();
      if (!lastReport || !rootRef.confirm || !rootRef.confirm('Normalize edilebilir kayıtlar ve yetim ilişkiler güvenli biçimde onarılsın mı?')) return;
      const result = safety().applySafeRepair(rootRef.localStorage);
      status.textContent = result.ok ? 'Güvenli onarım tamamlandı.' : 'Onarım başarısız: ' + result.reason;
      scan();
    });

    destructive.addEventListener('click', function () {
      if (!lastReport || !lastReport.invalidIndexes.length) return;
      if (!rootRef.confirm?.(String(lastReport.invalidIndexes.length) + ' geçersiz kayıt karantinaya alınsın mı?')) return;
      const result = safety().quarantineInvalidItems(rootRef.localStorage, lastReport.invalidIndexes);
      status.textContent = result.ok
        ? String(result.count) + ' kayıt karantinaya alındı; geri alınabilir.'
        : 'Karantina başarısız: ' + result.reason;
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
