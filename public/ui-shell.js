(function exposeHafizeUiShell(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeUiShell = api;
    const install = () => api.install(root.document, root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
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

  function install(documentRef, root) {
    if (!documentRef) return null;
    const sidebarDisclosure = installSidebarDisclosure(documentRef);
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
    let cursor = new Date();
    let selectedDay = cursor.getDate();

    function renderCalendar() {
      if (!calendarGrid || !monthLabel) return;
      monthLabel.textContent = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(cursor);
      calendarGrid.replaceChildren(...createMonthCells(cursor.getFullYear(), cursor.getMonth(), selectedDay).map((cell) => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = `calendar-day${cell.outside ? ' outside' : ''}${cell.selected ? ' selected' : ''}`;
        button.textContent = String(cell.day);
        button.setAttribute('aria-label', `${cell.day} ${cell.month + 1} ${cell.year}`);
        button.addEventListener('click', () => {
          cursor = new Date(cell.year, cell.month, 1);
          selectedDay = cell.day;
          renderCalendar();
        });
        return button;
      }));
    }

    documentRef.querySelector('#calendarPrev')?.addEventListener('click', () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      selectedDay = 1;
      renderCalendar();
    });
    documentRef.querySelector('#calendarNext')?.addEventListener('click', () => {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      selectedDay = 1;
      renderCalendar();
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

  return Object.freeze({ THEME_KEY, WEEKDAYS, resolveTheme, createMonthCells, installSidebarDisclosure, install });
});