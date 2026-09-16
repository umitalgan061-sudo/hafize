(function installScheduledTaskStats(root) {
  'use strict';

  const API_PATH = '/api/schedules/stats';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const STATS_ID = 'scheduledTasksStats';
  const REFRESH_MS = 30_000;

  const doc = () => root.document;
  const make = (tag, text, className) => { const node = doc().createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };
  const safeJson = async (response) => { try { return await response.json(); } catch { return null; } };

  async function refresh(section) {
    try {
      const response = await root.fetch(API_PATH, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const payload = await safeJson(response);
      if (!response.ok || !payload?.stats) throw new Error('SCHEDULE_STATS_UNAVAILABLE');
      const stats = payload.stats;
      section.replaceChildren(
        make('span', `Toplam ${stats.total}`, 'scheduled-tasks-stat-total'),
        make('span', `Planlandı ${stats.counts?.scheduled || 0}`),
        make('span', `Çalışıyor ${stats.counts?.running || 0}`),
        make('span', `Tamamlandı ${stats.counts?.completed || 0}`),
        make('span', `Başarısız ${stats.counts?.failed || 0}`),
        make('span', `İptal ${stats.counts?.cancelled || 0}`),
        make('span', `Hazır ${stats.due || 0}`, 'scheduled-tasks-stat-due')
      );
      section.dataset.capacity = stats.capacity === 'unbounded' ? 'Sınırsız görev kotası' : 'Sınırlı görev kotası';
    } catch {
      section.replaceChildren(make('span', 'İstatistikler geçici olarak kullanılamıyor.', 'scheduled-tasks-stat-error'));
    }
  }

  function boot() {
    const panel = doc()?.getElementById?.(PANEL_ID);
    if (!panel || doc().getElementById(STATS_ID)) return;
    const section = make('div', undefined, 'scheduled-tasks-stats');
    section.id = STATS_ID;
    section.setAttribute('role', 'status');
    section.setAttribute('aria-live', 'polite');
    panel.querySelector('.scheduled-tasks-list-section')?.prepend(section);
    const run = () => refresh(section);
    panel.addEventListener('click', (event) => { if (event.target?.closest?.('[data-task-action="refresh"]')) root.setTimeout(run, 0); });
    panel.addEventListener('submit', () => root.setTimeout(run, 100));
    panel.addEventListener('scheduled-task-state-changed', run);
    const observer = new MutationObserver(() => { if (!section.isConnected) return; if (!section.dataset.initialized) { section.dataset.initialized = '1'; run(); } });
    observer.observe(panel, { childList: true, subtree: true });
    run();
    root.setInterval?.(run, REFRESH_MS);
  }

  root.ScheduledTasksStats = Object.freeze({ refreshAll: () => { const section = doc()?.getElementById?.(STATS_ID); return section ? refresh(section) : Promise.resolve(); } });
  if (doc()?.readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
