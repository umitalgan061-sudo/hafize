import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const theme = require('../public/theme.js');

function fakeElement() {
  const attrs = new Map();
  const listeners = new Map();
  return {
    textContent: '',
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    click() { listeners.get('click')?.(); },
    listeners
  };
}

function harness({ stored = '', dark = false, storageThrows = false } = {}) {
  const button = fakeElement();
  const meta = fakeElement();
  const mediaListeners = new Map();
  const media = {
    matches: dark,
    addEventListener(type, handler) { mediaListeners.set(type, handler); },
    removeEventListener(type, handler) { if (mediaListeners.get(type) === handler) mediaListeners.delete(type); }
  };
  const values = new Map(stored ? [[theme.STORAGE_KEY, stored]] : []);
  const storage = {
    getItem(key) { if (storageThrows) throw new Error('blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (storageThrows) throw new Error('blocked'); values.set(key, String(value)); }
  };
  const documentElement = { dataset: {}, style: {} };
  const documentRef = {
    documentElement,
    querySelector(selector) {
      if (selector === '#themeToggle') return button;
      if (selector === 'meta[name="theme-color"]') return meta;
      return null;
    }
  };
  const root = { localStorage: storage, matchMedia: () => media };
  return { button, meta, mediaListeners, values, documentRef, documentElement, root };
}

assert.equal(theme.normalizeTheme('dark'), 'dark');
assert.equal(theme.normalizeTheme('light'), 'light');
assert.equal(theme.normalizeTheme('system'), '');
assert.equal(theme.systemTheme({ matchMedia: () => ({ matches: true }) }), 'dark');
assert.equal(theme.systemTheme({ matchMedia: () => ({ matches: false }) }), 'light');

{
  const h = harness({ dark: true });
  const controller = theme.installTheme(h.documentRef, h.root);
  assert.equal(controller.getTheme(), 'dark');
  assert.equal(h.documentElement.dataset.theme, 'dark');
  assert.equal(h.documentElement.style.colorScheme, 'dark');
  assert.equal(h.meta.getAttribute('content'), theme.DARK_COLOR);
  assert.equal(h.button.textContent, '☀');
  assert.equal(h.button.getAttribute('aria-pressed'), 'true');
  assert.equal(h.button.getAttribute('aria-label'), 'Gündüz moduna geç');

  h.button.click();
  assert.equal(controller.getTheme(), 'light');
  assert.equal(h.values.get(theme.STORAGE_KEY), 'light');
  assert.equal(h.meta.getAttribute('content'), theme.LIGHT_COLOR);
  assert.equal(h.button.textContent, '☾');
  assert.equal(h.button.getAttribute('aria-pressed'), 'false');

  controller.setTheme('dark');
  assert.equal(h.values.get(theme.STORAGE_KEY), 'dark');
  controller.destroy();
  assert.equal(h.button.listeners.size, 0);
  assert.equal(h.mediaListeners.size, 0);
}

{
  const h = harness({ stored: 'light', dark: true });
  const controller = theme.installTheme(h.documentRef, h.root);
  assert.equal(controller.getTheme(), 'light', 'stored user choice wins over system preference');
  h.mediaListeners.get('change')?.({ matches: true });
  assert.equal(controller.getTheme(), 'light', 'system changes do not override explicit choice');
}

{
  const h = harness({ dark: false });
  const controller = theme.installTheme(h.documentRef, h.root);
  assert.equal(controller.getTheme(), 'light');
  h.mediaListeners.get('change')?.({ matches: true });
  assert.equal(controller.getTheme(), 'dark', 'system changes apply before the user chooses explicitly');
  assert.equal(h.meta.getAttribute('content'), theme.DARK_COLOR);
}

{
  const h = harness({ dark: true, storageThrows: true });
  const controller = theme.installTheme(h.documentRef, h.root);
  assert.equal(controller.getTheme(), 'dark', 'blocked storage must not break theme initialization');
  h.button.click();
  assert.equal(controller.getTheme(), 'light', 'blocked storage must not break manual toggling');
}

assert.equal(theme.applyTheme(null, 'dark'), 'dark');
console.log('Theme OK: system default, persisted override, toggle UX, theme-color and storage fallback verified');
