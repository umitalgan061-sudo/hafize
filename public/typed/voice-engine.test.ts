import { describe, expect, it } from 'vitest';
import { createBreaker, createEngineFiles } from './voice-library.ts';

function world({ stored = new Map<string, Response>(), ok = true, putFails = false } = {}) {
  const fetched: string[] = [];
  const files = createEngineFiles({
    openStore: async () => ({
      match: async (path: RequestInfo | URL) => stored.get(String(path))?.clone(),
      put: async (path: RequestInfo | URL, response: Response) => { if (putFails) throw new Error('QuotaExceededError'); stored.set(String(path), response); }
    }),
    fetchFile: async (path) => { fetched.push(path); return new Response(ok ? 'engine-bytes' : 'no', { status: ok ? 200 : 503 }); },
    toUrl: (blob) => `blob:${blob.type}:${blob.size}`
  });
  return { files, fetched, stored };
}

describe('the voice engine files', () => {
  it('are downloaded once, however often and however close together they are asked for', async () => {
    const w = world();
    const [a, b] = await Promise.all([w.files('/vendor/x.data'), w.files('/vendor/x.data')]);
    const c = await w.files('/vendor/x.data');
    expect(w.fetched).toEqual(['/vendor/x.data']);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBe('blob:application/octet-stream:12');
  });

  it('come from the store on a later visit, with no download at all', async () => {
    const first = world();
    await first.files('/vendor/x.wasm');
    const later = world({ stored: first.stored });
    expect(await later.files('/vendor/x.wasm')).toBe('blob:application/wasm:12');
    expect(later.fetched).toEqual([]);
  });

  it('are asked for again after a failed download, and a failure is not kept', async () => {
    const w = world({ ok: false });
    await expect(w.files('/vendor/x.data')).rejects.toThrow('VOICE_ENGINE_UNAVAILABLE');
    await expect(w.files('/vendor/x.data')).rejects.toThrow('VOICE_ENGINE_UNAVAILABLE');
    expect(w.fetched.length).toBe(2);
    expect(w.stored.size).toBe(0);
  });

  it('still work for this page when the store is full', async () => {
    const w = world({ putFails: true });
    expect(await w.files('/vendor/x.data')).toBe('blob:application/octet-stream:12');
    await w.files('/vendor/x.data');
    expect(w.fetched.length).toBe(1);
  });
});

describe('the engine breaker', () => {
  it('rests the engine after two failures in a row and lets it back after the rest', () => {
    let clock = 0;
    const breaker = createBreaker({ now: () => clock });
    breaker.failed();
    expect(breaker.open()).toBe(false);
    breaker.failed();
    expect(breaker.open()).toBe(true);
    clock += 10 * 60_000 + 1;
    expect(breaker.open()).toBe(false);
  });

  it('forgets a failure once the engine works again', () => {
    const breaker = createBreaker();
    breaker.failed();
    breaker.succeeded();
    breaker.failed();
    expect(breaker.open()).toBe(false);
  });
});
