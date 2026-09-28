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
    const result = selectResponseVariant('C', [' B ', 'A'], 1, 1);
    expect(result).toEqual({ current: 'B', alternates: ['C'] });
  });
});
