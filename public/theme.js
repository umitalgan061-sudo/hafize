(function exposeHafizeTheme(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeTheme = api;
  const install = () => api.installTheme(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeTheme() {
  'use strict';

  const STORAGE_KEY = 'hafize.theme.v1';
  const LIGHT_COLOR = '#f7f5ef';
  const DARK_COLOR = '#171816';

  function normalizeTheme(value) {
    return value === 'light' || value === 'dark' ? value : '';
  }

  function readStoredTheme(storage) {
    try {
      return normalizeTheme(storage?.getItem?.(STORAGE_KEY));
    } catch {
      return '';
    }
  }

  function writeStoredTheme(storage, theme) {
    try {
      storage?.setItem?.(STORAGE_KEY, theme);
      return true;
    } catch {
      return false;
    }
  }

  function systemTheme(root) {
    return root?.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  }

  function applyTheme(documentRef, theme) {
    const resolved = normalizeTheme(theme) || 'light';
    const html = documentRef?.documentElement;
    if (!html) return resolved;

    html.dataset.theme = resolved;
    html.style.colorScheme = resolved;
    const meta = documentRef.querySelector?.('meta[name="theme-color"]');
    meta?.setAttribute?.('content', resolved === 'dark' ? DARK_COLOR : LIGHT_COLOR);
    return resolved;
  }

  function renderButton(button, theme) {
    if (!button) return;
    const dark = theme === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute?.('aria-label', dark ? 'Gündüz moduna geç' : 'Gece moduna geç');
    button.setAttribute?.('title', dark ? 'Gündüz modu' : 'Gece modu');
    button.setAttribute?.('aria-pressed', String(dark));
  }

  function installTheme(documentRef, root) {
    const button = documentRef?.querySelector?.('#themeToggle');
    const storage = root?.localStorage;
    const media = root?.matchMedia?.('(prefers-color-scheme: dark)');
    let explicitTheme = readStoredTheme(storage);
    let activeTheme = applyTheme(documentRef, explicitTheme || systemTheme(root));
    renderButton(button, activeTheme);

    function setTheme(theme, { persist = true } = {}) {
      const normalized = normalizeTheme(theme);
      if (!normalized) return activeTheme;
      explicitTheme = normalized;
      activeTheme = applyTheme(documentRef, normalized);
      if (persist) writeStoredTheme(storage, normalized);
      renderButton(button, activeTheme);
      return activeTheme;
    }

    function toggleTheme() {
      return setTheme(activeTheme === 'dark' ? 'light' : 'dark');
    }

    function handleSystemChange(event) {
      if (explicitTheme) return;
      activeTheme = applyTheme(documentRef, event?.matches ? 'dark' : 'light');
      renderButton(button, activeTheme);
    }

    button?.addEventListener?.('click', toggleTheme);
    media?.addEventListener?.('change', handleSystemChange);

    return Object.freeze({
      getTheme: () => activeTheme,
      setTheme,
      toggleTheme,
      destroy() {
        button?.removeEventListener?.('click', toggleTheme);
        media?.removeEventListener?.('change', handleSystemChange);
      }
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    LIGHT_COLOR,
    DARK_COLOR,
    normalizeTheme,
    readStoredTheme,
    systemTheme,
    applyTheme,
    installTheme
  });
});
