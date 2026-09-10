(function exposeHafizeSettingsWorkspace(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeSettingsWorkspace = api;
    const install = () => api.mount(root.document, root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeSettingsWorkspace() {
  'use strict';

  const THEME_KEY = 'hafize.theme.v1';
  const REDUCED_MOTION_KEY = 'hafize.reduced-motion.v1';
  const STORAGE_KEY = 'hafize.conversations.v1';
  const WORKSPACE_EVENT = 'hafize:workspace-changed';
  const STYLE_ID = 'settingsWorkspaceStyle';
  const STYLE_PATH = '/settings-workspace.css';
  const WORKSPACE_ID = 'settingsWorkspace';

  function readTheme(storage, mediaMatch) {
    const stored = storage?.getItem?.(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : (mediaMatch ? 'dark' : 'light');
  }

  function readReducedMotion(storage) {
    return storage?.getItem?.(REDUCED_MOTION_KEY) === 'true';
  }

  function writeStorage(storage, key, value) {
    try {
      if (value === null) storage?.removeItem?.(key);
      else storage?.setItem?.(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function readConversations(storage) {
    try {
      const parsed = JSON.parse(storage?.getItem?.(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function formatCount(storage) {
    const conversations = readConversations(storage);
    const messages = conversations.reduce((total, item) => total + (Array.isArray(item?.messages) ? item.messages.length : 0), 0);
    return { conversations: conversations.length, messages };
  }

  function ensureStyle(documentRef) {
    if (!documentRef?.head || !documentRef.createElement) return false;
    if (documentRef.getElementById?.(STYLE_ID)) return true;
    const link = documentRef.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_PATH;
    documentRef.head.append(link);
    return true;
  }

  function buildPanel(documentRef, title, description) {
    const panel = documentRef.createElement('section');
    panel.className = 'settings-panel';
    const heading = documentRef.createElement('h2');
    heading.textContent = title;
    const copy = documentRef.createElement('p');
    copy.textContent = description;
    panel.append(heading, copy);
    return panel;
  }

  function buildRow(documentRef, label, description) {
    const row = documentRef.createElement('div');
    row.className = 'settings-row';
    const copy = documentRef.createElement('div');
    copy.className = 'settings-copy';
    const title = documentRef.createElement('span');
    title.className = 'settings-label';
    title.textContent = label;
    const detail = documentRef.createElement('p');
    detail.textContent = description;
    copy.append(title, detail);
    const control = documentRef.createElement('div');
    control.className = 'settings-control';
    row.append(copy, control);
    return { row, control };
  }

  function makeSelect(documentRef, options, value) {
    const select = documentRef.createElement('select');
    for (const option of options) {
      const item = documentRef.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      item.selected = option.value === value;
      select.append(item);
    }
    return select;
  }

  function makeButton(documentRef, text, className = '') {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.textContent = text;
    if (className) button.classList.add(className);
    return button;
  }

  function makeSwitch(documentRef, label, checked) {
    const wrap = documentRef.createElement('label');
    wrap.className = 'settings-switch';
    const input = documentRef.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const text = documentRef.createElement('span');
    text.textContent = label;
    wrap.append(input, text);
    return { wrap, input };
  }

  function createView(documentRef, storage, rootRef) {
    const section = documentRef.createElement('section');
    section.id = WORKSPACE_ID;
    section.className = 'settings-workspace';
    section.hidden = true;
    section.tabIndex = -1;
    section.setAttribute('aria-labelledby', `${WORKSPACE_ID}Title`);

    const appearance = buildPanel(documentRef, 'Görünüm', 'Hafize’nin görünümünü ve hareket davranışını bu cihazda yerel olarak ayarla.');
    const appearanceTitle = appearance.querySelector('h2');
    appearanceTitle.id = `${WORKSPACE_ID}Title`;

    const theme = buildRow(documentRef, 'Tema', 'Açık, koyu veya sistem temasını kullan.');
    const themeStored = storage?.getItem?.(THEME_KEY);
    const themeSelect = makeSelect(documentRef, [
      { value: 'system', label: 'Sistem' },
      { value: 'light', label: 'Açık' },
      { value: 'dark', label: 'Koyu' }
    ], themeStored === 'light' || themeStored === 'dark' ? themeStored : 'system');
    theme.control.append(themeSelect);

    const motion = buildRow(documentRef, 'Azaltılmış hareket', 'Animasyonları ve geçişleri mümkün olduğunca azalt.');
    const motionSwitch = makeSwitch(documentRef, 'Etkin', readReducedMotion(storage));
    motion.control.append(motionSwitch.wrap);
    appearance.append(theme.row, motion.row);

    const data = buildPanel(documentRef, 'Yerel sohbet verileri', 'Sohbet geçmişi bu tarayıcının yerel depolamasında tutulur; bu ekran sunucuya veri göndermez.');
    const stats = buildRow(documentRef, 'Depolama özeti', 'Tarayıcıdaki mevcut yerel sohbet ve mesaj sayısını gösterir.');
    const statText = documentRef.createElement('span');
    statText.className = 'settings-stat';
    stats.control.append(statText);
    const dataActions = documentRef.createElement('div');
    dataActions.className = 'settings-actions';
    const refreshBtn = makeButton(documentRef, 'Özeti yenile');
    const clearBtn = makeButton(documentRef, 'Tüm sohbet geçmişini sil', 'settings-danger');
    dataActions.append(refreshBtn, clearBtn);
    data.append(stats.row, dataActions);

    const app = buildPanel(documentRef, 'Uygulama', 'PWA kurulumu ve temel klavye kısayolları.');
    const install = buildRow(documentRef, 'PWA', 'Tarayıcın destekliyorsa Hafize’yi uygulama olarak kur.');
    const installBtn = makeButton(documentRef, 'Uygulamayı yükle');
    install.control.append(installBtn);
    const shortcut = buildRow(documentRef, 'Klavye', 'Sohbet aramasına hızlıca geçmek için');
    const key = documentRef.createElement('span');
    key.className = 'settings-kbd';
    key.textContent = 'Ctrl / ⌘ + Shift + F';
    shortcut.control.append(key);
    app.append(install.row, shortcut.row);

    section.append(appearance, data, app);

    function announce(text) {
      const toast = documentRef.querySelector('#toast');
      if (!toast || !text) return;
      toast.textContent = text;
      toast.classList.remove('hidden');
      rootRef?.setTimeout?.(() => toast.classList.add('hidden'), 2600);
    }

    function paintTheme(value) {
      const dark = value === 'dark' || (value === 'system' && rootRef?.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
      documentRef.documentElement.dataset.theme = dark ? 'dark' : 'light';
      documentRef.querySelector('#themeToggle')?.setAttribute('aria-pressed', String(dark));
      documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#202122' : '#f7f5f0');
    }

    function refreshStats() {
      const value = formatCount(storage);
      statText.textContent = `${value.conversations} sohbet · ${value.messages} mesaj`;
    }

    function onThemeChange() {
      const value = themeSelect.value;
      writeStorage(storage, THEME_KEY, value === 'system' ? null : value);
      paintTheme(value);
      announce(`Tema: ${themeSelect.options[themeSelect.selectedIndex]?.textContent || value}`);
    }

    function onMotionChange() {
      const enabled = motionSwitch.input.checked;
      writeStorage(storage, REDUCED_MOTION_KEY, enabled ? 'true' : 'false');
      documentRef.documentElement.dataset.reducedMotion = String(enabled);
      announce(enabled ? 'Azaltılmış hareket açıldı.' : 'Azaltılmış hareket kapatıldı.');
    }

    function onClear() {
      if (!readConversations(storage).length) return announce('Silinecek yerel sohbet geçmişi yok.');
      if (!rootRef?.confirm?.('Tüm yerel sohbet geçmişi silinsin mi? Bu işlem geri alınamaz.')) return;
      try { storage?.removeItem?.(STORAGE_KEY); } catch { return announce('Yerel geçmiş silinemedi.'); }
      if (typeof rootRef?.location?.reload === 'function') return rootRef.location.reload();
      refreshStats();
      documentRef.querySelector('#conversationList')?.replaceChildren?.();
      announce('Yerel sohbet geçmişi silindi.');
    }

    function onInstall() {
      const installControl = documentRef.querySelector('#installBtn');
      const available = installControl?.hidden === false;
      installControl?.click?.();
      if (!available) announce('Kurulum bu tarayıcıda şu anda kullanılamıyor.');
    }

    themeSelect.addEventListener('change', onThemeChange);
    motionSwitch.input.addEventListener('change', onMotionChange);
    refreshBtn.addEventListener('click', refreshStats);
    clearBtn.addEventListener('click', onClear);
    installBtn.addEventListener('click', onInstall);
    refreshStats();
    documentRef.documentElement.dataset.reducedMotion = String(readReducedMotion(storage));
    return section;
  }

  function mount(documentRef = globalThis.document, rootRef = globalThis) {
    if (!documentRef || !documentRef.querySelector?.('.main')) return null;
    const existing = documentRef.getElementById?.(WORKSPACE_ID);
    if (existing) return existing;
    ensureStyle(documentRef);
    const rail = documentRef.querySelector('.utility-rail');
    const primary = documentRef.querySelector('.primary-column');
    const main = documentRef.querySelector('.main');
    if (!rail || !primary || !main) return null;
    const storage = rootRef?.localStorage;
    const view = createView(documentRef, storage, rootRef);
    rail.prepend(view);
    const navButtons = Array.from(documentRef.querySelectorAll('.nav-item'));
    const settingsButton = navButtons[3];
    settingsButton?.removeAttribute?.('disabled');

    function setSettingsNavigation(active) {
      navButtons.forEach((button, index) => {
        const isActive = active ? index === 3 : button.classList.contains('active');
        button.classList.toggle('active', isActive);
        if (isActive) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
    }

    function showSettings() {
      view.hidden = false;
      primary.hidden = true;
      main.setAttribute('data-workspace', 'settings');
      const intro = documentRef.querySelector('#workspaceNavigationIntro');
      if (intro) intro.hidden = true;
      for (const node of Array.from(rail.children || [])) {
        if (node !== view && node !== intro) node.hidden = true;
      }
      rail.setAttribute('aria-label', 'Hafize ayarlar çalışma alanı');
      setSettingsNavigation(true);
      view.focus();
    }

    function restoreNavigation(event) {
      if (event?.detail?.workspace === 'settings') showSettings();
      else view.hidden = true;
      if (event?.detail?.workspace !== 'settings') setSettingsNavigation(false);
    }

    const onSettingsClick = (event) => {
      event.preventDefault();
      showSettings();
      const sidebar = documentRef.querySelector('#sidebar');
      const toggle = documentRef.querySelector('#sidebarToggle');
      if (sidebar?.classList?.contains('open') && typeof toggle?.click === 'function') toggle.click();
    };

    settingsButton?.addEventListener('click', onSettingsClick);
    rootRef?.addEventListener?.(WORKSPACE_EVENT, restoreNavigation);
    view.hidden = true;
    return Object.freeze({ view, showSettings, refresh: () => formatCount(storage) });
  }

  return Object.freeze({ THEME_KEY, REDUCED_MOTION_KEY, STORAGE_KEY, readTheme, readReducedMotion, readConversations, formatCount, mount });
});
