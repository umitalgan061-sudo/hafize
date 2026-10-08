/**
 * TypeScript-first frontend migration wave.
 * The browser/global contract is intentionally preserved during the migration.
 */
// @ts-nocheck
(function installHafizePrivacyCenter(root) {
  'use strict';

  const PANEL_ID = 'privacyDataCenter';
  const STYLE_ID = 'privacyDataCenterStyle';
  const STYLE_PATH = '/settings-privacy.css';
  const CHANGE_EVENT = 'hafize:privacy-data-changed';
  const SHORTCUT = 'r';
  const MAX_KEYS = 300;
  const MAX_REPORT_BYTES = 120000;
  const MAX_SEARCH = 80;

  const SURFACES = Object.freeze([
    { id: 'conversations', keys: ['hafize.conversations.v1'], label: 'Sohbetler', description: 'Yerel sohbet geçmişi ve konuşma dalları.', group: 'data' },
    { id: 'message-workspace', keys: ['hafize.message-workspace.v1'], label: 'Mesaj çalışma alanı', description: 'Kaydedilen mesaj notları, etiketler ve geri bildirimler.', group: 'data' },
    { id: 'prompts', keys: ['hafize.prompt-library.v1'], label: 'İstem kütüphanesi', description: 'İstem metinleri, etiketler, favoriler ve kullanım sayaçları.', group: 'data' },
    { id: 'prompt-state', keys: ['hafize.prompt-library.v1.state'], label: 'İstem filtreleri', description: 'Prompt Library arama, etiket ve sıralama durumu.', group: 'preference' },
    { id: 'prompt-collections', keys: ['hafize.prompt-library.collections.v1'], label: 'İstem koleksiyonları', description: 'İstem koleksiyonları ve üyelikleri.', group: 'data' },
    { id: 'prompt-revisions', keys: ['hafize.prompt-library.revisions.v1'], label: 'İstem sürümleri', description: 'Prompt düzenleme sürümleri ve geri alma kayıtları.', group: 'data' },
    { id: 'smart-views', keys: ['hafize.prompt-library.smart-views.v1', 'hafize.prompt-library.smart-views.v1.state'], label: 'Akıllı görünümler', description: 'Kaydedilmiş prompt filtreleri ve görünüm durumu.', group: 'data' },
    { id: 'smart-fill', keys: ['hafize.prompt-library.smart-fill.v1'], prefix: 'hafize.prompt-library.smart-fill.v1.', label: 'Akıllı doldurma', description: 'Değişkenler için cihazda tutulan değer setleri.', group: 'data' },
    { id: 'model-preferences', keys: ['hafize.model-preferences.v1'], label: 'Model tercihleri', description: 'Seçili model, ajan ve yerel profiller.', group: 'preference' },
    { id: 'composer-history', keys: ['hafize.composer-history.v1'], label: 'Composer geçmişi', description: 'Cihazda tutulan son yazılan mesajlar.', group: 'data' },
    { id: 'composer-settings', keys: ['hafize.composer-history.settings.v1'], label: 'Composer ayarları', description: 'Geçmiş saklama tercihi.', group: 'preference' },
    { id: 'task-templates', keys: ['hafize.scheduled-task-templates.v1'], label: 'Görev şablonları', description: 'Yerel görev şablonları; gerçek planlanmış görevler değildir.', group: 'data' },
    { id: 'task-draft', keys: ['hafize.scheduled-task-draft.v1'], label: 'Görev taslağı', description: 'Geçici görev formu taslağı.', group: 'data' },
    { id: 'theme', keys: ['hafize.theme.v1'], label: 'Tema tercihi', description: 'Açık/koyu tema seçimi.', group: 'preference' },
    { id: 'reduced-motion', keys: ['hafize.reduced-motion.v1'], label: 'Hareket tercihi', description: 'Azaltılmış hareket tercihi.', group: 'preference' },
    { id: 'backup-meta', keys: ['hafize.workspace-backup.meta.v1'], label: 'Yedek meta verisi', description: 'Son yerel çalışma alanı yedeğinin özet meta verisi.', group: 'preference' }
  ]);

  const surfaceMap = new Map(SURFACES.map(function (surface) { return [surface.id, surface]; }));
  const exactMap = new Map();
  SURFACES.forEach(function (surface) {
    (surface.keys || []).forEach(function (key) { exactMap.set(key, surface); });
  });

  function clean(value, limit) {
    return String(value == null ? '' : value).replace(/\0/g, '').slice(0, limit || 180);
  }

  function safeStorage(storage) {
    try {
      return storage && typeof storage.key === 'function' && typeof storage.getItem === 'function' && typeof storage.removeItem === 'function'
        ? storage : null;
    } catch { return null; }
  }

  function classifyKey(key) {
    const value = String(key || '');
    if (exactMap.has(value)) return exactMap.get(value);
    return SURFACES.find(function (surface) { return surface.prefix && value.startsWith(surface.prefix); }) || null;
  }

  function matchesSurfaceKey(key, surface) {
    if (!surface) return false;
    if ((surface.keys || []).includes(key)) return true;
    return Boolean(surface.prefix && String(key || '').startsWith(surface.prefix));
  }

  /** Every exact key the known surfaces declare, so they never need enumeration. */
  const EXACT_KEYS = Object.freeze(SURFACES.flatMap(function (surface) { return surface.keys || []; }));

  function keyBytes(key, raw) {
    return new TextEncoder().encode(String(key) + String(raw == null ? '' : raw)).byteLength;
  }

  function inspectStorage(storage) {
    const store = safeStorage(storage);
    const empty = { available: false, surfaces: [], knownBytes: 0, unknownKeys: 0, unknownBytes: 0, totalKeys: 0 };
    if (!store) return empty;
    const stats = new Map(SURFACES.map(function (surface) {
      return [surface.id, { id: surface.id, label: surface.label, description: surface.description, group: surface.group, keys: 0, bytes: 0, present: false }];
    }));
    let knownBytes = 0;
    let unknownKeys = 0;
    let unknownBytes = 0;
    let totalKeys = 0;

    // Surfaces with exact keys are read directly. Enumeration is capped, so a
    // browser holding more than MAX_KEYS entries would otherwise report the
    // user's own data surfaces as absent.
    const counted = new Set();
    for (const key of EXACT_KEYS) {
      let raw = null;
      try { raw = store.getItem(key); } catch { continue; }
      if (raw === null) continue;
      const surface = classifyKey(key);
      if (!surface) continue;
      const target = stats.get(surface.id);
      const bytes = keyBytes(key, raw);
      target.keys += 1;
      target.bytes += bytes;
      target.present = true;
      knownBytes += bytes;
      counted.add(key);
    }

    let length = 0;
    try { length = Math.min(MAX_KEYS, Math.max(0, Number(store.length) || 0)); } catch { return empty; }
    for (let index = 0; index < length; index += 1) {
      let key = null;
      try { key = store.key(index); } catch { unknownKeys += 1; totalKeys += 1; continue; }
      if (key === null) continue;
      totalKeys += 1;
      if (counted.has(key)) continue;
      let raw = '';
      try { raw = store.getItem(key) || ''; } catch { unknownKeys += 1; continue; }
      const bytes = keyBytes(key, raw);
      const surface = classifyKey(key);
      if (surface) {
        const target = stats.get(surface.id);
        target.keys += 1;
        target.bytes += bytes;
        target.present = true;
        knownBytes += bytes;
      } else {
        unknownKeys += 1;
        unknownBytes += bytes;
      }
    }
    return { available: true, surfaces: Array.from(stats.values()), knownBytes, unknownKeys, unknownBytes, totalKeys };
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return String(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async function storageEstimate(rootRef) {
    try {
      const result = await rootRef.navigator?.storage?.estimate?.();
      return {
        usage: Number.isFinite(result?.usage) ? Math.max(0, result.usage) : null,
        quota: Number.isFinite(result?.quota) ? Math.max(0, result.quota) : null
      };
    } catch { return { usage: null, quota: null }; }
  }

  /**
   * Keys to remove for a surface, plus whether any lookup failed. An unreadable
   * storage must not be reported as a successful clear: nothing was inspected,
   * so nothing can be claimed about what is left behind.
   */
  function removalKeys(storage, surface) {
    const keys = new Set();
    if (!storage || !surface) return { keys: [], unreadable: true };
    let unreadable = false;
    // Exact keys are resolved without enumeration, so clearing a surface stays
    // complete even when the capped scan cannot reach every entry.
    for (const key of surface.keys || []) {
      try { if (storage.getItem(key) !== null) keys.add(key); } catch { unreadable = true; }
    }
    if (surface.prefix) {
      let length = 0;
      try { length = Math.min(MAX_KEYS, Math.max(0, Number(storage.length) || 0)); } catch { return { keys: [...keys], unreadable: true }; }
      for (let index = 0; index < length; index += 1) {
        let key = null;
        try { key = storage.key(index); } catch { unreadable = true; continue; }
        if (key !== null && matchesSurfaceKey(key, surface)) keys.add(key);
      }
    }
    return { keys: [...keys], unreadable };
  }

  function clearSurface(id, storage) {
    const store = safeStorage(storage);
    const surface = surfaceMap.get(id);
    if (!store || !surface) return { removed: 0, ok: false };
    const { keys, unreadable } = removalKeys(store, surface);
    let removed = 0;
    try {
      keys.forEach(function (key) { store.removeItem(key); removed += 1; });
      return { removed, ok: !unreadable };
    } catch { return { removed, ok: false }; }
  }

  function clearByGroup(group, storage) {
    const store = safeStorage(storage);
    if (!store) return { removed: 0, ok: false, failures: [] };
    let removed = 0;
    const failures = [];
    SURFACES.filter(function (surface) { return surface.group === group; }).forEach(function (surface) {
      const result = clearSurface(surface.id, store);
      removed += result.removed;
      if (!result.ok) failures.push(surface.id);
    });
    return { removed, ok: failures.length === 0, failures };
  }

  function clearAllKnown(storage) {
    const store = safeStorage(storage);
    if (!store) return { removed: 0, ok: false, failures: [] };
    let removed = 0;
    const failures = [];
    SURFACES.forEach(function (surface) {
      const result = clearSurface(surface.id, store);
      removed += result.removed;
      if (!result.ok) failures.push(surface.id);
    });
    return { removed, ok: failures.length === 0, failures };
  }

  function surfaceSummary(surface) {
    if (!surface) return '';
    return surface.label + ': ' + surface.keys + ' alan · ' + formatBytes(surface.bytes) + (surface.present ? '' : ' · Veri yok');
  }

  function privacySummary(snapshot, estimate) {
    const lines = ['Hafize yerel veri özeti', 'Bilinen veri: ' + formatBytes(snapshot.knownBytes), 'Tanınmayan alan: ' + snapshot.unknownKeys, 'Toplam localStorage alanı: ' + snapshot.totalKeys];
    if (estimate?.usage !== null && estimate?.quota !== null && estimate?.quota > 0) {
      lines.push('Tarayıcı kullanımı: ' + formatBytes(estimate.usage) + ' / ' + formatBytes(estimate.quota));
    }
    return lines.concat(snapshot.surfaces.filter(function (surface) { return surface.present; }).map(function (surface) {
      return surface.label + ': ' + surface.keys + ' alan · ' + formatBytes(surface.bytes);
    })).join('\n').slice(0, MAX_REPORT_BYTES);
  }

  function privacyReport(snapshot, estimate) {
    const payload = {
      format: 'hafize-privacy-report',
      version: 1,
      generatedAt: new Date().toISOString(),
      localOnly: true,
      contentIncluded: false,
      surfaces: snapshot.surfaces.map(function (surface) {
        return { id: surface.id, present: surface.present, keys: surface.keys, bytes: surface.bytes };
      }),
      totals: {
        knownBytes: snapshot.knownBytes,
        unknownKeys: snapshot.unknownKeys,
        unknownBytes: snapshot.unknownBytes,
        totalKeys: snapshot.totalKeys,
        storageUsage: estimate?.usage ?? null,
        storageQuota: estimate?.quota ?? null
      }
    };
    let serialized = JSON.stringify(payload, null, 2);
    if (new TextEncoder().encode(serialized).byteLength <= MAX_REPORT_BYTES) return serialized;
    payload.surfaces = payload.surfaces.slice(0, 8);
    serialized = JSON.stringify(payload, null, 2);
    return serialized;
  }

  function installStyle(documentRef) {
    if (!documentRef?.head) return false;
    if (documentRef.getElementById(STYLE_ID)) return true;
    const link = documentRef.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_PATH;
    documentRef.head.append(link);
    return true;
  }

  function make(documentRef, tag, textValue, className) {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function button(documentRef, label, className) {
    const node = make(documentRef, 'button', label, className || 'mini-btn');
    node.type = 'button';
    return node;
  }

  function mount(documentRef, rootRef) {
    const settings = documentRef?.getElementById?.('settingsWorkspace');
    if (!documentRef || !settings || documentRef.getElementById(PANEL_ID)) return null;
    if (!installStyle(documentRef)) return null;

    const panel = make(documentRef, 'section', undefined, 'privacy-data-center');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-labelledby', 'privacyDataCenterTitle');

    const head = make(documentRef, 'div', undefined, 'privacy-data-head');
    const heading = make(documentRef, 'div', undefined, 'privacy-data-heading');
    heading.append(make(documentRef, 'span', 'Gizlilik merkezi', 'privacy-data-eyebrow'));
    const title = make(documentRef, 'h2', 'Yerel veri ve gizlilik', 'privacy-data-title');
    title.id = 'privacyDataCenterTitle';
    heading.append(title);
    const collapse = button(documentRef, 'Gizle');
    collapse.setAttribute('aria-expanded', 'true');
    collapse.setAttribute('aria-controls', 'privacyDataCenterBody');
    head.append(heading, collapse);

    const body = make(documentRef, 'div', undefined, 'privacy-data-body');
    body.id = 'privacyDataCenterBody';
    body.append(make(documentRef, 'p', 'Bu cihazdaki bilinen Hafize verilerini incele, yalnızca seçtiğin yüzeyi temizle veya içerik paylaşmadan gizlilik raporu üret.', 'privacy-data-intro'));

    const summary = make(documentRef, 'div', undefined, 'privacy-data-summary');
    const known = make(documentRef, 'div', undefined, 'privacy-data-stat');
    const unknown = make(documentRef, 'div', undefined, 'privacy-data-stat');
    const browser = make(documentRef, 'div', undefined, 'privacy-data-stat');
    summary.append(known, unknown, browser);
    const quotaNote = make(documentRef, 'div', '', 'privacy-data-quota');

    const actions = make(documentRef, 'div', undefined, 'privacy-data-actions');
    const refresh = button(documentRef, 'Yenile', 'soft-btn');
    const report = button(documentRef, 'Gizlilik raporu', 'soft-btn');
    const copyReport = button(documentRef, 'Raporu kopyala', 'soft-btn');
    const copySummary = button(documentRef, 'Özeti kopyala', 'soft-btn');
    const clearData = button(documentRef, 'Veri yüzeylerini temizle', 'soft-btn privacy-data-warning');
    const clearPreferences = button(documentRef, 'Tercihleri sıfırla', 'soft-btn privacy-data-warning');
    const clearAll = button(documentRef, 'Bilinen tüm yerel veriyi temizle', 'soft-btn privacy-data-danger');
    actions.append(refresh, report, copyReport, copySummary, clearData, clearPreferences, clearAll);

    const filter = documentRef.createElement('input');
    filter.type = 'search';
    filter.maxLength = MAX_SEARCH;
    filter.placeholder = 'Veri yüzeyi ara…';
    filter.setAttribute('aria-label', 'Yerel veri yüzeylerinde ara');
    filter.className = 'privacy-data-filter';
    const sort = documentRef.createElement('select');
    sort.setAttribute('aria-label', 'Veri yüzeylerini sırala');
    [['name', 'Ada göre'], ['size', 'Boyuta göre']].forEach(function (item) {
      const option = documentRef.createElement('option'); option.value = item[0]; option.textContent = item[1]; sort.append(option);
    });
    const onlyPresent = documentRef.createElement('input');
    onlyPresent.type = 'checkbox';
    onlyPresent.id = 'privacyDataOnlyPresent';
    const onlyPresentLabel = documentRef.createElement('label');
    onlyPresentLabel.className = 'privacy-data-only-present';
    onlyPresentLabel.append(onlyPresent, make(documentRef, 'span', 'Yalnız dolu yüzeyler'));
    const filterControls = make(documentRef, 'div', undefined, 'privacy-data-filter-controls');
    filterControls.append(filter, sort, onlyPresentLabel);
    const list = make(documentRef, 'div', undefined, 'privacy-data-list');
    list.setAttribute('role', 'list');
    const status = make(documentRef, 'div', '', 'privacy-data-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    body.append(summary, actions, filterControls, list, status, make(documentRef, 'p', 'Tanınmayan localStorage alanları gösterilmez ve toplu temizlemede silinmez. Oturum, token, OAuth secret ve sunucu görev verileri bu merkezin kapsamı dışındadır.', 'privacy-data-note'));
    panel.append(head, body);
    settings.append(panel);

    let collapsed = false;
    let destroyed = false;
    let estimate = { usage: null, quota: null };
    let renderVersion = 0;
    const listeners = [];

    const on = (target, type, handler) => {
      target.addEventListener(type, handler);
      listeners.push(function () { target.removeEventListener(type, handler); });
    };

    const setStatus = (message) => { status.textContent = clean(message, 220); };

    function render() {
      if (destroyed) return;
      const snapshot = inspectStorage(rootRef.localStorage);
      known.replaceChildren(make(documentRef, 'strong', formatBytes(snapshot.knownBytes)), make(documentRef, 'span', 'Bilinen veri'));
      unknown.replaceChildren(make(documentRef, 'strong', String(snapshot.unknownKeys)), make(documentRef, 'span', 'Tanınmayan alan'));
      browser.replaceChildren(
        make(documentRef, 'strong', estimate.usage === null ? '—' : formatBytes(estimate.usage)),
        make(documentRef, 'span', estimate.quota === null ? 'Tarayıcı kotası bilinmiyor' : 'Depolama / ' + formatBytes(estimate.quota))
      );
      quotaNote.textContent = '';
      if (estimate.usage !== null && estimate.quota > 0) {
        const ratio = estimate.usage / estimate.quota;
        if (ratio >= .9) quotaNote.textContent = 'Depolama kotasının %90’ından fazlası kullanılıyor.';
        else if (ratio >= .8) quotaNote.textContent = 'Depolama kotasının %80’inden fazlası kullanılıyor.';
      }
      list.replaceChildren();
      if (quotaNote.textContent) list.append(quotaNote);
      const query = clean(filter.value, MAX_SEARCH).toLocaleLowerCase('tr-TR');
      [['data', 'Kullanıcı verileri'], ['preference', 'Tercihler']].forEach(function (group) {
        list.append(make(documentRef, 'h3', group[1], 'privacy-data-group-title'));
        const filtered = snapshot.surfaces.filter(function (item) {
          return item.group === group[0] && (!query || (item.label + ' ' + item.description).toLocaleLowerCase('tr-TR').includes(query)) && (!onlyPresent.checked || item.present);
        }).sort(function (a, b) { return sort.value === 'size' ? b.bytes - a.bytes : a.label.localeCompare(b.label, 'tr'); });
        filtered.forEach(function (surface) {
          const row = make(documentRef, 'article', undefined, 'privacy-data-row');
          row.dataset.privacySurface = surface.id;
          const copy = make(documentRef, 'div', undefined, 'privacy-data-copy');
          copy.append(make(documentRef, 'strong', surface.label), make(documentRef, 'small', surface.description));
          copy.append(make(documentRef, 'span', surface.present ? String(surface.keys) + ' alan · ' + formatBytes(surface.bytes) : 'Veri yok', 'privacy-data-meta'));
          const rowActions = make(documentRef, 'div', undefined, 'privacy-data-row-actions');
          const wipe = button(documentRef, surface.present ? 'Temizle' : 'Boş');
          wipe.disabled = !surface.present;
          wipe.dataset.privacyClear = surface.id;
          wipe.setAttribute('aria-label', surface.label + ' yerel verisini temizle');
          const copySurface = button(documentRef, 'Kopyala');
          copySurface.disabled = !surface.present;
          copySurface.dataset.privacyCopySurface = surface.id;
          copySurface.setAttribute('aria-label', surface.label + ' özetini kopyala');
          rowActions.append(wipe, copySurface);
          row.append(copy, rowActions);
          list.append(row);
        });
      });
      if (snapshot.unknownKeys) list.append(make(documentRef, 'div', String(snapshot.unknownKeys) + ' tanınmayan localStorage alanı kapsam dışında tutuldu.', 'privacy-data-unknown'));
      renderVersion += 1;
    }

    async function refreshEstimate() {
      const token = ++renderVersion;
      estimate = await storageEstimate(rootRef);
      if (!destroyed && token === renderVersion) render();
    }

    async function reportPayload() {
      return privacyReport(inspectStorage(rootRef.localStorage), estimate);
    }

    async function downloadReport() {
      const payload = await reportPayload();
      try {
        const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
        const url = rootRef.URL.createObjectURL(blob);
        const link = make(documentRef, 'a');
        link.href = url;
        link.download = 'hafize-privacy-report.json';
        link.click();
        rootRef.setTimeout?.(function () { rootRef.URL.revokeObjectURL(url); }, 0);
        setStatus('İçerik içermeyen gizlilik raporu oluşturuldu.');
      } catch { setStatus('Gizlilik raporu oluşturulamadı.'); }
    }

    function clearOne(id) {
      const surface = surfaceMap.get(id);
      if (!surface || !rootRef.confirm?.(surface.label + ' yerel verisi silinsin mi? Bu işlem geri alınamaz.')) return;
      const result = clearSurface(id, rootRef.localStorage);
      announce(rootRef, { action: 'clear-surface', id: id, removed: result.removed });
      setStatus(result.ok ? String(result.removed) + ' alan temizlendi.' : 'Bazı yerel alanlar temizlenemedi.');
      render();
      void refreshEstimate();
    }

    on(refresh, 'click', function () { render(); void refreshEstimate(); setStatus('Yerel veri özeti yenilendi.'); });
    on(filter, 'input', function () { render(); });
    on(sort, 'change', function () { render(); });
    on(onlyPresent, 'change', function () { render(); });
    on(report, 'click', function () { void downloadReport(); });
    on(copySummary, 'click', async function () {
      try {
        await rootRef.navigator?.clipboard?.writeText?.(privacySummary(inspectStorage(rootRef.localStorage), estimate));
        setStatus('İçeriksiz yerel veri özeti panoya kopyalandı.');
      } catch { setStatus('Yerel veri özeti panoya kopyalanamadı.'); }
    });
    on(copyReport, 'click', async function () {
      try {
        const payload = await reportPayload();
        await rootRef.navigator?.clipboard?.writeText?.(payload);
        setStatus('İçerik içermeyen gizlilik raporu panoya kopyalandı.');
      } catch { setStatus('Gizlilik raporu panoya kopyalanamadı.'); }
    });
    on(clearPreferences, 'click', function () {
      if (!rootRef.confirm?.('Tema, hareket, filtre ve diğer bilinen tercih verileri sıfırlansın mı? Kullanıcı verileri korunur.')) return;
      const result = clearByGroup('preference', rootRef.localStorage);
      announce(rootRef, { action: 'clear-preferences', removed: result.removed });
      setStatus(result.ok ? String(result.removed) + ' tercih alanı sıfırlandı.' : 'Bazı tercih alanları sıfırlanamadı.');
      render();
      void refreshEstimate();
    });
    on(clearData, 'click', function () {
      if (!rootRef.confirm?.('Kullanıcı verisi yüzeyleri temizlensin mi? Tercihler korunur.')) return;
      const result = clearByGroup('data', rootRef.localStorage);
      announce(rootRef, { action: 'clear-data-surfaces', removed: result.removed });
      setStatus(result.ok ? String(result.removed) + ' veri alanı temizlendi.' : 'Bazı veri alanları temizlenemedi.');
      render();
      void refreshEstimate();
    });
    on(clearAll, 'click', function () {
      if (!rootRef.confirm?.('Bilinen tüm Hafize yerel verileri ve tercihleri temizlensin mi? Tanınmayan alanlar korunacaktır.')) return;
      const typed = rootRef.prompt?.('Onay için TEMIZLE yaz:');
      if (String(typed || '').trim().toLocaleUpperCase('tr-TR') !== 'TEMIZLE') return setStatus('Toplu temizleme iptal edildi.');
      const result = clearAllKnown(rootRef.localStorage);
      announce(rootRef, { action: 'clear-all-known', removed: result.removed });
      setStatus(result.ok ? String(result.removed) + ' bilinen alan temizlendi.' : 'Bazı alanlar temizlenemedi.');
      render();
      void refreshEstimate();
    });
    on(list, 'click', function (event) {
      const target = event.target?.closest?.('[data-privacy-clear]');
      if (target) return clearOne(target.dataset.privacyClear);
      const copyTarget = event.target?.closest?.('[data-privacy-copy-surface]');
      if (!copyTarget) return;
      const surface = inspectStorage(rootRef.localStorage).surfaces.find(function (item) { return item.id === copyTarget.dataset.privacyCopySurface; });
      if (!surface) return;
      rootRef.navigator?.clipboard?.writeText?.(surfaceSummary(surface)).then(function () {
        setStatus('Yüzey özeti panoya kopyalandı.');
      }).catch(function () { setStatus('Yüzey özeti panoya kopyalanamadı.'); });
    });
    on(rootRef, 'storage', function (event) {
      if (event.key === null || classifyKey(event.key)) { render(); void refreshEstimate(); }
    });
    on(rootRef, CHANGE_EVENT, function () { render(); void refreshEstimate(); });
    on(documentRef, 'keydown', function (event) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== SHORTCUT) return;
      const active = documentRef.activeElement;
      if (active?.closest?.('input,textarea,select,button,[contenteditable="true"]')) return;
      event.preventDefault();
      panel.scrollIntoView({ block: 'nearest' });
      refresh.focus();
    });
    on(collapse, 'click', function () {
      collapsed = !collapsed;
      body.hidden = collapsed;
      collapse.textContent = collapsed ? 'Göster' : 'Gizle';
      collapse.setAttribute('aria-expanded', String(!collapsed));
    });

    render();
    void refreshEstimate();

    return Object.freeze({
      mounted: true,
      inspect: function () { return inspectStorage(rootRef.localStorage); },
      clearSurface: function (id) { return clearSurface(id, rootRef.localStorage); },
      clearDataSurfaces: function () { return clearByGroup('data', rootRef.localStorage); },
      clearPreferences: function () { return clearByGroup('preference', rootRef.localStorage); },
      clearAllKnown: function () { return clearAllKnown(rootRef.localStorage); },
      privacyReport: function () { return privacyReport(inspectStorage(rootRef.localStorage), estimate); },
      destroy: function () { destroyed = true; listeners.splice(0).forEach(function (off) { off(); }); panel.remove(); }
    });
  }

  function announce(rootRef, detail) {
    try { rootRef.dispatchEvent?.(new CustomEvent(CHANGE_EVENT, { detail: detail })); } catch {}
  }

  root.HafizePrivacyCenter = Object.freeze({
    SURFACES: SURFACES,
    formatBytes: formatBytes,
    classifyKey: classifyKey,
    inspectStorage: inspectStorage,
    storageEstimate: storageEstimate,
    clearSurface: clearSurface,
    clearDataSurfaces: function (storage) { return clearByGroup('data', storage); },
    clearPreferences: function (storage) { return clearByGroup('preference', storage); },
    clearAllKnown: clearAllKnown,
    surfaceSummary: surfaceSummary,
    privacySummary: privacySummary,
    privacyReport: privacyReport,
    mount: mount
  });

  const start = function () { if (root.document) mount(root.document, root); };
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
