export type Result<T, E = Error> = Readonly<{ ok: true; value: T } | { ok: false; error: E }>;
export type Cleanup = () => void;

export interface StorageLimits { readonly maxBytes: number; readonly maxEntries: number; readonly maxString: number; }
export interface StoragePolicy { readonly prefix?: string; readonly limits?: Partial<StorageLimits>; }
export interface StorageAdapter { readonly readText: (key: string) => string | null; readonly writeText: (key: string, value: string) => boolean; readonly remove: (key: string) => boolean; readonly keys: () => readonly string[]; readonly readJson: <T>(key: string, fallback: T) => T; readonly writeJson: <T>(key: string, value: T) => boolean; }

const DEFAULT_LIMITS: StorageLimits = Object.freeze({ maxBytes: 1_000_000, maxEntries: 100, maxString: 20_000 });
const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;
const clampString = (value: unknown, limit: number): string => String(value ?? '').slice(0, limit);

export function mergeLimits(input?: Partial<StorageLimits>): StorageLimits {
  return Object.freeze({
    maxBytes: Number.isInteger(input?.maxBytes) && (input?.maxBytes ?? 0) > 0 ? input!.maxBytes! : DEFAULT_LIMITS.maxBytes,
    maxEntries: Number.isInteger(input?.maxEntries) && (input?.maxEntries ?? 0) > 0 ? input!.maxEntries! : DEFAULT_LIMITS.maxEntries,
    maxString: Number.isInteger(input?.maxString) && (input?.maxString ?? 0) > 0 ? input!.maxString! : DEFAULT_LIMITS.maxString
  });
}

export function createStorageAdapter(storage: Storage | undefined, policy: StoragePolicy = {}): StorageAdapter {
  const limits = mergeLimits(policy.limits);
  const prefix = policy.prefix ?? '';
  const fullKey = (key: string): string => `${prefix}${clampString(key, 160)}`;
  const readText = (key: string): string | null => {
    try { const value = storage?.getItem(fullKey(key)); return typeof value === 'string' ? clampString(value, limits.maxBytes) : null; } catch { return null; }
  };
  const writeText = (key: string, value: string): boolean => {
    if (!storage) return false;
    const next = clampString(value, limits.maxBytes);
    if (byteLength(next) > limits.maxBytes) return false;
    try { storage.setItem(fullKey(key), next); return true; } catch { return false; }
  };
  const remove = (key: string): boolean => { try { storage?.removeItem(fullKey(key)); return true; } catch { return false; } };
  const keys = (): readonly string[] => {
    if (!storage) return Object.freeze([]);
    const output: string[] = [];
    try { for (let index = 0; index < storage.length && output.length < limits.maxEntries; index += 1) { const key = storage.key(index); if (key?.startsWith(prefix)) output.push(key.slice(prefix.length)); } } catch { return Object.freeze([]); }
    return Object.freeze(output);
  };
  const readJson = <T>(key: string, fallback: T): T => { const value = readText(key); if (!value) return fallback; try { return JSON.parse(value) as T; } catch { return fallback; } };
  const writeJson = <T>(key: string, value: T): boolean => { try { return writeText(key, JSON.stringify(value)); } catch { return false; } };
  return Object.freeze({ readText, writeText, remove, keys, readJson, writeJson });
}

export interface EventMap { readonly [event: string]: unknown; }
export type EventHandler<T> = (payload: T) => void;

export interface EventBus<Events extends EventMap> { readonly on: <K extends keyof Events>(event: K, handler: EventHandler<Events[K]>) => Cleanup; readonly emit: <K extends keyof Events>(event: K, payload: Events[K]) => void; readonly clear: () => void; readonly size: () => number; }

export function createEventBus<Events extends EventMap>(): EventBus<Events> {
  const handlers = new Map<keyof Events, Set<EventHandler<never>>>();
  const on = <K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): Cleanup => {
    const bucket = handlers.get(event) ?? new Set<EventHandler<never>>();
    bucket.add(handler as EventHandler<never>); handlers.set(event, bucket);
    return () => { bucket.delete(handler as EventHandler<never>); if (!bucket.size) handlers.delete(event); };
  };
  const emit = <K extends keyof Events>(event: K, payload: Events[K]): void => { for (const handler of handlers.get(event) ?? []) { try { (handler as EventHandler<Events[K]>)(payload); } catch { /* subscriber isolation */ } } };
  const clear = (): void => handlers.clear();
  const size = (): number => [...handlers.values()].reduce((count, bucket) => count + bucket.size, 0);
  return Object.freeze({ on, emit, clear, size });
}

export interface AbortableRequestOptions extends RequestInit { readonly timeoutMs?: number; readonly signal?: AbortSignal; }
export interface RequestError extends Error { readonly status?: number; readonly code?: string; }

export function createAbortSignal(timeoutMs = 15_000, external?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = (): void => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', abort, { once: true });
  }
  if (Number.isFinite(timeoutMs) && timeoutMs > 0) timer = setTimeout(() => controller.abort(), timeoutMs);
  const cleanup = (): void => { if (timer) clearTimeout(timer); if (external) external.removeEventListener('abort', abort); };
  controller.signal.addEventListener('abort', cleanup, { once: true });
  return controller.signal;
}

export async function requestJson<T>(input: RequestInfo | URL, options: AbortableRequestOptions = {}): Promise<T> {
  const { timeoutMs = 15_000, signal: externalSignal, ...requestOptions } = options;
  const signal = createAbortSignal(timeoutMs, externalSignal);
  const response = await fetch(input, { ...requestOptions, signal, credentials: requestOptions.credentials ?? 'same-origin', headers: { Accept: 'application/json', ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}), ...(requestOptions.headers || {}) } });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* empty response */ }
  if (!response.ok) {
    const error = new Error(typeof (payload as Record<string, unknown> | null)?.code === 'string' ? String((payload as Record<string, unknown>).code) : `HTTP_${response.status}`) as RequestError;
    Object.defineProperty(error, 'status', { value: response.status });
    Object.defineProperty(error, 'code', { value: typeof (payload as Record<string, unknown> | null)?.code === 'string' ? String((payload as Record<string, unknown>).code) : undefined });
    throw error;
  }
  return (payload ?? {}) as T;
}

export interface DisposableRegistry { readonly add: (cleanup: Cleanup) => Cleanup; readonly dispose: () => void; readonly size: () => number; }
export function createDisposableRegistry(): DisposableRegistry {
  const cleanups = new Set<Cleanup>();
  const add = (cleanup: Cleanup): Cleanup => { cleanups.add(cleanup); return () => { if (cleanups.delete(cleanup)) { try { cleanup(); } catch {} } }; };
  const dispose = (): void => { for (const cleanup of [...cleanups]) { try { cleanup(); } catch {} } cleanups.clear(); };
  return Object.freeze({ add, dispose, size: () => cleanups.size });
}

export function parseBoolean(value: unknown, fallback = false): boolean { if (value === true || value === false) return value; if (typeof value !== 'string') return fallback; if (value.toLowerCase() === 'true') return true; if (value.toLowerCase() === 'false') return false; return fallback; }
export function parseBoundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number { const parsed = Number(value); if (!Number.isInteger(parsed)) return fallback; return Math.min(maximum, Math.max(minimum, parsed)); }
export function normalizeIsoDate(value: unknown, fallback = new Date(0).toISOString()): string { if (typeof value !== 'string') return fallback; const timestamp = Date.parse(value); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback; }

export function resultOf<T>(work: () => T): Result<T> { try { return Object.freeze({ ok: true, value: work() }); } catch (error) { return Object.freeze({ ok: false, error: error instanceof Error ? error : new Error(String(error)) }); } }
export async function asyncResultOf<T>(work: () => Promise<T>): Promise<Result<T>> { try { return Object.freeze({ ok: true, value: await work() }); } catch (error) { return Object.freeze({ ok: false, error: error instanceof Error ? error : new Error(String(error)) }); } }

export const HafizeRuntimeKernel = Object.freeze({ mergeLimits, createStorageAdapter, createEventBus, createAbortSignal, requestJson, createDisposableRegistry, parseBoolean, parseBoundedInteger, normalizeIsoDate, resultOf, asyncResultOf });
