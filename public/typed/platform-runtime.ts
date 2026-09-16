export type PlatformPhase = 'booting' | 'ready' | 'degraded' | 'stopped';
export type NetworkState = 'online' | 'offline' | 'unknown';
export type FeatureState = 'registered' | 'starting' | 'running' | 'failed' | 'stopped';
export type MetricName = 'navigation' | 'longtask' | 'resource' | 'largest-contentful-paint' | 'layout-shift' | 'event';

export interface RuntimeCapabilities {
  readonly storage: boolean;
  readonly storageEstimate: boolean;
  readonly serviceWorker: boolean;
  readonly speechSynthesis: boolean;
  readonly speechRecognition: boolean;
  readonly screenCapture: boolean;
  readonly clipboard: boolean;
  readonly webTransport: boolean;
  readonly trustedTypes: boolean;
  readonly performanceObserver: boolean;
  readonly idleCallback: boolean;
}

export interface RuntimeMetric {
  readonly name: MetricName;
  readonly value: number;
  readonly at: number;
  readonly detail?: string;
}

export interface StorageSnapshot {
  readonly usage: number | null;
  readonly quota: number | null;
  readonly available: number | null;
  readonly persisted: boolean | null;
}

export interface PlatformSnapshot {
  readonly phase: PlatformPhase;
  readonly network: NetworkState;
  readonly visible: boolean;
  readonly onlineAt: string | null;
  readonly offlineAt: string | null;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly capabilities: RuntimeCapabilities;
  readonly storage: StorageSnapshot;
  readonly metrics: readonly RuntimeMetric[];
  readonly featureStates: Readonly<Record<string, FeatureState>>;
  readonly errors: number;
}

export interface PlatformFeatureContext {
  readonly signal: AbortSignal;
  readonly capabilities: RuntimeCapabilities;
  readonly snapshot: () => PlatformSnapshot;
  readonly scheduleIdle: (callback: () => void, timeout?: number) => number;
  readonly addMetric: (metric: Omit<RuntimeMetric, 'at'>) => void;
}

export interface PlatformFeature {
  readonly id: string;
  readonly priority?: number;
  readonly start: (context: PlatformFeatureContext) => void | (() => void) | Promise<void | (() => void)>;
}

interface PlatformWindow extends Window {
  readonly HafizePlatformRuntime?: PlatformRuntime;
  readonly requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  readonly cancelIdleCallback?: (handle: number) => void;
}

const root = globalThis as PlatformWindow;
const MAX_METRICS = 80;
const MAX_ERRORS = 24;
const MAX_FEATURES = 48;
const STORAGE_KEY = 'hafize.platform-runtime.v1';
const SNAPSHOT_VERSION = 1;

function nowIso(): string { return new Date().toISOString(); }
function clampMetric(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(value, Number.MAX_SAFE_INTEGER)) : 0; }

function detectCapabilities(windowRef: PlatformWindow): RuntimeCapabilities {
  const navigatorRef = typeof navigator === 'undefined' ? null : navigator;
  return Object.freeze({
    storage: (() => { try { return Boolean(windowRef.localStorage); } catch { return false; } })(),
    storageEstimate: Boolean(navigatorRef?.storage && typeof navigatorRef.storage.estimate === 'function'),
    serviceWorker: Boolean(navigatorRef && 'serviceWorker' in navigatorRef),
    speechSynthesis: 'speechSynthesis' in windowRef && typeof windowRef.speechSynthesis?.speak === 'function',
    speechRecognition: 'SpeechRecognition' in windowRef || 'webkitSpeechRecognition' in windowRef,
    screenCapture: Boolean(navigatorRef?.mediaDevices && typeof navigatorRef.mediaDevices.getDisplayMedia === 'function'),
    clipboard: Boolean(navigatorRef?.clipboard?.writeText),
    webTransport: 'WebTransport' in windowRef,
    trustedTypes: 'trustedTypes' in windowRef,
    performanceObserver: typeof windowRef.PerformanceObserver === 'function',
    idleCallback: typeof windowRef.requestIdleCallback === 'function'
  });
}

async function estimateStorage(): Promise<StorageSnapshot> {
  const navigatorRef = typeof navigator === 'undefined' ? null : navigator;
  if (!navigatorRef?.storage) return { usage: null, quota: null, available: null, persisted: null };
  try {
    const [estimate, persisted] = await Promise.all([
      typeof navigatorRef.storage.estimate === 'function' ? navigatorRef.storage.estimate() : Promise.resolve({}),
      typeof navigatorRef.storage.persisted === 'function' ? navigatorRef.storage.persisted() : Promise.resolve(null)
    ]);
    const usage = typeof estimate.usage === 'number' ? estimate.usage : null;
    const quota = typeof estimate.quota === 'number' ? estimate.quota : null;
    return { usage, quota, available: usage !== null && quota !== null ? Math.max(0, quota - usage) : null, persisted };
  } catch {
    return { usage: null, quota: null, available: null, persisted: null };
  }
}

function readPersistedSnapshot(): Partial<PlatformSnapshot> {
  try {
    const raw = root.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const record = parsed as Record<string, unknown>;
    return Number(record.version) === SNAPSHOT_VERSION ? parsed as Partial<PlatformSnapshot> : {};
  } catch { return {}; }
}

function persistSnapshot(snapshot: PlatformSnapshot): void {
  try {
    root.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ version: SNAPSHOT_VERSION, phase: snapshot.phase, startedAt: snapshot.startedAt, updatedAt: snapshot.updatedAt }));
  } catch { /* diagnostics must never break application features */ }
}

export class PlatformRuntime {
  private readonly controllers = new Map<string, AbortController>();
  private readonly cleanup = new Map<string, () => void>();
  private readonly listeners: Array<() => void> = [];
  private readonly metrics: RuntimeMetric[] = [];
  private readonly featureStates = new Map<string, FeatureState>();
  private readonly errorMessages: string[] = [];
  private readonly features = new Map<string, PlatformFeature>();
  private snapshotValue: PlatformSnapshot;
  private phase: PlatformPhase = 'booting';
  private idleHandle = 0;
  private storageRefreshToken = 0;
  private started = false;

  constructor(private readonly windowRef: PlatformWindow = root) {
    const persisted = readPersistedSnapshot();
    const startedAt = typeof persisted.startedAt === 'string' ? persisted.startedAt : nowIso();
    const network = windowRef.navigator?.onLine === false ? 'offline' : 'online';
    this.snapshotValue = Object.freeze({
      phase: 'booting', network,
      visible: windowRef.document?.visibilityState !== 'hidden',
      onlineAt: network === 'offline' ? null : startedAt, offlineAt: null,
      startedAt, updatedAt: nowIso(), capabilities: detectCapabilities(windowRef),
      storage: { usage: null, quota: null, available: null, persisted: null }, metrics: [], featureStates: {}, errors: 0
    });
  }

  snapshot(): PlatformSnapshot { return this.snapshotValue; }

  private patch(patch: Partial<PlatformSnapshot>): void {
    this.snapshotValue = Object.freeze({ ...this.snapshotValue, ...patch, updatedAt: nowIso(), metrics: Object.freeze(this.metrics.slice(-MAX_METRICS)), featureStates: Object.freeze(Object.fromEntries(this.featureStates.entries())) });
    persistSnapshot(this.snapshotValue);
    this.windowRef.dispatchEvent(new CustomEvent('hafize:platform-snapshot', { detail: this.snapshotValue }));
  }

  private setPhase(phase: PlatformPhase): void { this.phase = phase; this.patch({ phase }); }

  addMetric(metric: Omit<RuntimeMetric, 'at'>): void {
    this.metrics.push({ ...metric, value: clampMetric(metric.value), at: Date.now(), ...(metric.detail ? { detail: metric.detail.slice(0, 180) } : {}) });
    if (this.metrics.length > MAX_METRICS * 2) this.metrics.splice(0, this.metrics.length - MAX_METRICS);
    this.patch({ metrics: this.metrics });
  }

  recordError(error: unknown, detail = 'runtime'): void {
    const message = error instanceof Error ? error.message : String(error);
    this.errorMessages.push(`${detail}:${message}`.slice(0, 240));
    if (this.errorMessages.length > MAX_ERRORS) this.errorMessages.splice(0, this.errorMessages.length - MAX_ERRORS);
    this.patch({ errors: this.errorMessages.length, phase: this.phase === 'ready' ? 'degraded' : this.phase });
  }

  scheduleIdle(callback: () => void, timeout = 1200): number {
    if (this.windowRef.requestIdleCallback) return this.windowRef.requestIdleCallback(() => callback(), { timeout });
    return this.windowRef.setTimeout(callback, Math.min(timeout, 2000));
  }

  private observePerformance(): void {
    if (!this.snapshotValue.capabilities.performanceObserver) return;
    const Observer = this.windowRef.PerformanceObserver;
    if (!Observer) return;
    const observe = (type: MetricName, options?: PerformanceObserverInit): void => {
      try {
        const observer = new Observer((list) => {
          for (const entry of list.getEntries()) {
            const value = 'value' in entry && typeof entry.value === 'number' ? entry.value : entry.duration;
            this.addMetric({ name: type, value, detail: entry.name });
          }
        });
        observer.observe(options ?? { entryTypes: [type] });
        this.listeners.push(() => observer.disconnect());
      } catch { /* unsupported entry types are ignored per-browser */ }
    };
    observe('navigation'); observe('resource'); observe('longtask'); observe('largest-contentful-paint'); observe('layout-shift'); observe('event', { type: 'event', buffered: true, durationThreshold: 40 });
  }

  private async refreshStorage(): Promise<void> {
    const token = ++this.storageRefreshToken;
    const storage = await estimateStorage();
    if (token !== this.storageRefreshToken) return;
    this.patch({ storage });
  }

  private installLifecycleListeners(): void {
    const listen = <K extends keyof WindowEventMap>(target: Window, type: K, handler: (event: WindowEventMap[K]) => void): void => {
      target.addEventListener(type, handler as EventListener);
      this.listeners.push(() => target.removeEventListener(type, handler as EventListener));
    };
    listen(this.windowRef, 'online', () => { this.patch({ network: 'online', onlineAt: nowIso(), phase: this.phase === 'stopped' ? this.phase : 'ready' }); void this.refreshStorage(); });
    listen(this.windowRef, 'offline', () => { this.patch({ network: 'offline', offlineAt: nowIso(), phase: this.phase === 'stopped' ? this.phase : 'degraded' }); });
    listen(this.windowRef, 'visibilitychange', () => { this.patch({ visible: this.windowRef.document.visibilityState !== 'hidden' }); });
    listen(this.windowRef, 'error', (event) => { this.recordError(event.error ?? event.message, 'window'); });
    listen(this.windowRef, 'unhandledrejection', (event) => { this.recordError(event.reason, 'promise'); });
    listen(this.windowRef, 'pagehide', () => { persistSnapshot(this.snapshotValue); });
  }

  register(feature: PlatformFeature): void {
    if (!feature.id || this.featureStates.has(feature.id) || this.featureStates.size >= MAX_FEATURES) return;
    this.featureStates.set(feature.id, 'registered');
    this.features.set(feature.id, feature);
    this.patch({});
  }

  async startFeatures(): Promise<void> {
    const features = [...this.features.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));
    for (const feature of features) await this.startFeature(feature.id);
  }

  async startFeature(id: string): Promise<void> {
    const feature = this.features.get(id);
    const state = this.featureStates.get(id);
    if (!feature || state === 'running' || state === 'starting') return;
    this.featureStates.set(id, 'starting');
    const controller = new AbortController();
    this.controllers.set(id, controller);
    try {
      const cleanup = await feature.start({ signal: controller.signal, capabilities: this.snapshotValue.capabilities, snapshot: () => this.snapshotValue, scheduleIdle: (callback, timeout) => this.scheduleIdle(callback, timeout), addMetric: (metric) => this.addMetric(metric) });
      if (typeof cleanup === 'function') this.cleanup.set(id, cleanup);
      this.featureStates.set(id, 'running');
    } catch (error) {
      this.featureStates.set(id, 'failed');
      this.recordError(error, `feature:${id}`);
    }
    this.patch({});
  }

  stopFeature(id: string): void {
    this.controllers.get(id)?.abort('feature-stopped');
    this.controllers.delete(id);
    try { this.cleanup.get(id)?.(); } catch (error) { this.recordError(error, `cleanup:${id}`); }
    this.cleanup.delete(id);
    if (this.featureStates.has(id)) this.featureStates.set(id, 'stopped');
    this.patch({});
  }

  addFeature(feature: PlatformFeature): void {
    if (this.features.has(feature.id)) return;
    this.register(feature);
    if (this.started) void this.startFeature(feature.id);
  }

  removeFeature(id: string): void { this.stopFeature(id); this.features.delete(id); this.featureStates.delete(id); this.patch({}); }

  async start(): Promise<PlatformSnapshot> {
    if (this.started) return this.snapshotValue;
    this.started = true;
    this.installLifecycleListeners();
    this.observePerformance();
    await this.refreshStorage();
    await this.startFeatures();
    this.setPhase('ready');
    if (typeof document !== 'undefined') {
      void import('./platform-dashboard.ts').then(({ mountPlatformDashboard }) => { mountPlatformDashboard(document); }).catch((error: unknown) => this.recordError(error, 'platform-dashboard'));
    }
    this.windowRef.dispatchEvent(new CustomEvent('hafize:platform-ready', { detail: this.snapshotValue }));
    return this.snapshotValue;
  }

  stop(): void {
    for (const id of [...this.featureStates.keys()]) this.stopFeature(id);
    if (this.idleHandle) { this.windowRef.cancelIdleCallback?.(this.idleHandle); this.windowRef.clearTimeout(this.idleHandle); this.idleHandle = 0; }
    for (const off of this.listeners.splice(0)) off();
    this.started = false;
    this.setPhase('stopped');
    this.windowRef.dispatchEvent(new CustomEvent('hafize:platform-stopped'));
  }
}

export const hafizePlatform = new PlatformRuntime();
root.HafizePlatformRuntime = hafizePlatform;

const bootFeature: PlatformFeature = {
  id: 'platform-self-check',
  priority: 100,
  start: ({ capabilities, addMetric }) => {
    addMetric({ name: 'navigation', value: performance.now(), detail: `capabilities:${Object.values(capabilities).filter(Boolean).length}` });
    return () => undefined;
  }
};
hafizePlatform.addFeature(bootFeature);
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void hafizePlatform.start(); }, { once: true });
  else void hafizePlatform.start();
}
