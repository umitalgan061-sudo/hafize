import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGenerationController,
  formatGenerationBytes,
  formatGenerationElapsed,
  type GenerationSnapshot
} from './generation-control.ts';
import {
  appendGenerationHistory,
  compactGenerationHistoryForCopy,
  normalizeGenerationHistory,
  readGenerationHistory,
  summarizeGenerationHistory,
  writeGenerationHistory
} from './generation-history.ts';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

const snapshot = (phase: GenerationSnapshot['phase'], runId: number): GenerationSnapshot => ({
  phase,
  runId,
  startedAt: Date.now() - 150,
  endedAt: Date.now(),
  elapsedMs: 150,
  bytesRead: 2048,
  events: 7,
  stopReason: phase === 'aborted' ? 'user' : null,
  label: 'Hafize yanıtı',
  errorCode: phase === 'failed' ? 'NETWORK_ERROR' : null
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('generation-control formatting', () => {
  it('formats bounded elapsed time', () => {
    expect(formatGenerationElapsed(0)).toBe('0 ms');
    expect(formatGenerationElapsed(950)).toBe('950 ms');
    expect(formatGenerationElapsed(2400)).toBe('2.4 sn');
    expect(formatGenerationElapsed(62000)).toBe('1 dk 2 sn');
    expect(formatGenerationElapsed(Number.NaN)).toBe('0 ms');
  });

  it('formats bounded byte counts', () => {
    expect(formatGenerationBytes(900)).toBe('900 B');
    expect(formatGenerationBytes(2048)).toBe('2.0 KB');
    expect(formatGenerationBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatGenerationBytes(-1)).toBe('0 B');
  });
});

describe('generation-control state machine', () => {
  it('creates one active run and exposes an abort signal', () => {
    const controller = createGenerationController();
    const run = controller.begin('Yanıt üretiliyor');
    expect(run).not.toBeNull();
    expect(run?.signal.aborted).toBe(false);
    expect(controller.snapshot().phase).toBe('active');
    expect(controller.begin('ikinci')).toBeNull();
    controller.destroy();
  });

  it('stops the active run and aborts the underlying signal', () => {
    const controller = createGenerationController();
    const run = controller.begin('Yanıt üretiliyor');
    expect(controller.stop('user')).toBe(true);
    expect(run?.signal.aborted).toBe(true);
    expect(controller.snapshot()).toMatchObject({
      phase: 'aborted',
      stopReason: 'user',
      errorCode: 'SSE_ABORTED'
    });
    expect(controller.stop('user')).toBe(false);
    controller.destroy();
  });

  it('publishes monotonically increasing progress', () => {
    const controller = createGenerationController();
    const updates: GenerationSnapshot[] = [];
    controller.subscribe((next) => updates.push(next));
    controller.begin('Yanıt');
    controller.progress(512, 2);
    controller.progress(2048, 3);
    expect(controller.snapshot()).toMatchObject({ phase: 'active', bytesRead: 2048, events: 5 });
    expect(updates.at(-1)?.events).toBe(5);
    controller.complete({ bytesRead: 4096, events: 9 });
    expect(controller.snapshot()).toMatchObject({ phase: 'completed', bytesRead: 4096, events: 9 });
    controller.destroy();
  });

  it('records terminal errors without leaking arbitrary objects', () => {
    const controller = createGenerationController();
    controller.begin('Yanıt');
    controller.fail({ code: 'NVIDIA_TIMEOUT', secret: 'do-not-store' });
    expect(controller.snapshot()).toMatchObject({
      phase: 'failed',
      errorCode: 'NVIDIA_TIMEOUT'
    });
    controller.destroy();
  });

  it('ignores terminal transitions after a user stop', () => {
    const controller = createGenerationController();
    controller.begin('Yanıt');
    controller.stop('offline');
    controller.complete();
    controller.fail(new Error('late'));
    expect(controller.snapshot().phase).toBe('aborted');
    expect(controller.snapshot().stopReason).toBe('offline');
    controller.destroy();
  });
});

describe('generation-history persistence', () => {
  it('normalizes duplicate and malformed history records', () => {
    const normalized = normalizeGenerationHistory([
      snapshot('completed', 1),
      { ...snapshot('completed', 1), id: 'same' },
      { id: 'same', phase: 'failed', startedAt: 'bad', endedAt: 'bad' },
      { phase: 'invalid' }
    ]);
    expect(normalized.length).toBe(2);
    expect(normalized.every((entry) => ['completed', 'failed', 'aborted'].includes(entry.phase))).toBe(true);
  });

  it('writes and reads metadata-only history within bounds', () => {
    const storage = new MemoryStorage();
    const entry = { ...snapshot('completed', 4), id: 'run-4' };
    expect(writeGenerationHistory(storage, [entry])).toBe(true);
    const read = readGenerationHistory(storage);
    expect(read).toHaveLength(1);
    expect(read[0]).toMatchObject({ runId: 4, bytesRead: 2048 });
    expect(JSON.stringify(read)).not.toContain('do-not-store');
  });

  it('prepends newer history and caps it to twelve entries', () => {
    const storage = new MemoryStorage();
    const entries = Array.from({ length: 20 }, (_, index) => ({
      ...snapshot('completed', index + 1),
      id: `run-${index + 1}`
    }));
    const next = appendGenerationHistory(storage, entries.at(-1)!);
    expect(next.length).toBe(1);
    const all = appendGenerationHistory(storage, { ...snapshot('failed', 99), id: 'run-99' });
    expect(all[0]?.id).toBe('run-99');
  });

  it('summarizes and compacts history without prompt content', () => {
    const entries = [
      { ...snapshot('completed', 1), id: '1' },
      { ...snapshot('aborted', 2), id: '2' },
      { ...snapshot('failed', 3), id: '3' }
    ].map((entry) => ({
      id: entry.id,
      runId: entry.runId,
      phase: entry.phase,
      startedAt: new Date(entry.startedAt!).toISOString(),
      endedAt: new Date(entry.endedAt!).toISOString(),
      elapsedMs: entry.elapsedMs,
      bytesRead: entry.bytesRead,
      events: entry.events,
      label: entry.label,
      stopReason: entry.stopReason,
      errorCode: entry.errorCode
    }));
    const summary = summarizeGenerationHistory(entries);
    expect(summary).toMatchObject({ total: 3, completed: 1, aborted: 1, failed: 1 });
    const compact = compactGenerationHistoryForCopy(entries);
    expect(compact).toContain('Hafize üretim geçmişi');
    expect(compact).not.toContain('prompt');
  });
});
