import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTaskNotifications, MUTED_KEY, type TaskResult } from './task-notifications.ts';

const SEEN_KEY = 'hafize.taskResults.seen.v1';
const result = (index: number): TaskResult => ({ id: `result_${index}`, task: `görev ${index}`, ok: true, content: 'x', error: '', createdAt: '2026-11-09T05:30:00.000Z', readAt: null });

/** A page with the given unread results on the server and notification permission already given. */
function page(results: TaskResult[], stored: Record<string, string> = { [SEEN_KEY]: '[]' }) {
  const store = new Map(Object.entries(stored));
  const shown: Array<{ title: string; tag?: string }> = [];
  class FakeNotification {
    static permission = 'granted';
    onclick: (() => void) | null = null;
    constructor(title: string, options: { tag?: string } = {}) { shown.push({ title, tag: options.tag }); }
    close() { /* nothing to close */ }
  }
  const root = {
    Notification: FakeNotification,
    localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } },
    fetch: async () => new Response(JSON.stringify({ results })),
    setTimeout: () => 0,
    focus: () => undefined
  } as unknown as typeof globalThis;
  const documentRef = { querySelector: () => null, querySelectorAll: () => [], documentElement: {}, createElement: () => ({}) } as unknown as Document;
  const stop = installTaskNotifications(documentRef, root);
  return { shown, store, stop };
}

describe('task result notices', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('a full list of unread results is announced once, as one notice, and never again', async () => {
    const p = page(Array.from({ length: 1000 }, (_, index) => result(index)));
    await vi.advanceTimersByTimeAsync(0);
    expect(p.shown.length).toBe(1);
    expect(p.shown[0].title).toBe('Hafize: 1000 görev sonucu');
    // The next minutes: with only 200 ids remembered, 800 of these came back as new every single minute.
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(p.shown.length).toBe(1);
    expect(JSON.parse(p.store.get(SEEN_KEY) ?? '[]').length).toBe(1000);
    p.stop?.();
  });

  it('one new result is announced by itself', async () => {
    const p = page([result(1)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(p.shown).toEqual([{ title: 'Hafize görevi tamamlandı', tag: 'hafize-gorev-sonucu' }]);
    p.stop?.();
  });

  it('nothing is shown once the owner has turned notices off, and it is not saved up for later', async () => {
    const p = page([result(1), result(2)], { [SEEN_KEY]: '[]', [MUTED_KEY]: '1' });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(p.shown.length).toBe(0);
    p.store.delete(MUTED_KEY);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(p.shown.length).toBe(0);
    p.stop?.();
  });
});

describe('the result list in Settings', () => {
  it('builds rows for the newest results only, however long the log is', async () => {
    vi.useFakeTimers();
    const rows: unknown[] = [];
    const node = () => {
      const self: Record<string, unknown> & { children: unknown[] } = { children: [], className: '', textContent: '', type: '',
        append: (...items: unknown[]) => { self.children.push(...items); }, replaceChildren: (...items: unknown[]) => { self.children = items; },
        setAttribute: () => undefined, addEventListener: () => undefined, querySelector: () => null, insertBefore: (item: unknown) => { self.children.push(item); }, remove: () => undefined, scrollIntoView: () => undefined };
      return self;
    };
    const host = node();
    const made: Array<ReturnType<typeof node>> = [];
    const documentRef = { querySelector: (selector: string) => (selector === '.settings-workspace' ? host : null), querySelectorAll: () => [], documentElement: {},
      createElement: () => { const item = node(); made.push(item); return item; } } as unknown as Document;
    const store = new Map([[SEEN_KEY, '[]']]);
    const root = { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } },
      fetch: async () => new Response(JSON.stringify({ results: Array.from({ length: 1000 }, (_, index) => result(index)) })), setTimeout: () => 0 } as unknown as typeof globalThis;
    const stop = installTaskNotifications(documentRef, root);
    await vi.advanceTimersByTimeAsync(0);
    rows.push(...made.filter((item) => item.className === 'task-result' || item.className === 'task-result is-failed'));
    expect(rows.length).toBe(20);
    expect(made.some((item) => item.textContent === 'Kalan 980 sonucu göster')).toBe(true);
    expect(made.some((item) => item.textContent === 'Tümünü temizle')).toBe(true);
    stop?.();
    vi.useRealTimers();
  });
});
