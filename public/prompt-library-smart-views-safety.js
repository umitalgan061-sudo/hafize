(function installHafizePromptSmartViewsSafety(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibrarySmartViewSafety';
  const STORAGE_KEY = 'hafize.prompt-library.smart-views.v1';
  const CHECKPOINT_KEY = STORAGE_KEY + '.repair-checkpoint';
  const MAX_VIEWS = 24;
  const MAX_QUERY = 180;
  const MAX_NAME = 72;
  const MAX_CHECKPOINT = 300000;

  const text = (doc, value, className) => {
    const node = doc.createElement('span');
    if (className) node.className = className;
    node.textContent = String(value ?? '');
    return node;
  };

  const button = (doc, label, className = 'mini-btn') => {
    const node = doc.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    return node;
  };

  const readRaw = (storage = root.localStorage) => {
    try {
      const raw = storage?.getItem?.(STORAGE_KEY);
      return { readable: true, value: raw ? JSON.parse(raw) : [] };
    } catch {
      return { readable: false, value: [] };
    }
  };

  const write = (value, storage = root.localStorage) => {
    try {
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(value));
      root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-smart-views-changed'));
      return true;
    } catch {
      return false;
    }
  };

  const writeCheckpoint = (value, storage = root.localStorage) => {
    try {
      const payload = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), views: value });
      if (payload.length > MAX_CHECKPOINT) return false;
      storage?.setItem?.(CHECKPOINT_KEY, payload);
      return true;
    } catch {
      return false;
    }
  };

  const readCheckpoint = (storage = root.localStorage) => {
    try {
      const value = JSON.parse(storage?.getItem?.(CHECKPOINT_KEY) || 'null');
      return value && Array.isArray(value.views) ? value : null;
    } catch {
      return null;
    }
  };

  const clearCheckpoint = (storage = root.localStorage) => {
    try { storage?.removeItem?.(CHECKPOINT_KEY); return true; } catch { return false; }
  };

  function issueReason(view) {
    if (!view || typeof view !== 'object') return 'Geçersiz nesne';
    const reasons = [];
    if (typeof view.name !== 'string' || !view.name.trim()) reasons.push('boş ad');
    if (typeof view.name === 'string' && view.name.length > MAX_NAME) reasons.push('uzun ad');
    if (typeof view.query === 'string' && view.query.length > MAX_QUERY) reasons.push('uzun sorgu');
    if (Number.isFinite(Number(view.minUse)) && Number.isFinite(Number(view.maxUse)) && Number(view.minUse) > Number(view.maxUse)) reasons.push('kullanım aralığı ters');
    const sort = view.sort || view.core?.sort || '';
    if (sort && !['updated-desc','favorite-first','created-desc','title-asc'].includes(sort)) reasons.push('geçersiz sıralama');
    return reasons.join(', ');
  }

  function analyze(storage = root.localStorage) {
    const raw = readRaw(storage);
    if (!raw.readable) {
      return { readable: false, rawCount: 0, validCount: 0, invalidCount: 0, duplicateIds: [], duplicateNames: [], overCapacity: false, issues: [] };
    }

    const values = Array.isArray(raw.value) ? raw.value : [];
    const invalid = [];
    const idCounts = new Map();
    const nameCounts = new Map();

    values.forEach((view, index) => {
      const reason = issueReason(view);
      if (reason) invalid.push({ index, reason });
      const id = typeof view?.id === 'string' ? view.id : '';
      const name = typeof view?.name === 'string' ? view.name.trim().toLocaleLowerCase('tr-TR') : '';
      if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
      if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    });

    const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id).slice(0, 24);
    const duplicateNames = [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name).slice(0, 24);
    const issues = [
      ...invalid.map((item) => '#' + (item.index + 1) + ': ' + item.reason),
      ...duplicateIds.map((id) => 'Yinelenen id: ' + id),
      ...duplicateNames.map((name) => 'Yinelenen ad: ' + name),
      ...(values.length > MAX_VIEWS ? ['Kapasite: ' + values.length + '/' + MAX_VIEWS] : [])
    ];

    return {
      readable: true,
      rawCount: values.length,
      validCount: Math.max(0, values.length - invalid.length),
      invalidCount: invalid.length,
      invalid,
      duplicateIds,
      duplicateNames,
      overCapacity: values.length > MAX_VIEWS,
      issues: issues.slice(0, 80)
    };
  }

  function normalizeRepair(storage = root.localStorage) {
    const raw = readRaw(storage);
    if (!raw.readable) return { ok: false, reason: 'STORAGE_UNREADABLE', views: [], repaired: 0 };

    const api = root.HafizePromptLibrarySmartViews;
    const input = Array.isArray(raw.value) ? raw.value : [];
    const views = [];
    const seenIds = new Set();
    const seenNames = new Set();
    let repaired = 0;

    for (const candidate of input.slice(0, MAX_VIEWS * 2)) {
      let next = api?.normalizeView?.(candidate);
      if (!next) {
        repaired += 1;
        continue;
      }

      let nextId = next.id;
      while (seenIds.has(nextId)) {
        nextId = root.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        repaired += 1;
      }

      let nextName = next.name;
      let suffix = 2;
      while (seenNames.has(nextName.toLocaleLowerCase('tr-TR'))) {
        nextName = (next.name + ' ' + suffix++).slice(0, MAX_NAME);
        repaired += 1;
      }

      if (nextId !== next.id || nextName !== next.name) {
        next = { ...next, id: nextId, name: nextName, updatedAt: new Date().toISOString() };
      }
      seenIds.add(next.id);
      seenNames.add(next.name.toLocaleLowerCase('tr-TR'));
      views.push(next);
      if (views.length >= MAX_VIEWS) {
        if (input.length > views.length) repaired += input.length - views.length;
        break;
      }
    }

    return { ok: true, reason: '', views, repaired };
  }

  function exportCheckpoint(storage = root.localStorage) {
    const raw = readRaw(storage);
    if (!raw.readable) return '';
    const payload = {
      version: 1,
      source: 'hafize-prompt-smart-views-recovery',
      exportedAt: new Date().toISOString(),
      views: Array.isArray(raw.value) ? raw.value : []
    };
    const output = JSON.stringify(payload, null, 2);
    return output.length <= MAX_CHECKPOINT ? output : '';
  }

  function applyRepair(storage = root.localStorage) {
    const raw = readRaw(storage);
    if (!raw.readable) return { ok: false, reason: 'STORAGE_UNREADABLE', views: [], repaired: 0 };
    const plan = normalizeRepair(storage);
    if (!plan.ok) return plan;
    if (!writeCheckpoint(Array.isArray(raw.value) ? raw.value : [], storage)) {
      return { ok: false, reason: 'CHECKPOINT_FAILED', views: [], repaired: 0 };
    }
    if (!write(plan.views, storage)) {
      return { ok: false, reason: 'WRITE_FAILED', views: [], repaired: 0 };
    }
    root.dispatchEvent?.(new root.CustomEvent('hafize:prompt-library-smart-views-repaired', { detail: { repaired: plan.repaired } }));
    return plan;
  }

  function undoRepair(storage = root.localStorage) {
    const checkpoint = readCheckpoint(storage);
    if (!checkpoint) return { ok: false, reason: 'NO_CHECKPOINT' };
    if (!write(checkpoint.views, storage)) return { ok: false, reason: 'RESTORE_FAILED' };
    clearCheckpoint(storage);
    return { ok: true, reason: '', restored: checkpoint.views.length };
  }

  function download(textValue, filename) {
    try {
      const blob = new Blob([textValue], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = root.document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch {
      return false;
    }
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.(CARD_ID);
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const section = documentRef.createElement('section');
    section.id = PANEL_ID;
    section.className = 'prompt-library-smart-view-safety';
    section.setAttribute('aria-labelledby', 'promptSmartViewSafetyTitle');

    const header = documentRef.createElement('div');
    header.className = 'prompt-smart-view-safety-head';
    const title = text(documentRef, 'Görünüm sağlığı', 'prompt-smart-view-safety-title');
    title.id = 'promptSmartViewSafetyTitle';
    const status = text(documentRef, '', 'prompt-smart-view-safety-status');
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.setAttribute('aria-controls', 'promptSmartViewSafetyBody');
    header.append(title, status, collapse);

    const body = documentRef.createElement('div');
    body.id = 'promptSmartViewSafetyBody';
    body.className = 'prompt-smart-view-safety-body';

    const metrics = documentRef.createElement('div');
    metrics.className = 'prompt-smart-view-safety-metrics';
    const issues = documentRef.createElement('div');
    issues.className = 'prompt-smart-view-safety-issues';
    issues.setAttribute('role', 'list');

    const actions = documentRef.createElement('div');
    actions.className = 'prompt-smart-view-safety-actions';
    const scan = button(documentRef, 'Tara');
    const backup = button(documentRef, 'Yedek indir');
    const repair = button(documentRef, 'Güvenli onarım');
    const undo = button(documentRef, 'Son onarımı geri al');
    actions.append(scan, backup, repair, undo);

    body.append(metrics, issues, actions);
    section.append(header, body);
    card.append(section);

    let hidden = false;
    let last = null;

    function metric(label, value) {
      const row = documentRef.createElement('div');
      row.className = 'prompt-smart-view-safety-metric';
      row.append(text(documentRef, label, 'prompt-smart-view-safety-label'));
      row.append(text(documentRef, value, 'prompt-smart-view-safety-value'));
      return row;
    }

    function render(report) {
      last = report;
      metrics.replaceChildren();
      issues.replaceChildren();
      if (!report.readable) {
        status.textContent = 'Görünüm storage alanı okunamıyor; onarım yapılmadı.';
        repair.disabled = true;
        undo.disabled = true;
        return;
      }
      const issueCount = report.invalidCount + report.duplicateIds.length + report.duplicateNames.length + (report.overCapacity ? 1 : 0);
      metrics.append(
        metric('Kayıt', report.rawCount),
        metric('Geçerli', report.validCount),
        metric('Sorun', issueCount),
        metric('Kapasite', report.rawCount + '/' + MAX_VIEWS)
      );
      if (!report.issues.length) {
        issues.append(text(documentRef, 'Sorun bulunmadı.', 'prompt-smart-view-safety-ok'));
      } else {
        report.issues.slice(0, 16).forEach((issue) => {
          const row = text(documentRef, issue, 'prompt-smart-view-safety-issue');
          row.setAttribute('role', 'listitem');
          issues.append(row);
        });
      }
      repair.disabled = issueCount === 0;
      undo.disabled = !readCheckpoint(rootRef.localStorage);
      status.textContent = issueCount
        ? 'Tarama sorunlar buldu; güvenli onarım checkpoint oluşturur.'
        : 'Tarama tamamlandı; görünüm verisi tutarlı.';
    }

    scan.addEventListener('click', () => render(analyze(rootRef.localStorage)));

    backup.addEventListener('click', () => {
      const payload = exportCheckpoint(rootRef.localStorage);
      if (!payload) return status.textContent = 'Kurtarma yedeği üretilemedi veya boyut sınırı aşıldı.';
      status.textContent = download(payload, 'hafize-prompt-smart-views-recovery.json')
        ? 'Kurtarma yedeği indirildi.'
        : 'Kurtarma yedeği indirilemedi.';
    });

    repair.addEventListener('click', () => {
      if (!last) render(analyze(rootRef.localStorage));
      if (!last || !rootRef.confirm?.('Sorunlu görünüm kayıtları güvenli biçimde normalize edilsin mi?')) return;
      const result = applyRepair(rootRef.localStorage);
      status.textContent = result.ok ? result.repaired + ' düzeltme uygulandı.' : 'Onarım başarısız: ' + result.reason;
      render(analyze(rootRef.localStorage));
    });

    undo.addEventListener('click', () => {
      if (!rootRef.confirm?.('Son görünüm onarımı geri alınsın mı?')) return;
      const result = undoRepair(rootRef.localStorage);
      status.textContent = result.ok ? result.restored + ' görünüm geri yüklendi.' : 'Geri alma başarısız: ' + result.reason;
      render(analyze(rootRef.localStorage));
    });

    collapse.addEventListener('click', () => {
      hidden = !hidden;
      body.hidden = hidden;
      collapse.textContent = hidden ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!hidden));
    });

    const onStorage = (event) => {
      if (event.key === STORAGE_KEY || event.key === CHECKPOINT_KEY) render(analyze(rootRef.localStorage));
    };
    rootRef.addEventListener?.('storage', onStorage);
    render(analyze(rootRef.localStorage));

    return Object.freeze({
      mounted: true,
      scan: () => render(analyze(rootRef.localStorage)),
      analyze: () => analyze(rootRef.localStorage),
      applyRepair: () => applyRepair(rootRef.localStorage),
      undoRepair: () => undoRepair(rootRef.localStorage),
      destroy: () => {
        rootRef.removeEventListener?.('storage', onStorage);
        section.remove();
      }
    });
  }

  root.HafizePromptLibrarySmartViewsSafety = Object.freeze({
    STORAGE_KEY,
    CHECKPOINT_KEY,
    MAX_VIEWS,
    MAX_QUERY,
    MAX_NAME,
    MAX_CHECKPOINT,
    analyze,
    normalizeRepair,
    exportCheckpoint,
    applyRepair,
    undoRepair,
    readCheckpoint,
    mount
  });

  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
