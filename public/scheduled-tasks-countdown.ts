interface CountdownRow extends HTMLElement {
  dataset: DOMStringMap & {
    status?: string;
    runAt?: string;
  };
}

interface CountdownWindow extends Window {
  ScheduledTaskCountdown?: Readonly<{
    label: (timestamp: string) => string;
    refresh: () => void;
    start: () => void;
    stop: () => void;
  }>;
}

const root = globalThis as unknown as CountdownWindow;
const PANEL_ID = 'scheduledTasksWorkspace';
const REFRESH_MS = 1_000;
let timer: ReturnType<typeof root.setInterval> | undefined;
let observer: MutationObserver | undefined;

export function countdownLabel(timestamp: string): string {
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

export function refreshCountdowns(documentRef: Document = root.document): void {
  const panel = documentRef?.getElementById(PANEL_ID);
  if (!panel || panel.hidden) return;
  panel.querySelectorAll<CountdownRow>('.scheduled-task-row').forEach((row) => {
    if (row.dataset.status !== 'scheduled') {
      row.querySelector('.scheduled-task-countdown')?.remove();
      return;
    }
    const meta = row.querySelector<HTMLElement>('.scheduled-task-meta');
    const timestamp = row.dataset.runAt || '';
    if (!meta || !timestamp) return;
    let node = row.querySelector<HTMLElement>('.scheduled-task-countdown');
    if (!node) {
      node = documentRef.createElement('span');
      node.className = 'scheduled-task-countdown';
      meta.append(' · ', node);
    }
    node.textContent = countdownLabel(timestamp);
  });
}

function stopCountdown(): void {
  if (timer === undefined) return;
  root.clearInterval(timer);
  timer = undefined;
}

function startCountdown(): void {
  stopCountdown();
  const panel = root.document?.getElementById(PANEL_ID);
  if (!panel || panel.hidden) return;
  timer = root.setInterval(() => refreshCountdowns(root.document), REFRESH_MS);
  refreshCountdowns(root.document);
}

function boot(): void {
  if (!root.document) return;
  root.addEventListener('hafize:scheduled-tasks-open', startCountdown);
  root.addEventListener('hafize:scheduled-tasks-close', stopCountdown);
  observer = new MutationObserver(() => {
    const panel = root.document.getElementById(PANEL_ID);
    if (panel && !panel.hidden) startCountdown();
    if (panel?.hidden) stopCountdown();
  });
  observer.observe(root.document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden']
  });
  root.addEventListener('beforeunload', () => {
    observer?.disconnect();
    stopCountdown();
    root.removeEventListener('hafize:scheduled-tasks-open', startCountdown);
    root.removeEventListener('hafize:scheduled-tasks-close', stopCountdown);
  }, { once: true });
}

root.ScheduledTaskCountdown = Object.freeze({
  label: countdownLabel,
  refresh: () => refreshCountdowns(root.document),
  start: startCountdown,
  stop: stopCountdown
});

if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
