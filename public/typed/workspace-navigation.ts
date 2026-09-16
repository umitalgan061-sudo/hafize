export const WORKSPACES = ['chat', 'tasks', 'connections'] as const;
export type Workspace = (typeof WORKSPACES)[number];
export const NAV_INDEX: Readonly<Record<Workspace, number>> = Object.freeze({ chat: 0, tasks: 1, connections: 2 });
export const CARD_IDS: Readonly<Record<Exclude<Workspace, 'chat'>, readonly string[]>> = Object.freeze({ tasks: ['scheduleRuntimeCard', 'scheduleListCard'], connections: ['accountConnectionCard', 'canvaConnectionCard', 'githubWriteReadinessCard'] });
export const CHANGE_EVENT = 'hafize:workspace-changed';
const INTRO_ID = 'workspaceNavigationIntro';
const STYLE_ID = 'workspaceNavigationStyle';
const STYLE_PATH = '/workspace-navigation.css';

const COPY: Record<Exclude<Workspace, 'chat'>, { eyebrow: string; title: string; description: string }> = {
  tasks: { eyebrow: 'Bulut görevleri', title: 'Görevler', description: 'Planlanmış ajan çalışmalarını, çalışma motorunun durumunu ve geçmiş görevleri tek yerde yönet.' },
  connections: { eyebrow: 'Güvenli bağlantılar', title: 'Bağlantılar', description: 'Hesap, Gmail, Canva ve GitHub bağlantı sınırlarını tek çalışma alanında kontrol et.' }
};

export function normalizeWorkspace(value: unknown): Workspace { return typeof value === 'string' && (WORKSPACES as readonly string[]).includes(value) ? value as Workspace : 'chat'; }
export function allowedCardIds(workspace: unknown): readonly string[] { const key = normalizeWorkspace(workspace); return key === 'chat' ? [] : CARD_IDS[key]; }
export function isWorkspaceCard(node: Element | null | undefined, workspace: unknown): boolean { const id = node?.id || ''; return Boolean(id && allowedCardIds(workspace).includes(id)); }
export function workspaceCopy(workspace: unknown): { eyebrow: string; title: string; description: string } | null { const key = normalizeWorkspace(workspace); return key === 'chat' ? null : COPY[key]; }

function snapshot(node: Element, name: string): { present: boolean; value: string | null } { const value = node.getAttribute(name); return { present: value !== null, value }; }
function restore(node: Element, name: string, value: { present: boolean; value: string | null }): void { if (value.present) node.setAttribute(name, value.value ?? ''); else node.removeAttribute(name); }

export function resolveNavigation(documentRef: Document): Readonly<Record<Workspace, HTMLButtonElement>> | null {
  const list = documentRef.querySelector('.nav-list'); const buttons = [...(list?.querySelectorAll<HTMLButtonElement>('.nav-item') || [])]; if (buttons.length < WORKSPACES.length) return null;
  const result = { chat: buttons[NAV_INDEX.chat], tasks: buttons[NAV_INDEX.tasks], connections: buttons[NAV_INDEX.connections] }; return result.chat && result.tasks && result.connections ? Object.freeze(result) as Readonly<Record<Workspace, HTMLButtonElement>> : null;
}

function ensureStyle(documentRef: Document): HTMLLinkElement | HTMLStyleElement | null {
  const existing = documentRef.getElementById(STYLE_ID); if (existing instanceof HTMLLinkElement || existing instanceof HTMLStyleElement) return existing;
  const link = documentRef.createElement('link'); link.id = STYLE_ID; link.rel = 'stylesheet'; link.href = STYLE_PATH; link.setAttribute('data-hafize-workspace-navigation-style', '1'); documentRef.head.append(link); return link;
}

function dispatchWorkspace(rootRef: Window, workspace: Workspace): void { try { rootRef.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { workspace } })); } catch {} }

export function createWorkspaceController(documentRef: Document = document, rootRef: Window = window): Readonly<{ mount: () => boolean; destroy: () => boolean; setWorkspace: (value: unknown, options?: { focus?: boolean; emit?: boolean }) => boolean; getWorkspace: () => Workspace; syncCards: () => void }> {
  const main = documentRef.querySelector<HTMLElement>('.main'); const primary = documentRef.querySelector<HTMLElement>('.primary-column'); const rail = documentRef.querySelector<HTMLElement>('.utility-rail'); const nav = resolveNavigation(documentRef);
  if (!main || !primary || !rail || !nav) throw new Error('WORKSPACE_NAVIGATION_HOST_UNAVAILABLE');
  let mounted = false; let destroyed = false; let current: Workspace = 'chat'; let observer: MutationObserver | null = null; let intro: HTMLElement | null = null; let ownedStyle: Element | null = null; const listeners: Array<() => void> = []; const cards = new Set<HTMLElement>(); const cardSnapshots = new Map<HTMLElement, boolean>();
  const original = { main: snapshot(main, 'data-workspace'), rail: snapshot(rail, 'aria-label'), primaryHidden: primary.hidden, nav: Object.fromEntries(WORKSPACES.map((key) => [key, { disabled: nav[key].disabled, active: nav[key].classList.contains('active'), current: snapshot(nav[key], 'aria-current') }])) as Record<Workspace, { disabled: boolean; active: boolean; current: { present: boolean; value: string | null } }> };
  const listen = (target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, typeof options === 'boolean' ? options : options ? { capture: options.capture } : undefined)); };
  const snapshotCards = () => { [...rail.children].forEach((node) => { if (node instanceof HTMLElement && !cardSnapshots.has(node)) { cardSnapshots.set(node, node.hidden); cards.add(node); } }); };
  const restoreCards = () => { cards.forEach((node) => { const value = cardSnapshots.get(node); if (value !== undefined) node.hidden = value; }); };
  const syncCards = () => { snapshotCards(); if (current === 'chat') { restoreCards(); return; } cards.forEach((node) => { if (node !== intro) node.hidden = !isWorkspaceCard(node, current); }); };
  const renderIntro = () => { if (!intro) return; const copy = workspaceCopy(current); intro.hidden = !copy; if (!copy) return; const eyebrow = intro.querySelector<HTMLElement>('[data-role="eyebrow"]'); const title = intro.querySelector<HTMLHeadingElement>('[data-role="title"]'); const description = intro.querySelector<HTMLElement>('[data-role="description"]'); if (eyebrow) eyebrow.textContent = copy.eyebrow; if (title) title.textContent = copy.title; if (description) description.textContent = copy.description; };
  const render = (focus = false) => { main.dataset.workspace = current; primary.hidden = current !== 'chat'; rail.setAttribute('aria-label', current === 'chat' ? (original.rail.value || 'Hafize yardımcı araçları') : current === 'tasks' ? 'Hafize görevler çalışma alanı' : 'Hafize bağlantılar çalışma alanı'); WORKSPACES.forEach((key) => { const active = key === current; nav[key].classList.toggle('active', active); if (active) nav[key].setAttribute('aria-current', 'page'); else nav[key].removeAttribute('aria-current'); }); renderIntro(); syncCards(); if (focus && current !== 'chat') intro?.focus(); };
  const setWorkspace = (value: unknown, options: { focus?: boolean; emit?: boolean } = {}) => { if (destroyed) return false; const next = normalizeWorkspace(value); const changed = next !== current; current = next; render(Boolean(options.focus)); if (changed && options.emit !== false) dispatchWorkspace(rootRef, current); return changed; };
  const mount = () => { if (mounted || destroyed || documentRef.getElementById(INTRO_ID)) return false; const style = ensureStyle(documentRef); if (!style) return false; ownedStyle = style; intro = documentRef.createElement('section'); intro.id = INTRO_ID; intro.className = 'workspace-navigation-intro'; intro.tabIndex = -1; intro.setAttribute('aria-live', 'polite'); const eyebrow = documentRef.createElement('span'); eyebrow.dataset.role = 'eyebrow'; const title = documentRef.createElement('h1'); title.dataset.role = 'title'; const description = documentRef.createElement('p'); description.dataset.role = 'description'; intro.append(eyebrow, title, description); rail.prepend(intro); WORKSPACES.forEach((key) => listen(nav[key], 'click', (() => setWorkspace(key, { focus: key !== 'chat' })) as EventListener)); nav.tasks.disabled = false; nav.connections.disabled = false; mounted = true; render(); observer = new MutationObserver(syncCards); observer.observe(rail, { childList: true }); return true; };
  const destroy = () => { if (!mounted || destroyed) return false; destroyed = true; observer?.disconnect(); listeners.splice(0).forEach((off) => { try { off(); } catch {} }); restoreCards(); intro?.remove(); if (ownedStyle && ownedStyle !== documentRef.getElementById(STYLE_ID)) ownedStyle.remove(); restore(main, 'data-workspace', original.main); restore(rail, 'aria-label', original.rail); primary.hidden = original.primaryHidden; WORKSPACES.forEach((key) => { nav[key].disabled = original.nav[key].disabled; nav[key].classList.toggle('active', original.nav[key].active); restore(nav[key], 'aria-current', original.nav[key].current); }); mounted = false; return true; };
  return Object.freeze({ mount, destroy, setWorkspace, getWorkspace: () => current, syncCards });
}

const start = () => { try { const controller = createWorkspaceController(document, window); controller.mount(); } catch {} };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
