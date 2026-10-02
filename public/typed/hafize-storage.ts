export interface HafizeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface HafizeStorageLimits {
  readonly maxKeyLength?: number;
  readonly maxValueBytes?: number;
  readonly maxWriteBytes?: number;
  readonly maxKeys?: number;
}

export interface HafizeStorageWriteResult {
  readonly ok: boolean;
  readonly bytes: number;
  readonly key: string;
}

export interface HafizeStorageSize {
  readonly key: string;
  readonly chars: number;
  readonly bytes: number;
}

export interface HafizeStorageChange {
  readonly key: string;
  readonly reason: 'write' | 'remove' | 'clear' | 'external';
  readonly previous: string | null;
  readonly current: string | null;
}

export interface HafizeStorageSubscription {
  readonly unsubscribe: () => void;
}

type JsonParser<T> = (value: unknown) => T | null;

const DEFAULT_LIMITS: Required<HafizeStorageLimits> = Object.freeze({
  maxKeyLength: 180,
  maxValueBytes: 512 * 1024,
  maxWriteBytes: 768 * 1024,
  maxKeys: 256
});

const UTF8_ENCODER = new TextEncoder();

export class HafizeStorageError extends Error {
  readonly code: string;
  readonly key: string;

  constructor(message: string, code: string, key = '') {
    super(message);
    this.name = 'HafizeStorageError';
    this.code = code;
    this.key = key;
  }
}

export class HafizeStorageUnavailableError extends HafizeStorageError {
  constructor(key = '') {
    super('Yerel depolama kullanılamıyor.', 'STORAGE_UNAVAILABLE', key);
    this.name = 'HafizeStorageUnavailableError';
  }
}

function bytesOf(value: string): number {
  return UTF8_ENCODER.encode(value).byteLength;
}

function validKey(key: string, limits: Required<HafizeStorageLimits>): boolean {
  return typeof key === 'string' && key.trim().length > 0 && key.length <= limits.maxKeyLength;
}

function normalizeLimits(input: HafizeStorageLimits = {}): Required<HafizeStorageLimits> {
  return {
    maxKeyLength: Math.max(1, Math.min(1024, Math.floor(input.maxKeyLength ?? DEFAULT_LIMITS.maxKeyLength))),
    maxValueBytes: Math.max(256, Math.min(4 * 1024 * 1024, Math.floor(input.maxValueBytes ?? DEFAULT_LIMITS.maxValueBytes))),
    maxWriteBytes: Math.max(256, Math.min(4 * 1024 * 1024, Math.floor(input.maxWriteBytes ?? DEFAULT_LIMITS.maxWriteBytes))),
    maxKeys: Math.max(1, Math.min(10_000, Math.floor(input.maxKeys ?? DEFAULT_LIMITS.maxKeys)))
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseSafely<T>(raw: string | null, parser?: JsonParser<T>): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parser ? parser(parsed) : parsed as T;
  } catch {
    return null;
  }
}

export class HafizeStorage {
  readonly storage: HafizeStorageLike;
  readonly limits: Required<HafizeStorageLimits>;
  private readonly listeners = new Map<string, Set<(change: HafizeStorageChange) => void>>();

  constructor(storage: HafizeStorageLike, limits: HafizeStorageLimits = {}) {
    this.storage = storage;
    this.limits = normalizeLimits(limits);
    this.assertAvailable();
  }

  private assertAvailable(): void {
    try {
      const probe = '__hafize_storage_probe__';
      const value = this.storage.getItem(probe);
      if (value !== null) this.storage.removeItem(probe);
    } catch (error) {
      throw new HafizeStorageUnavailableError();
    }
  }

  private assertKey(key: string): void {
    if (!validKey(key, this.limits)) {
      throw new HafizeStorageError('Geçersiz localStorage anahtarı.', 'STORAGE_KEY_INVALID', key);
    }
  }

  private notify(change: HafizeStorageChange): void {
    for (const handler of this.listeners.get(change.key) ?? []) {
      try { handler(Object.freeze(change)); } catch { /* listener isolation */ }
    }
  }

  readRaw(key: string): string | null {
    this.assertKey(key);
    try {
      const value = this.storage.getItem(key);
      if (value === null) return null;
      if (bytesOf(value) > this.limits.maxValueBytes) return null;
      return value;
    } catch {
      throw new HafizeStorageUnavailableError(key);
    }
  }

  readJson<T>(key: string, parser?: JsonParser<T>, fallback?: T): T | null {
    const raw = this.readRaw(key);
    const value = parseSafely(raw, parser);
    if (value === null) return fallback === undefined ? null : cloneJson(fallback);
    return cloneJson(value);
  }

  writeRaw(key: string, value: string): HafizeStorageWriteResult {
    this.assertKey(key);
    if (typeof value !== 'string') throw new HafizeStorageError('Depolama değeri metin olmalıdır.', 'STORAGE_VALUE_INVALID', key);
    const bytes = bytesOf(value);
    if (bytes > this.limits.maxValueBytes) {
      throw new HafizeStorageError('Depolama değeri izin verilen boyutu aştı.', 'STORAGE_VALUE_TOO_LARGE', key);
    }
    if (bytes > this.limits.maxWriteBytes) {
      throw new HafizeStorageError('Yazma işlemi izin verilen boyutu aştı.', 'STORAGE_WRITE_TOO_LARGE', key);
    }

    const previous = this.readRaw(key);
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      throw new HafizeStorageError('Yerel depolamaya yazılamadı.', 'STORAGE_WRITE_FAILED', key);
    }
    this.notify({ key, reason: 'write', previous, current: value });
    return Object.freeze({ ok: true, bytes, key });
  }

  writeJson<T>(key: string, value: T): HafizeStorageWriteResult {
    let raw: string;
    try {
      raw = JSON.stringify(value);
    } catch (error) {
      throw new HafizeStorageError('Depolanacak veri JSON biçimine dönüştürülemedi.', 'STORAGE_SERIALIZE_FAILED', key);
    }
    return this.writeRaw(key, raw);
  }

  updateJson<T>(key: string, fallback: T, updater: (current: T) => T): HafizeStorageWriteResult {
    const current = this.readJson<T>(key) ?? cloneJson(fallback);
    return this.writeJson(key, updater(current));
  }

  remove(key: string): boolean {
    this.assertKey(key);
    const previous = this.readRaw(key);
    if (previous === null) return false;
    try {
      this.storage.removeItem(key);
    } catch {
      throw new HafizeStorageError('Yerel depolama alanı silinemedi.', 'STORAGE_REMOVE_FAILED', key);
    }
    this.notify({ key, reason: 'remove', previous, current: null });
    return true;
  }

  has(key: string): boolean {
    this.assertKey(key);
    return this.readRaw(key) !== null;
  }

  subscribe(key: string, listener: (change: HafizeStorageChange) => void): HafizeStorageSubscription {
    this.assertKey(key);
    const handlers = this.listeners.get(key) ?? new Set();
    handlers.add(listener);
    this.listeners.set(key, handlers);
    return Object.freeze({
      unsubscribe: () => {
        const set = this.listeners.get(key);
        set?.delete(listener);
        if (set?.size === 0) this.listeners.delete(key);
      }
    });
  }

  acceptExternalChange(key: string, previous: string | null, current: string | null): void {
    this.assertKey(key);
    this.notify({ key, reason: 'external', previous, current });
  }

  list(prefix = ''): HafizeStorageSize[] {
    const cleanPrefix = typeof prefix === 'string' ? prefix.slice(0, this.limits.maxKeyLength) : '';
    const output: HafizeStorageSize[] = [];
    const count = Math.min(this.storage.length, this.limits.maxKeys);
    for (let index = 0; index < count; index += 1) {
      const key = this.storage.key(index);
      if (!key || !key.startsWith(cleanPrefix)) continue;
      let value: string | null = null;
      try { value = this.storage.getItem(key); } catch { value = null; }
      if (value === null) continue;
      output.push(Object.freeze({ key, chars: value.length, bytes: bytesOf(value) }));
    }
    return output;
  }

  size(prefix = ''): number {
    return this.list(prefix).reduce((sum, item) => sum + item.bytes, 0);
  }

  clearKnown(keys: readonly string[]): number {
    const bounded = keys.slice(0, this.limits.maxKeys);
    let removed = 0;
    for (const key of bounded) if (this.remove(key)) removed += 1;
    return removed;
  }
}

export class HafizeMemoryStorage implements HafizeStorageLike {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
}

export function createHafizeStorage(storage: HafizeStorageLike = globalThis.localStorage): HafizeStorage {
  return new HafizeStorage(storage);
}
