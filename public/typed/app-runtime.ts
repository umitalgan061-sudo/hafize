import { hafizeApi } from './hafize-api.ts';
import {
  connectivityFromHealth,
  type HealthResponse,
  type RuntimeConnectivity,
  type RuntimeSeverity,
  type RuntimeSnapshot
} from './hafize-types.ts';

const STATUS_ID = 'hafizeRuntimeStatus';
const DETAILS_ID = 'hafizeRuntimeDetails';
const REFRESH_INTERVAL_MS = 60_000;
const TOAST_ID = 'toast';

interface RuntimeElements {
  status: HTMLButtonElement;
  details: HTMLElement;
  body: HTMLElement;
  close: HTMLButtonElement;
  refresh: HTMLButtonElement;
}

export interface RuntimeController {
  readonly snapshot: () => RuntimeSnapshot;
  readonly refresh: () => Promise<void>;
  readonly destroy: () => void;
}

function button(label: string, className: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  return node;
}

function ensureElements(): RuntimeElements | null {
  const topbar = document.querySelector<HTMLElement>('.topbar');
  if (!topbar || document.getElementById(STATUS_ID)) return null;

  const status = button('… Kontrol ediliyor', 'runtime-status');
  status.id = STATUS_ID;
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-expanded', 'false');
  status.setAttribute('aria-controls', DETAILS_ID);

  const details = document.createElement('section');
  details.id = DETAILS_ID;
  details.className = 'runtime-details';
  details.hidden = true;
  details.setAttribute('role', 'dialog');
  details.setAttribute('aria-modal', 'false');
  details.setAttribute('aria-labelledby', `${DETAILS_ID}Title`);

  const heading = document.createElement('div');
  heading.className = 'runtime-details-head';
  const title = document.createElement('strong');
  title.id = `${DETAILS_ID}Title`;
  title.textContent = 'Hafize sistem durumu';
  const close = button('Kapat', 'mini-btn');
  close.setAttribute('aria-label', 'Sistem durumu panelini kapat');
  heading.append(title, close);

  const body = document.createElement('div');
  body.className = 'runtime-details-body';
  const refresh = button('Şimdi yenile', 'soft-btn');
  refresh.className += ' runtime-details-refresh';

  details.append(heading, body, refresh);
  const themeToggle = topbar.querySelector('#themeToggle');
  if (themeToggle) topbar.insertBefore(status, themeToggle);
  else topbar.append(status);
  topbar.append(details);
  return { status, details, body, close, refresh };
}

function connectivityLabel(value: RuntimeConnectivity): string {
  return value === 'online' ? 'Çevrimiçi' : value === 'offline' ? 'Çevrimdışı' : value === 'degraded' ? 'Sınırlı' : 'Kontrol ediliyor';
}

function connectivityIcon(value: RuntimeConnectivity): string {
  return value === 'online' ? '●' : value === 'offline' ? '○' : value === 'degraded' ? '◐' : '…';
}

function severityFor(value: RuntimeConnectivity): RuntimeSeverity {
  return value === 'online' ? 'success' : value === 'degraded' ? 'warning' : value === 'offline' ? 'error' : 'info';
}

function showToast(message: string, severity: RuntimeSeverity): void {
  const toast = document.getElementById(TOAST_ID);
  if (!toast) return;
  toast.dataset.severity = severity;
  toast.textContent = message.slice(0, 180);
  toast.classList.remove('hidden');
  globalThis.setTimeout(() => toast.classList.add('hidden'), 3200);
}

function row(parent: HTMLElement, label: string, value: string): void {
  const item = document.createElement('div');
  item.className = 'runtime-details-row';
  const left = document.createElement('span');
  left.className = 'runtime-details-label';
  left.textContent = label;
  const right = document.createElement('span');
  right.className = 'runtime-details-value';
  right.textContent = value;
  item.append(left, right);
  parent.append(item);
}

function renderHealth(body: HTMLElement, health: HealthResponse | null): void {
  body.replaceChildren();
  if (!health) {
    const empty = document.createElement('p');
    empty.textContent = 'Sunucu sağlık bilgisi alınamadı.';
    body.append(empty);
    return;
  }
  row(body, 'API', health.status === 'ok' ? 'Hazır' : 'Sınırlı');
  row(body, 'NVIDIA NIM', health.nvidiaConfigured ? 'Hazır' : 'Yapılandırılmamış');
  row(body, 'Ajanlar', String(health.agents));
  row(body, 'Context compaction', health.contextCompactionConfigured ? 'Açık' : 'Kapalı');
  row(body, 'Scheduled worker', health.scheduleWorkerConfigured ? 'Hazır' : 'Kapalı');
  row(body, 'Görev depolama', health.scheduleStorageDurable ? 'Kalıcı' : 'Geçici');
  row(body, 'Lease koruması', health.scheduleLeaseConfigured ? 'Açık' : 'Kapalı');
  row(body, 'GitHub', health.githubReadConfigured ? 'Hazır' : 'Kapalı');
  row(body, 'Canva', health.canvaReadConfigured ? 'Hazır' : 'Kapalı');
  row(body, 'Gmail', health.gmailReadConfigured ? 'Hazır' : 'Kapalı');
}

function render(elements: RuntimeElements, snapshot: RuntimeSnapshot): void {
  const label = connectivityLabel(snapshot.connectivity);
  elements.status.textContent = `${connectivityIcon(snapshot.connectivity)} ${label}`;
  elements.status.dataset.tone = severityFor(snapshot.connectivity);
  elements.status.title = snapshot.checkedAt ? `Son kontrol: ${new Date(snapshot.checkedAt).toLocaleTimeString('tr-TR')}` : 'Henüz kontrol yapılmadı';
  renderHealth(elements.body, snapshot.health);
}

export function mountHafizeRuntime(): RuntimeController | null {
  const elements = ensureElements();
  if (!elements) return null;

  let snapshot: RuntimeSnapshot = Object.freeze({
    connectivity: navigator.onLine ? 'unknown' : 'offline',
    checkedAt: null,
    apiReachable: false,
    health: null,
    lastErrorCode: null
  });
  let timer: ReturnType<typeof globalThis.setInterval> | undefined;
  let destroyed = false;

  const refresh = async (): Promise<void> => {
    if (destroyed) return;
    if (!navigator.onLine) {
      snapshot = Object.freeze({ ...snapshot, connectivity: 'offline', apiReachable: false, checkedAt: new Date().toISOString() });
      render(elements, snapshot);
      return;
    }
    const controller = new AbortController();
    try {
      const health = await hafizeApi.health(controller.signal);
      snapshot = Object.freeze({
        connectivity: connectivityFromHealth(health, true),
        checkedAt: new Date().toISOString(),
        apiReachable: true,
        health,
        lastErrorCode: null
      });
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'NETWORK_ERROR';
      snapshot = Object.freeze({
        ...snapshot,
        connectivity: 'degraded',
        checkedAt: new Date().toISOString(),
        apiReachable: false,
        lastErrorCode: code.slice(0, 80)
      });
    }
    render(elements, snapshot);
  };

  const toggle = (): void => {
    elements.details.hidden = !elements.details.hidden;
    elements.status.setAttribute('aria-expanded', String(!elements.details.hidden));
  };
  const close = (): void => {
    elements.details.hidden = true;
    elements.status.setAttribute('aria-expanded', 'false');
    elements.status.focus();
  };
  const online = (): void => { void refresh(); showToast('Bağlantı geri geldi.', 'success'); };
  const offline = (): void => {
    snapshot = Object.freeze({ ...snapshot, connectivity: 'offline', apiReachable: false, checkedAt: new Date().toISOString() });
    render(elements, snapshot);
    showToast('İnternet bağlantısı kesildi.', 'error');
  };
  const keyboard = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !elements.details.hidden) close();
  };

  elements.status.addEventListener('click', toggle);
  elements.close.addEventListener('click', close);
  elements.refresh.addEventListener('click', () => { void refresh(); });
  document.addEventListener('keydown', keyboard);
  globalThis.addEventListener('online', online);
  globalThis.addEventListener('offline', offline);
  void refresh();
  timer = globalThis.setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);

  return Object.freeze({
    snapshot: () => snapshot,
    refresh,
    destroy: () => {
      destroyed = true;
      if (timer !== undefined) globalThis.clearInterval(timer);
      elements.status.removeEventListener('click', toggle);
      elements.close.removeEventListener('click', close);
      document.removeEventListener('keydown', keyboard);
      globalThis.removeEventListener('online', online);
      globalThis.removeEventListener('offline', offline);
      elements.details.remove();
      elements.status.remove();
    }
  });
}

const controller = mountHafizeRuntime();
if (controller) globalThis.dispatchEvent(new CustomEvent('hafize:runtime-ready'));
