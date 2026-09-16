export type ThemePreference = 'system' | 'light' | 'dark';
export interface LocalConversationLike { readonly messages?: readonly unknown[]; }
export interface SettingsWorkspaceController { readonly showSettings: () => void; readonly refresh: () => { readonly conversations: number; readonly messages: number }; readonly destroy: () => void; }
interface SettingsRoot extends Window { HafizeSettingsWorkspace?: SettingsWorkspaceController; }

export const SETTINGS_KEYS = Object.freeze({ theme: 'hafize.theme.v1', reducedMotion: 'hafize.reduced-motion.v1', conversations: 'hafize.conversations.v1' });
const WORKSPACE_EVENT = 'hafize:workspace-changed';
const WORKSPACE_ID = 'settingsWorkspace';
const STYLE_ID = 'settingsWorkspaceStyle';
const STYLE_PATH = '/settings-workspace.css';

export function readThemePreference(storage: Storage | undefined): ThemePreference { try { const value = storage?.getItem(SETTINGS_KEYS.theme); return value === 'light' || value === 'dark' ? value : 'system'; } catch { return 'system'; } }
export function readReducedMotion(storage: Storage | undefined): boolean { try { return storage?.getItem(SETTINGS_KEYS.reducedMotion) === 'true'; } catch { return false; } }
export function writePreference(storage: Storage | undefined, key: string, value: string | null): boolean { try { if (value === null) storage?.removeItem(key); else storage?.setItem(key, value); return true; } catch { return false; } }
export function readConversationSummary(storage: Storage | undefined): { conversations: number; messages: number } { try { const value: unknown = JSON.parse(storage?.getItem(SETTINGS_KEYS.conversations) || '[]'); const conversations = Array.isArray(value) ? value : []; const messages = conversations.reduce((total, item) => total + (item && typeof item === 'object' && Array.isArray((item as LocalConversationLike).messages) ? (item as LocalConversationLike).messages!.length : 0), 0); return { conversations: conversations.length, messages }; } catch { return { conversations: 0, messages: 0 }; } }

function make<K extends keyof HTMLElementTagNameMap>(documentRef: Document, tag: K, textValue?: string, className?: string): HTMLElementTagNameMap[K] { const node = documentRef.createElement(tag); if (className) node.className = className; if (textValue !== undefined) node.textContent = textValue; return node; }
function ensureStyle(documentRef: Document): void { if (documentRef.getElementById(STYLE_ID)) return; const link = make(documentRef, 'link'); link.id = STYLE_ID; link.rel = 'stylesheet'; link.href = STYLE_PATH; documentRef.head.append(link); }

export function mountSettingsWorkspace(documentRef: Document = document, rootRef: SettingsRoot = globalThis as SettingsRoot): SettingsWorkspaceController | null {
  const rail = documentRef.querySelector<HTMLElement>('.utility-rail'); const primary = documentRef.querySelector<HTMLElement>('.primary-column'); const main = documentRef.querySelector<HTMLElement>('.main'); const nav = [...documentRef.querySelectorAll<HTMLButtonElement>('.nav-item')][3]; if (!rail || !primary || !main || !nav) return null;
  const existing = documentRef.getElementById(WORKSPACE_ID); if (existing) return null; ensureStyle(documentRef); const storage = rootRef.localStorage;
  const section = make(documentRef, 'section', undefined, 'settings-workspace'); section.id = WORKSPACE_ID; section.hidden = true; section.tabIndex = -1; section.setAttribute('aria-labelledby', 'settingsWorkspaceTitle');
  const title = make(documentRef, 'h1', 'Ayarlar'); title.id = 'settingsWorkspaceTitle'; section.append(title);
  const appearance = make(documentRef, 'section', undefined, 'settings-panel'); appearance.append(make(documentRef, 'h2', 'Görünüm'), make(documentRef, 'p', 'Tema ve hareket tercihlerini bu cihazda yerel olarak ayarla.'));
  const themeRow = make(documentRef, 'div', undefined, 'settings-row'); themeRow.append(make(documentRef, 'span', 'Tema', 'settings-label')); const theme = documentRef.createElement('select'); theme.setAttribute('aria-label', 'Tema tercihi'); [['system','Sistem'],['light','Açık'],['dark','Koyu']].forEach(([value, label]) => { const option = make(documentRef, 'option', label); option.value = value; option.selected = value === readThemePreference(storage); theme.append(option); }); themeRow.append(theme);
  const motionRow = make(documentRef, 'div', undefined, 'settings-row'); motionRow.append(make(documentRef, 'span', 'Azaltılmış hareket', 'settings-label')); const motion = documentRef.createElement('input'); motion.type = 'checkbox'; motion.checked = readReducedMotion(storage); motion.setAttribute('aria-label', 'Azaltılmış hareketi etkinleştir'); motionRow.append(motion); appearance.append(themeRow, motionRow);
  const data = make(documentRef, 'section', undefined, 'settings-panel'); data.append(make(documentRef, 'h2', 'Yerel sohbet verileri'), make(documentRef, 'p', 'Sohbet geçmişi tarayıcı yerel depolamasında tutulur.'));
  const stat = make(documentRef, 'span', '', 'settings-stat'); const refresh = make(documentRef, 'button', 'Özeti yenile'); refresh.type = 'button'; const clear = make(documentRef, 'button', 'Tüm sohbet geçmişini sil', 'settings-danger'); clear.type = 'button'; const actions = make(documentRef, 'div', undefined, 'settings-actions'); actions.append(refresh, clear); const dataRow = make(documentRef, 'div', undefined, 'settings-row'); dataRow.append(make(documentRef, 'span', 'Depolama özeti', 'settings-label'), stat); data.append(dataRow, actions);
  const app = make(documentRef, 'section', undefined, 'settings-panel'); app.append(make(documentRef, 'h2', 'Uygulama'), make(documentRef, 'p', 'PWA kurulumu ve klavye kısayolları.')); const install = make(documentRef, 'button', 'Uygulamayı yükle'); install.type = 'button'; const installRow = make(documentRef, 'div', undefined, 'settings-row'); installRow.append(make(documentRef, 'span', 'PWA', 'settings-label'), install); app.append(installRow);
  section.append(appearance, data, app); rail.prepend(section);
  const announce = (message: string): void => { const toast = documentRef.querySelector<HTMLElement>('#toast'); if (!toast) return; toast.textContent = message; toast.classList.remove('hidden'); rootRef.setTimeout(() => toast.classList.add('hidden'), 2600); };
  const refreshStats = (): { conversations: number; messages: number } => { const result = readConversationSummary(storage); stat.textContent = `${result.conversations} sohbet · ${result.messages} mesaj`; return result; };
  theme.addEventListener('change', () => { const value = theme.value as ThemePreference; writePreference(storage, SETTINGS_KEYS.theme, value === 'system' ? null : value); const dark = value === 'dark' || (value === 'system' && Boolean(rootRef.matchMedia?.('(prefers-color-scheme: dark)').matches)); documentRef.documentElement.dataset.theme = dark ? 'dark' : 'light'; announce(`Tema: ${theme.options[theme.selectedIndex]?.textContent || value}`); });
  motion.addEventListener('change', () => { writePreference(storage, SETTINGS_KEYS.reducedMotion, motion.checked ? 'true' : 'false'); documentRef.documentElement.dataset.reducedMotion = String(motion.checked); announce(motion.checked ? 'Azaltılmış hareket açıldı.' : 'Azaltılmış hareket kapatıldı.'); });
  refresh.addEventListener('click', () => { refreshStats(); announce('Depolama özeti yenilendi.'); });
  clear.addEventListener('click', () => { if (!rootRef.confirm?.('Tüm yerel sohbet geçmişi silinsin mi? Bu işlem geri alınamaz.')) return; try { storage.removeItem(SETTINGS_KEYS.conversations); refreshStats(); documentRef.getElementById('conversationList')?.replaceChildren(); announce('Yerel sohbet geçmişi silindi.'); } catch { announce('Yerel geçmiş silinemedi.'); } });
  install.addEventListener('click', () => { documentRef.getElementById('installBtn')?.click(); });
  const showSettings = (): void => { section.hidden = false; primary.hidden = true; main.dataset.workspace = 'settings'; for (const node of [...rail.children]) if (node !== section) (node as HTMLElement).hidden = true; nav.classList.add('active'); nav.setAttribute('aria-current', 'page'); section.focus(); };
  const restore = (event: Event): void => { const detail = (event as CustomEvent<{ workspace?: string }>).detail; if (detail?.workspace !== 'settings') { section.hidden = true; primary.hidden = false; main.removeAttribute('data-workspace'); } };
  const onNav = (event: MouseEvent): void => { event.preventDefault(); showSettings(); };
  nav.disabled = false; nav.addEventListener('click', onNav); rootRef.addEventListener(WORKSPACE_EVENT, restore); refreshStats();
  const destroy = (): void => { nav.removeEventListener('click', onNav); rootRef.removeEventListener(WORKSPACE_EVENT, restore); section.remove(); };
  const controller = Object.freeze({ showSettings, refresh: refreshStats, destroy }); rootRef.HafizeSettingsWorkspace = controller; return controller;
}

const boot = (): void => { void mountSettingsWorkspace(); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
