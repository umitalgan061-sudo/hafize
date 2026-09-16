import { describe, expect, it, vi } from 'vitest';
import { countdownLabel } from './scheduled-tasks-countdown.ts';

describe('scheduled task countdown', () => {
  it('returns an empty label for invalid timestamps', () => {
    expect(countdownLabel('not-a-date')).toBe('');
  });

  it('reports overdue tasks without negative durations', () => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00Z'));
    expect(countdownLabel('2026-09-16T09:59:00Z')).toBe('Şimdi çalışması bekleniyor');
    vi.useRealTimers();
  });

  it('formats days and remaining hours', () => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00Z'));
    expect(countdownLabel('2026-09-18T12:30:00Z')).toBe('2 gün 2 saat kaldı');
    vi.useRealTimers();
  });

  it('formats short and medium durations', () => {
    vi.setSystemTime(new Date('2026-09-16T10:00:00Z'));
    expect(countdownLabel('2026-09-16T10:45:00Z')).toBe('45 dk kaldı');
    expect(countdownLabel('2026-09-16T12:30:00Z')).toBe('2 saat 30 dk kaldı');
    vi.useRealTimers();
  });
});
