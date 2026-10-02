import { describe, expect, it } from 'vitest';
import {
  listResponseVariants,
  selectResponseVariant
} from './response-variants.ts';

describe('response variant selection', () => {
  it('lists current response before bounded history', () => {
    expect(listResponseVariants('C', ['B', 'A'])).toEqual([
      { index: 0, kind: 'current', content: 'C' },
      { index: 1, kind: 'previous', content: 'B' },
      { index: 2, kind: 'previous', content: 'A' }
    ]);
  });

  it('selects an older response and preserves the replaced current response', () => {
    expect(selectResponseVariant('C', ['B', 'A'], 2)).toEqual({
      current: 'A',
      alternates: ['C', 'B']
    });
  });

  it('rejects the current variant and invalid indexes', () => {
    expect(selectResponseVariant('C', ['B'], 0)).toBe(null);
    expect(selectResponseVariant('C', ['B'], 5)).toBe(null);
    expect(selectResponseVariant('C', [], 1)).toBe(null);
  });

  it('trims and caps selected response content', () => {
    // The fourth argument is a per-response length bound, not an item count:
    // every variant is trimmed and truncated, none of them is dropped.
    const result = selectResponseVariant('CCCC', ['  BBBB  ', 'AAAA'], 1, 2);
    expect(result).toEqual({ current: 'BB', alternates: ['CC', 'AA'] });
  });
});
