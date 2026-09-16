import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPresets, variableNames, writePresets } from './prompt-library-smart-fill.ts';

describe('Prompt Library Smart Fill', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('extracts stable unique variable names through the core bridge', () => {
    vi.stubGlobal('HafizePromptLibrary', {
      extractVariables: (body: string) => [...body.matchAll(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g)].map((match) => match[1])
    });
    expect(variableNames('{{konu}} {{konu}} {{format}}')).toEqual(['konu', 'format']);
  });

  it('reads malformed preset records safely and caps their size', () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({ id: `id-${index}`, name: `Set ${index}`, values: { konu: `değer-${index}` } }));
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([...entries, null, { id: '', name: '', values: {} }]) });
    expect(readPresets('prompt')).toHaveLength(6);
    expect(readPresets('prompt')[0]?.values.konu).toBe('değer-0');
  });

  it('stores only the bounded preset collection under a prompt-specific key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: () => null });
    const presets = Array.from({ length: 9 }, (_, index) => ({ id: `id-${index}`, name: `Set ${index}`, values: { konu: 'x' } }));
    expect(writePresets('abc', presets)).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = setItem.mock.calls[0];
    expect(key).toBe('hafize.prompt-library.smart-fill.v1.abc');
    expect(JSON.parse(raw)).toHaveLength(6);
  });
});
