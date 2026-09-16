export type WorkspaceName = 'chat' | 'tasks' | 'connections';
export interface WorkspaceCopy { readonly eyebrow: string; readonly title: string; readonly description: string; }
export interface WorkspaceNavigationController { readonly mount: () => boolean; readonly destroy: () => boolean; readonly setWorkspace: (workspace: WorkspaceName, options?: { focus?: boolean; emit?: boolean }) => boolean; readonly getWorkspace: () => WorkspaceName; readonly syncCards: () => void; }
interface NavigationRoot extends Window { HafizeWorkspaceNavigation?: Readonly<{ readonly mount: (documentRef: Document, rootRef: NavigationRoot) => WorkspaceNavigationController | null; }>; }
const root = globalThis as NavigationRoot;
export const WORKSPACES: readonly WorkspaceName[] = Object.freeze(['chat', 'tasks', 'connections']);
const NAV_INDEX: Readonly<Record<WorkspaceName, number>> = Object.freeze({ chat: 0, tasks: 1, connections: 2 });
const CARD_IDS: Readonly<Record<Exclude<WorkspaceName, 'chat'>, readonly string[]>> = Object.freeze({ tasks: Object.freeze(['scheduleRuntimeCard', 'scheduleListCard']), connections: Object.freeze(['accountConnectionCard', 'canvaConnectionCard', 'githubWriteReadinessCard']) });
export const CHANGE_EVENT = 'hafize:workspace-changed';
const COPY: Readonly<Record<Exclude<WorkspaceName, 'chat'>, WorkspaceCopy>> = Object.freeze({ tasks: Object.freeze({ eyebrow: 'Bulut görevleri', title: 'Görevler', description: 'Planlanmış ajan çalışmalarını, çalışma motorunun durumunu ve geçmiş görevleri tek yerde yönet.' }), connections: Object.freeze({ eyebrow: 'Güvenli bağlantılar', title: 'Bağlantılar', description: 'Hesap, Gmail, Canva ve GitHub bağlantı sınırlarını tek çalışma alanında kontrol et.' }) });

export function normalizeWorkspace(value: unknown): WorkspaceName { return typeof value === 'string' && (WORKSPACES as readonly string[]).includes(value) ? value as WorkspaceName : 'chat'; }
export function allowedCardIds(workspace: unknown): readonly string[] { const key = normalizeWorkspace(workspace); return key === 'chat' ? [] : CARD_IDS[key]; }
export function isWorkspaceCard(node: Element | null, workspace: WorkspaceName): boolean { const id = node?.id || ''; return allowedCardIds(workspace).includes(id); }
export function workspaceCopy(workspace: unknown): WorkspaceCopy | null { const key = normalizeWorkspace(workspace); return key === 'chat' ? null : COPY[key]; }

function resolveNavigation(documentRef: Document): Record<WorkspaceName, HTMLButtonElement> | null {
  const buttons = [...documentRef.querySelectorAll<HTMLButtonElement>('.nav-list .nav-item')];
  if (buttons.length < WORKSPACES.length) return null;
  const result = Object.fromEntries(WORKSPACES.map((workspace) => [workspace, buttons[NAV_INDEX[workspace]]])) as Partial<Record<WorkspaceName, HTMLButtonElement>>;
  return WORKSPACES.every((workspace) => Boolean(result[workspace])) ? result as Record<WorkspaceName, HTMLButtonElement> : null;
}

export function createWorkspaceNavigation(documentRef: Document = document, rootRef: NavigationRoot = root): WorkspaceNavigationController | null {
  const main = documentRef.querySelector<HTMLElement>('.main'); const primary = documentRef.querySelector<HTMLElement>('.primary-column'); const rail = documentRef.querySelector<HTMLElement>('.utility-rail'); const nav = resolveNavigation(documentRef);
  if (!main || !primary || !rail || !nav) return null;
  if (documentRef.getElementById('workspaceNavigationIntro')) return null;
  const intro = documentRef.createElement('section'); intro.id = 'workspaceNavigationIntro'; intro.className = 'workspace-navigation-intro'; intro.hidden = true; intro.tabIndex = -1; intro.setAttribute('aria-live', 'polite');
  const eyebrow = documentRef.createElement('span'); eyebrow.className = 'workspace-navigation-eyebrow'; const title = documentRef.createElement('h1'); title.className = 'workspace-navigation-title'; const description = documentRef.createElement('p'); description.className = 'workspace-navigation-description'; intro.append(eyebrow, title, description);
  const ownedCards = new Map<Element, boolean>(); for (const node of [...rail.children]) ownedCards.set(node, (node as HTMLElement).hidden);
  let current: WorkspaceName = 'chat'; let destroyed = false;
  const render = (focus = false): void => { if (destroyed) return; main.dataset.workspace = current; primary.hidden = current !== 'chat'; for (const [node, original] of ownedCards) (node as HTMLElement).hidden = current === 'chat' ? original : !isWorkspaceCard(node, current); const copy = workspaceCopy(current); intro.hidden = !copy; if (copy) { eyebrow.textContent = copy.eyebrow; title.textContent = copy.title; description.textContent = copy.description; } for (const workspace of WORKSPACES) { const button = nav[workspace]; const active = workspace === current; button.classList.toggle('active', active); button.setAttribute('aria-current', active ? 'page' : 'false'); button.disabled = false; } if (focus && current !== 'chat') intro.focus(); };
  const setWorkspace = (value: WorkspaceName, options: { focus?: boolean; emit?: boolean } = {}): boolean => { if (destroyed) return false; const next = normalizeWorkspace(value); const changed = next !== current; current = next; render(options.focus === true); if (changed && options.emit !== false) rootRef.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: Object.freeze({ workspace: current }) })); return changed; };
  const handlers: Array<() => void> = []; for (const workspace of WORKSPACES) { const handler = (event: Event): void => { event.preventDefault(); setWorkspace(workspace, { focus: workspace !== 'chat' }); }; nav[workspace].addEventListener('click', handler); handlers.push(() => nav[workspace].removeEventListener('click', handler)); }
  rail.prepend(intro); render();
  const observer = new MutationObserver(() => { for (const node of [...rail.children]) if (node !== intro && !ownedCards.has(node)) ownedCards.set(node, (node as HTMLElement).hidden); render(); }); observer.observe(rail, { childList: true });
  const destroy = (): boolean => { if (destroyed) return false; destroyed = true; observer.disconnect(); handlers.splice(0).forEach((off) => off()); for (const [node, hidden] of ownedCards) (node as HTMLElement).hidden = hidden; intro.remove(); primary.hidden = false; nav.tasks.disabled = true; nav.connections.disabled = true; main.removeAttribute('data-workspace'); return true; };
  return Object.freeze({ mount: () => true, destroy, setWorkspace, getWorkspace: () => current, syncCards: render });
}

export const HafizeWorkspaceNavigation = Object.freeze({ WORKSPACES, CHANGE_EVENT, normalizeWorkspace, allowedCardIds, isWorkspaceCard, workspaceCopy, createWorkspaceNavigation, mount: (documentRef: Document = document, rootRef: NavigationRoot = root) => createWorkspaceNavigation(documentRef, rootRef) });
root.HafizeWorkspaceNavigation = HafizeWorkspaceNavigation;
const boot = (): void => { void createWorkspaceNavigation(document, root); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
