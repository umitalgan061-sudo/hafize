interface RuntimeSnapshotLike {
  readonly phase: string;
  readonly network: string;
  readonly visible: boolean;
  readonly errors: number;
  readonly storage: { readonly usage: number | null; readonly quota: number | null; readonly available: number | null; readonly persisted: boolean | null };
  readonly capabilities: Readonly<Record<string, boolean>>;
  readonly metrics: readonly { readonly name: string; readonly value: number }[];
  readonly featureStates: Readonly<Record<string, string>>;
}
interface RuntimeLike { readonly snapshot: () => RuntimeSnapshotLike }
interface RuntimeDashboardWindow extends Window { HafizePlatformRuntime?: RuntimeLike }
const root = globalThis as RuntimeDashboardWindow;
const ID = 'hafizePlatformDashboard';
const TOGGLE_ID = 'hafizePlatformDashboardToggle';

const el = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const fmt = (v: number | null): string => v === null || !Number.isFinite(v) ? '—' : v < 1024 ? `${Math.round(v)} B` : v < 1024 ** 2 ? `${(v / 1024).toFixed(1)} KB` : v < 1024 ** 3 ? `${(v / 1024 ** 2).toFixed(1)} MB` : `${(v / 1024 ** 3).toFixed(1)} GB`;
const net = (v: string): string => v === 'online' ? 'Çevrimiçi' : v === 'offline' ? 'Çevrimdışı' : 'Kontrol ediliyor';

export interface PlatformDashboardStaticController { readonly open: () => void; readonly close: () => void; readonly refresh: () => void; readonly destroy: () => void }

export function mountPlatformDashboardStatic(documentRef: Document = root.document, runtime: RuntimeLike | undefined = root.HafizePlatformRuntime): PlatformDashboardStaticController | null {
  const topbar = documentRef?.querySelector<HTMLElement>('.topbar');
  if (!documentRef || !topbar || !runtime || documentRef.getElementById(ID)) return null;
  const toggle = el(documentRef, 'button', 'Sistem', 'runtime-status');
  toggle.id = TOGGLE_ID; toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', ID); toggle.title = 'Platform yetenekleri ve performans durumunu göster';
  const panel = el(documentRef, 'section', undefined, 'platform-dashboard');
  panel.id = ID; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', `${ID}Title`);
  const head = el(documentRef, 'div', undefined, 'platform-dashboard-head'); const title = el(documentRef, 'strong', 'Platform durumu'); title.id = `${ID}Title`; const closeButton = el(documentRef, 'button', 'Kapat', 'mini-btn'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Platform durum panelini kapat'); head.append(title, closeButton);
  const description = el(documentRef, 'p', 'Tarayıcı yetenekleri, yerel depolama ve sınırlı performans metrikleri cihazda izlenir.'); description.id = `${ID}Description`;
  const body = el(documentRef, 'div', undefined, 'platform-dashboard-body'); panel.append(head, description, body); panel.setAttribute('aria-describedby', description.id);
  const theme = topbar.querySelector('#themeToggle'); if (theme) topbar.insertBefore(toggle, theme); else topbar.append(toggle); topbar.append(panel);
  const row = (parent: HTMLElement, label: string, value: string): void => { const item = el(documentRef, 'div', undefined, 'platform-dashboard-row'); item.append(el(documentRef, 'span', label, 'platform-dashboard-label'), el(documentRef, 'span', value, 'platform-dashboard-value')); parent.append(item); };
  const render = (): void => {
    const snapshot = runtime.snapshot(); toggle.textContent = snapshot.network === 'offline' ? 'Sistem · Çevrimdışı' : snapshot.phase === 'degraded' ? 'Sistem · Sınırlı' : 'Sistem'; toggle.dataset.tone = snapshot.phase === 'degraded' ? 'warning' : snapshot.network === 'offline' ? 'error' : 'success'; body.replaceChildren();
    const overview = el(documentRef, 'div', undefined, 'platform-dashboard-grid'); row(overview, 'Durum', snapshot.phase); row(overview, 'Ağ', net(snapshot.network)); row(overview, 'Görünür', snapshot.visible ? 'Evet' : 'Hayır'); row(overview, 'Hatalar', String(snapshot.errors)); body.append(overview);
    const storage = el(documentRef, 'section', undefined, 'platform-dashboard-section'); storage.append(el(documentRef, 'strong', 'Yerel depolama', 'platform-dashboard-section-title')); row(storage, 'Kullanım', fmt(snapshot.storage.usage)); row(storage, 'Kota', fmt(snapshot.storage.quota)); row(storage, 'Boş alan', fmt(snapshot.storage.available)); row(storage, 'Kalıcı', snapshot.storage.persisted === null ? 'Bilinmiyor' : snapshot.storage.persisted ? 'Evet' : 'Hayır'); body.append(storage);
    const caps = el(documentRef, 'section', undefined, 'platform-dashboard-section'); caps.append(el(documentRef, 'strong', 'Yetenekler', 'platform-dashboard-section-title')); const enabled = Object.entries(snapshot.capabilities).filter(([, value]) => value).map(([name]) => name); caps.append(el(documentRef, 'p', enabled.length ? enabled.join(' · ') : 'Desteklenen yetenek yok', 'platform-dashboard-capabilities')); body.append(caps);
    const features = el(documentRef, 'section', undefined, 'platform-dashboard-section'); features.append(el(documentRef, 'strong', 'Özellik durumları', 'platform-dashboard-section-title')); for (const [name, state] of Object.entries(snapshot.featureStates)) row(features, name, state); body.append(features);
    const metrics = el(documentRef, 'section', undefined, 'platform-dashboard-section'); metrics.append(el(documentRef, 'strong', 'Son metrikler', 'platform-dashboard-section-title')); for (const metric of snapshot.metrics.slice(-8).reverse()) row(metrics, metric.name, metric.name === 'layout-shift' ? metric.value.toFixed(4) : `${metric.value.toFixed(1)} ms`); body.append(metrics);
  };
  const open = (): void => { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); render(); closeButton.focus(); };
  const close = (): void => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };
  const togglePanel = (): void => panel.hidden ? open() : close();
  const onSnapshot = (): void => { if (!panel.hidden) render(); };
  const onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); } };
  toggle.addEventListener('click', togglePanel); closeButton.addEventListener('click', close); root.addEventListener('hafize:platform-snapshot', onSnapshot); documentRef.addEventListener('keydown', onKeydown); render();
  return Object.freeze({ open, close, refresh: render, destroy: () => { toggle.removeEventListener('click', togglePanel); closeButton.removeEventListener('click', close); root.removeEventListener('hafize:platform-snapshot', onSnapshot); documentRef.removeEventListener('keydown', onKeydown); panel.remove(); toggle.remove(); } });
}

if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mountPlatformDashboardStatic(document); }, { once: true }); else mountPlatformDashboardStatic(document); }
