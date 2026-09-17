(function installPromptLibraryHealth(root) {
  'use strict';

  const PROMPT_KEY = 'hafize.prompt-library.v1';
  const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';
  const REVISION_KEY = 'hafize.prompt-library.revisions.v1';
  const HEALTH_STATE_KEY = 'hafize.prompt-library.health.v1';
  const PANEL_ID = 'promptLibraryHealth';
  const MAX_PROMPTS = 120;
  const MAX_COLLECTIONS = 40;
  const MAX_REVISIONS = 600;
  const MAX_ISSUES = 240;
  const MAX_REPORT = 240000;
  const LONG_BODY = 7000;
  const STALE_DAYS = 180;
  const OLD_DATE = 0;
  const SEVERITY_ORDER = Object.freeze({ error: 0, warning: 1, info: 2 });

  const text = (doc, value, className = '') => {
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

  const clamp = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
  const lower = (value) => String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const isoNow = () => new Date().toISOString();
  const daysAgo = (value) => {
    const time = Date.parse(String(value ?? ''));
    if (!Number.isFinite(time)) return OLD_DATE;
    return Math.floor((Date.now() - time) / 86400000);
  };

  function readJson(storage, key, fallback) {
    try {
      const raw = storage?.getItem?.(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function readRaw(storage, key) {
    try { return storage?.getItem?.(key) ?? null; } catch { return null; }
  }

  function safeStorage(rootRef = root) {
    try { return rootRef.localStorage || null; } catch { return null; }
  }

  function readPrompts(storage) {
    const raw = readRaw(storage, PROMPT_KEY);
    const value = readJson(storage, PROMPT_KEY, []);
    const isArray = Array.isArray(value);
    const candidates = isArray ? value : [];
    return {
      raw,
      value,
      isArray,
      candidates: candidates.slice(0, MAX_PROMPTS * 2)
    };
  }

  function promptIds(prompts) {
    return new Set(prompts.filter((item) => item && typeof item.id === 'string').map((item) => item.id.slice(0, 120)));
  }

  function readCollections(storage) {
    const value = readJson(storage, COLLECTION_KEY, []);
    return Array.isArray(value) ? value.slice(0, MAX_COLLECTIONS * 2) : [];
  }

  function readRevisions(storage) {
    const value = readJson(storage, REVISION_KEY, []);
    return Array.isArray(value) ? value.slice(0, MAX_REVISIONS * 2) : [];
  }

  function addIssue(list, severity, code, title, detail, promptId = '', related = '') {
    if (list.length >= MAX_ISSUES) return;
    list.push({ severity, code, title, detail, promptId: clamp(promptId, 120), related: clamp(related, 160) });
  }

  function tokenSet(body) {
    const words = normalizeWhitespace(body).toLocaleLowerCase('tr-TR').split(/[^\p{L}\p{N}_-]+/u).filter((word) => word.length >= 3);
    return new Set(words.slice(0, 240));
  }

  function similarity(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    for (const value of a) if (b.has(value)) overlap += 1;
    return overlap / (a.size + b.size - overlap);
  }

  function inspectPrompts(rawInfo, issues) {
    const ids = new Set();
    const titles = new Map();
    const bodies = new Map();
    const valid = [];
    let malformed = 0;
    let duplicateIds = 0;

    if (rawInfo.raw === null) addIssue(issues, 'info', 'storage-missing', 'Prompt storage bulunamadı', 'Kütüphane henüz veri üretmemiş; bu normal bir başlangıç durumudur.');
    if (!rawInfo.isArray && rawInfo.raw !== null) addIssue(issues, 'error', 'storage-root', 'Prompt storage kökü dizi değil', 'Mevcut JSON kökü beklenen dizi biçiminde değil; onarım bunu güvenli biçimde normalize edebilir.');

    rawInfo.candidates.forEach((item, index) => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || typeof item.body !== 'string' || !item.body) {
        malformed += 1;
        addIssue(issues, 'error', 'malformed-record', 'Bozuk prompt kaydı', `${index + 1}. kayıt normalize edilemiyor.`);
        return;
      }
      const id = item.id.slice(0, 120);
      if (ids.has(id)) {
        duplicateIds += 1;
        addIssue(issues, 'error', 'duplicate-id', 'Yinelenen prompt kimliği', `“${clamp(item.title, 72)}” kaydı aynı id ile birden fazla kez bulunuyor.`, id);
      }
      ids.add(id);
      const title = lower(item.title || 'isimsiz istem');
      const bodyKey = lower(normalizeWhitespace(item.body));
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(item);
      if (!bodies.has(bodyKey)) bodies.set(bodyKey, []);
      bodies.get(bodyKey).push(item);
      valid.push(item);

      if (!Array.isArray(item.tags) || !item.tags.filter((tag) => typeof tag === 'string' && tag.trim()).length) {
        addIssue(issues, 'warning', 'missing-tags', 'Etiketsiz prompt', `“${clamp(item.title, 72)}” aramayı kolaylaştıracak bir etiket taşımıyor.`, id);
      }
      if (item.body.length >= LONG_BODY) addIssue(issues, 'warning', 'long-body', 'Uzun prompt', `“${clamp(item.title, 72)}” ${item.body.length} karakter; düzenleme ve taşıma maliyeti yükselebilir.`, id);

      const useCount = Number(item.useCount);
      if (!Number.isFinite(useCount) || useCount < 0) addIssue(issues, 'warning', 'invalid-use-count', 'Geçersiz kullanım sayacı', `“${clamp(item.title, 72)}” için useCount normal sayı değil.`, id);
      else if (useCount === 0) addIssue(issues, 'info', 'unused', 'Henüz kullanılmamış prompt', `“${clamp(item.title, 72)}” henüz kullanılmamış.`, id);

      const age = daysAgo(item.updatedAt || item.createdAt);
      if (age >= STALE_DAYS) addIssue(issues, 'info', 'stale', 'Eski prompt', `“${clamp(item.title, 72)}” yaklaşık ${age} gündür güncellenmemiş.`, id);

      const variables = String(item.body).match(/\{\{\s*[a-zA-Z0-9_-]{1,32}\s*\}\}/g) || [];
      const uniqueVariables = [...new Set(variables.map((value) => value.replace(/^\{\{\s*|\s*\}\}$/g, '')))].length;
      if (uniqueVariables > 12) addIssue(issues, 'error', 'too-many-variables', 'Çok fazla değişken', `“${clamp(item.title, 72)}” 12 sınırından fazla değişken içeriyor.`, id);
      if (/\{\{[^}]*$|^\{\{[^}]*\}\}/.test(item.body) && variables.length === 0) addIssue(issues, 'warning', 'malformed-variable', 'Şüpheli değişken sözdizimi', `“${clamp(item.title, 72)}” değişken biçimi açısından incelenmeli.`, id);
    });

    titles.forEach((group) => {
      if (group.length <= 1) return;
      group.forEach((item) => addIssue(issues, 'warning', 'duplicate-title', 'Yinelenen prompt başlığı', `“${clamp(item.title, 72)}” başlığı başka bir kayıtla aynı.`, item.id));
    });

    bodies.forEach((group) => {
      if (group.length <= 1) return;
      group.forEach((item) => addIssue(issues, 'warning', 'duplicate-body', 'Yinelenen prompt gövdesi', `“${clamp(item.title, 72)}” başka bir prompt ile aynı metni kullanıyor.`, item.id));
    });

    for (let index = 0; index < Math.min(valid.length, MAX_PROMPTS); index += 1) {
      for (let next = index + 1; next < Math.min(valid.length, MAX_PROMPTS); next += 1) {
        const left = valid[index];
        const right = valid[next];
        if (!left?.body || !right?.body) continue;
        const score = similarity(left.body, right.body);
        if (score >= 0.82) {
          addIssue(issues, 'info', 'near-duplicate', 'Birbirine çok benzeyen prompt', `“${clamp(left.title, 60)}” ve “${clamp(right.title, 60)}” metin benzerliği ${(score * 100).toFixed(0)}%.`, left.id, right.id);
        }
      }
    }

    return { validCount: valid.length, malformed, duplicateIds, ids, valid };
  }

  function inspectCollections(collections, ids, issues) {
    let orphanCount = 0;
    let malformed = 0;
    const seen = new Set();
    collections.forEach((collection, index) => {
      if (!collection || typeof collection !== 'object' || typeof collection.id !== 'string' || typeof collection.name !== 'string') {
        malformed += 1;
        addIssue(issues, 'error', 'malformed-collection', 'Bozuk koleksiyon kaydı', `${index + 1}. koleksiyon normalize edilemiyor.`);
        return;
      }
      if (seen.has(collection.id)) addIssue(issues, 'error', 'duplicate-collection-id', 'Yinelenen koleksiyon kimliği', `“${clamp(collection.name, 72)}” koleksiyon id'si tekrar ediyor.`, '', collection.id);
      seen.add(collection.id);
      const members = Array.isArray(collection.promptIds) ? collection.promptIds : [];
      members.slice(0, 120).forEach((id) => {
        if (!ids.has(id)) {
          orphanCount += 1;
          addIssue(issues, 'warning', 'orphan-member', 'Yetim koleksiyon üyesi', `“${clamp(collection.name, 72)}” artık bulunmayan bir prompt id'sine işaret ediyor.`, id, collection.id);
        }
      });
      if (!members.length) addIssue(issues, 'info', 'empty-collection', 'Boş koleksiyon', `“${clamp(collection.name, 72)}” hiç prompt içermiyor.`, '', collection.id);
    });
    return { orphanCount, malformed };
  }

  function inspectRevisions(revisions, ids, issues) {
    let orphanCount = 0;
    let malformed = 0;
    revisions.slice(0, MAX_REVISIONS).forEach((revision, index) => {
      if (!revision || typeof revision !== 'object' || typeof revision.id !== 'string') {
        malformed += 1;
        addIssue(issues, 'error', 'malformed-revision', 'Bozuk revizyon kaydı', `${index + 1}. revizyon normalize edilemiyor.`);
        return;
      }
      const promptId = typeof revision.promptId === 'string' ? revision.promptId : '';
      if (promptId && !ids.has(promptId)) {
        orphanCount += 1;
        addIssue(issues, 'warning', 'orphan-revision', 'Yetim prompt revizyonu', 'Revizyon artık bulunmayan bir prompt kaydına bağlı.', promptId, revision.id);
      }
    });
    return { orphanCount, malformed };
  }

  function summarize(issues, prompts, collections, revisions, promptMeta, collectionMeta, revisionMeta) {
    const counts = { error: 0, warning: 0, info: 0 };
    issues.forEach((issue) => { counts[issue.severity] = (counts[issue.severity] || 0) + 1; });
    const health = counts.error === 0 && promptMeta.malformed === 0 && collectionMeta.malformed === 0 && revisionMeta.malformed === 0;
    return {
      version: 1,
      healthy: health,
      checkedAt: isoNow(),
      promptCount: promptMeta.validCount,
      rawPromptCount: promptMeta.candidates.length,
      collectionCount: collections.length,
      revisionCount: revisions.length,
      malformedPrompts: promptMeta.malformed,
      duplicatePromptIds: promptMeta.duplicateIds,
      orphanCollectionMembers: collectionMeta.orphanCount,
      orphanRevisions: revisionMeta.orphanCount,
      issueCounts: counts
    };
  }

  function diagnose(rootRef = root) {
    const storage = safeStorage(rootRef);
    const promptInfo = readPrompts(storage);
    const collections = readCollections(storage);
    const revisions = readRevisions(storage);
    const issues = [];
    const promptMeta = inspectPrompts(promptInfo, issues);
    const collectionMeta = inspectCollections(collections, promptMeta.ids, issues);
    const revisionMeta = inspectRevisions(revisions, promptMeta.ids, issues);
    issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code, 'tr'));
    const summary = summarize(issues, promptInfo.candidates, collections, revisions, promptMeta, collectionMeta, revisionMeta);
    return {
      summary,
      issues: issues.slice(0, MAX_ISSUES),
      prompts: promptMeta.valid,
      collections,
      revisions,
      rawPrompt: promptInfo.raw
    };
  }

  function readState(rootRef = root) {
    const storage = safeStorage(rootRef);
    const state = readJson(storage, HEALTH_STATE_KEY, {});
    if (!state || typeof state !== 'object') return { filter: 'all', panelOpen: true };
    return { filter: ['all', 'error', 'warning', 'info'].includes(state.filter) ? state.filter : 'all', panelOpen: state.panelOpen !== false };
  }

  function writeState(rootRef, next) {
    const storage = safeStorage(rootRef);
    try { storage?.setItem?.(HEALTH_STATE_KEY, JSON.stringify({ filter: next.filter, panelOpen: next.panelOpen })); return true; } catch { return false; }
  }

  function repair(rootRef = root) {
    const storage = safeStorage(rootRef);
    if (!storage) return { ok: false, message: 'Local storage kullanılamıyor.' };
    const core = rootRef.HafizePromptLibrary;
    if (!core?.loadItems || !core?.saveItems || !core?.normalizeCollection) return { ok: false, message: 'Prompt Library çekirdeği bulunamadı.' };
    const current = core.loadItems(storage);
    const beforeCount = current.length;
    if (!core.saveItems(storage, current)) return { ok: false, message: 'Prompt kayıtları onarılamadı.' };

    const collectionsApi = rootRef.HafizePromptLibraryCollections;
    if (collectionsApi?.readCollections && collectionsApi?.saveCollections) {
      const existing = collectionsApi.readCollections(storage);
      const repaired = typeof collectionsApi.pruneMembers === 'function' ? collectionsApi.pruneMembers(existing, storage) : existing;
      collectionsApi.saveCollections(storage, repaired);
    }

    try {
      const event = typeof rootRef.StorageEvent === 'function'
        ? new rootRef.StorageEvent('storage', { key: PROMPT_KEY, newValue: JSON.stringify(core.loadItems(storage)), storageArea: storage })
        : new rootRef.Event('storage');
      rootRef.dispatchEvent?.(event);
    } catch { /* repair already persisted */ }

    return { ok: true, message: `${beforeCount} prompt kaydı normalize edildi.` };
  }

  function exportReport(report) {
    const output = JSON.stringify({ ...report.summary, issues: report.issues }, null, 2);
    return output.slice(0, MAX_REPORT);
  }

  function mount(documentRef = root.document, rootRef = root) {
    const card = documentRef?.getElementById?.('promptLibraryCard');
    if (!documentRef || !card || documentRef.getElementById(PANEL_ID)) return null;

    const state = readState(rootRef);
    const panel = documentRef.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'prompt-library-health';
    panel.setAttribute('aria-labelledby', 'promptLibraryHealthTitle');

    const head = documentRef.createElement('div');
    head.className = 'prompt-library-health-head';
    const title = documentRef.createElement('strong');
    title.id = 'promptLibraryHealthTitle';
    title.textContent = 'Kütüphane kalite merkezi';
    const status = text(documentRef, 'Kontrol bekliyor', 'prompt-library-health-status');
    const toggle = button(documentRef, state.panelOpen ? 'Gizle' : 'Göster');
    toggle.setAttribute('aria-expanded', String(state.panelOpen));
    head.append(title, status, toggle);

    const body = documentRef.createElement('div');
    body.className = 'prompt-library-health-body';
    body.hidden = !state.panelOpen;

    const actions = documentRef.createElement('div');
    actions.className = 'prompt-library-health-actions';
    const refresh = button(documentRef, 'Yeniden tara');
    const repairButton = button(documentRef, 'Güvenli onarım');
    const copyButton = button(documentRef, 'Raporu kopyala');
    const filter = documentRef.createElement('select');
    filter.setAttribute('aria-label', 'Sağlık sorunlarını filtrele');
    [['all', 'Tümü'], ['error', 'Hatalar'], ['warning', 'Uyarılar'], ['info', 'Bilgi']].forEach(([value, label]) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = label;
      filter.append(option);
    });
    filter.value = state.filter;
    actions.append(refresh, repairButton, copyButton, filter);

    const stats = documentRef.createElement('div');
    stats.className = 'prompt-library-health-stats';
    const issues = documentRef.createElement('div');
    issues.className = 'prompt-library-health-issues';
    issues.setAttribute('role', 'list');
    const message = text(documentRef, '', 'prompt-library-health-message');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    body.append(actions, stats, issues, message);
    panel.append(head, body);
    card.append(panel);

    let report = diagnose(rootRef);
    let filterValue = state.filter;

    const metric = (label, value, className) => {
      const node = documentRef.createElement('div');
      node.className = `prompt-library-health-metric ${className || ''}`;
      node.append(text(documentRef, String(value), 'prompt-library-health-value'), text(documentRef, label, 'prompt-library-health-label'));
      return node;
    };

    const renderIssues = () => {
      issues.replaceChildren();
      const visible = filterValue === 'all' ? report.issues : report.issues.filter((issue) => issue.severity === filterValue);
      if (!visible.length) {
        issues.append(text(documentRef, 'Bu filtrede sorun bulunmuyor.', 'prompt-library-health-empty'));
        return;
      }
      visible.slice(0, 80).forEach((issue) => {
        const row = documentRef.createElement('article');
        row.className = `prompt-library-health-issue is-${issue.severity}`;
        row.setAttribute('role', 'listitem');
        row.append(text(documentRef, issue.title, 'prompt-library-health-issue-title'));
        row.append(text(documentRef, issue.detail, 'prompt-library-health-issue-detail'));
        const meta = text(documentRef, issue.promptId ? `Prompt: ${issue.promptId}` : issue.related ? `İlişkili: ${issue.related}` : '', 'prompt-library-health-issue-meta');
        if (meta.textContent) row.append(meta);
        issues.append(row);
      });
    };

    const render = () => {
      report = diagnose(rootRef);
      const counts = report.summary.issueCounts;
      status.textContent = report.summary.healthy ? 'Kütüphane sağlıklı' : `${counts.error} hata · ${counts.warning} uyarı`;
      status.dataset.state = report.summary.healthy ? 'healthy' : 'issues';
      stats.replaceChildren(
        metric('Prompt', report.summary.promptCount),
        metric('Koleksiyon', report.summary.collectionCount),
        metric('Revizyon', report.summary.revisionCount),
        metric('Hata', counts.error, 'has-error'),
        metric('Uyarı', counts.warning, 'has-warning'),
        metric('Bilgi', counts.info, 'has-info')
      );
      repairButton.disabled = report.summary.healthy;
      renderIssues();
    };

    const onToggle = () => {
      const open = body.hidden;
      body.hidden = !open;
      toggle.textContent = open ? 'Gizle' : 'Göster';
      toggle.setAttribute('aria-expanded', String(open));
      writeState(rootRef, { filter: filterValue, panelOpen: open });
    };
    const onRefresh = () => { render(); message.textContent = 'Kütüphane yeniden tarandı.'; };
    const onRepair = () => {
      if (report.summary.healthy || !rootRef.confirm?.('Sorunlu Prompt Library verileri güvenli normalize işleminden geçirilsin mi?')) return;
      const result = repair(rootRef);
      message.textContent = result.message;
      render();
    };
    const onCopy = async () => {
      try {
        await rootRef.navigator?.clipboard?.writeText?.(exportReport(report));
        message.textContent = 'Sağlık raporu panoya kopyalandı.';
      } catch { message.textContent = 'Rapor panoya kopyalanamadı.'; }
    };
    const onFilter = () => { filterValue = filter.value; writeState(rootRef, { filter: filterValue, panelOpen: !body.hidden }); renderIssues(); };

    toggle.addEventListener('click', onToggle);
    refresh.addEventListener('click', onRefresh);
    repairButton.addEventListener('click', onRepair);
    copyButton.addEventListener('click', onCopy);
    filter.addEventListener('change', onFilter);
    const onStorage = (event) => {
      if ([PROMPT_KEY, COLLECTION_KEY, REVISION_KEY].includes(event.key)) render();
    };
    rootRef.addEventListener?.('storage', onStorage);
    render();

    return Object.freeze({
      mounted: true,
      diagnose: () => diagnose(rootRef),
      repair: () => repair(rootRef),
      refresh: render,
      destroy: () => {
        rootRef.removeEventListener?.('storage', onStorage);
        toggle.removeEventListener('click', onToggle);
        refresh.removeEventListener('click', onRefresh);
        repairButton.removeEventListener('click', onRepair);
        copyButton.removeEventListener('click', onCopy);
        filter.removeEventListener('change', onFilter);
        panel.remove();
      }
    });
  }

  root.HafizePromptLibraryHealth = Object.freeze({
    PROMPT_KEY,
    COLLECTION_KEY,
    REVISION_KEY,
    HEALTH_STATE_KEY,
    LIMITS: Object.freeze({ MAX_PROMPTS, MAX_COLLECTIONS, MAX_REVISIONS, MAX_ISSUES, LONG_BODY, STALE_DAYS }),
    diagnose,
    repair,
    exportReport,
    similarity,
    mount
  });

  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
