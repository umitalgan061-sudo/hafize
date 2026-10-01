type HealthPayload = {
  status?: string;
  readiness?: {
    state?: 'ready' | 'degraded' | 'blocked' | 'unknown';
    releaseable?: boolean;
    components?: Record<string, 'ready' | 'warning' | 'blocked' | 'unknown'>;
    summary?: { total?: number; ready?: number; warning?: number; blocked?: number; unknown?: number };
  };
};

const CARD_ID = 'systemReadinessCard';
const REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;

const labels: Record<string, string> = {
  auth: 'Kimlik doğrulama',
  pwa: 'PWA',
  skills: 'Ajanlar / Skills',
  memory: 'Bellek',
  schedule: 'Görev zamanlama',
  connectors: 'Bağlantılar',
  model: 'Model',
  release: 'Sürüm'
};

const stateLabels: Record<string, string> = {
  ready: 'Hazır',
  warning: 'Uyarı',
  degraded: 'Kısmen hazır',
  blocked: 'Engelli',
  unknown: 'Bilinmiyor'
};

const make = <K extends keyof HTMLElementTagNameMap>(documentRef: Document, tag: K, className?: string, value?: string): HTMLElementTagNameMap[K] => {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};

async function fetchHealth(signal?: AbortSignal): Promise<HealthPayload> {
  const response = await fetch('/api/health', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal });
  if (!response.ok) throw new Error('HEALTH_HTTP_' + response.status);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('HEALTH_INVALID_RESPONSE');
  return data as HealthPayload;
}

function mount(documentRef: Document = document, root: Window = window) {
  const rail = documentRef.querySelector<HTMLElement>('.utility-rail');
  if (!rail || documentRef.getElementById(CARD_ID)) return null;

  const card = make(documentRef, 'section', 'utility-card system-readiness-card');
  card.id = CARD_ID;
  card.setAttribute('aria-labelledby', 'systemReadinessTitle');

  const head = make(documentRef, 'div', 'utility-head system-readiness-head');
  head.append(make(documentRef, 'span', 'mini-icon', '◈'));
  head.append(make(documentRef, 'strong', '', 'Sistem sağlığı'));

  const refresh = make(documentRef, 'button', 'mini-btn', 'Yenile');
  refresh.type = 'button';
  refresh.setAttribute('aria-label', 'Sistem sağlığı durumunu yenile');
  head.append(refresh);

  const title = make(documentRef, 'span', 'system-readiness-title', 'Hafize çalışma durumu');
  title.id = 'systemReadinessTitle';
  title.hidden = true;

  const summary = make(documentRef, 'div', 'system-readiness-summary');
  summary.setAttribute('aria-live', 'polite');
  const status = make(documentRef, 'span', 'system-readiness-state', 'Kontrol ediliyor…');
  const counts = make(documentRef, 'span', 'system-readiness-counts', '');
  summary.append(status, counts);

  const list = make(documentRef, 'div', 'system-readiness-list');
  list.setAttribute('role', 'list');

  const timestamp = make(documentRef, 'div', 'system-readiness-time', '');
  const error = make(documentRef, 'div', 'system-readiness-error', '');
  error.setAttribute('role', 'alert');

  card.append(head, title, summary, list, timestamp, error);
  rail.append(card);

  let timer = 0;
  let controller: AbortController | null = null;
  let destroyed = false;

  const render = (payload: HealthPayload) => {
    const readiness = payload.readiness;
    const state = readiness?.state || 'unknown';
    status.textContent = stateLabels[state] || 'Bilinmiyor';
    status.dataset.state = state;
    const s = readiness?.summary || {};
    counts.textContent = [s.ready || 0, s.warning || 0, s.blocked || 0, s.unknown || 0].join(' / ');
    list.replaceChildren();
    for (const [key, value] of Object.entries(readiness?.components || {})) {
      const row = make(documentRef, 'div', 'system-readiness-row');
      row.setAttribute('role', 'listitem');
      const name = make(documentRef, 'span', 'system-readiness-name', labels[key] || key);
      const badge = make(documentRef, 'span', 'system-readiness-badge', stateLabels[value] || value);
      badge.dataset.state = value;
      row.append(name, badge);
      list.append(row);
    }
    timestamp.textContent = 'Son kontrol: ' + new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    error.textContent = '';
  };

  const reportError = (message: string) => {
    status.textContent = 'Kontrol başarısız';
    status.dataset.state = 'blocked';
    error.textContent = message;
  };

  const refreshHealth = async () => {
    if (destroyed) return;
    controller?.abort();
    controller = new AbortController();
    const timeout = root.setTimeout(() => controller?.abort(), FETCH_TIMEOUT_MS);
    refresh.disabled = true;
    try {
      const payload = await fetchHealth(controller.signal);
      render(payload);
    } catch {
      reportError('Sistem sağlık bilgisi alınamadı.');
    } finally {
      root.clearTimeout(timeout);
      refresh.disabled = false;
    }
  };

  refresh.addEventListener('click', refreshHealth);
  void refreshHealth();
  timer = root.setInterval(refreshHealth, REFRESH_MS);

  return Object.freeze({
    refresh: refreshHealth,
    destroy: () => {
      destroyed = true;
      controller?.abort();
      root.clearInterval(timer);
      card.remove();
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void mount(); }, { once: true });
  else void mount();
}
