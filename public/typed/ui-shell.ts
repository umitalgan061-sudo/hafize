import { Disposer, on, query, safeStorage, writeStorage, text } from './browser-platform.ts';

export const UI_SHELL_THEME_KEY = 'hafize.theme.v1';
export const UI_SHELL_WEEKDAYS = Object.freeze(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
export type CalendarCell = { day: number; month: number; year: number; outside: boolean; selected: boolean };
export type CalendarPoint = { year: number; month: number; day: number };

export function resolveTheme(stored: unknown, prefersDark: boolean): 'light' | 'dark' {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function createMonthCells(year: number, month: number, selectedDay: number): CalendarCell[] {
  const first = new Date(year, month, 1); const startOffset = (first.getDay() + 6) % 7; const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return { day: date.getDate(), month: date.getMonth(), year: date.getFullYear(), outside: date.getMonth() !== month, selected: date.getMonth() === month && date.getDate() === selectedDay }; });
}

export function moveCalendarDate(year: number, month: number, day: number, key: string): CalendarPoint | null {
  const date = new Date(year, month, day); if (Number.isNaN(date.getTime())) return null;
  if (key === 'ArrowLeft') date.setDate(date.getDate() - 1); else if (key === 'ArrowRight') date.setDate(date.getDate() + 1); else if (key === 'ArrowUp') date.setDate(date.getDate() - 7); else if (key === 'ArrowDown') date.setDate(date.getDate() + 7); else if (key === 'Home') date.setDate(1); else if (key === 'End') date.setMonth(date.getMonth() + 1, 0); else return null;
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

export function installSidebarDisclosure(documentRef: Document): Readonly<{ isOpen: () => boolean; close: () => void; destroy: () => void }> | null {
  const sidebar = query<HTMLElement>(documentRef, '#sidebar'); const toggle = query<HTMLButtonElement>(documentRef, '#sidebarToggle'); if (!sidebar || !toggle) return null;
  let open = sidebar.classList.contains('open'); const disposer = new Disposer();
  const render = (next: boolean, focus = false) => { open = Boolean(next); sidebar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-controls', sidebar.id || 'sidebar'); toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç'); if (focus) toggle.focus(); };
  const click = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); render(!open); };
  const keydown = (event: Event) => { const keyEvent = event as KeyboardEvent; if (keyEvent.key !== 'Escape' || !open) return; keyEvent.preventDefault(); render(false, true); };
  on(toggle, 'click', click, true, disposer); on(documentRef, 'keydown', keydown, undefined, disposer); render(open);
  return Object.freeze({ isOpen: () => open, close: () => render(false), destroy: () => disposer.flush() });
}

export function installChatAccessibility(documentRef: Document): boolean {
  const messages = query<HTMLElement>(documentRef, '#messages'); if (!messages) return false;
  query<HTMLElement>(documentRef, '.chat-stage')?.removeAttribute('aria-live');
  messages.setAttribute('role', 'log'); messages.setAttribute('aria-live', 'polite'); messages.setAttribute('aria-relevant', 'additions text'); messages.setAttribute('aria-atomic', 'false'); messages.setAttribute('aria-label', 'Sohbet mesajları'); return true;
}

export function install(documentRef: Document = document, rootRef: Window = window): Readonly<{ getTheme: () => 'light' | 'dark'; renderCalendar: () => void; sidebarDisclosure: ReturnType<typeof installSidebarDisclosure>; destroy: () => void }> | null {
  if (!documentRef) return null;
  const disposer = new Disposer(); const sidebarDisclosure = installSidebarDisclosure(documentRef); installChatAccessibility(documentRef);
  if (sidebarDisclosure) disposer.add(() => sidebarDisclosure.destroy());
  const html = documentRef.documentElement; const themeToggle = query<HTMLButtonElement>(documentRef, '#themeToggle'); const media = rootRef.matchMedia?.('(prefers-color-scheme: dark)'); let theme = resolveTheme(safeStorage(rootRef.localStorage, UI_SHELL_THEME_KEY, ''), Boolean(media?.matches));
  const paintTheme = (next: 'light' | 'dark') => { theme = next; html.dataset.theme = next; themeToggle?.setAttribute('aria-pressed', String(next === 'dark')); themeToggle?.setAttribute('title', next === 'dark' ? 'Gündüz moduna geç' : 'Gece moduna geç'); query<HTMLMetaElement>(documentRef, 'meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#202122' : '#f7f5f0'); };
  const toggleTheme = () => { const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark'; writeStorage(rootRef.localStorage, UI_SHELL_THEME_KEY, next); paintTheme(next); };
  paintTheme(theme); on(themeToggle, 'click', toggleTheme, undefined, disposer);
  const monthLabel = query<HTMLElement>(documentRef, '#calendarMonth'); const calendarGrid = query<HTMLElement>(documentRef, '#calendarGrid'); let cursor = new Date(); let selectedDay = cursor.getDate();
  const renderCalendar = () => { if (!calendarGrid || !monthLabel) return; monthLabel.textContent = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor); calendarGrid.replaceChildren(...createMonthCells(cursor.getFullYear(), cursor.getMonth(), selectedDay).map((cell) => { const button = text<HTMLButtonElement>(documentRef, 'button', String(cell.day), `calendar-day${cell.outside ? ' outside' : ''}${cell.selected ? ' selected' : ''}`); button.type = 'button'; button.tabIndex = cell.selected ? 0 : -1; button.setAttribute('aria-label', `${cell.day} ${cell.month + 1} ${cell.year}`); button.setAttribute('aria-pressed', String(cell.selected)); const select = (point: CalendarPoint) => { cursor = new Date(point.year, point.month, 1); selectedDay = point.day; renderCalendar(); button.closest('#calendarGrid')?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus(); }; on(button, 'click', () => select({ year: cell.year, month: cell.month, day: cell.day }), undefined, disposer); on(button, 'keydown', ((event: Event) => { const point = moveCalendarDate(cell.year, cell.month, cell.day, (event as KeyboardEvent).key); if (!point) return; event.preventDefault(); select(point); }) as EventListener, undefined, disposer); return button; })); };
  on(query<HTMLButtonElement>(documentRef, '#calendarPrev'), 'click', () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1); selectedDay = 1; renderCalendar(); }, undefined, disposer);
  on(query<HTMLButtonElement>(documentRef, '#calendarNext'), 'click', () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1); selectedDay = 1; renderCalendar(); }, undefined, disposer);
  const mic = query<HTMLElement>(documentRef, '#micBtn'); const proxy = query<HTMLButtonElement>(documentRef, '#voiceProxy'); const voiceCard = query<HTMLElement>(documentRef, '.voice-card'); if (mic) { const observer = new MutationObserver(() => { const active = mic.getAttribute('aria-pressed') === 'true'; voiceCard?.classList.toggle('listening', active); if (proxy) proxy.textContent = active ? 'Dinlemeyi durdur' : 'Dinlemek için dokun'; }); observer.observe(mic, { attributes: true, attributeFilter: ['aria-pressed'] }); disposer.add(() => observer.disconnect()); }
  on(proxy, 'click', () => mic?.click(), undefined, disposer); renderCalendar();
  return Object.freeze({ getTheme: () => theme, renderCalendar, sidebarDisclosure, destroy: () => disposer.flush() });
}

const start = () => install(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
