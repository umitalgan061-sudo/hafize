(function installPromptSmartInsert(root) {
  'use strict';

  const CARD_ID = 'promptLibraryCard';
  const MODAL_ID = 'promptLibraryVariableDialog';
  const PROFILE_KEY = 'hafize.prompt-library.variable-profiles.v1';
  const MAX_PROFILES = 24;
  const MAX_PROFILE_NAME = 60;
  const MAX_VARIABLES = 12;
  const MAX_VARIABLE = 32;
  const MAX_VALUE = 1000;
  const MAX_PREVIEW = 8000;
  const MAX_IMPORT = 300000;
  let active = null;

  const api = () => root.HafizePromptLibrary;
  const composer = () => root.document?.querySelector?.('#messageInput');
  const make = (tag, text, className) => {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const safeValue = (value) => String(value ?? '').replace(/\0/g, '').slice(0, MAX_VALUE);
  const safeName = (value) => String(value ?? '').trim().slice(0, MAX_PROFILE_NAME);
  const profileId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const valuesFor = (body) => api()?.extractVariables?.(body) || [];

  function normalizeProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const name = safeName(raw.name);
    if (!name) return null;
    const values = Object.create(null);
    let count = 0;
    for (const [rawKey, rawValue] of Object.entries(raw.values && typeof raw.values === 'object' ? raw.values : {})) {
      const key = String(rawKey).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_VARIABLE);
      if (!key || count >= MAX_VARIABLES) continue;
      values[key] = safeValue(rawValue);
      count += 1;
    }
    return { id: String(raw.id || profileId()).slice(0, 120), name, values, updatedAt: String(raw.updatedAt || new Date().toISOString()).slice(0, 40) };
  }

  function normalizeProfiles(raw) {
    if (!Array.isArray(raw)) return [];
    const output = [];
    const seen = new Set();
    for (const candidate of raw.slice(0, MAX_PROFILES * 2)) {
      const profile = normalizeProfile(candidate);
      if (!profile || seen.has(profile.id)) continue;
      seen.add(profile.id);
      output.push(profile);
      if (output.length >= MAX_PROFILES) break;
    }
    return output;
  }

  function loadProfiles() {
    try {
      const raw = JSON.parse(root.localStorage?.getItem(PROFILE_KEY) || '[]');
      return normalizeProfiles(raw);
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

  function exportProfiles(profiles) {
    const payload = JSON.stringify({ version: 1, source: 'hafize-prompt-variable-profiles', exportedAt: new Date().toISOString(), profiles: normalizeProfiles(profiles) }, null, 2);
    return payload.length <= MAX_IMPORT ? payload : JSON.stringify({ version: 1, source: 'hafize-prompt-variable-profiles', profiles: [] }, null, 2);
  }

  function importProfilesText(text) {
    const source = String(text || '');
    if (source.length > MAX_IMPORT) throw new Error('oversize');
    const parsed = JSON.parse(source);
    const incoming = Array.isArray(parsed) ? parsed : parsed?.profiles;
    return normalizeProfiles(incoming);
  }

  function mergeProfiles(current, incoming) {
    const result = normalizeProfiles(current);
    const byName = new Map(result.map((profile) => [profile.name.toLocaleLowerCase('tr-TR'), profile]));
    for (const raw of normalizeProfiles(incoming)) {
      const key = raw.name.toLocaleLowerCase('tr-TR');
      const existing = byName.get(key);
      if (existing) {
        const merged = { ...existing, values: { ...existing.values, ...raw.values }, updatedAt: new Date().toISOString() };
        const index = result.findIndex((profile) => profile.id === existing.id);
        if (index >= 0) result.splice(index, 1, normalizeProfile(merged));
      } else if (result.length < MAX_PROFILES) {
        const copy = normalizeProfile({ ...raw, id: profileId() });
        if (copy) { result.push(copy); byName.set(key, copy); }
      }
    }
    return normalizeProfiles(result);
  }

  function currentValues(fields) {
    const values = Object.create(null);
    for (const { name, input } of fields) values[name] = safeValue(input.value);
    return values;
  }

  function close(reason = 'cancel') {
    if (!active) return;
    const { dialog, trigger } = active;
    active = null;
    dialog.remove();
    root.document.getElementById(CARD_ID)?.removeAttribute('aria-busy');
    trigger?.focus?.();
    root.dispatchEvent?.(new CustomEvent('hafize:prompt-library-variable-dialog', { detail: { reason } }));
  }

  function createDownload(text, filename, mime) {
    try {
      const blob = new Blob([text], { type: mime });
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

  function renderProfileSelect(panel, names, fields) {
    const profileWrap = make('div', undefined, 'prompt-library-profile-tools');
    const label = make('label', 'Değişken profili', 'prompt-library-variable-label');
    const select = root.document.createElement('select');
    select.setAttribute('aria-label', 'Değişken profili seç');
    const blank = make('option', 'Profil seçmeden devam et'); blank.value = ''; select.append(blank);
    for (const profile of loadProfiles()) {
      const option = make('option', profile.name); option.value = profile.id; select.append(option);
    }
    const actions = make('div', undefined, 'prompt-library-profile-actions');
    const save = make('button', 'Profili kaydet', 'mini-btn'); save.type = 'button';
    const deleteButton = make('button', 'Profili sil', 'mini-btn'); deleteButton.type = 'button';
    const exportButton = make('button', 'Profilleri dışa aktar', 'mini-btn'); exportButton.type = 'button';
    const importButton = make('button', 'Profilleri içe aktar', 'mini-btn'); importButton.type = 'button';
    const file = root.document.createElement('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    actions.append(save, deleteButton, exportButton, importButton, file);
    profileWrap.append(label, select, actions);

    select.addEventListener('change', () => {
      const profile = loadProfiles().find((candidate) => candidate.id === select.value);
      for (const { name, input } of fields) input.value = profile?.values?.[name] || '';
      active.profileId = profile?.id || '';
      active.updatePreview?.();
    });

    save.addEventListener('click', () => {
      const suggested = select.value ? loadProfiles().find((candidate) => candidate.id === select.value)?.name || '' : '';
      const name = root.prompt?.('Profil adı:', suggested) ?? '';
      const cleanName = safeName(name);
      if (!cleanName) return;
      const values = currentValues(fields);
      const profiles = loadProfiles();
      const existing = profiles.find((profile) => profile.name.toLocaleLowerCase('tr-TR') === cleanName.toLocaleLowerCase('tr-TR'));
      const next = normalizeProfile({ id: existing?.id || profileId(), name: cleanName, values, updatedAt: new Date().toISOString() });
      if (!next) return;
      const nextProfiles = existing ? profiles.map((profile) => profile.id === existing.id ? next : profile) : [next, ...profiles].slice(0, MAX_PROFILES);
      if (!saveProfiles(nextProfiles)) return;
      active.profileId = next.id;
      renderProfileOptions(select);
      select.value = next.id;
      notify('Değişken profili kaydedildi.');
    });

    deleteButton.addEventListener('click', () => {
      if (!select.value) return notify('Önce silinecek profili seç.');
      if (!root.confirm?.('Seçili değişken profili silinsin mi?')) return;
      if (saveProfiles(loadProfiles().filter((profile) => profile.id !== select.value))) {
        active.profileId = '';
        select.value = '';
        notify('Değişken profili silindi.');
      }
    });

    exportButton.addEventListener('click', () => {
      const ok = createDownload(exportProfiles(loadProfiles()), 'hafize-variable-profiles.json', 'application/json;charset=utf-8');
      notify(ok ? 'Değişken profilleri dışa aktarıldı.' : 'Profil yedeği oluşturulamadı.');
    });

    importButton.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const selected = file.files?.[0]; file.value = '';
      if (!selected || selected.size > MAX_IMPORT) return notify('Profil dosyası 300 KB sınırını aşamaz.');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const incoming = importProfilesText(String(reader.result || ''));
          const merged = mergeProfiles(loadProfiles(), incoming);
          if (!saveProfiles(merged)) return notify('Profil yedeği kaydedilemedi.');
          notify(`${incoming.length} profil içe aktarıldı.`);
          renderProfileOptions(select);
        } catch { notify('Geçersiz değişken profil yedeği.'); }
      };
      reader.onerror = () => notify('Profil yedeği okunamadı.');
      reader.readAsText(selected);
    });

    renderProfileOptions(select);
    return profileWrap;
  }

  function renderProfileOptions(select) {
    const selected = select.value;
    const blank = make('option', 'Profil seçmeden devam et'); blank.value = '';
    select.replaceChildren(blank);
    for (const profile of loadProfiles()) {
      const option = make('option', profile.name); option.value = profile.id; select.append(option);
    }
    select.value = loadProfiles().some((profile) => profile.id === selected) ? selected : '';
  }

  function notify(message) {
    const status = root.document?.querySelector?.('#promptLibraryCard .prompt-library-status');
    if (status) status.textContent = String(message || '').slice(0, 180);
  }

  function open(item) {
    if (!item || active || !root.document) return;
    const names = valuesFor(item.body);
    const card = root.document.getElementById(CARD_ID);
    if (!card) return;
    if (!names.length) {
      const input = composer();
      if (!input) return notify('Mesaj alanı bulunamadı.');
      input.value = item.body;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      return;
    }

    const dialog = make('div', undefined, 'prompt-library-variable-dialog');
    dialog.id = MODAL_ID;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'promptLibraryVariableTitle');
    dialog.tabIndex = -1;
    const panel = make('div', undefined, 'prompt-library-variable-panel');
    const heading = make('div', undefined, 'prompt-library-variable-heading');
    const title = make('h3', 'Akıllı istem doldurma'); title.id = 'promptLibraryVariableTitle';
    const closeButton = make('button', 'Kapat', 'mini-btn'); closeButton.type = 'button';
    heading.append(title, closeButton);
    const help = make('p', `${item.title || 'İsimsiz istem'} için ${names.length} değişkeni doldur.`, 'prompt-library-variable-help');
    const form = make('div', undefined, 'prompt-library-variable-form');
    const fields = [];
    const preview = make('pre', undefined, 'prompt-library-variable-preview');
    preview.setAttribute('aria-label', 'Doldurulmuş istem önizlemesi');
    const updatePreview = () => {
      const values = currentValues(fields);
      preview.textContent = (api()?.replaceVariables?.(item.body, values) || item.body).slice(0, MAX_PREVIEW);
    };

    for (const name of names) {
      const label = make('label', name, 'prompt-library-variable-label'); label.htmlFor = `promptVariable-${name}`;
      const input = root.document.createElement('textarea');
      input.id = `promptVariable-${name}`; input.name = name; input.rows = 2; input.maxLength = MAX_VALUE;
      input.placeholder = `{{${name}}} değerini gir`; input.setAttribute('aria-label', `${name} değişkeni`); input.required = true;
      input.addEventListener('input', updatePreview);
      fields.push({ name, input }); form.append(label, input);
    }

    const profiles = renderProfileSelect(panel, names, fields);
    const actions = make('div', undefined, 'prompt-library-variable-actions');
    const insert = make('button', 'Composer’a aktar', 'soft-btn'); insert.type = 'button';
    const cancel = make('button', 'Vazgeç', 'soft-btn'); cancel.type = 'button';
    const reset = make('button', 'Alanları temizle', 'soft-btn'); reset.type = 'button';
    actions.append(insert, cancel, reset);
    panel.append(heading, help, profiles, form, make('h4', 'Önizleme'), preview, actions);
    dialog.append(panel);
    (root.document.body || root.document.documentElement).append(dialog);
    active = { dialog, fields, trigger: root.document.activeElement, updatePreview, profileId: '' };
    card.setAttribute('aria-busy', 'true');
    updatePreview();

    const focusables = () => [...dialog.querySelectorAll('textarea,select,button:not([disabled])')].filter((node) => !node.hidden);
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); insert.click(); return; }
      if (event.key !== 'Tab') return;
      const nodes = focusables(); if (!nodes.length) return;
      const index = nodes.indexOf(root.document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); nodes.at(-1).focus(); }
      else if (!event.shiftKey && index === nodes.length - 1) { event.preventDefault(); nodes[0].focus(); }
    };
    const onBackdrop = (event) => { if (event.target === dialog) close('backdrop'); };
    insert.addEventListener('click', () => {
      const values = currentValues(fields);
      const missing = names.filter((name) => !values[name].trim());
      if (missing.length) { notify(`Eksik değişken: ${missing.join(', ')}`); fields.find((field) => field.name === missing[0])?.input.focus(); return; }
      const input = composer();
      if (!input) return close('composer-missing');
      input.value = api()?.replaceVariables?.(item.body, values) || item.body;
      input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); close('insert');
      notify('İstem composer alanına aktarıldı; otomatik gönderim yapılmadı.');
    });
    cancel.addEventListener('click', () => close());
    closeButton.addEventListener('click', () => close());
    reset.addEventListener('click', () => { for (const { input } of fields) input.value = ''; updatePreview(); fields[0]?.input.focus(); });
    dialog.addEventListener('keydown', onKey);
    dialog.addEventListener('click', onBackdrop);
    fields[0]?.input.focus();
  }

  function enhance() {
    const card = root.document?.getElementById?.(CARD_ID);
    const list = card?.querySelector?.('#promptLibraryList');
    if (!card || !list) return;
    list.querySelectorAll('.prompt-item').forEach((row) => {
      const actions = row.querySelector('.prompt-item-actions'); const itemId = row.dataset.promptId;
      if (!actions || !itemId || actions.querySelector('[data-prompt-smart-insert]')) return;
      const button = make('button', 'Akıllı doldur', 'soft-btn prompt-smart-insert'); button.type = 'button';
      button.dataset.promptSmartInsert = itemId; button.setAttribute('aria-label', 'Değişkenleri doldurarak kullan'); actions.append(button);
      button.addEventListener('click', () => { const item = api()?.loadItems?.(root.localStorage).find((candidate) => candidate.id === itemId); if (item) open(item); });
    });
  }

  function boot() {
    if (!root.document) return;
    const ready = () => {
      enhance();
      const card = root.document.getElementById(CARD_ID);
      if (card && root.MutationObserver) {
        const observer = new root.MutationObserver(enhance);
        observer.observe(card, { childList: true, subtree: true });
        root.addEventListener?.('beforeunload', () => { close('unload'); observer.disconnect(); });
      }
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', ready, { once: true });
    else ready();
  }

  root.HafizePromptLibrarySmartInsert = Object.freeze({
    PROFILE_KEY,
    limits: Object.freeze({ MAX_PROFILES, MAX_PROFILE_NAME, MAX_VARIABLES, MAX_VARIABLE, MAX_VALUE, MAX_PREVIEW, MAX_IMPORT }),
    normalizeProfile,
    normalizeProfiles,
    loadProfiles,
    saveProfiles,
    exportProfiles,
    importProfilesText,
    mergeProfiles,
    variableNames: valuesFor,
    replace: (body, values) => api()?.replaceVariables?.(body, values) || String(body || ''),
    open,
    close
  });

  boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
