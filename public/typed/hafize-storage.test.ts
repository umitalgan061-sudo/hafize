import { describe, expect, it, vi } from 'vitest';
import {
  HafizeMemoryStorage,
  HafizeStorage,
  HafizeStorageError,
  createHafizeStorage
} from './hafize-storage.ts';

function createStorage(limits = {}) {
  return new HafizeStorage(new HafizeMemoryStorage(), limits);
}

describe('HafizeStorage', () => {
  it('writes and reads typed JSON without changing the persisted shape', () => {
    const storage = createStorage();
    storage.writeJson('hafize.demo', [{ id: '1', title: 'İlk' }]);
    expect(storage.readJson<{ id: string; title: string }[]>('hafize.demo')).toEqual([
      { id: '1', title: 'İlk' }
    ]);
  });

  it('supports a parser that rejects malformed application data', () => {
    const storage = createStorage();
    storage.writeRaw('hafize.demo', '{"id":123}');
    const value = storage.readJson('hafize.demo', (candidate) => {
      if (!candidate || typeof candidate !== 'object') return null;
      const source = candidate as Record<string, unknown>;
      return typeof source.id === 'string' ? source.id : null;
    }, 'fallback');
    expect(value).toBe('fallback');
  });

  it('returns a cloned value so callers cannot mutate the cached reference', () => {
    const storage = createStorage();
    const original = { nested: { value: 1 } };
    storage.writeJson('hafize.clone', original);
    const first = storage.readJson('hafize.clone') as { nested: { value: number } };
    first.nested.value = 9;
    expect(storage.readJson('hafize.clone')).toEqual(original);
  });

  it('calculates UTF-8 byte limits rather than string length', () => {
    const storage = createStorage({ maxValueBytes: 5, maxWriteBytes: 5 });
    expect(() => storage.writeRaw('hafize.limit', '🙂🙂')).toThrowError(
      expect.objectContaining({ code: 'STORAGE_VALUE_TOO_LARGE' })
    );
  });

  it('rejects invalid keys before touching storage', () => {
    const storage = createStorage();
    expect(() => storage.readRaw('')).toThrowError(
      expect.objectContaining({ code: 'STORAGE_KEY_INVALID' })
    );
  });

  it('distinguishes value and write bounds', () => {
    const storage = createStorage({ maxValueBytes: 100, maxWriteBytes: 10 });
    expect(() => storage.writeRaw('hafize.limit', '12345678901')).toThrowError(
      expect.objectContaining({ code: 'STORAGE_WRITE_TOO_LARGE' })
    );
  });

  it('emits a local change after writing', () => {
    const storage = createStorage();
    const listener = vi.fn();
    const subscription = storage.subscribe('hafize.event', listener);

    storage.writeRaw('hafize.event', 'one');
    storage.writeRaw('hafize.event', 'two');

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0]).toMatchObject({
      key: 'hafize.event',
      reason: 'write',
      previous: null,
      current: 'one'
    });
    expect(listener.mock.calls[1][0]).toMatchObject({
      previous: 'one',
      current: 'two'
    });
    subscription.unsubscribe();
    storage.writeRaw('hafize.event', 'three');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('isolates subscriber exceptions', () => {
    const storage = createStorage();
    const safe = vi.fn();
    storage.subscribe('hafize.event', () => { throw new Error('listener'); });
    storage.subscribe('hafize.event', safe);
    expect(() => storage.writeRaw('hafize.event', 'one')).not.toThrow();
    expect(safe).toHaveBeenCalledTimes(1);
  });

  it('accepts browser storage events through the same subscription boundary', () => {
    const storage = createStorage();
    const listener = vi.fn();
    storage.subscribe('hafize.event', listener);
    storage.acceptExternalChange('hafize.event', 'old', 'new');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'external',
      previous: 'old',
      current: 'new'
    }));
  });

  it('removes data and reports whether something existed', () => {
    const storage = createStorage();
    expect(storage.remove('hafize.missing')).toBe(false);
    storage.writeRaw('hafize.value', 'x');
    expect(storage.has('hafize.value')).toBe(true);
    expect(storage.remove('hafize.value')).toBe(true);
    expect(storage.has('hafize.value')).toBe(false);
  });

  it('lists bounded size information without exposing values', () => {
    const storage = createStorage();
    storage.writeRaw('hafize.a', '123');
    storage.writeRaw('other.b', '456789');
    expect(storage.list('hafize.')).toEqual([
      expect.objectContaining({ key: 'hafize.a', chars: 3, bytes: 3 })
    ]);
    expect(storage.size('hafize.')).toBe(3);
  });

  it('limits key enumeration to its configured safety cap', () => {
    const storage = createStorage({ maxKeys: 2 });
    storage.writeRaw('hafize.one', '1');
    storage.writeRaw('hafize.two', '22');
    storage.writeRaw('hafize.three', '333');
    expect(storage.list().length).toBe(2);
  });

  it('clears only explicitly supplied known keys', () => {
    const storage = createStorage();
    storage.writeRaw('hafize.a', 'a');
    storage.writeRaw('hafize.b', 'b');
    storage.writeRaw('unknown', 'keep');
    expect(storage.clearKnown(['hafize.a', 'hafize.b', 'unknown'])).toBe(3);
    expect(storage.has('unknown')).toBe(false);
  });

  it('updates JSON atomically from the caller perspective', () => {
    const storage = createStorage();
    storage.writeJson('hafize.counter', { count: 1 });
    storage.updateJson('hafize.counter', { count: 0 }, (current) => ({
      count: current.count + 2
    }));
    expect(storage.readJson('hafize.counter')).toEqual({ count: 3 });
  });

  it('creates a storage boundary against an injected storage implementation', () => {
    const memory = new HafizeMemoryStorage();
    const storage = createHafizeStorage(memory);
    storage.writeJson('hafize.injected', { ok: true });
    expect(memory.getItem('hafize.injected')).toBe('{"ok":true}');
  });

  it('fails closed when the backing storage throws', () => {
    const broken = {
      get length() { return 0; },
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
      key() { return null; }
    };
    expect(() => new HafizeStorage(broken)).toThrowError(
      expect.objectContaining({ code: 'STORAGE_UNAVAILABLE' })
    );
  });

  it('does not leak arbitrary object serialization errors as raw exceptions', () => {
    const storage = createStorage();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => storage.writeJson('hafize.circular', circular)).toThrowError(
      expect.objectContaining({ code: 'STORAGE_SERIALIZE_FAILED' })
    );
  });

  it('accepts known data with a null parser result only through fallback', () => {
    const storage = createStorage();
    storage.writeRaw('hafize.value', 'null');
    expect(storage.readJson('hafize.value', () => null, { safe: true })).toEqual({ safe: true });
  });

  it('keeps change values bounded to the same persisted strings', () => {
    const storage = createStorage({ maxValueBytes: 100 });
    const listener = vi.fn();
    storage.subscribe('hafize.value', listener);
    storage.writeRaw('hafize.value', 'x');
    expect(listener.mock.calls[0][0].current).toBe('x');
  });
});

describe('HafizeMemoryStorage', () => {
  it('implements the browser Storage shape used by the boundary', () => {
    const storage = new HafizeMemoryStorage();
    storage.setItem('a', '1');
    storage.setItem('b', '2');
    expect(storage.length).toBe(2);
    expect(storage.getItem('a')).toBe('1');
    expect(storage.key(0)).toBe('a');
    storage.removeItem('a');
    expect(storage.getItem('a')).toBeNull();
    expect(storage.length).toBe(1);
  });
});
