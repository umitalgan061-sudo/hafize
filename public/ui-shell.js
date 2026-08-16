(function exposeHafizeUiShell(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeUiShell = api;
    const install = () => api.install(root.document, root);
    const loadEnhancements = () => {
      const documentRef = root.document;
      if (!documentRef?.head || documentRef.querySelector?.('script[data-hafize-enhancements-entry="1"]')) return;
      const script = documentRef.createElement('script');
      script.src = '/enhancements-loader.js';
      script.defer = true;
      script.dataset.hafizeEnhancementsEntry = '1';
      documentRef.head.append(script);
    };
    if (root.document?.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', () => {
        install();
        loadEnhancements();
      }, { once: true });
    } else {
      install();
      loadEnhancements();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeUiShell() {
  'use strict';

  const THEME_KEY = 'hafize.theme.v1';
  const WEEKDAYS = Object.freeze(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);

  function resolveTheme(stored, prefersDark) {
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersDark ? 'dark' : 'light';
  }

  function createMonthCells(year, month, selectedDay) {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        day: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
        outside: date.getMonth() !== month,
        selected: date.getMonth() === month && date.getDate() === selectedDay
      };
    });
  }

  function moveCalendarDate(year, month, day, key) {
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

  function installSidebarDisclosure(documentRef) {
    const sidebar = documentRef?.querySelector?.('#sidebar');
    const toggle = documentRef?.querySelector?.('#sidebarToggle');
    if (!sidebar || !toggle) return null;
    let open = sidebar.classList?.contains?.('open') === true;

    function render(next, { focusToggle = false } = {}) {
      open = Boolean(next);
      sidebar.classList?.toggle?.('open', open);
      toggle.setAttribute?.('aria-expanded', String(open));
      toggle.setAttribute?.('aria-controls', sidebar.id || 'sidebar');
      toggle.setAttribute?.('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
      if (focusToggle) toggle.focus?.();
    }

    function onToggle(event) {
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      render(!open);
    }

    function onKeydown(event) {
      if (event?.key !== 'Escape' || !open) return;
      event.preventDefault?.();
      render(false, { focusToggle: true });
    }

    toggle.addEventListener?.('click', onToggle, true);
    documentRef.addEventListener?.('keydown', onKeydown);
    render(open);

    return Object.freeze({
      isOpen: () => open,
      close: () => render(false),
      destroy() {
        toggle.removeEventListener?.('click', onToggle, true);
        documentRef.removeEventListener?.('keydown', onKeydown);
      }
    });
  }

  function installChatAccessibility(documentRef) {
    const stage = documentRef?.querySelector?.('.chat-stage');
    const messages = documentRef?.querySelector?.('#messages');
    if (!messages) return false;
    stage?.removeAttribute?.('aria-live');
    messages.setAttribute?.('role', 'log');
    messages.setAttribute?.('aria-live', 'polite');
    messages.setAttribute?.('aria-relevant', 'additions text');
    messages.setAttribute?.('aria-atomic', 'false');
    messages.setAttribute?.('aria-label', 'Sohbet mesajları');
    return true;
  }

  function install(documentRef, root) {
    if (!documentRef) return null;
    const sidebarDisclosure = installSidebarDisclosure(documentRef);
    installChatAccessibility(documentRef);
    const html = documentRef.documentElement;
    const themeToggle = documentRef.querySelector('#themeToggle');
    const storage = root?.localStorage;
    const media = root?.matchMedia?.('(prefers-color-scheme: dark)');
    let theme = resolveTheme(storage?.getItem?.(THEME_KEY), Boolean(media?.matches));

    function paintTheme(next) {
      theme = next;
      html.dataset.theme = next;
      themeToggle?.setAttribute('aria-pressed', String(next === 'dark'));
      themeToggle?.setAttribute('title', next === 'dark' ? 'Gündüz moduna geç' : 'Gece moduna geç');
      documentRef.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#202122' : '#f7f5f0');
    }

    paintTheme(theme);
    themeToggle?.addEventListener('click', () => {
      const next = theme === 'dark' ? 'light' : 'dark';
      storage?.setItem?.(THEME_KEY, next);
      paintTheme(next);
    });

    const monthLabel = documentRef.querySelector('#calendarMonth');
    const calendarGrid = documentRef.querySelector('#calendarGrid');
    monthLabel?.setAttribute?.('aria-live', 'polite');
    calendarGrid?.setAttribute?.('aria-label', 'Takvim günleri');
    let cursor = new Date();
    let selectedDay = cursor.getDate();

    function renderCalendar({ focusSelected = false } = {}) {
      if (!calendarGrid || !monthLabel) return;
      monthLabel.textContent = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);
      const cells = createMonthCells(cursor.getFullYear(), cursor.getMonth(), selectedDay);
      calendarGrid.replaceChildren(...cells.map((cell) => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = `calendar-day${cell.outside ? ' outside' : ''}${cell.selected ? ' selected' : ''}`;
        button.textContent = String(cell.day);
        button.tabIndex = cell.selected ? 0 : -1;
        button.setAttribute('aria-label', `${cell.day} ${cell.month + 1} ${cell.year}`);
        button.setAttribute('aria-pressed', String(cell.selected));
        function selectCell(target) {
          cursor = new Date(target.year, target.month, 1);
          selectedDay = target.day;
          renderCalendar({ focusSelected: true });
        }
        button.addEventListener('click', () => selectCell(cell));
        button.addEventListener('keydown', (event) => {
          const target = moveCalendarDate(cell.year, cell.month, cell.day, event.key);
          if (!target) return;
          event.preventDefault();
          selectCell(target);
        });
        return button;
      }));
      if (focusSelected) calendarGrid.querySelector?.('[aria-pressed="true"]')?.focus?.();
    }

    documentRef.querySelector('#calendarPrev')?.addEventListener('click', () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      selectedDay = 1;
      renderCalendar({ focusSelected: true });
    });
    documentRef.querySelector('#calendarNext')?.addEventListener('click', () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      selectedDay = 1;
      renderCalendar({ focusSelected: true });
    });
    renderCalendar();

    const mic = documentRef.querySelector('#micBtn');
    const proxy = documentRef.querySelector('#voiceProxy');
    const voiceCard = documentRef.querySelector('.voice-card');
    proxy?.addEventListener('click', () => mic?.click());
    const observer = typeof root?.MutationObserver === 'function' && mic
      ? new root.MutationObserver(() => {
          const active = mic.getAttribute('aria-pressed') === 'true';
          voiceCard?.classList.toggle('listening', active);
          if (proxy) proxy.textContent = active ? 'Dinlemeyi durdur' : 'Dinlemek için dokun';
        })
      : null;
    observer?.observe(mic, { attributes: true, attributeFilter: ['aria-pressed'] });

    return Object.freeze({
      getTheme: () => theme,
      renderCalendar,
      sidebarDisclosure,
      destroy: () => {
        observer?.disconnect?.();
        sidebarDisclosure?.destroy?.();
      }
    });
  }

  return Object.freeze({ THEME_KEY, WEEKDAYS, resolveTheme, createMonthCells, moveCalendarDate, installSidebarDisclosure, installChatAccessibility, install });
});
