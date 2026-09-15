(function installPromptLibraryVariableForm(root) {
  'use strict';

  const LIMITS = Object.freeze({
    maxVariables: 12,
    maxName: 32,
    maxValue: 1000,
    maxTitle: 80,
    maxProfileName: 60
  });
  const CARD_ID = 'promptLibraryCard';
  const PANEL_ID = 'promptLibraryVariableForm';
  const PROFILE_KEY = 'hafize.prompt-library.variable-profiles.v1';
  let activeRequest = null;
  let mounted = false;

  const api = () => root.HafizePromptLibrary;
  const trim = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const ids = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function safeName(value) {
    return trim(value, LIMITS.maxName).replace(/[^a-zA-Z0-9_-]/g, '');
  }

  function safeValue(value) {
    return String(value ?? '').slice(0, LIMITS.maxValue);
  }

  function extract(body) {
    const helper = api();
    if (helper?.extractVariables) return helper.extractVariables(body).slice(0, LIMITS.maxVariables);
    const matches = String(body ?? '').match(/\{\{\s*[a-zA-Z0-9_-]{1,32}\s*\}\}/g) || [];
    const seen = new Set();
    return matches.map((match) => safeName(match.replace(/^\{\{\s*|\s*\}\}$/g, ''))).filter((name) => name && !seen.has(name) && seen.add(name)).slice(0, LIMITS.maxVariables);
  }

  function loadProfiles() {
    try {
      const raw = root.localStorage?.getItem(PROFILE_KEY) || '[]';
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((profile) => profile && typeof profile === 'object').slice(0, 20).map((profile) => ({
        id: trim(profile.id, 120) || ids(),
        name: trim(profile.name, LIMITS.maxProfileName),
        values: Object.fromEntries(Object.entries(profile.values || {}).slice(0, LIMITS.maxVariables).map(([key, value]) => [safeName(key), safeValue(value)]).filter(([key]) => key))
      })).filter((profile) => profile.name);
    } catch {
      return [];
    }
  }

  function saveProfiles(profiles) {
    try {
      root.localStorage?.setItem(PROFILE_KEY, JSON.stringify(profiles.slice(0, 20)));
      return true;
    } catch {
      return false;
    }
  }

  function create(tag, textValue, className) {
    const node = root.document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function button(label, className = 'soft-btn') {
    const node = create('button', label, className);
    node.type = 'button';
    return node;
  }

  function closePanel() {
    const panel = root.document?.getElementById?.(PANEL_ID);
    panel?.remove();
    activeRequest = null;
  }

  function renderProfileOptions(select, profiles, selectedId = '') {
    select.replaceChildren();
    const empty = create('option', 'Profil seç…');
    empty.value = '';
    select.append(empty);
    profiles.forEach((profile) => {
      const option = create('option', profile.name);
      option.value = profile.id;
      select.append(option);
    });
    select.value = selectedId;
  }

  function rememberProfile(values, name) {
    const title = trim(name, LIMITS.maxProfileName);
    if (!title) return false;
    const profiles = loadProfiles();
    const normalized = Object.fromEntries(Object.entries(values).map(([key, value]) => [safeName(key), safeValue(value)]).filter(([key]) => key));
    const current = profiles.find((profile) => profile.name.toLocaleLowerCase('tr-TR') === title.toLocaleLowerCase('tr-TR'));
    if (current) current.values = normalized;
    else profiles.unshift({ id: ids(), name: title, values: normalized });
    return saveProfiles(profiles);
  }

  function confirmRequest(values) {
    const request = activeRequest;
    if (!request) return;
    const helper = api();
    const body = helper?.replaceVariables ? helper.replaceVariables(request.body, values) : String(request.body).replace(/\{\{\s*([a-zA-Z0-9_-]{1,32})\s*\}\}/g, (_m, name) => safeValue(values[name]));
    const composer = request.composer;
    composer.value = body.slice(0, 8000);
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.focus();
    if (request.onUsed) request.onUsed();
    closePanel();
  }

  function mount(bodyText, composer, onUsed) {
    const documentRef = root.document;
    if (!documentRef || !composer) return false;
    closePanel();
    const names = extract(bodyText);
    if (!names.length) return false;
    activeRequest = { body: String(bodyText), composer, onUsed };

    const overlay = create('div', undefined, 'prompt-library-variable-overlay');
    overlay.id = PANEL_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'promptLibraryVariableTitle');

    const dialog = create('div', undefined, 'prompt-library-variable-dialog');
    const header = create('div', undefined, 'prompt-library-variable-header');
    const title = create('strong', 'İstemi doldur', 'prompt-library-variable-title');
    title.id = 'promptLibraryVariableTitle';
    const close = button('Kapat', 'mini-btn');
    close.setAttribute('aria-label', 'İstem doldurma penceresini kapat');
    header.append(title, close);

    const intro = create('p', 'Değişkenleri doldur, ardından istemi mesaj alanına aktar.', 'prompt-library-variable-intro');
    const profileRow = create('div', undefined, 'prompt-library-variable-profile');
    const profiles = loadProfiles();
    const profileSelect = documentRef.createElement('select');
    profileSelect.setAttribute('aria-label', 'Değişken profili');
    renderProfileOptions(profileSelect, profiles);
    const saveProfile = button('Profili kaydet', 'mini-btn');
    const deleteProfile = button('Profili sil', 'mini-btn');
    profileRow.append(profileSelect, saveProfile, deleteProfile);

    const fields = create('div', undefined, 'prompt-library-variable-fields');
    const inputs = new Map();
    const updatePreview = () => {
      const helper = api();
      const values = Object.fromEntries([...inputs.entries()].map(([name, input]) => [name, safeValue(input.value)]));
      preview.textContent = helper?.replaceVariables ? helper.replaceVariables(bodyText, values) : String(bodyText);
      const missing = names.filter((name) => !safeValue(values[name]));
      submit.disabled = missing.length > 0;
      requirements.textContent = missing.length ? `Eksik: ${missing.join(', ')}` : 'Tüm değişkenler dolduruldu.';
    };

    names.forEach((name, index) => {
      const field = create('label', undefined, 'prompt-library-variable-field');
      const label = create('span', `${index + 1}. {{${name}}}`);
      const input = documentRef.createElement('textarea');
      input.rows = 2;
      input.maxLength = LIMITS.maxValue;
      input.setAttribute('aria-label', `${name} değişkeni`);
      input.placeholder = `${name} için değer…`;
      input.dataset.variableName = name;
      inputs.set(name, input);
      input.addEventListener('input', updatePreview);
      field.append(label, input);
      fields.append(field);
    });

    const requirements = create('div', 'Değerler kontrol ediliyor…', 'prompt-library-variable-requirements');
    requirements.setAttribute('role', 'status');
    requirements.setAttribute('aria-live', 'polite');
    const previewLabel = create('div', 'Önizleme', 'prompt-library-variable-preview-label');
    const preview = create('pre', '', 'prompt-library-variable-preview');
    preview.setAttribute('aria-label', 'Doldurulmuş istem önizlemesi');
    const actions = create('div', undefined, 'prompt-library-variable-actions');
    const cancel = button('Vazgeç');
    const submit = button('Mesaj alanına aktar');
    submit.className += ' primary';
    actions.append(cancel, submit);

    dialog.append(header, intro, profileRow, fields, requirements, previewLabel, preview, actions);
    overlay.append(dialog);
    documentRef.body.append(overlay);

    close.addEventListener('click', closePanel);
    cancel.addEventListener('click', closePanel);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closePanel(); });
    documentRef.addEventListener('keydown', onKeydown, true);

    profileSelect.addEventListener('change', () => {
      const profile = loadProfiles().find((candidate) => candidate.id === profileSelect.value);
      if (!profile) return;
      inputs.forEach((input, name) => { input.value = profile.values[name] || ''; });
      updatePreview();
      [...inputs.values()][0]?.focus();
    });

    saveProfile.addEventListener('click', () => {
      const defaultName = names.slice(0, 3).join('-');
      const name = root.prompt?.('Profil adı:', defaultName);
      if (name === null) return;
      const values = Object.fromEntries([...inputs.entries()].map(([key, input]) => [key, safeValue(input.value)]));
      const ok = rememberProfile(values, name);
      renderProfileOptions(profileSelect, loadProfiles());
      if (ok) {
        const profile = loadProfiles().find((candidate) => candidate.name === trim(name, LIMITS.maxProfileName));
        if (profile) profileSelect.value = profile.id;
        requirements.textContent = 'Değişken profili cihazda saklandı.';
      } else requirements.textContent = 'Profil kaydedilemedi.';
    });

    deleteProfile.addEventListener('click', () => {
      const selected = profileSelect.value;
      if (!selected) return;
      const profile = loadProfiles().find((candidate) => candidate.id === selected);
      if (!profile || !root.confirm?.(`“${profile.name}” profili silinsin mi?`)) return;
      saveProfiles(loadProfiles().filter((candidate) => candidate.id !== selected));
      renderProfileOptions(profileSelect, loadProfiles());
      requirements.textContent = 'Profil silindi.';
    });

    submit.addEventListener('click', () => {
      const values = Object.fromEntries([...inputs.entries()].map(([name, input]) => [name, safeValue(input.value)]));
      if (names.some((name) => !values[name])) return;
      confirmRequest(values);
    });

    updatePreview();
    [...inputs.values()][0]?.focus();
    return true;
  }

  function onKeydown(event) {
    if (!activeRequest) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      root.document?.querySelector?.(`#${PANEL_ID} button.primary:not(:disabled)`)?.click();
    }
  }

  function onClickCapture(event) {
    const buttonTarget = event.target?.closest?.('#promptLibraryCard .prompt-item-actions button');
    if (!buttonTarget || String(buttonTarget.textContent || '').trim() !== 'Kullan') return;
    const row = buttonTarget.closest('.prompt-item');
    const id = row?.dataset?.promptId;
    if (!id) return;
    const items = api()?.loadItems?.(root.localStorage) || [];
    const item = items.find((candidate) => candidate.id === id);
    const composer = root.document?.getElementById?.('messageInput');
    if (!item || !composer || !extract(item.body).length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    mount(item.body, composer, () => {
      const current = api()?.loadItems?.(root.localStorage) || [];
      const index = current.findIndex((candidate) => candidate.id === id);
      if (index < 0 || !api()?.normalizeItem) return;
      current.splice(index, 1, api().normalizeItem({ ...current[index], useCount: current[index].useCount + 1, updatedAt: new Date().toISOString() }));
      api().saveItems(root.localStorage, current);
      root.dispatchEvent?.(new StorageEvent('storage', { key: api().STORAGE_KEY, newValue: JSON.stringify(current) }));
    });
  }

  function boot() {
    if (mounted || !root.document) return;
    mounted = true;
    root.document.addEventListener('click', onClickCapture, true);
    root.addEventListener?.('beforeunload', () => root.document?.removeEventListener('click', onClickCapture, true), { once: true });
  }

  const apiExport = Object.freeze({
    PROFILE_KEY,
    LIMITS,
    loadProfiles,
    saveProfiles,
    mount,
    close: closePanel
  });
  root.HafizePromptLibraryVariableForm = apiExport;
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
