import { describe, expect, it } from 'vitest';
import { formatScheduleDate, isoFromLocal, localDateTimeValue, normalizeStatus, statusText, SCHEDULE_LIMITS } from './scheduled-tasks.ts';

describe('scheduled task contracts', () => {
  it('maps known statuses to typed labels', () => {
    expect(normalizeStatus('scheduled')).toBe('scheduled');
    expect(normalizeStatus('running')).toBe('running');
    expect(normalizeStatus('unexpected')).toBe('unknown');
    expect(statusText('completed')).toBe('Tamamlandı');
  });

  it('converts a valid local datetime into ISO', () => {
    const value = isoFromLocal('2026-09-20T12:30');
    expect(value).toMatch(/^2026-09-20T/);
  });

  it('returns empty string for malformed datetime values', () => {
    expect(isoFromLocal('not-a-date')).toBe('');
  });

  it('creates a future local default from a fixed clock', () => {
    const value = localDateTimeValue(5, new Date('2026-09-16T10:00:00'));
    expect(value).toContain('2026-09-16T10:05');
  });

  it('formats valid dates for Turkish users', () => {
    expect(formatScheduleDate('2026-09-20T12:30:00Z')).not.toBe('Tarih bilinmiyor');
  });

  it('enforces bounded task configuration', () => {
    expect(SCHEDULE_LIMITS.list).toBe(128);
    expect(SCHEDULE_LIMITS.attempts).toBe(5);
  });
});
