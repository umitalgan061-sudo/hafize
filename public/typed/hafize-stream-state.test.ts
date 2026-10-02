import { describe, expect, it, vi } from 'vitest';
import {
  createHafizeStreamController,
  formatStreamBytes,
  formatStreamDuration,
  phaseLabel,
  phaseTone
} from './hafize-stream-state.ts';

describe('Hafize stream state controller', () => {
  it('starts idle and emits the current state to new subscribers', () => {
    const controller = createHafizeStreamController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
      phase: 'idle',
      sequence: 0
    }));

    unsubscribe();
    controller.begin();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('creates a new sequence for every stream', () => {
    const controller = createHafizeStreamController();
    expect(controller.begin()).toBe(1);
    controller.complete();
    expect(controller.begin('trace-2')).toBe(2);
    expect(controller.snapshot()).toMatchObject({
      phase: 'connecting',
      sequence: 2,
      traceId: 'trace-2'
    });
  });

  it('moves to streaming only after a chunk event', () => {
    const controller = createHafizeStreamController();
    controller.begin();

    expect(controller.snapshot().phase).toBe('connecting');
    controller.chunk(128, 2);
    expect(controller.snapshot()).toMatchObject({
      phase: 'streaming',
      bytesRead: 128,
      events: 2
    });

    controller.chunk(-40, -2);
    expect(controller.snapshot()).toMatchObject({
      bytesRead: 128,
      events: 2
    });
  });

  it('completes with final wire statistics', () => {
    const controller = createHafizeStreamController();
    controller.begin('abc');
    controller.chunk(50, 1);
    controller.complete({
      bytesRead: 512,
      events: 9,
      durationMs: 990,
      traceId: 'final-trace'
    });

    const snapshot = controller.snapshot();
    expect(snapshot.phase).toBe('completed');
    expect(snapshot.bytesRead).toBe(512);
    expect(snapshot.events).toBe(9);
    expect(snapshot.traceId).toBe('final-trace');
    expect(snapshot.endedAt).not.toBeNull();
    expect(snapshot.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('normalizes failure metadata without exposing arbitrary errors', () => {
    const controller = createHafizeStreamController();
    controller.begin();
    controller.fail(Object.assign(new Error('secret text'), { code: 'SSE_NETWORK_ERROR' }));

    expect(controller.snapshot()).toMatchObject({
      phase: 'failed',
      errorCode: 'SSE_NETWORK_ERROR',
      errorMessage: 'secret text'
    });
  });

  it('marks abort separately from failure', () => {
    const controller = createHafizeStreamController();
    controller.begin();
    controller.abort(new DOMException('Aborted', 'AbortError'));

    expect(controller.snapshot()).toMatchObject({
      phase: 'aborted',
      errorCode: 'AbortError'
    });
    expect(controller.snapshot().durationMs).toBeGreaterThanOrEqual(0);
  });

  it('ignores terminal transitions after completion', () => {
    const controller = createHafizeStreamController();
    controller.begin();
    controller.complete();
    const completed = controller.snapshot();
    controller.fail(new Error('late'));
    controller.abort();
    expect(controller.snapshot()).toBe(completed);
  });

  it('resets state while preserving monotonic sequence numbering', () => {
    const controller = createHafizeStreamController();
    controller.begin();
    controller.complete();
    controller.reset();
    expect(controller.snapshot()).toMatchObject({
      phase: 'idle',
      sequence: 1,
      bytesRead: 0,
      events: 0
    });
  });

  it('isolates subscriber failures', () => {
    const controller = createHafizeStreamController();
    const safe = vi.fn();
    controller.subscribe(() => { throw new Error('bad subscriber'); });
    controller.subscribe(safe);

    controller.begin();
    controller.chunk(10);

    expect(safe).toHaveBeenCalled();
    expect(controller.snapshot().phase).toBe('streaming');
  });

  it('stops notifying subscribers after destroy', () => {
    const controller = createHafizeStreamController();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.destroy();
    controller.begin();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('stream display helpers', () => {
  it.each([
    ['idle', ''],
    ['connecting', 'Bağlanıyor'],
    ['streaming', 'Yanıt geliyor'],
    ['completed', 'Tamamlandı'],
    ['aborted', 'İptal edildi'],
    ['failed', 'Hata']
  ] as const)('labels %s', (phase, label) => {
    expect(phaseLabel(phase)).toBe(label);
  });

  it('maps phases to stable UI tones', () => {
    expect(phaseTone('connecting')).toBe('active');
    expect(phaseTone('streaming')).toBe('active');
    expect(phaseTone('completed')).toBe('success');
    expect(phaseTone('aborted')).toBe('warning');
    expect(phaseTone('failed')).toBe('error');
    expect(phaseTone('idle')).toBe('neutral');
  });

  it('formats milliseconds and seconds consistently', () => {
    expect(formatStreamDuration(null)).toBe('—');
    expect(formatStreamDuration(0)).toBe('0 ms');
    expect(formatStreamDuration(250)).toBe('250 ms');
    expect(formatStreamDuration(1_500)).toBe('1.5 sn');
    expect(formatStreamDuration(20_000)).toBe('20 sn');
  });

  it('formats bytes with bounded units', () => {
    expect(formatStreamBytes(0)).toBe('0 B');
    expect(formatStreamBytes(1_024)).toBe('1 KB');
    expect(formatStreamBytes(9_216)).toBe('9.0 KB');
    expect(formatStreamBytes(1_048_576)).toBe('1.0 MB');
  });
});
