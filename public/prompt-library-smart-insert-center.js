(function installPromptSmartInsertCenter(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const CENTER_ID = 'promptLibrarySmartInsertCenter';
  const PROFILE_KEY = 'hafize.prompt-library.variable-profiles.v1';
  const MAX_PROFILES = 24;
  const MAX_PROFILE_NAME = 60;
  const MAX_VARIABLES = 12;
  const MAX_VARIABLE = 32;
  const MAX_VALUE = 1000;
  const MAX_QUERY = 80;
  const SORTS = Object.freeze(['recent', 'name', 'favorite']);
  const STATE_KEY = `${PROFILE_KEY}.ui`;
  let mounted = false;
  let observer = null;

  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (label, action) => {
    const node = make('button', label, 'mini-btn prompt-profile-center-action');
    node.type = 'button';
    node.dataset.profileCenterAction = action;
    node.setAttribute('aria-label', label);
    return node;
  };
  const cleanName = (value) => String(value ?? '').replace(/\0/g, '').trim().slice(0, MAX_PROFILE_NAME);
  const cleanValue = (value) => String(value ?? '').replace(/\0/g, '').slice(0, MAX_VALUE);
  const profileId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = cleanName(raw.name);
    if (!name) return null;
    const values = Object.create(null);
    let count = 0;
    for (const [rawKey, rawValue] of Object.entries(raw.values && typeof raw.values === 'object' ? raw.values : {})) {
      const key = String(rawKey).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_VARIABLE);
      if (!key || count >= MAX_VARIABLES) continue;
      values[key] = cleanValue(rawValue);
      count += 1;
    }
    return {
      id: String(raw.id || profileId()).slice(0, 120),
      name,
      values,
      favorite: raw.favorite === true,
      updatedAt: String(raw.updatedAt || new Date().toISOString()).slice(0, 40)
    };
  }

  function normalizeProfiles(raw) {
    if (!Array.isArray(raw)) return [];
    const result = [];
    const seen = new Set();
    for (const rawProfile of raw.slice(0, MAX_PROFILES * 2)) {
      const profile = normalizeProfile(rawProfile);
      if (!profile || seen.has(profile.id)) continue;
      seen.add(profile.id);
      result.push(profile);
      if (result.length >= MAX_PROFILES) break;
    }
    return result;
  }

  function loadProfiles() {
    try {
      return normalizeProfiles(JSON.parse(root.localStorage?.getItem(PROFILE_KEY) || '[]'));
    } catch {
      return [];
    }
  }

  function saveProfiles(profiles) {
    const normalized = normalizeProfiles(profiles);
    try {
      root.localStorage?.setItem(PROFILE_KEY, JSON.stringify(normalized));
      root.dispatchEvent?.(new Event('hafize:prompt-library-variable-profiles-changed'));
      return true;
    } catch {
      return false;
    }
  }

  function loadState() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STATE_KEY) || '{}');
      return {
        query: String(value.query || '').slice(0, MAX_QUERY),
        sort: SORTS.includes(value.sort) ? value.sort : 'recent'
      };
    } catch {
      return { query: '', sort: 'recent' };
    }
  }

  function saveState(state) {
    try {
      root.localStorage?.setItem(STATE_KEY, JSON.stringify({ query: String(state.query || '').slice(0, MAX_QUERY), sort: SORTS.includes(state.sort) ? state.sort : 'recent' }));
    } catch {
      // UI state is disposable; profile records remain unaffected.
    }
  }

  function matches(profile, state) {
    if (!state.query) return true;
    const query = state.query.toLocaleLowerCase('tr-TR');
    return [profile.name, ...Object.keys(profile.values)].join(' ').toLocaleLowerCase('tr-TR').includes(query);
  }

  function sortProfiles(profiles, sort) {
    const result = profiles.slice();
    if (sort === 'name') return result.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    if (sort === 'favorite') return result.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
    return result.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
  }

  function download(text, filename) {
    try {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = make('a');
      link.href = url;
      link.download = filename;
      link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0);
      return true;
    } catch {
      return false;
    }
  }

  function report(message) {
    const status = root.document?.querySelector?.(`#${CENTER_ID} .prompt-profile-center-status`);
    if (status) status.textContent = String(message || '').slice(0, 180);
  }

  function promptName(initial = '') {
    return cleanName(root.prompt?.('Profil adı:', initial) ?? '');
  }

  function profileSummary(profile) {
    const keys = Object.keys(profile.values);
    return keys.length ? `${keys.length} değişken · ${keys.slice(0, 3).join(', ')}` : 'Değişken değeri yok';
  }

  function openProfile(profile) {
    const api = root.HafizePromptLibrarySmartInsert;
    const library = root.HafizePromptLibrary;
    const items = library?.loadItems?.(root.localStorage) || [];
    const candidate = items.find((item) => (item.variables || []).length > 0) || items.find((item) => /\{\{[^}]+\}\}/.test(item.body || ''));
    if (!candidate || !api?.open) return report('Bu profil için değişkenli bir istem bulunamadı.');
    report(`${profile.name} profili seçildi; değişkenli istemlerden birini açmak için Prompt Library içindeki Akıllı doldur düğmesini kullan.`);
  }

  function duplicateProfile(profile) {
    const profiles = loadProfiles();
    if (profiles.length >= MAX_PROFILES) return report('Profil sınırı dolu.');
    const copy = normalizeProfile({ ...profile, id: profileId(), name: `${profile.name} kopyası`, favorite: false, updatedAt: new Date().toISOString() });
    if (!copy || !saveProfiles([copy, ...profiles])) return report('Profil çoğaltılamadı.');
    report('Profil çoğaltıldı.');
  }

  function renameProfile(profile) {
    const name = promptName(profile.name);
    if (!name || name.toLocaleLowerCase('tr-TR') === profile.name.toLocaleLowerCase('tr-TR')) return;
    const profiles = loadProfiles();
    if (profiles.some((item) => item.id !== profile.id && item.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) return report('Bu isimde bir profil zaten var.');
    const next = profiles.map((item) => item.id === profile.id ? normalizeProfile({ ...item, name, updatedAt: new Date().toISOString() }) : item);
    if (!saveProfiles(next)) return report('Profil yeniden adlandırılamadı.');
    report('Profil yeniden adlandırıldı.');
  }

  function toggleFavorite(profile) {
    const profiles = loadProfiles();
    const next = profiles.map((item) => item.id === profile.id ? normalizeProfile({ ...item, favorite: !item.favorite, updatedAt: new Date().toISOString() }) : item);
    if (!saveProfiles(next)) return report('Profil favorisi güncellenemedi.');
  }

  function removeProfile(profile) {
    if (!root.confirm?.(`“${profile.name}” profili silinsin mi?`)) return;
    if (!saveProfiles(loadProfiles().filter((item) => item.id !== profile.id))) return report('Profil silinemedi.');
    report('Profil silindi.');
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 300000) return report('Profil yedeği 300 KB sınırını aşamaz.');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const incoming = Array.isArray(parsed) ? parsed : parsed?.profiles;
        const existing = loadProfiles();
        const byName = new Map(existing.map((item) => [item.name.toLocaleLowerCase('tr-TR'), item]));
        const merged = existing.slice();
        for (const candidate of normalizeProfiles(incoming)) {
          const key = candidate.name.toLocaleLowerCase('tr-TR');
          const current = byName.get(key);
          if (current) {
            const index = merged.findIndex((item) => item.id === current.id);
            const combined = normalizeProfile({ ...current, values: { ...current.values, ...candidate.values }, favorite: current.favorite || candidate.favorite, updatedAt: new Date().toISOString() });
            if (index >= 0) merged.splice(index, 1, combined);
          } else if (merged.length < MAX_PROFILES) {
            const copy = normalizeProfile({ ...candidate, id: profileId() });
            if (copy) { merged.push(copy); byName.set(key, copy); }
          }
        }
        if (!saveProfiles(merged)) return report('Profil yedeği kaydedilemedi.');
        report('Profil yedeği içe aktarıldı.');
      } catch {
        report('Geçersiz profil yedeği.');
      }
    };
    reader.onerror = () => report('Profil yedeği okunamadı.');
    reader.readAsText(file);
  }

  function exportAll() {
    const payload = JSON.stringify({ version: 2, source: 'hafize-prompt-variable-profiles', exportedAt: new Date().toISOString(), profiles: loadProfiles() }, null, 2);
    report(download(payload, 'hafize-variable-profiles.json') ? 'Profil yedeği dışa aktarıldı.' : 'Profil yedeği oluşturulamadı.');
  }

  function handleAction(event) {
    const target = event.target?.closest?.('[data-profile-center-action]');
    if (!target) return;
    const card = root.document.getElementById(CENTER_ID);
    const profileIdValue = target.closest('[data-profile-id]')?.dataset.profileId;
    const profile = profileIdValue ? loadProfiles().find((item) => item.id === profileIdValue) : null;
    switch (target.dataset.profileCenterAction) {
      case 'favorite': if (profile) toggleFavorite(profile); break;
      case 'duplicate': if (profile) duplicateProfile(profile); break;
      case 'rename': if (profile) renameProfile(profile); break;
      case 'delete': if (profile) removeProfile(profile); break;
      case 'open': if (profile) openProfile(profile); break;
      case 'new': {
        const name = promptName();
        if (!name) break;
        if (loadProfiles().length >= MAX_PROFILES) return report('Profil sınırı dolu.');
        const next = normalizeProfile({ id: profileId(), name, values: {}, updatedAt: new Date().toISOString() });
        saveProfiles([next, ...loadProfiles()]);
        report('Yeni profil oluşturuldu; değerleri Smart Insert içinde doldurabilirsiniz.');
        break;
      }
      case 'export': exportAll(); break;
      case 'import': card?.querySelector('[data-profile-center-file]')?.click(); break;
      case 'clear-search': {
        const input = card?.querySelector('[data-profile-center-search]');
        if (input) input.value = '';
        const state = loadState(); state.query = ''; saveState(state); render();
        break;
      }
      default: break;
    }
  }

  function renderProfile(profile) {
    const row = make('article', undefined, 'prompt-profile-center-row');
    row.dataset.profileId = profile.id;
    const title = make('strong', profile.name, 'prompt-profile-center-name');
    const meta = make('div', profileSummary(profile), 'prompt-profile-center-meta');
    const actions = make('div', undefined, 'prompt-profile-center-row-actions');
    actions.append(
      button('Aç', 'open'),
      button(profile.favorite ? '★' : '☆', 'favorite'),
      button('Çoğalt', 'duplicate'),
      button('Adlandır', 'rename'),
      button('Sil', 'delete')
    );
    row.append(title, meta, actions);
    return row;
  }

  function render() {
    const center = root.document.getElementById(CENTER_ID);
    if (!center) return;
    const state = loadState();
    center.replaceChildren();
    const head = make('div', undefined, 'prompt-profile-center-head');
    const title = make('strong', 'Değişken profilleri', 'prompt-profile-center-title');
    const count = make('span', '', 'prompt-profile-center-count');
    head.append(title, count);
    const toolbar = make('div', undefined, 'prompt-profile-center-toolbar');
    const search = root.document.createElement('input');
    search.type = 'search'; search.value = state.query; search.maxLength = MAX_QUERY; search.placeholder = 'Profil ara…';
    search.dataset.profileCenterSearch = 'true'; search.setAttribute('aria-label', 'Değişken profillerinde ara');
    const sort = root.document.createElement('select'); sort.setAttribute('aria-label', 'Profilleri sırala');
    for (const [value, label] of [['recent', 'Son güncellenen'], ['favorite', 'Favoriler'], ['name', 'Ada göre']]) { const option = make('option', label); option.value = value; sort.append(option); }
    sort.value = state.sort;
    const newButton = button('＋ Yeni profil', 'new');
    const importButton = button('İçe aktar', 'import');
    const exportButton = button('Dışa aktar', 'export');
    toolbar.append(search, sort, newButton, importButton, exportButton);
    const list = make('div', undefined, 'prompt-profile-center-list'); list.setAttribute('role', 'list');
    const filtered = sortProfiles(loadProfiles().filter((profile) => matches(profile, state)), state.sort);
    count.textContent = `${filtered.length}/${loadProfiles().length}`;
    if (!filtered.length) list.append(make('div', 'Kayıtlı değişken profili yok.', 'prompt-profile-center-empty'));
    else filtered.forEach((profile) => list.append(renderProfile(profile)));
    const file = root.document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.dataset.profileCenterFile = 'true';
    const status = make('div', '', 'prompt-profile-center-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    center.append(head, toolbar, list, file, status);

    search.addEventListener('input', () => { const next = loadState(); next.query = String(search.value).slice(0, MAX_QUERY); saveState(next); render(); requestAnimationFrame?.(() => center.querySelector('[data-profile-center-search]')?.focus()); });
    sort.addEventListener('change', () => { const next = loadState(); next.sort = sort.value; saveState(next); render(); });
    file.addEventListener('change', () => { const selected = file.files?.[0]; file.value = ''; importFile(selected); });
    center.addEventListener('click', handleAction, { once: true });
  }

  function mount() {
    if (mounted || !root.document) return;
    const card = root.document.getElementById(CARD_ID);
    if (!card) return;
    const section = make('section', undefined, 'prompt-profile-center');
    section.id = CENTER_ID;
    section.setAttribute('aria-labelledby', 'promptProfileCenterTitle');
    card.append(section);
    mounted = true;
    render();
    root.addEventListener?.('hafize:prompt-library-variable-profiles-changed', render);
    observer = root.MutationObserver ? new root.MutationObserver(() => { if (root.document.getElementById(CENTER_ID)) render(); }) : null;
    observer?.observe(card, { childList: true, subtree: true });
    root.addEventListener?.('beforeunload', () => observer?.disconnect?.(), { once: true });
  }

  const api = Object.freeze({ PROFILE_KEY, STATE_KEY, limits: Object.freeze({ MAX_PROFILES, MAX_PROFILE_NAME, MAX_VARIABLES, MAX_VARIABLE, MAX_VALUE, MAX_QUERY }), normalizeProfile, normalizeProfiles, loadProfiles, saveProfiles, loadState, saveState, matches, sortProfiles, mount, render });
  root.HafizePromptLibrarySmartInsertCenter = api;

  const start = () => mount();
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
