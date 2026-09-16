import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchPromptLibrary } from './prompt-library-command-palette.ts';

describe('Prompt Library command palette', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ranks exact titles above prefixes, tags and body matches', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify([
        { id: 'body', title: 'Kod', body: 'asistan metni', tags: [], updatedAt: '2026-01-01T00:00:00Z' },
        { id: 'tag', title: 'Plan', body: 'başka', tags: ['asistan'], updatedAt: '2026-01-02T00:00:00Z' },
        { id: 'prefix', title: 'Asistan için plan', body: 'başka', tags: [], updatedAt: '2026-01-03T00:00:00Z' },
        { id: 'exact', title: 'Asistan', body: 'başka', tags: [], favorite: false, updatedAt: '2026-01-04T00:00:00Z' }
      ])
    });
    const result = searchPromptLibrary('Asistan');
    expect(result.map((item) => item.id)).toEqual(['exact', 'prefix', 'tag', 'body']);
  });

  it('uses favorite and updated date as deterministic tie breakers', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify([
        { id: 'old', title: 'A plan', body: '', tags: [], favorite: false, updatedAt: '2026-01-01T00:00:00Z' },
        { id: 'new', title: 'B plan', body: '', tags: [], favorite: false, updatedAt: '2026-02-01T00:00:00Z' },
        { id: 'fav', title: 'C plan', body: '', tags: [], favorite: true, updatedAt: '2026-01-05T00:00:00Z' }
      ])
    });
    const result = searchPromptLibrary('plan');
    expect(result[0]?.id).toBe('fav');
    expect(result).toHaveLength(3);
  });

  it('caps the query and the result set', () => {
    const longQuery = 'a'.repeat(500);
    const items = Array.from({ length: 40 }, (_, index) => ({
      id: String(index), title: `A ${index}`, body: longQuery, tags: [], updatedAt: new Date().toISOString()
    }));
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(items) });
    expect(searchPromptLibrary(`${longQuery} suffix`)).toHaveLength(0);
    expect(searchPromptLibrary('A')).toHaveLength(12);
  });

  it('survives broken local storage payloads', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken' });
    expect(searchPromptLibrary('anything')).toEqual([]);
  });
});
