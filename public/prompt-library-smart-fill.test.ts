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

  it('caps the variable count and the length of each name', () => {
    vi.stubGlobal('HafizePromptLibrary', {
      extractVariables: (body: string) => [...body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => match[1])
    });
    const many = Array.from({ length: 30 }, (_, index) => `{{ad${index}}}`).join(' ');
    expect(variableNames(many)).toHaveLength(12);
    expect(variableNames(`{{${'u'.repeat(80)}}}`)[0]).toHaveLength(32);
    expect(variableNames('düz metin')).toEqual([]);
  });

  it('degrades to an empty preset list when storage refuses to be read', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('SecurityError'); } });
    expect(readPresets('prompt')).toEqual([]);
  });

  it('reports a failed write instead of pretending the preset was stored', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); }
    });
    expect(writePresets('prompt', [{ id: 'a', name: 'Set', values: {} }])).toBe(false);
  });

  it('drops preset records without a name or an id', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify([
        { id: 'keep', name: 'Set', values: { konu: 'değer' } },
        { id: '', name: 'Adsız', values: {} },
        { id: 'no-name', name: '   ', values: {} }
      ])
    });
    expect(readPresets('prompt').map((preset) => preset.id)).toEqual(['keep']);
  });

  it('stores only the bounded preset collection under a prompt-specific key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem, getItem: () => null });
    const presets = Array.from({ length: 9 }, (_, index) => ({ id: `id-${index}`, name: `Set ${index}`, values: { konu: 'x' } }));
    expect(writePresets('abc', presets)).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = setItem.mock.calls[0] ?? [];
    expect(key).toBe('hafize.prompt-library.smart-fill.v1.abc');
    expect(JSON.parse(raw)).toHaveLength(6);
  });
});
