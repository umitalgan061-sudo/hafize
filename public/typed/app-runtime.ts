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
const REFRESH_MS = 60_000;
const TOAST_ID = 'toast';

interface RuntimeElements {
  status: HTMLButtonElement;
  details: HTMLElement;
  close: HTMLButtonElement;
  refresh: HTMLButtonElement;
}

interface RuntimeController {
  readonly snapshot: () => RuntimeSnapshot;
  readonly refresh: () => Promise<void>;
  readonly destroy: () => void;
}

function createButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}

function ensureStatusElement(): RuntimeElements | null {
  const topbar = document.querySelector<HTMLElement>('.topbar');
  if (!topbar || document.getElementById(STATUS_ID)) return null;

  const status = createButton('Sistem durumu', 'runtime-status');
  status.id = STATUS_ID;
  status.setAttribute('aria-expanded', 'false');
  status.setAttribute('aria-controls', DETAILS_ID);
  status.setAttribute('aria-live', 'polite');

  const details = document.createElement('section');
  details.id = DETAILS_ID;
  details.className = 'runtime-details';
  details.hidden = true;
  details.setAttribute('role', 'dialog');
  details.setAttribute('aria-labelledby', `${DETAILS_ID}Title`);

  const heading = document.createElement('div');
  heading.className = 'runtime-details-head';
  const title = document.createElement('strong');
  title.id = `${DETAILS_ID}Title`;
  title.textContent = 'Sistem durumu';
  const close = createButton('Kapat', 'mini-btn');
  close.setAttribute('aria-label', 'Sistem durumu panelini kapat');
  heading.append(title, close);

  const body = document.createElement('div');
  body.className = 'runtime-details-body';

  const refresh = createButton('Yenile', 'soft-btn');
  refresh.classList.add('runtime-details-refresh');

  details.append(heading, body, refresh);
  topbar.insertBefore(status, topbar.querySelector('#themeToggle'));
  topbar.append(details);
  return { status, details, close, refresh };
}

function connectivityLabel(connectivity: RuntimeConnectivity): string {
  switch (connectivity) {
    case 'online': return 'Çevrimiçi';
    case 'offline': return 'Çevrimdışı';
    case 'degraded': return 'Sınırlı';
    default: return 'Kontrol ediliyor';
  }
}

function connectivityIcon(connectivity: RuntimeConnectivity): string {
  switch (connectivity) {
    case 'online': return '●';
    case 'offline': return '○';
    case 'degraded': return '◐';
    default: return '…';
  }
}

function toneFor(connectivity: RuntimeConnectivity): RuntimeSeverity {
  if (connectivity === 'online') return 'success';
  if (connectivity === 'degraded') return 'warning';
  if (connectivity === 'offline') return 'error';
  return 'info';
}

function showToast(message: string, severity: RuntimeSeverity = 'info'): void {
  const toast = document.getElementById(TOAST_ID);
  if (!toast) return;
  toast.textContent = message.slice(0, 180);
  toast.dataset.severity = severity;
  toast.classList.remove('hidden');
  globalThis.setTimeout(() => toast.classList.add('hidden'), 3200);
}

function appendRow(parent: HTMLElement, label: string, value: string): void {
  const row = document.createElement('div');
  row.className = 'runtime-details-row';
  const key = document.createElement('span');
  key.className = 'runtime-details-label';
  key.textContent = label;
  const valueNode = document.createElement('span');
  valueNode.className = 'runtime-details-value';
  valueNode.textContent = value;
  row.append(key, valueNode);
  parent.append(row);
}

function renderHealth(body: HTMLElement, health: HealthResponse | null): void {
  body.replaceChildren();
  if (!health) {
    const empty = document.createElement('p');
    empty.textContent = 'Sunucu durum bilgisi henüz alınamadı.';
    body.append(empty);
    return;
  }
  appendRow(body, 'API', health.status === 'ok' ? 'Hazır' : 'Sınırlı');
  appendRow(body, 'NVIDIA NIM', health.nvidiaConfigured ? 'Hazır' : 'Yapılandırılmamış');
  appendRow(body, 'Ajanlar', String(health.agents));
  appendRow(body, 'Context compaction', health.contextCompactionConfigured ? 'Açık' : 'Kapalı');
  appendRow(body, 'Görev çalışanı', health.scheduleWorkerConfigured ? 'Hazır' : 'Kapalı');
  appendRow(body, 'Kalıcı görev depolama', health.scheduleStorageDurable ? 'Kalıcı' : 'Geçici');
  appendRow(body, 'Lease koruması', health.scheduleLeaseConfigured ? 'Açık' : 'Kapalı');
  appendRow(body, 'GitHub okuma', health.githubReadConfigured ? 'Hazır' : 'Kapalı');
  appendRow(body, 'Canva', health.canvaReadConfigured ? 'Hazır' : 'Kapalı');
  appendRow(body, 'Gmail', health.gmailReadConfigured ? 'Hazır' : 'Kapalı');
}

function updateIndicator(elements: RuntimeElements, snapshot: RuntimeSnapshot): void {
  const label = connectivityLabel(snapshot.connectivity);
  elements.status.textContent = `${connectivityIcon(snapshot.connectivity)} ${label}`;
  elements.status.dataset.tone = toneFor(snapshot.connectivity);
  elements.status.title = snapshot.checkedAt ? `Son kontrol: ${new Date(snapshot.checkedAt).toLocaleTimeString('tr-TR')}` : 'Durum kontrol ediliyor';
  renderHealth(elements.details.querySelector('.runtime-details-body') as HTMLElement, snapshot.health);
}

function createController(elements: RuntimeElements): RuntimeController {
  let current: RuntimeSnapshot = Object.freeze({
    connectivity: navigator.onLine ? 'unknown' : 'offline',
    checkedAt: null,
    apiReachable: false,
    health: null,
    lastErrorCode: null
  });
  let timer = 0;
  let destroyed = false;

  const refresh = async (): Promise<void> => {
    if (destroyed) return;
    const networkOnline = navigator.onLine;
    if (!networkOnline) {
      current = Object.freeze({ ...current, connectivity: 'offline', apiReachable: false, checkedAt: new Date().toISOString() });
      updateIndicator(elements, current);
      return;
    }
    const controller = new AbortController();
    try {
      const health = await hafizeApi.health(controller.signal);
      current = Object.freeze({
        connectivity: connectivityFromHealth(health, true),
        checkedAt: new Date().toISOString(),
        apiReachable: true,
        health,
        lastErrorCode: null
      });
      updateIndicator(elements, current);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : 'NETWORK_ERROR';
      current = Object.freeze({
        ...current,
        connectivity: 'degraded',
        checkedAt: new Date().toISOString(),
        apiReachable: false,
        lastErrorCode: code.slice(0, 80)
      });
      updateIndicator(elements, current);
    }
  };

  const onToggle = () => {
    const nextHidden = !elements.details.hidden;
    elements.details.hidden = nextHidden;
    elements.status.setAttribute('aria-expanded', String(!nextHidden));
  };
  const onClose = () => {
    elements.details.hidden = true;
    elements.status.setAttribute('aria-expanded', 'false');
    elements.status.focus();
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !elements.details.hidden) onClose();
  };
  const onOnline = () => { void refresh(); showToast('Bağlantı geri geldi.', 'success'); };
  const onOffline = () => {
    current = Object.freeze({ ...current, connectivity: 'offline', apiReachable: false, checkedAt: new Date().toISOString() });
    updateIndicator(elements, current);
    showToast('İnternet bağlantısı kesildi.', 'error');
  };

  elements.status.addEventListener('click', onToggle);
  elements.close.addEventListener('click', onClose);
  elements.refresh.addEventListener('click', () => { void refresh(); });
  document.addEventListener('keydown', onKeydown);
  globalThis.addEventListener('online', onOnline);
  globalThis.addEventListener('offline', onOffline);
  void refresh();
  timer = globalThis.setInterval(() => { void refresh(); }, REFRESH_MS);

  return {
    snapshot: () => current,
    refresh,
    destroy: () => {
      destroyed = true;
      globalThis.clearInterval(timer);
      elements.status.removeEventListener('click', onToggle);
      elements.close.removeEventListener('click', onClose);
      document.removeEventListener('keydown', onKeydown);
      globalThis.removeEventListener('online', onOnline);
      globalThis.removeEventListener('offline', onOffline);
      elements.details.remove();
      elements.status.remove();
    }
  };
}

export function mountHafizeRuntime(): RuntimeController | null {
  const elements = ensureStatusElement();
  if (!elements) return null;
  return createController(elements);
}

const controller = mountHafizeRuntime();
if (controller) globalThis.dispatchEvent(new CustomEvent('hafize:runtime-ready'));
