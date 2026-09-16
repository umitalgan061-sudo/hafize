export type PlatformEventMap = {
  'platform:ready': { at: string };
  'platform:stopped': { at: string };
  'network:online': { at: string };
  'network:offline': { at: string };
  'feature:started': { id: string };
  'feature:failed': { id: string; message: string };
  'feature:stopped': { id: string };
  'diagnostic:error': { source: string; message: string };
};

export type PlatformEventName = keyof PlatformEventMap;
export type PlatformEventListener<K extends PlatformEventName> = (payload: PlatformEventMap[K]) => void;

export interface PlatformSubscription { readonly unsubscribe: () => void }

export class PlatformEventBus {
  private readonly listeners = new Map<PlatformEventName, Set<(payload: unknown) => void>>();

  on<K extends PlatformEventName>(name: K, listener: PlatformEventListener<K>): PlatformSubscription {
    const bucket = this.listeners.get(name) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    this.listeners.set(name, bucket);
    return { unsubscribe: () => { bucket.delete(listener as (payload: unknown) => void); if (!bucket.size) this.listeners.delete(name); } };
  }

  emit<K extends PlatformEventName>(name: K, payload: PlatformEventMap[K]): void {
    const bucket = this.listeners.get(name);
    if (!bucket) return;
    for (const listener of [...bucket]) {
      try { listener(payload); } catch { /* event consumers cannot break runtime */ }
    }
  }

  clear(name?: PlatformEventName): void {
    if (name) this.listeners.delete(name);
    else this.listeners.clear();
  }

  size(name?: PlatformEventName): number {
    return name ? this.listeners.get(name)?.size ?? 0 : [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

export const hafizePlatformEvents = new PlatformEventBus();
