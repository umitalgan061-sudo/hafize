(function exposeHafizeLocalDataCenter(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeLocalDataCenter = api;
    const mount = () => api.mount(root.document, root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeLocalDataCenter() {
  'use strict';

  const CENTER_ID = 'localDataCenter';
  const SETTINGS_ID = 'settingsWorkspace';
  const MAX_READ = 1_500_000;
  const MAX_MANIFEST = 250_000;
  const MAX_PREVIEW = 120;
  const APP_PREFIX = 'hafize.';

  const STORES = Object.freeze([
    Object.freeze({ id: 'conversations', key: 'hafize.conversations.v1', label: 'Sohbetler', description: 'Yerel sohbet geçmişi ve mesajlar.', clearGroup: 'conversation' }),
    Object.freeze({ id: 'drafts', key: 'hafize.chat-drafts.v1', label: 'Taslaklar', description: 'Gönderilmemiş sohbet taslakları.', clearGroup: 'draft' }),
    Object.freeze({ id: 'prompt-library', key: 'hafize.prompt-library.v1', label: 'İstem kütüphanesi', description: 'Kaydedilmiş istemler ve kullanım sayıları.', clearGroup: 'prompt' }),
    Object.freeze({ id: 'prompt-library-state', key: 'hafize.prompt-library.v1.state', label: 'İstem filtreleri', description: 'İstem kütüphanesi arama ve filtre tercihleri.', clearGroup: 'prompt' }),
    Object.freeze({ id: 'composer-history', key: 'hafize.composer-history.v1', label: 'Composer geçmişi', description: 'Daha önce gönderilmiş composer metinleri.', clearGroup: 'history' }),
    Object.freeze({ id: 'composer-history-settings', key: 'hafize.composer-history.settings.v1', label: 'Composer geçmiş ayarları', description: 'Composer geçmişi retention ve opt-out tercihleri.', clearGroup: 'history' }),
    Object.freeze({ id: 'theme', key: 'hafize.theme.v1', label: 'Tema tercihi', description: 'Açık/koyu tema tercihi.', clearGroup: 'preference' }),
    Object.freeze({ id: 'reduced-motion', key: 'hafize.reduced-motion.v1', label: 'Hareket tercihi', description: 'Azaltılmış hareket tercihi.', clearGroup: 'preference' })
  ]);

  const KNOWN_KEYS = new Set(STORES.map((store) => store.key));

  function safeStorage(rootRef = globalThis) {
    try { return rootRef.localStorage || null; } catch { return null; }
  }

  function safeGet(storage, key) {
    try {
      const value = storage?.getItem?.(key);
      if (typeof value !== 'string') return { present: false, raw: '' };
      return { present: true, raw: value.slice(0, MAX_READ), truncated: value.length > MAX_READ };
    } catch {
      return { present: false, raw: '', unavailable: true };
    }
  }

  function safeJson(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function utf8Bytes(value) {
    try { return new TextEncoder().encode(String(value)).byteLength; }
    catch { return unescape(encodeURIComponent(String(value))).length; }
  }

  function countValue(value) {
    if (Array.isArray(value)) return `${value.length} kayıt`;
    if (value && typeof value === 'object') return `${Object.keys(value).length} alan`;
    if (typeof value === 'string') return value ? '1 değer' : '0 değer';
    if (value === null || value === undefined) return 'boş';
    return '1 değer';
  }

  function previewValue(value) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PREVIEW);
  }

  function inspectStore(store, storage) {
    const result = safeGet(storage, store.key);
    const parsed = result.present && !result.truncated ? safeJson(result.raw) : null;
    return Object.freeze({
      id: store.id,
      key: store.key,
      label: store.label,
      description: store.description,
      present: result.present,
      unavailable: result.unavailable === true,
      truncated: result.truncated === true,
      chars: result.present ? result.raw.length : 0,
      bytes: result.present ? utf8Bytes(result.raw) : 0,
      count: parsed === null ? (result.present ? 'okunamadı' : '—') : countValue(parsed),
      preview: parsed === null ? '' : previewValue(parsed)
    });
  }

  function inspect(storage = safeStorage()) {
    return STORES.map((store) => inspectStore(store, storage));
  }

  function totalBytes(snapshot) {
    return snapshot.reduce((sum, item) => sum + item.bytes, 0);
  }

  function appKeys(storage) {
    const keys = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (typeof key === 'string' && key.startsWith(APP_PREFIX)) keys.push(key);
      }
    } catch {}
    return keys.sort();
  }

  function unknownKeys(storage) {
    return appKeys(storage).filter((key) => !KNOWN_KEYS.has(key));
  }

  function removeKey(storage, key) {
    if (!KNOWN_KEYS.has(key)) return { ok: false, reason: 'unknown-key' };
    try { storage?.removeItem?.(key); return { ok: true, key }; }
    catch { return { ok: false, reason: 'storage-error', key }; }
  }

  function clearStore(id, storage = safeStorage()) {
    const store = STORES.find((candidate) => candidate.id === id);
    if (!store) return Object.freeze({ ok: false, reason: 'unknown-store' });
    return Object.freeze(removeKey(storage, store.key));
  }

  function clearStores(ids, storage = safeStorage()) {
    const unique = [...new Set(Array.isArray(ids) ? ids : [])];
    const results = unique.map((id) => ({ id, ...clearStore(id, storage) }));
    return Object.freeze({ ok: results.every((item) => item.ok), results });
  }

  function clearAllKnown(storage = safeStorage()) {
    return clearStores(STORES.map((store) => store.id), storage);
  }

  function buildManifest(snapshot, unknown) {
    const manifest = {
      version: 1,
      source: 'hafize-local-data-center',
      exportedAt: new Date().toISOString(),
      stores: snapshot.map((item) => ({ id: item.id, key: item.key, label: item.label, present: item.present, chars: item.chars, bytes: item.bytes, count: item.count })),
      summary: { totalStores: snapshot.length, presentStores: snapshot.filter((item) => item.present).length, totalBytes: totalBytes(snapshot) },
      unmanagedHafizeKeys: unknown.slice(0, 40)
    };
    return JSON.stringify(manifest, null, 2).slice(0, MAX_MANIFEST);
  }

  function downloadManifest(documentRef, rootRef, snapshot, unknown) {
    if (!documentRef || !rootRef?.URL || !rootRef.Blob) return false;
    const payload = buildManifest(snapshot, unknown);
    const blob = new rootRef.Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = rootRef.URL.createObjectURL(blob);
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = 'hafize-local-data-manifest.json';
    link.rel = 'noopener';
    link.click();
    rootRef.setTimeout?.(() => rootRef.URL.revokeObjectURL(url), 0);
    return true;
  }

  function button(documentRef, label, className = 'soft-btn') {
    const node = documentRef.createElement('button');
    node.type = 'button'; node.className = className; node.textContent = label;
    return node;
  }

  function makeRow(documentRef, item) {
    const row = documentRef.createElement('article');
    row.className = 'local-data-row';
    row.dataset.localDataId = item.id;
    row.setAttribute('role', 'listitem');
    const copy = documentRef.createElement('div'); copy.className = 'local-data-copy';
    const title = documentRef.createElement('strong'); title.textContent = item.label;
    const description = documentRef.createElement('p'); description.textContent = item.description;
    const meta = documentRef.createElement('small'); meta.textContent = item.present ? `${item.count} · ${item.bytes.toLocaleString('tr-TR')} B` : 'Kayıt yok';
    copy.append(title, description, meta);
    const actions = documentRef.createElement('div'); actions.className = 'local-data-row-actions';
    const clear = button(documentRef, 'Sil', 'mini-btn'); clear.dataset.localDataAction = 'clear';
    clear.setAttribute('aria-label', `${item.label} verisini sil`);
    clear.disabled = !item.present;
    actions.append(clear);
    row.append(copy, actions);
    return row;
  }

  function mount(documentRef = globalThis.document, rootRef = globalThis) {
    const settings = documentRef?.getElementById?.(SETTINGS_ID);
    if (!documentRef || !settings || documentRef.getElementById(CENTER_ID)) return null;
    const storage = safeStorage(rootRef);
    const section = documentRef.createElement('section');
    section.id = CENTER_ID;
    section.className = 'settings-panel local-data-center';
    section.setAttribute('aria-labelledby', 'localDataCenterTitle');
    const heading = documentRef.createElement('h2'); heading.id = 'localDataCenterTitle'; heading.textContent = 'Yerel veri merkezi';
    const intro = documentRef.createElement('p'); intro.textContent = 'Hafize’nin cihazda tuttuğu uygulama verilerini gör, hangi alanın ne kadar yer kullandığını incele ve kayıtları açıkça yönet.';
    const privacy = documentRef.createElement('div'); privacy.className = 'local-data-privacy';
    privacy.append(
      (() => { const s = documentRef.createElement('strong'); s.textContent = 'Gizlilik sınırı'; return s; })(),
      (() => { const p = documentRef.createElement('p'); p.textContent = 'Yalnız aşağıda açıkça listelenen Hafize anahtarları yönetilir. Bilinmeyen `hafize.*` anahtarları silinmez.'; return p; })()
    );

    const summary = documentRef.createElement('div'); summary.className = 'local-data-summary'; summary.setAttribute('aria-live', 'polite');
    const list = documentRef.createElement('div'); list.className = 'local-data-list'; list.setAttribute('role', 'list');
    const actions = documentRef.createElement('div'); actions.className = 'local-data-actions';
    const refresh = button(documentRef, 'Özeti yenile');
    const manifest = button(documentRef, 'Veri manifestini indir');
    const clearAll = button(documentRef, 'Yönetilen verileri temizle', 'soft-btn local-data-danger');
    actions.append(refresh, manifest, clearAll);
    const unmanaged = documentRef.createElement('p'); unmanaged.className = 'local-data-unmanaged';
    section.append(heading, intro, privacy, summary, list, actions, unmanaged);
    settings.append(section);

    let destroyed = false;
    const listeners = [];
    const on = (target, type, handler) => { target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler)); };
    const report = (message) => { summary.textContent = String(message).slice(0, 220); };

    function render(message = '') {
      if (destroyed) return;
      const snapshot = inspect(storage);
      const unknown = unknownKeys(storage);
      summary.textContent = message || `${snapshot.filter((item) => item.present).length}/${snapshot.length} yönetilen alan · ${totalBytes(snapshot).toLocaleString('tr-TR')} B`;
      list.replaceChildren();
      snapshot.forEach((item) => list.append(makeRow(documentRef, item)));
      unmanaged.textContent = unknown.length ? `${unknown.length} yönetilmeyen Hafize anahtarı algılandı; bunlara dokunulmadı.` : 'Yönetilmeyen Hafize anahtarı bulunamadı.';
      clearAll.disabled = !snapshot.some((item) => item.present);
    }

    function clearOne(event) {
      const row = event.target?.closest?.('[data-local-data-action="clear"]')?.closest?.('.local-data-row');
      const id = row?.dataset?.localDataId;
      const item = STORES.find((candidate) => candidate.id === id);
      if (!item || !storage) return;
      if (!rootRef.confirm?.(`${item.label} verisi silinsin mi?`)) return;
      const result = clearStore(id, storage);
      render(result.ok ? `${item.label} verisi silindi.` : 'Yerel veri silinemedi.');
    }

    function clearEverything() {
      if (!storage) return report('Yerel depolama kullanılamıyor.');
      if (!rootRef.confirm?.('Hafize’nin yönetilen yerel verileri silinsin mi? Bu işlem geri alınamaz.')) return;
      const result = clearAllKnown(storage);
      render(result.ok ? 'Yönetilen yerel veriler temizlendi.' : 'Bazı yerel veriler temizlenemedi.');
    }

    on(list, 'click', clearOne);
    on(refresh, 'click', () => render('Yerel veri özeti yenilendi.'));
    on(manifest, 'click', () => {
      const snapshot = inspect(storage); const unknown = unknownKeys(storage);
      render(downloadManifest(documentRef, rootRef, snapshot, unknown) ? 'Yalnız veri metadatasını içeren manifest hazırlandı.' : 'Manifest indirilemedi.');
    });
    on(clearAll, 'click', clearEverything);
    on(rootRef, 'storage', (event) => {
      if (event.key === null || KNOWN_KEYS.has(event.key)) render('Başka bir sekmedeki değişiklik algılandı.');
    });
    on(documentRef, 'keydown', (event) => {
      if (!event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'd') return;
      event.preventDefault();
      section.focus();
    });

    render();
    return Object.freeze({ mounted: true, inspect: () => inspect(storage), clear: (id) => clearStore(id, storage), clearAll: () => clearAllKnown(storage), destroy: () => { destroyed = true; listeners.splice(0).forEach((off) => off()); section.remove(); } });
  }

  return Object.freeze({ CENTER_ID, STORES, KNOWN_KEYS, inspect, totalBytes, unknownKeys, clearStore, clearStores, clearAllKnown, buildManifest, mount });
});
