export type HafizeTheme = 'light' | 'dark';

export interface HafizeRuntimeOptions {
  root?: Document;
  storage?: Storage;
  initialTheme?: HafizeTheme;
}

const THEME_KEY = 'hafize.theme.v1';

function safeTheme(value: string | null | undefined, fallback: HafizeTheme): HafizeTheme {
  return value === 'dark' || value === 'light' ? value : fallback;
}

function readTheme(storage: Storage | undefined, fallback: HafizeTheme): HafizeTheme {
  try {
    return safeTheme(storage?.getItem(THEME_KEY), fallback);
  } catch {
    return fallback;
  }
}

export function applyTheme(documentRef: Document, theme: HafizeTheme): HafizeTheme {
  documentRef.documentElement.dataset.theme = theme;
  documentRef.documentElement.style.colorScheme = theme;
  documentRef.dispatchEvent(new CustomEvent('hafize:theme-change', { detail: { theme } }));
  return theme;
}

export function persistTheme(storage: Storage | undefined, theme: HafizeTheme): boolean {
  try { storage?.setItem(THEME_KEY, theme); return true; } catch { return false; }
}

export function installThemeController(options: HafizeRuntimeOptions = {}): () => void {
  const documentRef = options.root ?? document;
  const storage = options.storage ?? window.localStorage;
  let theme = readTheme(storage, options.initialTheme ?? safeTheme(documentRef.documentElement.dataset.theme, 'light'));
  const toggle = documentRef.getElementById('themeToggle');
  const render = (): void => {
    applyTheme(documentRef, theme);
    toggle?.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle?.setAttribute('aria-label', theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç');
  };
  const onClick = (): void => { theme = theme === 'dark' ? 'light' : 'dark'; persistTheme(storage, theme); render(); };
  toggle?.addEventListener('click', onClick);
  render();
  return () => toggle?.removeEventListener('click', onClick);
}

export function installNetworkStatus(documentRef: Document = document, root: Window = window): () => void {
  const target = documentRef.getElementById('toast');
  const notify = (): void => {
    if (!target) return;
    target.textContent = root.navigator.onLine ? 'Bağlantı yeniden kuruldu.' : 'Çevrimdışısın; yerel özellikler çalışmaya devam eder.';
    target.classList.remove('hidden');
    root.setTimeout(() => target.classList.add('hidden'), 3200);
  };
  root.addEventListener('online', notify); root.addEventListener('offline', notify);
  return () => { root.removeEventListener('online', notify); root.removeEventListener('offline', notify); };
}

export function bootTypedShell(options: HafizeRuntimeOptions = {}): () => void {
  const cleanupTheme = installThemeController(options);
  const cleanupNetwork = installNetworkStatus(options.root, window);
  return () => { cleanupTheme(); cleanupNetwork(); };
}

if (typeof document !== 'undefined') {
  const start = (): void => { bootTypedShell(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
