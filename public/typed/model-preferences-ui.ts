import {
  MODEL_PREFERENCES_LIMITS,
  createProfile,
  exportModelPreferences,
  importModelPreferences,
  loadModelPreferences,
  previewModelPreferenceImport,
  rankProfiles,
  removeProfile,
  renameProfile,
  duplicateProfile,
  rememberSelection,
  saveModelPreferences,
  touchProfile,
  upsertProfile,
  type ModelPreferenceProfile,
  type ModelPreferenceState
} from './model-preferences.ts';

interface Selection {
  model: string;
  agentId: string;
  toolsEnabled: boolean;
}

interface Choice {
  id: string;
  label: string;
}

export interface ModelPreferencesUiController {
  refresh: () => void;
  destroy: () => void;
}

interface Options {
  modelSelect: HTMLSelectElement;
  agentSelect: HTMLSelectElement;
  toolModeButton: HTMLButtonElement;
  getCurrent: () => Selection;
  getChoices: () => { models: Choice[]; agents: Choice[] };
  apply: (selection: Selection) => void;
}

const PANEL_ID = 'modelPreferencesPanel';
const OPEN_BUTTON_ID = 'modelPreferencesButton';
const STORAGE_KEY = 'hafize.model-preferences.v1';

function button(label: string, className = 'mini-btn'): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  return node;
}

function label(value: string): HTMLElement {
  const node = document.createElement('span');
  node.textContent = value;
  return node;
}

function createDialog(): {
  panel: HTMLElement;
  body: HTMLElement;
  close: HTMLButtonElement;
  add: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  clear: HTMLButtonElement;
  file: HTMLInputElement;
} {
  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.className = 'model-preferences-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'modelPreferencesTitle');

  const head = document.createElement('div');
  head.className = 'model-preferences-head';
  const title = document.createElement('strong');
  title.id = 'modelPreferencesTitle';
  title.textContent = 'Model ve ajan tercihleri';
  const close = button('Kapat');
  close.setAttribute('aria-label', 'Model ve ajan tercihlerini kapat');
  head.append(title, close);

  const body = document.createElement('div');
  body.className = 'model-preferences-body';

  const actions = document.createElement('div');
  actions.className = 'model-preferences-actions';
  const add = button('Mevcut seçimi profil olarak kaydet', 'soft-btn');
  const exportButton = button('Dışa aktar', 'soft-btn');
  const importButton = button('İçe aktar', 'soft-btn');
  const clear = button('Tercihleri sıfırla', 'soft-btn');
  actions.append(add, exportButton, importButton, clear);

  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;

  panel.append(head, body, actions, file);
  return { panel, body, close, add, exportButton, importButton, clear, file };
}

function renderProfiles(
  body: HTMLElement,
  state: ModelPreferenceState,
  current: Selection,
  choices: { models: Choice[]; agents: Choice[] },
  onApply: (profile: ModelPreferenceProfile) => void,
  onRename: (profile: ModelPreferenceProfile) => void,
  onDuplicate: (profile: ModelPreferenceProfile) => void,
  onDelete: (profile: ModelPreferenceProfile) => void
): void {
  body.replaceChildren();

  const summary = document.createElement('p');
  summary.className = 'model-preferences-summary';
  summary.textContent = state.profiles.length
    ? `${state.profiles.length}/${MODEL_PREFERENCES_LIMITS.maxProfiles} profil kayıtlı.`
    : 'Henüz kaydedilmiş profil yok.';
  body.append(summary);

  const currentLine = document.createElement('div');
  currentLine.className = 'model-preferences-current';
  currentLine.append(
    label(`Model: ${current.model || 'seçilmedi'}`),
    label(`Ajan: ${choices.agents.find((agent) => agent.id === current.agentId)?.label || current.agentId || 'seçilmedi'}`),
    label(current.toolsEnabled ? 'Araçlar açık' : 'Araçlar kapalı')
  );
  body.append(currentLine);

  const list = document.createElement('div');
  list.className = 'model-preferences-list';
  list.setAttribute('role', 'list');

  const ranked = rankProfiles(state, current);
  if (!ranked.length) {
    const empty = document.createElement('div');
    empty.className = 'model-preferences-empty';
    empty.textContent = 'Model ve ajan seçimini profil olarak kaydettiğinde burada hızlı geçiş yapabilirsin.';
    list.append(empty);
  }

  for (const profile of ranked) {
    const row = document.createElement('article');
    row.className = 'model-preference-row';
    row.dataset.profileId = profile.id;
    row.setAttribute('role', 'listitem');

    const main = document.createElement('div');
    main.className = 'model-preference-main';
    const name = document.createElement('strong');
    name.textContent = profile.name;
    const meta = document.createElement('small');
    const agentLabel = choices.agents.find((agent) => agent.id === profile.agentId)?.label || profile.agentId;
    meta.textContent = `${profile.model} · ${agentLabel} · ${profile.toolsEnabled ? 'araçlar açık' : 'araçlar kapalı'} · ${profile.useCount} kullanım`;
    main.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'model-preference-row-actions';
    const apply = button('Uygula', 'soft-btn');
    apply.disabled = current.model === profile.model
      && current.agentId === profile.agentId
      && current.toolsEnabled === profile.toolsEnabled;
    apply.addEventListener('click', () => onApply(profile));
    const rename = button('Adlandır', 'mini-btn');
    rename.setAttribute('aria-label', `${profile.name} profilini yeniden adlandır`);
    rename.addEventListener('click', () => onRename(profile));
    const duplicate = button('Çoğalt', 'mini-btn');
    duplicate.setAttribute('aria-label', `${profile.name} profilini çoğalt`);
    duplicate.addEventListener('click', () => onDuplicate(profile));
    const remove = button('Sil', 'mini-btn');
    remove.setAttribute('aria-label', `${profile.name} profilini sil`);
    remove.addEventListener('click', () => onDelete(profile));
    actions.append(apply, rename, duplicate, remove);
    row.append(main, actions);
    list.append(row);
  }
  body.append(list);
}

export function mountModelPreferences(options: Options): ModelPreferencesUiController | null {
  if (!options.modelSelect || !options.agentSelect || !options.toolModeButton) return null;
  if (document.getElementById(PANEL_ID)) return null;

  const composerModel = options.modelSelect.closest('.model-wrap');
  const anchor = composerModel?.parentElement || options.modelSelect.parentElement;
  if (!anchor) return null;

  const open = button('Tercihler', 'mini-btn');
  open.id = OPEN_BUTTON_ID;
  open.setAttribute('aria-expanded', 'false');
  open.setAttribute('aria-controls', PANEL_ID);
  open.title = 'Model ve ajan tercihleri';
  anchor.append(open);

  const dialog = createDialog();
  anchor.parentElement?.append(dialog.panel);

  let state = loadModelPreferences();
  let previousTrigger: HTMLElement | null = null;

  const status = (message: string): void => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message.slice(0, 180);
    toast.classList.remove('hidden');
    window.setTimeout(() => toast.classList.add('hidden'), 3000);
  };

  const current = (): Selection => options.getCurrent();
  const choices = (): { models: Choice[]; agents: Choice[] } => options.getChoices();

  const persistSelection = (): void => {
    state = rememberSelection(state, current());
    saveModelPreferences(state);
  };

  const render = (): void => renderProfiles(dialog.body, state, current(), choices(),
    (profile) => {
      options.apply({ model: profile.model, agentId: profile.agentId, toolsEnabled: profile.toolsEnabled });
      state = touchProfile(state, profile.id);
      state = rememberSelection(state, current());
      saveModelPreferences(state);
      render();
      status(`“${profile.name}” uygulandı.`);
    },
    (profile) => {
      const nextName = globalThis.prompt('Yeni profil adı:', profile.name);
      if (nextName === null || !nextName.trim()) return;
      state = renameProfile(state, profile.id, nextName);
      saveModelPreferences(state);
      render();
      status('Profil yeniden adlandırıldı.');
    },
    (profile) => {
      if (state.profiles.length >= MODEL_PREFERENCES_LIMITS.maxProfiles) return status('En fazla 6 profil kaydedebilirsin.');
      state = duplicateProfile(state, profile.id);
      saveModelPreferences(state);
      render();
      status('Profil çoğaltıldı.');
    },
    (profile) => {
      if (!globalThis.confirm(`“${profile.name}” profili silinsin mi?`)) return;
      state = removeProfile(state, profile.id);
      saveModelPreferences(state);
      render();
      status('Profil silindi.');
    }
  );

  const close = (): void => {
    dialog.panel.hidden = true;
    open.setAttribute('aria-expanded', 'false');
    previousTrigger?.focus();
    previousTrigger = null;
  };

  const show = (): void => {
    previousTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : open;
    state = loadModelPreferences();
    render();
    dialog.panel.hidden = false;
    open.setAttribute('aria-expanded', 'true');
    dialog.close.focus();
  };

  open.addEventListener('click', show);
  dialog.close.addEventListener('click', close);

  dialog.add.addEventListener('click', () => {
    const nowSelection = current();
    const defaultName = nowSelection.model ? `${nowSelection.model.split('/').at(-1) || nowSelection.model.slice(0, 24)} profili` : 'Yeni profil';
    const name = globalThis.prompt('Profil adı:', defaultName);
    if (name === null) return;
    if (state.profiles.length >= MODEL_PREFERENCES_LIMITS.maxProfiles) return status('En fazla 6 profil kaydedebilirsin.');
    const profile = createProfile(name, nowSelection.model, nowSelection.agentId, nowSelection.toolsEnabled);
    if (!profile) return status('Model ve ajan seçimi olmadan profil kaydedilemez.');
    state = upsertProfile(state, profile);
    state = rememberSelection(state, nowSelection);
    saveModelPreferences(state);
    render();
    status('Profil kaydedildi.');
  });

  dialog.clear.addEventListener('click', () => {
    if (!globalThis.confirm('Tüm model/ajan profilleri ve son seçim temizlensin mi?')) return;
    state = { version: 1, selectedModel: '', selectedAgentId: '', profiles: [], updatedAt: new Date().toISOString() };
    saveModelPreferences(state);
    render();
    status('Model ve ajan tercihleri sıfırlandı.');
  });

  dialog.exportButton.addEventListener('click', () => {
    const payload = exportModelPreferences(state);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hafize-model-tercihleri.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    status('Tercihler dışa aktarıldı.');
  });

  dialog.importButton.addEventListener('click', () => dialog.file.click());
  dialog.file.addEventListener('change', async () => {
    const selectedFile = dialog.file.files?.[0];
    dialog.file.value = '';
    if (!selectedFile) return;
    if (selectedFile.size > MODEL_PREFERENCES_LIMITS.maxImport) {
      return status('Tercih yedeği 200 KB sınırını aşamaz.');
    }
    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text);
      const preview = previewModelPreferenceImport(state, parsed);
      if (!preview.willImport) {
        return status(
          preview.candidateCount
            ? 'Import için kullanılabilir kapasite veya geçerli profil yok.'
            : 'Import dosyasında profil bulunamadı.'
        );
      }
      const approved = globalThis.confirm(
        preview.willImport + ' profil alınacak; ' +
        preview.rejectedCount + ' kayıt reddedilecek; ' +
        preview.collisionCount + ' ID çakışması yeni ID ile korunacak. ' +
        preview.capacityRemaining + ' kapasite mevcut. Devam edilsin mi?'
      );
      if (!approved) return status('Import iptal edildi.');
      const result = importModelPreferences(state, parsed);
      state = result.state;
      saveModelPreferences(state);
      render();
      status(result.imported + ' profil içe aktarıldı; ' + result.rejected + ' kayıt reddedildi.');
    } catch {
      status('Geçersiz model tercihleri yedeği.');
    }
  });;

  const focusables = (): HTMLElement[] => Array.from(
    dialog.panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );

  const keyboard = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !dialog.panel.hidden) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Tab' && !dialog.panel.hidden) {
      const nodes = focusables();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== 'm') return;
    if (document.activeElement instanceof HTMLInputElement
      || document.activeElement instanceof HTMLTextAreaElement
      || document.activeElement instanceof HTMLSelectElement) return;
    event.preventDefault();
    if (dialog.panel.hidden) show();
    else close();
  };

  const onModelOrAgentChange = (): void => {
    persistSelection();
    if (!dialog.panel.hidden) render();
  };

  options.modelSelect.addEventListener('change', onModelOrAgentChange);
  options.agentSelect.addEventListener('change', onModelOrAgentChange);
  options.toolModeButton.addEventListener('click', onModelOrAgentChange);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY) return;
    state = loadModelPreferences();
    if (!dialog.panel.hidden) render();
  };
  document.addEventListener('keydown', keyboard);
  globalThis.addEventListener('storage', onStorage);

  return Object.freeze({
    refresh: (): void => {
      state = loadModelPreferences();
      if (!dialog.panel.hidden) render();
    },
    destroy: (): void => {
      open.remove();
      dialog.panel.remove();
      options.modelSelect.removeEventListener('change', onModelOrAgentChange);
      options.agentSelect.removeEventListener('change', onModelOrAgentChange);
      options.toolModeButton.removeEventListener('click', onModelOrAgentChange);
      document.removeEventListener('keydown', keyboard);
      globalThis.removeEventListener('storage', onStorage);
    }
  });
}

const boot = (): void => {
  const modelSelect = document.querySelector<HTMLSelectElement>('#modelSelect');
  const agentSelect = document.querySelector<HTMLSelectElement>('#agentSelect');
  const toolModeButton = document.querySelector<HTMLButtonElement>('#toolModeBtn');
  if (!modelSelect || !agentSelect || !toolModeButton) return;
};

// A browser entry must not throw where there is no DOM (Node checks, workers,
// prerender): the module still publishes its API, it only skips auto-mounting.
if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
}

