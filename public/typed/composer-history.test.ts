import { describe, expect, it } from 'vitest';
import { normalizeSettings, normalize, COMPOSER_HISTORY_LIMITS, COMPOSER_HISTORY_RETENTION } from './composer-history.ts';

describe('composer history contracts', () => {
  it('normalizes settings to supported retention windows', () => {
    expect(normalizeSettings({ enabled: true, maxItems: 20 })).toEqual({ enabled: true, maxItems: 20 });
    expect(normalizeSettings({ enabled: true, maxItems: 999 })).toEqual({ enabled: true, maxItems: 40 });
    expect(normalizeSettings({ enabled: false, maxItems: 0 })).toEqual({ enabled: false, maxItems: 0 });
  });

  it('preserves an explicit list of supported retention values', () => {
    expect([...COMPOSER_HISTORY_RETENTION]).toEqual([0, 10, 20, 40]);
    expect(COMPOSER_HISTORY_LIMITS.maxItems).toBe(40);
  });

  it('strips null characters and clips oversized history items', () => {
    const value = normalize(`abc\0${'x'.repeat(COMPOSER_HISTORY_LIMITS.maxText + 10)}`);
    expect(value.includes('\0')).toBe(false);
    expect(value.length).toBe(COMPOSER_HISTORY_LIMITS.maxText);
  });
});
