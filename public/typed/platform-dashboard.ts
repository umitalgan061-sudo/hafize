import { hafizePlatform, type PlatformSnapshot } from './platform-runtime.ts';

interface DashboardWindow extends Window {
  HafizePlatformDashboard?: Readonly<{ mount: () => PlatformDashboardController | null }>;
}

export type PlatformDashboardController = Readonly<{
  readonly mounted: true;
  readonly open: () => void;
  readonly close: () => void;
  readonly refresh: () => void;
  readonly destroy: () => void;
}>;

const root = globalThis as DashboardWindow;
const PANEL_ID = 'hafizePlatformDashboard';
const TOGGLE_ID = 'hafizePlatformDashboardToggle';

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function networkLabel(value: PlatformSnapshot['network']): string {
  return value === 'online' ? 'Çevrimiçi' : value === 'offline' ? 'Çevrimdışı' : 'Kontrol ediliyor';
}

function featureTone(value: string): string {
  return value === 'running' ? 'ok' : value === 'failed' ? 'error' : value === 'starting' ? 'busy' : 'muted';
}

function metricLabel(name: string): string {
  const labels: Record<string, string> = {
    navigation: 'Navigasyon', resource: 'Kaynak', longtask: 'Uzun görev', 'largest-contentful-paint': 'LCP', 'layout-shift': 'Layout shift', event: 'Etkileşim'
  };
  return labels[name] || name;
}

export function mountPlatformDashboard(documentRef: Document = root.document): PlatformDashboardController | null {
  const topbar = documentRef?.querySelector<HTMLElement>('.topbar');
  if (!documentRef || !topbar || documentRef.getElementById(PANEL_ID)) return null;

  const toggle = make(documentRef, 'button', 'Sistem', 'runtime-status');
  toggle.id = TOGGLE_ID;
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', PANEL_ID);
  toggle.title = 'Platform yetenekleri ve performans durumunu göster';

  const panel = make(documentRef, 'section', undefined, 'platform-dashboard');
  panel.id = PANEL_ID;
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', `${PANEL_ID}Title`);
  panel.setAttribute('aria-describedby', `${PANEL_ID}Description`);

  const head = make(documentRef, 'div', undefined, 'platform-dashboard-head');
  const title = make(documentRef, 'strong', 'Platform durumu');
  title.id = `${PANEL_ID}Title`;
  const closeButton = make(documentRef, 'button', 'Kapat', 'mini-btn');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Platform durum panelini kapat');
  head.append(title, closeButton);

  const description = make(documentRef, 'p', 'Tarayıcı yetenekleri, yerel depolama ve sınırlı performans metrikleri cihazda izlenir. Sunucuya analitik gönderilmez.');
  description.id = `${PANEL_ID}Description`;
  const body = make(documentRef, 'div', undefined, 'platform-dashboard-body');
  panel.append(head, description, body);

  const themeToggle = topbar.querySelector('#themeToggle');
  if (themeToggle) topbar.insertBefore(toggle, themeToggle);
  else topbar.append(toggle);
  topbar.append(panel);

  const row = (parent: HTMLElement, label: string, value: string): void => {
    const item = make(documentRef, 'div', undefined, 'platform-dashboard-row');
    item.append(make(documentRef, 'span', label, 'platform-dashboard-label'), make(documentRef, 'span', value, 'platform-dashboard-value'));
    parent.append(item);
  };

  const render = (): void => {
    const snapshot = hafizePlatform.snapshot();
    toggle.textContent = snapshot.phase === 'degraded' ? 'Sistem · Sınırlı' : snapshot.network === 'offline' ? 'Sistem · Çevrimdışı' : 'Sistem';
    toggle.dataset.tone = snapshot.phase === 'degraded' ? 'warning' : snapshot.network === 'offline' ? 'error' : 'success';
    body.replaceChildren();

    const overview = make(documentRef, 'div', undefined, 'platform-dashboard-grid');
    row(overview, 'Durum', snapshot.phase);
    row(overview, 'Ağ', networkLabel(snapshot.network));
    row(overview, 'Görünür', snapshot.visible ? 'Evet' : 'Hayır');
    row(overview, 'Hatalar', String(snapshot.errors));
    body.append(overview);

    const storage = make(documentRef, 'div', undefined, 'platform-dashboard-section');
    storage.append(make(documentRef, 'strong', 'Yerel depolama', 'platform-dashboard-section-title'));
    row(storage, 'Kullanım', formatBytes(snapshot.storage.usage));
    row(storage, 'Kota', formatBytes(snapshot.storage.quota));
    row(storage, 'Boş alan', formatBytes(snapshot.storage.available));
    row(storage, 'Kalıcı', snapshot.storage.persisted === null ? 'Bilinmiyor' : snapshot.storage.persisted ? 'Evet' : 'Hayır');
    body.append(storage);

    const capabilities = make(documentRef, 'div', undefined, 'platform-dashboard-section');
    capabilities.append(make(documentRef, 'strong', 'Yetenekler', 'platform-dashboard-section-title'));
    const capabilityNames = Object.entries(snapshot.capabilities).filter(([, enabled]) => enabled).map(([name]) => name);
    const capabilityText = capabilityNames.length ? capabilityNames.join(' · ') : 'Desteklenen yetenek yok';
    capabilities.append(make(documentRef, 'p', capabilityText, 'platform-dashboard-capabilities'));
    body.append(capabilities);

    const features = make(documentRef, 'div', undefined, 'platform-dashboard-section');
    features.append(make(documentRef, 'strong', 'Özellik durumları', 'platform-dashboard-section-title'));
    const entries = Object.entries(snapshot.featureStates);
    if (!entries.length) features.append(make(documentRef, 'p', 'Kayıtlı özellik yok.', 'platform-dashboard-empty'));
    for (const [id, state] of entries) {
      const item = make(documentRef, 'div', undefined, 'platform-dashboard-feature');
      item.append(make(documentRef, 'span', id, 'platform-dashboard-feature-id'), make(documentRef, 'span', state, `platform-dashboard-feature-state ${featureTone(state)}`));
      features.append(item);
    }
    body.append(features);

    const metrics = make(documentRef, 'div', undefined, 'platform-dashboard-section');
    metrics.append(make(documentRef, 'strong', 'Son metrikler', 'platform-dashboard-section-title'));
    const recent = snapshot.metrics.slice(-8).reverse();
    if (!recent.length) metrics.append(make(documentRef, 'p', 'Henüz performans metriği yok.', 'platform-dashboard-empty'));
    for (const metric of recent) {
      const value = metric.name === 'layout-shift' ? metric.value.toFixed(4) : `${metric.value.toFixed(1)} ms`;
      row(metrics, metricLabel(metric.name), value);
    }
    body.append(metrics);
  };

  const open = (): void => { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); render(); closeButton.focus(); };
  const close = (): void => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };
  const togglePanel = (): void => { if (panel.hidden) open(); else close(); };
  const onSnapshot = (): void => { if (!panel.hidden) render(); };
  const onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); } };

  toggle.addEventListener('click', togglePanel);
  closeButton.addEventListener('click', close);
  root.addEventListener('hafize:platform-snapshot', onSnapshot);
  root.document.addEventListener('keydown', onKeydown);
  render();

  return Object.freeze({
    mounted: true,
    open,
    close,
    refresh: render,
    destroy: () => {
      toggle.removeEventListener('click', togglePanel);
      closeButton.removeEventListener('click', close);
      root.removeEventListener('hafize:platform-snapshot', onSnapshot);
      root.document.removeEventListener('keydown', onKeydown);
      panel.remove();
      toggle.remove();
    }
  });
}

export const HafizePlatformDashboard = Object.freeze({ mount: mountPlatformDashboard });
root.HafizePlatformDashboard = HafizePlatformDashboard;
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void mountPlatformDashboard(document); }, { once: true });
  else mountPlatformDashboard(document);
}
