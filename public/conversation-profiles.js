(function exposeHafizeConversationProfiles(root) {
  'use strict';

  const STORAGE_KEY = 'hafize.conversation-profiles.v1';
  const VERSION = 1;
  const MAX_PROFILES = 40;
  const MAX_NAME = 80;
  const MAX_DESCRIPTION = 240;
  const MAX_MODEL = 240;
  const MAX_AGENT = 160;
  const MAX_IMPORT_BYTES = 1_000_000;
  const MAX_EXPORT_BYTES = 1_000_000;
  const PANEL_ID = 'conversationProfiles';
  const DIALOG_ID = 'conversationProfilesDialog';
  const CHANGE_EVENT = 'hafize:conversation-profile-changed';

  const now = () => new Date().toISOString();
  const clip = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const makeId = () => root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalizeProfile(input) {
    if (!input || typeof input !== 'object') return null;
    const name = clip(input.name, MAX_NAME);
    if (!name) return null;
    const createdAt = clip(input.createdAt, 40) || now();
    const updatedAt = clip(input.updatedAt, 40) || createdAt;
    return Object.freeze({
      id: clip(input.id, 120) || makeId(),
      name,
      description: clip(input.description, MAX_DESCRIPTION),
      model: clip(input.model, MAX_MODEL),
      agent: clip(input.agent, MAX_AGENT),
      toolsEnabled: input.toolsEnabled === true,
      isDefault: input.isDefault === true,
      createdAt,
      updatedAt
    });
  }

  function normalizeProfiles(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const ids = new Set();
    const names = new Set();
    for (const raw of value.slice(0, MAX_PROFILES * 2)) {
      const profile = normalizeProfile(raw);
      if (!profile) continue;
      const idKey = profile.id.toLocaleLowerCase('en-US');
      const nameKey = profile.name.toLocaleLowerCase('tr-TR');
      if (ids.has(idKey) || names.has(nameKey)) continue;
      ids.add(idKey);
      names.add(nameKey);
      output.push(profile);
      if (output.length >= MAX_PROFILES) break;
    }
    const defaults = output.filter((profile) => profile.isDefault);
    if (defaults.length > 1) {
      const keeper = defaults[0].id;
      return output.map((profile) => Object.freeze({ ...profile, isDefault: profile.id === keeper }));
    }
    return output;
  }

  function readProfiles(storage = root.localStorage) {
    try {
      const raw = storage?.getItem?.(STORAGE_KEY) || '[]';
      return normalizeProfiles(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function saveProfiles(storage, profiles) {
    try {
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(normalizeProfiles(profiles)));
      return true;
    } catch {
      return false;
    }
  }

  function defaultProfile(profiles) {
    return normalizeProfiles(profiles).find((profile) => profile.isDefault) || null;
  }

  function uniqueName(name, profiles, suffix = ' kopyası') {
    const base = clip(name, MAX_NAME) || 'Yeni profil';
    const names = new Set(profiles.map((profile) => profile.name.toLocaleLowerCase('tr-TR')));
    if (!names.has(base.toLocaleLowerCase('tr-TR'))) return base;
    for (let index = 2; index <= 99; index += 1) {
      const candidate = clip(`${base}${suffix} ${index}`, MAX_NAME);
      if (!names.has(candidate.toLocaleLowerCase('tr-TR'))) return candidate;
    }
    return clip(`${base}-${Date.now()}`, MAX_NAME);
  }

  function exportPayload(profiles) {
    const payload = { version: VERSION, source: 'hafize-conversation-profiles', exportedAt: now(), profiles: normalizeProfiles(profiles) };
    const full = JSON.stringify(payload, null, 2);
    if (full.length <= MAX_EXPORT_BYTES) return full;
    const reduced = { ...payload, profiles: payload.profiles.slice(0, Math.max(1, Math.floor(payload.profiles.length / 2))) };
    const output = JSON.stringify(reduced, null, 2);
    return output.length <= MAX_EXPORT_BYTES ? output : JSON.stringify({ version: VERSION, source: payload.source, exportedAt: payload.exportedAt, profiles: [] }, null, 2);
  }

  function importPayload(payload, profiles) {
    const current = normalizeProfiles(profiles);
    if (!payload || typeof payload !== 'object') return { profiles: current, imported: 0, skipped: 0 };
    const incoming = Array.isArray(payload.profiles) ? payload.profiles : [];
    const existingNames = new Set(current.map((profile) => profile.name.toLocaleLowerCase('tr-TR')));
    let imported = 0;
    let skipped = 0;
    for (const raw of incoming.slice(0, MAX_PROFILES * 2)) {
      if (current.length >= MAX_PROFILES) { skipped += 1; continue; }
      const candidate = normalizeProfile({ ...raw, id: makeId(), name: uniqueName(raw?.name, current, '') });
      if (!candidate || existingNames.has(candidate.name.toLocaleLowerCase('tr-TR'))) { skipped += 1; continue; }
      current.push(candidate);
      existingNames.add(candidate.name.toLocaleLowerCase('tr-TR'));
      imported += 1;
    }
    return { profiles: normalizeProfiles(current), imported, skipped };
  }

  function currentSelection(documentRef = root.document) {
    const model = documentRef?.getElementById?.('modelSelect');
    const agent = documentRef?.getElementById?.('agentSelect');
    const tools = documentRef?.getElementById?.('toolModeBtn');
    return Object.freeze({
      model: clip(model?.value, MAX_MODEL),
      agent: clip(agent?.value, MAX_AGENT),
      toolsEnabled: tools?.getAttribute?.('aria-pressed') === 'true'
    });
  }

  function availableModel(modelSelect, value) {
    return Boolean(value && [...(modelSelect?.options || [])].some((option) => option.value === value));
  }

  function availableAgent(agentSelect, value) {
    return Boolean(value && [...(agentSelect?.options || [])].some((option) => option.value === value));
  }

  function applySelection(selection, documentRef = root.document, rootRef = root) {
    const model = documentRef?.getElementById?.('modelSelect');
    const agent = documentRef?.getElementById?.('agentSelect');
    const tools = documentRef?.getElementById?.('toolModeBtn');
    if (!model || !agent || !tools) return { applied: false, reason: 'controls-unavailable' };

    const result = { applied: true, model: false, agent: false, tools: false, skipped: [] };
    if (selection.model) {
      if (availableModel(model, selection.model)) {
        model.value = selection.model;
        model.dispatchEvent(new Event('change', { bubbles: true }));
        result.model = true;
      } else result.skipped.push('model');
    }
    if (selection.agent) {
      if (availableAgent(agent, selection.agent)) {
        agent.value = selection.agent;
        agent.dispatchEvent(new Event('change', { bubbles: true }));
        result.agent = true;
      } else result.skipped.push('agent');
    }
    const desiredTools = selection.toolsEnabled === true;
    if (tools.getAttribute('aria-pressed') === String(desiredTools)) {
      result.tools = true;
    } else if (!tools.disabled) {
      tools.click();
      result.tools = true;
    } else result.skipped.push('tools');
    rootRef.dispatchEvent?.(new CustomEvent(CHANGE_EVENT, { detail: Object.freeze({ selection, result }) }));
    return result;
  }

  function createElement(documentRef, tag, textValue, className) {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  function makeButton(documentRef, label, action, className = 'mini-btn') {
    const node = createElement(documentRef, 'button', label, className);
    node.type = 'button';
    node.dataset.profileAction = action;
    node.setAttribute('aria-label', label);
    return node;
  }

  function trapFocus(dialog, event) {
    if (event.key !== 'Tab' || dialog.hidden) return;
    const nodes = [...dialog.querySelectorAll('button,input,textarea,select')].filter((node) => !node.disabled && !node.hidden);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && root.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && root.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function mount(documentRef = root.document, rootRef = root) {
    const topbar = documentRef?.querySelector?.('.topbar');
    if (!documentRef || !topbar || documentRef.getElementById(PANEL_ID)) return null;

    const button = createElement(documentRef, 'button', 'Profiller', 'conversation-profile-launch');
    button.type = 'button';
    button.id = 'conversationProfileLaunch';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', DIALOG_ID);
    const theme = documentRef.getElementById('themeToggle');
    if (theme) topbar.insertBefore(button, theme);
    else topbar.append(button);

    const dialog = createElement(documentRef, 'section', undefined, 'conversation-profiles-dialog');
    dialog.id = DIALOG_ID;
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'conversationProfilesTitle');
    dialog.setAttribute('aria-describedby', 'conversationProfilesDescription');

    const shell = createElement(documentRef, 'div', undefined, 'conversation-profiles-shell');
    const head = createElement(documentRef, 'div', undefined, 'conversation-profiles-head');
    const title = createElement(documentRef, 'strong', 'Sohbet profilleri', 'conversation-profiles-title');
    title.id = 'conversationProfilesTitle';
    const close = makeButton(documentRef, 'Kapat', 'close');
    head.append(title, close);

    const description = createElement(documentRef, 'p', 'Model, ajan ve araç modunu tek bir yerel profilde kaydet ve tek tıkla uygula.', 'conversation-profiles-description');
    description.id = 'conversationProfilesDescription';

    const toolbar = createElement(documentRef, 'div', undefined, 'conversation-profiles-toolbar');
    const create = makeButton(documentRef, '＋ Yeni profil', 'create', 'soft-btn');
    const capture = makeButton(documentRef, 'Mevcut ayarları kaydet', 'capture', 'soft-btn');
    const exportButton = makeButton(documentRef, 'Dışa aktar', 'export', 'soft-btn');
    const importButton = makeButton(documentRef, 'İçe aktar', 'import', 'soft-btn');
    toolbar.append(create, capture, exportButton, importButton);

    const status = createElement(documentRef, 'div', '', 'conversation-profiles-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const list = createElement(documentRef, 'div', undefined, 'conversation-profiles-list');
    list.setAttribute('role', 'list');
    const file = documentRef.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;

    const form = createElement(documentRef, 'form', undefined, 'conversation-profile-form');
    form.hidden = true;
    form.noValidate = true;
    const nameInput = documentRef.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = MAX_NAME;
    nameInput.required = true;
    nameInput.placeholder = 'Profil adı';
    nameInput.setAttribute('aria-label', 'Profil adı');
    const descriptionInput = documentRef.createElement('textarea');
    descriptionInput.maxLength = MAX_DESCRIPTION;
    descriptionInput.rows = 3;
    descriptionInput.placeholder = 'Kısa açıklama';
    descriptionInput.setAttribute('aria-label', 'Profil açıklaması');
    const defaultLabel = createElement(documentRef, 'label', undefined, 'conversation-profile-default');
    const defaultInput = documentRef.createElement('input');
    defaultInput.type = 'checkbox';
    defaultLabel.append(defaultInput, createElement(documentRef, 'span', 'Varsayılan profil'));
    const formActions = createElement(documentRef, 'div', undefined, 'conversation-profile-form-actions');
    const saveForm = makeButton(documentRef, 'Kaydet', 'save-form', 'soft-btn');
    const cancelForm = makeButton(documentRef, 'Vazgeç', 'cancel-form', 'mini-btn');
    formActions.append(saveForm, cancelForm);
    form.append(
      createElement(documentRef, 'label', 'Profil adı', 'conversation-profile-label'), nameInput,
      createElement(documentRef, 'label', 'Açıklama', 'conversation-profile-label'), descriptionInput,
      defaultLabel,
      formActions
    );

    shell.append(head, description, toolbar, form, list, status, file);
    dialog.append(shell);
    documentRef.body.append(dialog);

    let profiles = readProfiles(rootRef.localStorage);
    let editingId = '';
    let previousFocus = null;
    const listeners = [];

    const addListener = (target, type, handler) => {
      target.addEventListener(type, handler);
      listeners.push(() => target.removeEventListener(type, handler));
    };

    const announce = (message) => {
      status.textContent = clip(message, 180);
      rootRef.clearTimeout?.(announce.timer);
      announce.timer = rootRef.setTimeout?.(() => { status.textContent = ''; }, 3000);
    };

    const persist = () => saveProfiles(rootRef.localStorage, profiles);

    const openDialog = () => {
      previousFocus = documentRef.activeElement;
      dialog.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      render();
      list.querySelector('button')?.focus?.();
      if (!list.querySelector('button')) create.focus();
    };

    const closeDialog = () => {
      dialog.hidden = true;
      form.hidden = true;
      editingId = '';
      button.setAttribute('aria-expanded', 'false');
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
      previousFocus = null;
    };

    const render = () => {
      list.replaceChildren();
      profiles = readProfiles(rootRef.localStorage);
      const fallback = currentSelection(documentRef);
      if (!profiles.length) {
        const empty = createElement(documentRef, 'div', 'Henüz profil yok. Mevcut ayarları doğrudan kaydedebilirsin.', 'conversation-profiles-empty');
        list.append(empty);
        return;
      }
      for (const profile of profiles) {
        const row = createElement(documentRef, 'article', undefined, 'conversation-profile-row');
        row.dataset.profileId = profile.id;
        if (profile.isDefault) row.classList.add('is-default');
        const info = createElement(documentRef, 'div', undefined, 'conversation-profile-info');
        info.append(createElement(documentRef, 'strong', profile.name, 'conversation-profile-name'));
        if (profile.description) info.append(createElement(documentRef, 'p', profile.description, 'conversation-profile-description'));
        const meta = createElement(documentRef, 'div', undefined, 'conversation-profile-meta');
        meta.append(createElement(documentRef, 'span', profile.model || 'Model seçilmemiş'));
        meta.append(createElement(documentRef, 'span', profile.agent || 'Ajan seçilmemiş'));
        meta.append(createElement(documentRef, 'span', profile.toolsEnabled ? 'Araçlar açık' : 'Araçlar kapalı'));
        if (profile.isDefault) meta.append(createElement(documentRef, 'span', 'Varsayılan', 'conversation-profile-default-badge'));
        info.append(meta);
        const actions = createElement(documentRef, 'div', undefined, 'conversation-profile-actions');
        actions.append(
          makeButton(documentRef, 'Uygula', 'apply'),
          makeButton(documentRef, 'Güncelle', 'edit'),
          makeButton(documentRef, 'Çoğalt', 'duplicate'),
          makeButton(documentRef, 'Varsayılan yap', 'default'),
          makeButton(documentRef, 'Sil', 'delete')
        );
        row.append(info, actions);
        list.append(row);
      }
      if (!fallback.model && !fallback.agent && !fallback.toolsEnabled) {
        // Empty current state is valid and intentionally not mutated.
      }
    };

    const beginForm = (profile = null) => {
      editingId = profile?.id || '';
      nameInput.value = profile?.name || '';
      descriptionInput.value = profile?.description || '';
      defaultInput.checked = profile?.isDefault === true;
      form.hidden = false;
      nameInput.focus();
    };

    const saveFormData = () => {
      const name = clip(nameInput.value, MAX_NAME);
      if (!name) {
        announce('Profil adı gerekli.');
        nameInput.focus();
        return;
      }
      const nameKey = name.toLocaleLowerCase('tr-TR');
      const duplicate = profiles.find((profile) => profile.id !== editingId && profile.name.toLocaleLowerCase('tr-TR') === nameKey);
      if (duplicate) {
        announce('Aynı isimde bir profil zaten var.');
        nameInput.focus();
        return;
      }
      const selection = currentSelection(documentRef);
      const base = editingId ? profiles.find((profile) => profile.id === editingId) : null;
      const next = normalizeProfile({
        ...(base || {}),
        id: base?.id || makeId(),
        name,
        description: descriptionInput.value,
        model: base?.model || selection.model,
        agent: base?.agent || selection.agent,
        toolsEnabled: base ? base.toolsEnabled : selection.toolsEnabled,
        isDefault: defaultInput.checked,
        createdAt: base?.createdAt || now(),
        updatedAt: now()
      });
      if (!next) return announce('Profil kaydedilemedi.');
      if (next.isDefault) profiles = profiles.map((profile) => Object.freeze({ ...profile, isDefault: false }));
      const index = profiles.findIndex((profile) => profile.id === next.id);
      if (index >= 0) profiles.splice(index, 1, next); else {
        if (profiles.length >= MAX_PROFILES) return announce('Profil sınırı dolu.');
        profiles.unshift(next);
      }
      if (!persist()) return announce('Profil cihazda kaydedilemedi.');
      form.hidden = true;
      editingId = '';
      render();
      announce('Profil kaydedildi.');
    };

    const captureCurrent = () => {
      const selection = currentSelection(documentRef);
      const candidate = normalizeProfile({
        id: makeId(),
        name: uniqueName('Mevcut sohbet ayarları', profiles),
        description: 'Mevcut model, ajan ve araç modu ayarlarından oluşturuldu.',
        ...selection,
        createdAt: now(),
        updatedAt: now()
      });
      if (!candidate) return announce('Mevcut ayarlar profil oluşturmak için uygun değil.');
      if (profiles.length >= MAX_PROFILES) return announce('Profil sınırı dolu.');
      profiles = [candidate, ...profiles];
      if (!persist()) return announce('Profil cihazda kaydedilemedi.');
      render();
      announce('Mevcut ayarlar yeni profil olarak kaydedildi.');
    };

    const profileForRow = (target) => {
      const id = target?.closest?.('[data-profile-id]')?.dataset?.profileId || '';
      return profiles.find((profile) => profile.id === id) || null;
    };

    const handleAction = (event) => {
      const target = event.target?.closest?.('[data-profile-action]');
      if (!target) return;
      const action = target.dataset.profileAction;
      const profile = profileForRow(target);
      if (action === 'close') return closeDialog();
      if (action === 'create') return beginForm();
      if (action === 'capture') return captureCurrent();
      if (action === 'cancel-form') { form.hidden = true; editingId = ''; return; }
      if (action === 'save-form') { event.preventDefault(); return saveFormData(); }
      if (!profile) return;
      if (action === 'apply') {
        const result = applySelection(profile, documentRef, rootRef);
        if (result.skipped.length) announce(`Profil uygulandı; hazır olmayan: ${result.skipped.join(', ')}.`);
        else announce(`“${profile.name}” uygulandı.`);
        return render();
      }
      if (action === 'edit') return beginForm(profile);
      if (action === 'duplicate') {
        if (profiles.length >= MAX_PROFILES) return announce('Profil sınırı dolu.');
        const copy = normalizeProfile({ ...profile, id: makeId(), name: uniqueName(profile.name, profiles), isDefault: false, createdAt: now(), updatedAt: now() });
        profiles = [copy, ...profiles];
        if (!persist()) return announce('Profil çoğaltılamadı.');
        render();
        return announce('Profil çoğaltıldı.');
      }
      if (action === 'default') {
        profiles = profiles.map((item) => Object.freeze({ ...item, isDefault: item.id === profile.id, updatedAt: item.id === profile.id ? now() : item.updatedAt }));
        if (!persist()) return announce('Varsayılan profil kaydedilemedi.');
        render();
        return announce(`“${profile.name}” varsayılan profil oldu.`);
      }
      if (action === 'delete') {
        if (!rootRef.confirm?.(`“${profile.name}” silinsin mi?`)) return;
        profiles = profiles.filter((item) => item.id !== profile.id);
        if (profile.isDefault) {
          const first = profiles[0];
          if (first) profiles[0] = Object.freeze({ ...first, isDefault: true });
        }
        if (!persist()) return announce('Profil silinemedi.');
        render();
        return announce('Profil silindi.');
      }
      if (action === 'export') {
        const content = exportPayload(profiles);
        if (content.length > MAX_EXPORT_BYTES) return announce('Dışa aktarma sınırı aşıldı.');
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = createElement(documentRef, 'a');
        link.href = url;
        link.download = 'hafize-conversation-profiles.json';
        link.click();
        rootRef.setTimeout?.(() => URL.revokeObjectURL(url), 0);
        announce(`${profiles.length} profil dışa aktarıldı.`);
        return;
      }
      if (action === 'import') return file.click();
    };

    const onFile = () => {
      const picked = file.files?.[0];
      file.value = '';
      if (!picked) return;
      if (picked.size > MAX_IMPORT_BYTES) return announce('İçe aktarma dosyası 1 MB sınırını aşamaz.');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          const merged = importPayload(parsed, profiles);
          profiles = merged.profiles;
          if (!persist()) return announce('İçe aktarma kaydedilemedi.');
          render();
          announce(`${merged.imported} profil eklendi, ${merged.skipped} kayıt atlandı.`);
        } catch {
          announce('Geçersiz profil yedeği.');
        }
      };
      reader.onerror = () => announce('Profil yedeği okunamadı.');
      reader.readAsText(picked);
    };

    addListener(button, 'click', openDialog);
    addListener(dialog, 'click', handleAction);
    addListener(form, 'submit', (event) => { event.preventDefault(); saveFormData(); });
    addListener(file, 'change', onFile);
    addListener(dialog, 'keydown', (event) => {
      if (dialog.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return; }
      trapFocus(dialog, event);
    });
    addListener(rootRef, 'hafize:models-loaded', render);
    addListener(rootRef, 'hafize:agents-loaded', render);
    addListener(rootRef, 'beforeunload', () => { for (const off of listeners.splice(0)) off(); });

    const defaultToApply = () => {
      const selected = defaultProfile(readProfiles(rootRef.localStorage));
      if (!selected) return;
      const controls = currentSelection(documentRef);
      const modelReady = !selected.model || availableModel(documentRef.getElementById('modelSelect'), selected.model);
      const agentReady = !selected.agent || availableAgent(documentRef.getElementById('agentSelect'), selected.agent);
      if (modelReady && agentReady && (controls.model !== selected.model || controls.agent !== selected.agent || controls.toolsEnabled !== selected.toolsEnabled)) {
        applySelection(selected, documentRef, rootRef);
      }
    };

    render();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => defaultToApply()) : null;
    observer?.observe(documentRef.getElementById('modelSelect') || documentRef.body, { childList: true, subtree: true });
    rootRef.setTimeout?.(defaultToApply, 500);

    return Object.freeze({
      mounted: true,
      open: openDialog,
      close: closeDialog,
      read: () => readProfiles(rootRef.localStorage),
      current: () => currentSelection(documentRef),
      apply: (id) => {
        const profile = readProfiles(rootRef.localStorage).find((item) => item.id === id);
        return profile ? applySelection(profile, documentRef, rootRef) : { applied: false, reason: 'profile-not-found' };
      },
      destroy: () => {
        observer?.disconnect?.();
        for (const off of listeners.splice(0)) off();
        dialog.remove();
        button.remove();
      }
    });
  }

  const api = Object.freeze({
    STORAGE_KEY,
    VERSION,
    LIMITS: Object.freeze({ MAX_PROFILES, MAX_NAME, MAX_DESCRIPTION, MAX_MODEL, MAX_AGENT, MAX_IMPORT_BYTES, MAX_EXPORT_BYTES }),
    normalizeProfile,
    normalizeProfiles,
    readProfiles,
    saveProfiles,
    defaultProfile,
    currentSelection,
    applySelection,
    exportPayload,
    importPayload,
    mount
  });

  root.HafizeConversationProfiles = api;
  const start = () => mount(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(typeof globalThis !== 'undefined' ? globalThis : self);
