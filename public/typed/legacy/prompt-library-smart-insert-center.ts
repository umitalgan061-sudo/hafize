(function installPromptSmartInsertCenter(root) {
  'use strict';
  const CARD_ID = 'promptLibraryCard';
  const CENTER_ID = 'promptLibrarySmartInsertCenter';
  const PROFILE_KEY = 'hafize.prompt-library.variable-profiles.v1';
  const STATE_KEY = `${PROFILE_KEY}.center-state`;
  const MAX_PROFILES = 24;
  const MAX_PROFILE_NAME = 60;
  const MAX_VARIABLES = 12;
  const MAX_VARIABLE = 32;
  const MAX_VALUE = 1000;
  const MAX_QUERY = 80;
  const SORTS = Object.freeze(['recent', 'name', 'favorite']);
  let mounted = false;

  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const actionButton = (label, action) => {
    const node = make('button', label, 'mini-btn prompt-profile-center-action');
    node.type = 'button'; node.dataset.profileCenterAction = action; node.setAttribute('aria-label', label); return node;
  };
  const cleanName = (value) => String(value ?? '').replace(/\0/g, '').trim().slice(0, MAX_PROFILE_NAME);
  const cleanValue = (value) => String(value ?? '').replace(/\0/g, '').slice(0, MAX_VALUE);
  const newId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const keyForName = (value) => String(value || '').toLocaleLowerCase('tr-TR');

  function normalizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = cleanName(raw.name); if (!name) return null;
    const values = Object.create(null); let count = 0;
    for (const [rawKey, rawValue] of Object.entries(raw.values && typeof raw.values === 'object' ? raw.values : {})) {
      const key = String(rawKey).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_VARIABLE);
      if (!key || count >= MAX_VARIABLES) continue;
      values[key] = cleanValue(rawValue); count += 1;
    }
    return { id: String(raw.id || newId()).slice(0, 120), name, values, favorite: raw.favorite === true, updatedAt: String(raw.updatedAt || new Date().toISOString()).slice(0, 40) };
  }

  function normalizeProfiles(raw) {
    if (!Array.isArray(raw)) return [];
    const output = []; const ids = new Set();
    for (const candidate of raw.slice(0, MAX_PROFILES * 2)) {
      const profile = normalizeProfile(candidate);
      if (!profile || ids.has(profile.id)) continue;
      ids.add(profile.id); output.push(profile); if (output.length >= MAX_PROFILES) break;
    }
    return output;
  }

  function loadProfiles() {
    try { return normalizeProfiles(JSON.parse(root.localStorage?.getItem(PROFILE_KEY) || '[]')); } catch { return []; }
  }

  function saveProfiles(profiles) {
    try {
      root.localStorage?.setItem(PROFILE_KEY, JSON.stringify(normalizeProfiles(profiles)));
      root.dispatchEvent?.(new Event('hafize:prompt-library-variable-profiles-changed'));
      return true;
    } catch { return false; }
  }

  function loadState() {
    try {
      const value = JSON.parse(root.localStorage?.getItem(STATE_KEY) || '{}');
      return { query: String(value.query || '').slice(0, MAX_QUERY), sort: SORTS.includes(value.sort) ? value.sort : 'recent' };
    } catch { return { query: '', sort: 'recent' }; }
  }

  function saveState(next) {
    try { root.localStorage?.setItem(STATE_KEY, JSON.stringify({ query: String(next.query || '').slice(0, MAX_QUERY), sort: SORTS.includes(next.sort) ? next.sort : 'recent' })); } catch {}
  }

  function matches(profile, state) {
    if (!state.query) return true;
    const query = state.query.toLocaleLowerCase('tr-TR');
    return [profile.name, ...Object.keys(profile.values)].join(' ').toLocaleLowerCase('tr-TR').includes(query);
  }

  function sortProfiles(profiles, sort) {
    const output = profiles.slice();
    if (sort === 'name') return output.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return output.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
  }

  function report(message) {
    const status = root.document.querySelector(`#${CENTER_ID} .prompt-profile-center-status`);
    if (status) status.textContent = String(message || '').slice(0, 180);
  }

  function profileName(initial = '') { return cleanName(root.prompt?.('Profil adı:', initial) ?? ''); }

  function createProfile() {
    const profiles = loadProfiles();
    if (profiles.length >= MAX_PROFILES) return report('Profil sınırı dolu.');
    const name = profileName(); if (!name) return;
    if (profiles.some((profile) => keyForName(profile.name) === keyForName(name))) return report('Bu isimde bir profil zaten var.');
    const profile = normalizeProfile({ name, values: {}, favorite: false, updatedAt: new Date().toISOString() });
    if (profile && saveProfiles([profile, ...profiles])) report('Yeni profil oluşturuldu.');
  }

  function duplicateProfile(profile) {
    const profiles = loadProfiles();
    if (profiles.length >= MAX_PROFILES) return report('Profil sınırı dolu.');
    let name = `${profile.name} kopyası`; let index = 2;
    while (profiles.some((candidate) => keyForName(candidate.name) === keyForName(name))) name = `${profile.name} kopyası ${index++}`;
    const copy = normalizeProfile({ ...profile, id: newId(), name, favorite: false, updatedAt: new Date().toISOString() });
    if (!copy || !saveProfiles([copy, ...profiles])) return report('Profil çoğaltılamadı.');
    report('Profil çoğaltıldı.');
  }

  function renameProfile(profile) {
    const name = profileName(profile.name); if (!name || keyForName(name) === keyForName(profile.name)) return;
    const profiles = loadProfiles();
    if (profiles.some((candidate) => candidate.id !== profile.id && keyForName(candidate.name) === keyForName(name))) return report('Bu isimde bir profil zaten var.');
    const next = profiles.map((candidate) => candidate.id === profile.id ? normalizeProfile({ ...candidate, name, updatedAt: new Date().toISOString() }) : candidate);
    if (!saveProfiles(next)) return report('Profil yeniden adlandırılamadı.');
    report('Profil yeniden adlandırıldı.');
  }

  function toggleFavorite(profile) {
    const next = loadProfiles().map((candidate) => candidate.id === profile.id ? normalizeProfile({ ...candidate, favorite: !candidate.favorite, updatedAt: new Date().toISOString() }) : candidate);
    if (!saveProfiles(next)) report('Profil favorisi güncellenemedi.');
  }

  function deleteProfile(profile) {
    if (!root.confirm?.(`“${profile.name}” profili silinsin mi?`)) return;
    if (!saveProfiles(loadProfiles().filter((candidate) => candidate.id !== profile.id))) return report('Profil silinemedi.');
    report('Profil silindi.');
  }

  function importProfiles(file) {
    if (!file) return;
    if (file.size > 300000) return report('Profil yedeği 300 KB sınırını aşamaz.');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')); const incoming = normalizeProfiles(Array.isArray(parsed) ? parsed : parsed?.profiles);
        const current = loadProfiles(); const byName = new Map(current.map((profile) => [keyForName(profile.name), profile])); const result = current.slice();
        for (const candidate of incoming) {
          const existing = byName.get(keyForName(candidate.name));
          if (existing) {
            const index = result.findIndex((profile) => profile.id === existing.id);
            const merged = normalizeProfile({ ...existing, values: { ...existing.values, ...candidate.values }, favorite: existing.favorite || candidate.favorite, updatedAt: new Date().toISOString() });
            if (index >= 0) result.splice(index, 1, merged);
          } else if (result.length < MAX_PROFILES) {
            const next = normalizeProfile({ ...candidate, id: newId() }); if (next) { result.push(next); byName.set(keyForName(next.name), next); }
          }
        }
        if (!saveProfiles(result)) return report('Profil yedeği kaydedilemedi.');
        report(`${incoming.length} profil işlendi.`);
      } catch { report('Geçersiz profil yedeği.'); }
    };
    reader.onerror = () => report('Profil yedeği okunamadı.');
    reader.readAsText(file);
  }

  function exportProfiles() {
    try {
      const payload = JSON.stringify({ version: 2, source: 'hafize-prompt-variable-profiles', exportedAt: new Date().toISOString(), profiles: loadProfiles() }, null, 2);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob);
      const link = make('a'); link.href = url; link.download = 'hafize-variable-profiles.json'; link.click();
      root.setTimeout?.(() => URL.revokeObjectURL(url), 0); report('Profil yedeği dışa aktarıldı.');
    } catch { report('Profil yedeği oluşturulamadı.'); }
  }

  function handleAction(event) {
    const target = event.target?.closest?.('[data-profile-center-action]'); if (!target) return;
    const action = target.dataset.profileCenterAction;
    const profileId = target.closest('[data-profile-id]')?.dataset.profileId;
    const profile = profileId ? loadProfiles().find((candidate) => candidate.id === profileId) : null;
    if (action === 'new') return createProfile();
    if (action === 'favorite' && profile) return toggleFavorite(profile);
    if (action === 'duplicate' && profile) return duplicateProfile(profile);
    if (action === 'rename' && profile) return renameProfile(profile);
    if (action === 'delete' && profile) return deleteProfile(profile);
    if (action === 'import') return root.document.getElementById(CENTER_ID)?.querySelector('[data-profile-center-file]')?.click();
    if (action === 'export') return exportProfiles();
    if (action === 'clear-search') {
      const next = loadState(); next.query = ''; saveState(next); render();
    }
  }

  function rowFor(profile) {
    const row = make('article', undefined, 'prompt-profile-center-row'); row.dataset.profileId = profile.id; row.setAttribute('role', 'listitem');
    const name = make('strong', profile.name, 'prompt-profile-center-name');
    const keys = Object.keys(profile.values);
    const meta = make('span', keys.length ? `${keys.length} değişken` : 'Değişken değeri yok', 'prompt-profile-center-meta');
    const actions = make('div', undefined, 'prompt-profile-center-row-actions');
    actions.append(actionButton(profile.favorite ? '★' : '☆', 'favorite'), actionButton('Çoğalt', 'duplicate'), actionButton('Adlandır', 'rename'), actionButton('Sil', 'delete'));
    row.append(name, meta, actions); return row;
  }

  function render() {
    const center = root.document.getElementById(CENTER_ID); if (!center) return;
    const state = loadState(); const profiles = loadProfiles(); const filtered = sortProfiles(profiles.filter((profile) => matches(profile, state)), state.sort);
    center.replaceChildren();
    const heading = make('div', undefined, 'prompt-profile-center-head');
    heading.append(make('strong', 'Değişken profilleri', 'prompt-profile-center-title'), make('span', `${filtered.length}/${profiles.length}`, 'prompt-profile-center-count'));
    const toolbar = make('div', undefined, 'prompt-profile-center-toolbar');
    const search = root.document.createElement('input'); search.type = 'search'; search.value = state.query; search.maxLength = MAX_QUERY; search.placeholder = 'Profil ara…'; search.dataset.profileCenterSearch = 'true'; search.setAttribute('aria-label', 'Değişken profillerinde ara');
    const sort = root.document.createElement('select'); sort.setAttribute('aria-label', 'Profilleri sırala');
    for (const [value, label] of [['recent', 'Son güncellenen'], ['favorite', 'Favoriler'], ['name', 'Ada göre']]) { const option = make('option', label); option.value = value; sort.append(option); }
    sort.value = state.sort; toolbar.append(search, sort, actionButton('＋ Yeni profil', 'new'), actionButton('İçe aktar', 'import'), actionButton('Dışa aktar', 'export'));
    const list = make('div', undefined, 'prompt-profile-center-list'); list.setAttribute('role', 'list');
    if (!filtered.length) list.append(make('div', 'Kayıtlı değişken profili yok.', 'prompt-profile-center-empty')); else filtered.forEach((profile) => list.append(rowFor(profile)));
    const file = root.document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.dataset.profileCenterFile = 'true';
    const status = make('div', '', 'prompt-profile-center-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    center.append(heading, toolbar, list, file, status);
    center.addEventListener('click', handleAction);
    search.addEventListener('input', () => { const next = loadState(); next.query = String(search.value).slice(0, MAX_QUERY); saveState(next); render(); root.requestAnimationFrame?.(() => root.document.querySelector('[data-profile-center-search]')?.focus()); });
    sort.addEventListener('change', () => { const next = loadState(); next.sort = sort.value; saveState(next); render(); });
    file.addEventListener('change', () => { const selected = file.files?.[0]; file.value = ''; importProfiles(selected); });
  }

  function mount() {
    if (mounted || !root.document) return;
    const card = root.document.getElementById(CARD_ID); if (!card) return;
    const center = make('section', undefined, 'prompt-profile-center'); center.id = CENTER_ID; center.setAttribute('aria-labelledby', 'promptProfileCenterTitle');
    card.append(center); mounted = true; render();
    root.addEventListener?.('hafize:prompt-library-variable-profiles-changed', render);
    root.addEventListener?.('beforeunload', () => root.removeEventListener?.('hafize:prompt-library-variable-profiles-changed', render), { once: true });
  }

  root.HafizePromptLibrarySmartInsertCenter = Object.freeze({ PROFILE_KEY, STATE_KEY, limits: Object.freeze({ MAX_PROFILES, MAX_PROFILE_NAME, MAX_VARIABLES, MAX_VARIABLE, MAX_VALUE, MAX_QUERY }), normalizeProfile, normalizeProfiles, loadProfiles, saveProfiles, loadState, saveState, matches, sortProfiles, mount, render });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})(typeof globalThis !== 'undefined' ? globalThis : self);
