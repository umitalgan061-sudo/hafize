export type RuntimeStatus = 'booting' | 'ready' | 'degraded';
export type RuntimeEventKind = 'boot' | 'module-ready' | 'module-error' | 'online' | 'offline' | 'error' | 'unhandled-rejection' | 'visibility' | 'interaction';
export type RuntimeEvent = Readonly<{ at: string; kind: RuntimeEventKind; module?: string; message?: string; durationMs?: number; online?: boolean }>;

export const HAFIZE_RUNTIME_VERSION = '2026.09.16.typed-wave-2';
export const RUNTIME_LIMITS = Object.freeze({ events: 120, message: 240, performanceEntries: 60 });
export const RUNTIME_STORAGE_KEY = 'hafize.runtime-health.v1';

type RegisteredModule = { ready: boolean; startedAt: number; readyAt?: number; error?: string };
type RuntimeState = { status: RuntimeStatus; online: boolean; visible: boolean; modules: Record<string, RegisteredModule>; events: RuntimeEvent[] };

const createState = (): RuntimeState => ({ status: 'booting', online: typeof navigator === 'undefined' ? true : navigator.onLine !== false, visible: typeof document === 'undefined' ? true : !document.hidden, modules: {}, events: [] });
const state = createState();
const moduleResolvers = new Map<string, { resolve: (value: RegisteredModule) => void; promise: Promise<RegisteredModule> }>();
let installed = false;

function trimMessage(value: unknown): string { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, RUNTIME_LIMITS.message); }
function event(kind: RuntimeEventKind, data: Partial<Omit<RuntimeEvent, 'at' | 'kind'>> = {}): RuntimeEvent { return Object.freeze({ at: new Date().toISOString(), kind, ...data }); }
function push(record: RuntimeEvent): void { state.events.push(record); if (state.events.length > RUNTIME_LIMITS.events) state.events.splice(0, state.events.length - RUNTIME_LIMITS.events); }

export function recordRuntimeEvent(kind: RuntimeEventKind, data: Partial<Omit<RuntimeEvent, 'at' | 'kind'>> = {}): RuntimeEvent { const record = event(kind, data); push(record); return record; }
export function runtimeSnapshot(): Readonly<{ version: string; status: RuntimeStatus; online: boolean; visible: boolean; modules: Readonly<Record<string, RegisteredModule>>; events: readonly RuntimeEvent[] }> { return Object.freeze({ version: HAFIZE_RUNTIME_VERSION, status: state.status, online: state.online, visible: state.visible, modules: Object.freeze({ ...state.modules }), events: Object.freeze(state.events.slice()) }); }

export function setRuntimeStatus(status: RuntimeStatus): RuntimeStatus { state.status = status; return state.status; }
export function registerModule(name: string): Readonly<{ start: () => void; ready: (durationMs?: number) => void; fail: (error: unknown) => void; wait: () => Promise<RegisteredModule> }> {
  const key = trimMessage(name).toLowerCase().replace(/\s+/g, '-'); if (!key) throw new Error('RUNTIME_MODULE_NAME_REQUIRED');
  if (!state.modules[key]) state.modules[key] = { ready: false, startedAt: performance?.now?.() ?? Date.now() };
  if (!moduleResolvers.has(key)) { let resolve!: (value: RegisteredModule) => void; const promise = new Promise<RegisteredModule>((done) => { resolve = done; }); moduleResolvers.set(key, { resolve, promise }); }
  const entry = state.modules[key]; const resolver = moduleResolvers.get(key)!;
  const api = { start() { entry.startedAt = performance?.now?.() ?? Date.now(); recordRuntimeEvent('boot', { module: key }); }, ready(durationMs) { entry.ready = true; entry.readyAt = performance?.now?.() ?? Date.now(); delete entry.error; recordRuntimeEvent('module-ready', { module: key, durationMs }); resolver.resolve({ ...entry }); recomputeStatus(); }, fail(error) { entry.error = trimMessage(error instanceof Error ? error.message : error); entry.ready = false; recordRuntimeEvent('module-error', { module: key, message: entry.error }); recomputeStatus(); }, wait: () => resolver.promise };
  return Object.freeze(api);
}

export function markModuleReady(name: string, durationMs?: number): void { const module = registerModule(name); module.ready(durationMs); }
export function markModuleFailed(name: string, error: unknown): void { const module = registerModule(name); module.fail(error); }
function recomputeStatus(): RuntimeStatus { const values = Object.values(state.modules); if (!values.length) return state.status; state.status = values.some((item) => item.error) ? 'degraded' : values.every((item) => item.ready) ? 'ready' : 'booting'; return state.status; }

export function getModuleHealth(name: string): RegisteredModule | null { const key = trimMessage(name).toLowerCase().replace(/\s+/g, '-'); const value = state.modules[key]; return value ? Object.freeze({ ...value }) : null; }
export function waitForModule(name: string): Promise<RegisteredModule> { return registerModule(name).wait(); }

export function collectPerformanceEntries(): Array<Readonly<{ name: string; entryType: string; duration: number; startTime: number }>> {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') return [];
  return performance.getEntriesByType('measure').slice(-RUNTIME_LIMITS.performanceEntries).map((entry) => Object.freeze({ name: entry.name, entryType: entry.entryType, duration: Number(entry.duration.toFixed(2)), startTime: Number(entry.startTime.toFixed(2)) }));
}

export function exportDiagnostics(): string { return JSON.stringify({ version: HAFIZE_RUNTIME_VERSION, status: state.status, online: state.online, visible: state.visible, modules: state.modules, events: state.events.slice(), performance: collectPerformanceEntries() }, null, 2); }
export function clearDiagnostics(storage: Storage | undefined = globalThis.localStorage): boolean { try { storage?.removeItem(RUNTIME_STORAGE_KEY); return true; } catch { return false; } }
export function saveDiagnostics(storage: Storage | undefined = globalThis.localStorage): boolean { try { const payload = exportDiagnostics(); storage?.setItem(RUNTIME_STORAGE_KEY, payload); return true; } catch { return false; } }
export function loadDiagnostics(storage: Storage | undefined = globalThis.localStorage): RuntimeEvent[] { try { const raw = storage?.getItem(RUNTIME_STORAGE_KEY); const parsed = raw ? JSON.parse(raw) : null; return Array.isArray(parsed?.events) ? parsed.events.slice(-RUNTIME_LIMITS.events) : []; } catch { return []; } }

function installGlobalHooks(rootRef: Window): void {
  if (installed) return; installed = true;
  recordRuntimeEvent('boot', { message: HAFIZE_RUNTIME_VERSION, online: state.online });
  rootRef.addEventListener('online', () => { state.online = true; recordRuntimeEvent('online', { online: true }); });
  rootRef.addEventListener('offline', () => { state.online = false; recordRuntimeEvent('offline', { online: false }); });
  document.addEventListener('visibilitychange', () => { state.visible = !document.hidden; recordRuntimeEvent('visibility', { message: state.visible ? 'visible' : 'hidden' }); });
  rootRef.addEventListener('error', ((event: ErrorEvent) => { recordRuntimeEvent('error', { message: trimMessage(event.message || event.error?.message || 'window error') }); setRuntimeStatus('degraded'); }) as EventListener);
  rootRef.addEventListener('unhandledrejection', ((event: PromiseRejectionEvent) => { const reason = event.reason instanceof Error ? event.reason.message : event.reason; recordRuntimeEvent('unhandled-rejection', { message: trimMessage(reason) }); setRuntimeStatus('degraded'); }) as EventListener);
  rootRef.addEventListener('pointerdown', () => recordRuntimeEvent('interaction', { message: 'pointer' }), { passive: true });
  queueMicrotask(() => { if (state.status === 'booting' && Object.keys(state.modules).length === 0) setRuntimeStatus('ready'); });
}

export function installRuntimeHealth(documentRef: Document = document, rootRef: Window = window): Readonly<{ snapshot: () => ReturnType<typeof runtimeSnapshot>; diagnostics: () => string; save: () => boolean; clear: () => boolean; destroy: () => void }> {
  installGlobalHooks(rootRef); const start = performance?.now?.() ?? Date.now(); registerModule('runtime-health').start();
  const ready = () => { const duration = (performance?.now?.() ?? Date.now()) - start; markModuleReady('runtime-health', duration); };
  const visibility = () => recordRuntimeEvent('visibility', { message: documentRef.hidden ? 'hidden' : 'visible' });
  documentRef.addEventListener('visibilitychange', visibility);
  queueMicrotask(ready);
  return Object.freeze({ snapshot: runtimeSnapshot, diagnostics: exportDiagnostics, save: () => saveDiagnostics(rootRef.localStorage), clear: () => clearDiagnostics(rootRef.localStorage), destroy: () => documentRef.removeEventListener('visibilitychange', visibility) });
}

declare global { interface Window { HafizeRuntimeHealth?: ReturnType<typeof installRuntimeHealth> } }

const autoStart = () => { try { if (!window.HafizeRuntimeHealth) window.HafizeRuntimeHealth = installRuntimeHealth(document, window); } catch {} };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoStart, { once: true }); else autoStart();
