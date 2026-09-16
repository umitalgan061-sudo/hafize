import { Disposer, on, query, safeJsonParse, safeStorage, writeStorage, text } from './browser-platform.ts';

export const SETTINGS_THEME_KEY = 'hafize.theme.v1';
export const SETTINGS_REDUCED_MOTION_KEY = 'hafize.reduced-motion.v1';
export const SETTINGS_CONVERSATIONS_KEY = 'hafize.conversations.v1';
export const SETTINGS_WORKSPACE_EVENT = 'hafize:workspace-changed';
export const SETTINGS_WORKSPACE_ID = 'settingsWorkspace';

type Conversation = { messages?: unknown };
type SettingsSnapshot = { conversations: number; messages: number };

export function readTheme(storage: Storage, mediaMatch = false): 'system' | 'light' | 'dark' { const value = safeStorage(storage, SETTINGS_THEME_KEY, ''); return value === 'light' || value === 'dark' ? value : 'system'; }
export function readReducedMotion(storage: Storage): boolean { return safeStorage(storage, SETTINGS_REDUCED_MOTION_KEY, '') === 'true'; }
export function readConversations(storage: Storage): Conversation[] { const value = safeJsonParse<unknown>(safeStorage(storage, SETTINGS_CONVERSATIONS_KEY, '[]'), []); return Array.isArray(value) ? value.filter((item): item is Conversation => Boolean(item && typeof item === 'object')) : []; }
export function formatCount(storage: Storage): SettingsSnapshot { const conversations = readConversations(storage); return { conversations: conversations.length, messages: conversations.reduce((total, item) => total + (Array.isArray(item.messages) ? item.messages.length : 0), 0) }; }

function button(documentRef: Document, label: string, className = ''): HTMLButtonElement { const node = text<HTMLButtonElement>(documentRef, 'button', label, className); node.type = 'button'; return node; }
function row(documentRef: Document, label: string, description: string): { node: HTMLElement; control: HTMLElement } { const node = documentRef.createElement('div'); node.className = 'settings-row'; const copy = documentRef.createElement('div'); copy.className = 'settings-copy'; copy.append(text(documentRef, 'span', label, 'settings-label'), text(documentRef, 'p', description)); const control = documentRef.createElement('div'); control.className = 'settings-control'; node.append(copy, control); return { node, control }; }

export function mountSettingsWorkspace(documentRef: Document = document, rootRef: Window = window): Readonly<{ show: () => void; hide: () => void; refresh: () => SettingsSnapshot; destroy: () => void }> | null {
  const main = query<HTMLElement>(documentRef, '.main'); const primary = query<HTMLElement>(documentRef, '.primary-column'); const rail = query<HTMLElement>(documentRef, '.utility-rail'); if (!main || !primary || !rail || documentRef.getElementById(SETTINGS_WORKSPACE_ID)) return null;
  const storage = rootRef.localStorage; const disposer = new Disposer(); const view = documentRef.createElement('section'); view.id = SETTINGS_WORKSPACE_ID; view.className = 'settings-workspace'; view.hidden = true; view.tabIndex = -1; view.setAttribute('aria-labelledby', 'settingsWorkspaceTitle');
  const appearance = documentRef.createElement('section'); appearance.className = 'settings-panel'; appearance.append(text(documentRef, 'h2', 'Görünüm')); const title = appearance.querySelector('h2'); if (title) title.id = 'settingsWorkspaceTitle';
  const themeRow = row(documentRef, 'Tema', 'Açık, koyu veya sistem temasını kullan.'); const theme = documentRef.createElement('select'); [['system', 'Sistem'], ['light', 'Açık'], ['dark', 'Koyu']].forEach(([value, label]) => { const option = text<HTMLOptionElement>(documentRef, 'option', label); option.value = value; theme.append(option); }); theme.value = readTheme(storage); themeRow.control.append(theme);
  const motionRow = row(documentRef, 'Azaltılmış hareket', 'Animasyonları ve geçişleri mümkün olduğunca azalt.'); const motion = documentRef.createElement('input'); motion.type = 'checkbox'; motion.checked = readReducedMotion(storage); motion.setAttribute('aria-label', 'Azaltılmış hareket'); motionRow.control.append(motion);
  appearance.append(themeRow.node, motionRow.node);
  const data = documentRef.createElement('section'); data.className = 'settings-panel'; data.append(text(documentRef, 'h2', 'Yerel sohbet verileri')); const dataRow = row(documentRef, 'Depolama özeti', 'Tarayıcıdaki mevcut yerel sohbet ve mesaj sayısını göster.'); const stat = text(documentRef, 'span', '', 'settings-stat'); dataRow.control.append(stat); const actions = text<HTMLElement>(documentRef, 'div', '', 'settings-actions'); const refreshButton = button(documentRef, 'Özeti yenile'); const clearButton = button(documentRef, 'Tüm sohbet geçmişini sil', 'settings-danger'); actions.append(refreshButton, clearButton); data.append(dataRow.node, actions);
  const app = documentRef.createElement('section'); app.className = 'settings-panel'; app.append(text(documentRef, 'h2', 'Uygulama')); const installRow = row(documentRef, 'PWA', 'Tarayıcı desteği varsa Hafize’yi uygulama olarak kur.'); const installButton = button(documentRef, 'Uygulamayı yükle'); installRow.control.append(installButton); const shortcutRow = row(documentRef, 'Klavye', 'Sohbet aramasına hızlıca geçmek için'); shortcutRow.control.append(text(documentRef, 'kbd', 'Ctrl / ⌘ + Shift + F', 'settings-kbd')); app.append(installRow.node, shortcutRow.node);
  view.append(appearance, data, app); rail.prepend(view);
  const nav = [...documentRef.querySelectorAll<HTMLButtonElement>('.nav-item')]; const settingsButton = nav[3]; settingsButton?.removeAttribute('disabled');
  const paintTheme = (value: string) => { const dark = value === 'dark' || (value === 'system' && rootRef.matchMedia?.('(prefers-color-scheme: dark)')?.matches); documentRef.documentElement.dataset.theme = dark ? 'dark' : 'light'; query<HTMLButtonElement>(documentRef, '#themeToggle')?.setAttribute('aria-pressed', String(dark)); query<HTMLMetaElement>(documentRef, 'meta[name="theme-color"]')?.setAttribute('content', dark ? '#202122' : '#f7f5f0'); };
  const refresh = () => { const value = formatCount(storage); stat.textContent = `${value.conversations} sohbet · ${value.messages} mesaj`; return value; };
  const show = () => { view.hidden = false; primary.hidden = true; main.dataset.workspace = 'settings'; for (const node of [...rail.children]) if (node !== view) (node as HTMLElement).hidden = true; rail.setAttribute('aria-label', 'Hafize ayarlar çalışma alanı'); nav.forEach((item, index) => { const active = index === 3; item.classList.toggle('active', active); if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current'); }); refresh(); view.focus(); };
  const hide = () => { view.hidden = true; primary.hidden = false; main.removeAttribute('data-workspace'); for (const node of [...rail.children]) if (node !== view) (node as HTMLElement).hidden = false; settingsButton?.classList.remove('active'); settingsButton?.removeAttribute('aria-current'); };
  const onTheme = () => { writeStorage(storage, SETTINGS_THEME_KEY, theme.value === 'system' ? '' : theme.value); paintTheme(theme.value); };
  const onMotion = () => { writeStorage(storage, SETTINGS_REDUCED_MOTION_KEY, motion.checked ? 'true' : 'false'); documentRef.documentElement.dataset.reducedMotion = String(motion.checked); };
  const onClear = () => { if (!readConversations(storage).length || !rootRef.confirm('Tüm yerel sohbet geçmişi silinsin mi? Bu işlem geri alınamaz.')) return; try { storage.removeItem(SETTINGS_CONVERSATIONS_KEY); } catch {} refresh(); documentRef.querySelector('#conversationList')?.replaceChildren(); };
  const onInstall = () => query<HTMLButtonElement>(documentRef, '#installBtn')?.click();
  on(theme, 'change', onTheme, undefined, disposer); on(motion, 'change', onMotion, undefined, disposer); on(refreshButton, 'click', refresh, undefined, disposer); on(clearButton, 'click', onClear, undefined, disposer); on(installButton, 'click', onInstall, undefined, disposer); on(settingsButton, 'click', ((event) => { event.preventDefault(); show(); }) as EventListener, undefined, disposer); refresh(); paintTheme(theme.value);
  return Object.freeze({ show, hide, refresh, destroy: () => { disposer.flush(); view.remove(); } });
}

const start = () => mountSettingsWorkspace(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
