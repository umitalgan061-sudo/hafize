(function enhanceScheduledTaskCountdown(root) {
  'use strict';
  const PANEL_ID = 'scheduledTasksWorkspace';
  const REFRESH_MS = 1_000;
  let timer = 0;

  function label(timestamp) {
    const target = Date.parse(timestamp || '');
    if (!Number.isFinite(target)) return '';
    const delta = target - Date.now();
    if (delta <= 0) return 'Şimdi çalışması bekleniyor';
    const minutes = Math.floor(delta / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} gün ${hours % 24} saat kaldı`;
    if (hours > 0) return `${hours} saat ${minutes % 60} dk kaldı`;
    return `${Math.max(1, minutes)} dk kaldı`;
  }

  function refresh() {
    const panel = root.document?.getElementById?.(PANEL_ID);
    if (!panel || panel.hidden) return;
    panel.querySelectorAll('.scheduled-task-row').forEach((row) => {
      if (row.dataset.status !== 'scheduled') {
        row.querySelector('.scheduled-task-countdown')?.remove();
        return;
      }
      const meta = row.querySelector('.scheduled-task-meta');
      const timestamp = row.dataset.runAt;
      if (!meta || !timestamp) return;
      let node = row.querySelector('.scheduled-task-countdown');
      if (!node) { node = root.document.createElement('span'); node.className = 'scheduled-task-countdown'; meta.append(' · ', node); }
      node.textContent = label(timestamp);
    });
  }

  function watch() {
    if (timer) return;
    timer = root.setInterval?.(refresh, REFRESH_MS) || 0;
    refresh();
  }

  function boot() {
    if (!root.document) return;
    const observer = new MutationObserver(() => watch());
    observer.observe(root.document.documentElement, { childList: true, subtree: true });
    watch();
    root.addEventListener('beforeunload', () => { observer.disconnect(); root.clearInterval?.(timer); timer = 0; }, { once: true });
  }

  root.ScheduledTaskCountdown = Object.freeze({ label, refresh });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self);
