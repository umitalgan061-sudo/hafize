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
