/**
 * Uygulama kabuğu: tema, kenar çubuğu açıklaması, sohbet erişilebilirliği ve
 * Pazartesi başlangıçlı Türkçe takvim.
 *
 * Saf yardımcılar (`resolveTheme`, `createMonthCells`, `moveCalendarDate`) DOM'a
 * dokunmaz ve doğrudan test edilebilir. Otomatik kurulum yalnızca gerçek bir
 * `document` varsa çalışır, böylece modül Node altında da içe aktarılabilir.
 */

export type Theme = 'light' | 'dark';

export interface CalendarCell {
  readonly day: number;
  readonly month: number;
  readonly year: number;
  readonly outside: boolean;
  readonly selected: boolean;
}

export interface CalendarCursor {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface SidebarDisclosure {
  readonly isOpen: () => boolean;
  readonly close: () => void;
  readonly destroy: () => void;
}

export interface UiShellObserver {
  observe: (target: unknown, options: { attributes: boolean; attributeFilter: string[] }) => void;
  disconnect: () => void;
}

/** Kabuğun ihtiyaç duyduğu global yüzey; testlerde sahte bir nesne verilir. */
export interface UiShellRoot {
  readonly localStorage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  readonly matchMedia?: ((query: string) => MediaQueryList) | undefined;
  readonly MutationObserver?: (new (callback: () => void) => UiShellObserver) | undefined;
}

export interface UiShellController {
  readonly getTheme: () => Theme;
  readonly renderCalendar: (options?: { readonly focusSelected?: boolean }) => void;
  readonly sidebarDisclosure: SidebarDisclosure | null;
  readonly destroy: () => void;
}

export const THEME_KEY = 'hafize.theme.v1';
export const WEEKDAYS = Object.freeze(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
const CALENDAR_CELL_COUNT = 42;

export function resolveTheme(stored: unknown, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function createMonthCells(year: number, month: number, selectedDay: number): readonly CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  return Object.freeze(Array.from({ length: CALENDAR_CELL_COUNT }, (_unused, index): CalendarCell => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return Object.freeze({
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      outside: date.getMonth() !== month,
      selected: date.getMonth() === month && date.getDate() === selectedDay
    });
  }));
}

export function moveCalendarDate(year: number, month: number, day: number, key: string): CalendarCursor | null {
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  switch (key) {
    case 'ArrowLeft': date.setDate(date.getDate() - 1); break;
    case 'ArrowRight': date.setDate(date.getDate() + 1); break;
    case 'ArrowUp': date.setDate(date.getDate() - 7); break;
    case 'ArrowDown': date.setDate(date.getDate() + 7); break;
    case 'Home': date.setDate(1); break;
    case 'End': date.setMonth(date.getMonth() + 1, 0); break;
    default: return null;
  }
  return Object.freeze({ year: date.getFullYear(), month: date.getMonth(), day: date.getDate() });
}

export function installSidebarDisclosure(documentRef: Document): SidebarDisclosure | null {
  const sidebar = documentRef?.querySelector?.<HTMLElement>('#sidebar');
  const toggle = documentRef?.querySelector?.<HTMLButtonElement>('#sidebarToggle');
  if (!sidebar || !toggle) return null;
  let open = sidebar.classList?.contains?.('open') === true;

  function render(next: boolean, { focusToggle = false }: { readonly focusToggle?: boolean } = {}): void {
    open = Boolean(next);
    sidebar!.classList?.toggle?.('open', open);
    toggle!.setAttribute?.('aria-expanded', String(open));
    toggle!.setAttribute?.('aria-controls', sidebar!.id || 'sidebar');
    toggle!.setAttribute?.('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    if (focusToggle) toggle!.focus?.();
  }

  function onToggle(event: Partial<Event>): void {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    render(!open);
  }

  function onKeydown(event: Partial<KeyboardEvent>): void {
    if (event?.key !== 'Escape' || !open) return;
    event.preventDefault?.();
    render(false, { focusToggle: true });
  }

  toggle.addEventListener?.('click', onToggle as EventListener, true);
  documentRef.addEventListener?.('keydown', onKeydown as EventListener);
  render(open);

  return Object.freeze({
    isOpen: (): boolean => open,
    close: (): void => render(false),
    destroy(): void {
      toggle.removeEventListener?.('click', onToggle as EventListener, true);
      documentRef.removeEventListener?.('keydown', onKeydown as EventListener);
    }
  });
}

export function installChatAccessibility(documentRef: Document): boolean {
  const stage = documentRef?.querySelector?.<HTMLElement>('.chat-stage');
  const messages = documentRef?.querySelector?.<HTMLElement>('#messages');
  if (!messages) return false;
  stage?.removeAttribute?.('aria-live');
  messages.setAttribute?.('role', 'log');
  messages.setAttribute?.('aria-live', 'polite');
  messages.setAttribute?.('aria-relevant', 'additions text');
  messages.setAttribute?.('aria-atomic', 'false');
  messages.setAttribute?.('aria-label', 'Sohbet mesajları');
  return true;
}

function addListener(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): () => void {
  target.addEventListener(type, listener, options);
  return (): void => target.removeEventListener(type, listener, options);
}

export function install(documentRef: Document, root: UiShellRoot): UiShellController | null {
  if (!documentRef) return null;
  const html = documentRef.documentElement;
  if (!html) return null;

  const disposers: (() => void)[] = [];
  const sidebarDisclosure = installSidebarDisclosure(documentRef);
  if (sidebarDisclosure) disposers.push(sidebarDisclosure.destroy);
  installChatAccessibility(documentRef);

  const storage = root?.localStorage;
  const media = root?.matchMedia?.('(prefers-color-scheme: dark)');
  let theme = resolveTheme(storage?.getItem?.(THEME_KEY), Boolean(media?.matches));
  const themeToggle = documentRef.querySelector<HTMLButtonElement>('#themeToggle');

  const paintTheme = (next: Theme): void => {
    theme = next;
    html.dataset.theme = next;
    themeToggle?.setAttribute('aria-pressed', String(next === 'dark'));
    themeToggle?.setAttribute('title', next === 'dark' ? 'Gündüz moduna geç' : 'Gece moduna geç');
    documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#202122' : '#f7f5f0');
  };
  paintTheme(theme);

  if (themeToggle) {
    disposers.push(addListener(themeToggle, 'click', () => {
      const next: Theme = theme === 'dark' ? 'light' : 'dark';
      try { storage?.setItem?.(THEME_KEY, next); } catch { /* depolama opsiyoneldir */ }
      paintTheme(next);
    }));
  }
  if (media) {
    disposers.push(addListener(media, 'change', (): void => {
      if (!storage?.getItem?.(THEME_KEY)) paintTheme(resolveTheme(null, Boolean(media.matches)));
    }));
  }

  const monthLabel = documentRef.querySelector<HTMLElement>('#calendarMonth');
  const calendarGrid = documentRef.querySelector<HTMLElement>('#calendarGrid');
  monthLabel?.setAttribute('aria-live', 'polite');
  calendarGrid?.setAttribute('aria-label', 'Takvim günleri');
  let cursor = new Date();
  let selectedDay = cursor.getDate();

  const renderCalendar = (options: { readonly focusSelected?: boolean } = {}): void => {
    if (!calendarGrid || !monthLabel) return;
    monthLabel.textContent = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);
    const cells = createMonthCells(cursor.getFullYear(), cursor.getMonth(), selectedDay);
    const selectCell = (target: CalendarCursor): void => {
      cursor = new Date(target.year, target.month, 1);
      selectedDay = target.day;
      renderCalendar({ focusSelected: true });
    };
    calendarGrid.replaceChildren(...cells.map((cell) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = `calendar-day${cell.outside ? ' outside' : ''}${cell.selected ? ' selected' : ''}`;
      button.textContent = String(cell.day);
      button.tabIndex = cell.selected ? 0 : -1;
      button.setAttribute('aria-label', `${cell.day} ${cell.month + 1} ${cell.year}`);
      button.setAttribute('aria-pressed', String(cell.selected));
      button.addEventListener('click', () => selectCell(cell));
      button.addEventListener('keydown', (event: KeyboardEvent) => {
        const target = moveCalendarDate(cell.year, cell.month, cell.day, event.key);
        if (!target) return;
        event.preventDefault();
        selectCell(target);
      });
      return button;
    }));
    if (options.focusSelected) calendarGrid.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus?.();
  };

  const prev = documentRef.querySelector<HTMLButtonElement>('#calendarPrev');
  const next = documentRef.querySelector<HTMLButtonElement>('#calendarNext');
  if (prev) {
    disposers.push(addListener(prev, 'click', () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      selectedDay = 1;
      renderCalendar({ focusSelected: true });
    }));
  }
  if (next) {
    disposers.push(addListener(next, 'click', () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      selectedDay = 1;
      renderCalendar({ focusSelected: true });
    }));
  }
  renderCalendar();

  const mic = documentRef.querySelector<HTMLButtonElement>('#micBtn');
  const proxy = documentRef.querySelector<HTMLButtonElement>('#voiceProxy');
  const voiceCard = documentRef.querySelector<HTMLElement>('.voice-card');
  if (proxy) disposers.push(addListener(proxy, 'click', () => mic?.click()));

  const Observer = root?.MutationObserver;
  const observer = mic && typeof Observer === 'function'
    ? new Observer(() => {
        const active = mic.getAttribute('aria-pressed') === 'true';
        voiceCard?.classList.toggle('listening', active);
        if (proxy) proxy.textContent = active ? 'Dinlemeyi durdur' : 'Dinlemek için dokun';
      })
    : null;
  if (mic) observer?.observe?.(mic, { attributes: true, attributeFilter: ['aria-pressed'] });

  return Object.freeze({
    getTheme: (): Theme => theme,
    renderCalendar,
    sidebarDisclosure,
    destroy(): void {
      observer?.disconnect?.();
      for (const dispose of disposers.splice(0)) dispose();
    }
  });
}

const api = Object.freeze({
  THEME_KEY,
  WEEKDAYS,
  resolveTheme,
  createMonthCells,
  moveCalendarDate,
  installSidebarDisclosure,
  installChatAccessibility,
  install
});

type UiShellGlobal = typeof globalThis & {
  HafizeUiShell?: typeof api;
  document?: Document;
};

const browserRoot = globalThis as UiShellGlobal;
browserRoot.HafizeUiShell = api;

/** Yalnızca tarayıcıda otomatik kurulum; Node altında import yan etkisi yoktur. */
if (browserRoot.document) {
  const doc = browserRoot.document;
  const boot = (): void => { install(doc, browserRoot as unknown as UiShellRoot); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
