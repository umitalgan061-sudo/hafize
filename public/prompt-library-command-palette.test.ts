import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchPromptLibrary } from './prompt-library-command-palette.ts';

const installStorage = (items: unknown[]) => vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(items) });
const installCore = () => vi.stubGlobal('HafizePromptLibrary', {
  loadItems: (storage: Storage) => JSON.parse(storage.getItem('hafize.prompt-library.v1') || '[]'),
  extractVariables: (body: string) => [...body.matchAll(/\{\{([A-Za-z0-9_-]+)\}\}/g)].map((match) => match[1])
});

describe('Prompt Library command palette', () => {
  beforeEach(() => installCore());
  afterEach(() => vi.unstubAllGlobals());

  it('ranks exact titles above prefixes, tags and body matches', () => {
    installStorage([
      { id: 'body', title: 'Kod', body: 'asistan metni', tags: [], updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'tag', title: 'Plan', body: 'başka', tags: ['asistan'], updatedAt: '2026-01-02T00:00:00Z' },
      { id: 'prefix', title: 'Asistan için plan', body: 'başka', tags: [], updatedAt: '2026-01-03T00:00:00Z' },
      { id: 'exact', title: 'Asistan', body: 'başka', tags: [], favorite: false, updatedAt: '2026-01-04T00:00:00Z' }
    ]);
    const result = searchPromptLibrary('Asistan');
    expect(result.map((item) => item.id)).toEqual(['exact', 'prefix', 'tag', 'body']);
  });

  it('uses favorite and updated date as deterministic tie breakers', () => {
    installStorage([
      { id: 'old', title: 'A plan', body: '', tags: [], favorite: false, updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'new', title: 'B plan', body: '', tags: [], favorite: false, updatedAt: '2026-02-01T00:00:00Z' },
      { id: 'fav', title: 'C plan', body: '', tags: [], favorite: true, updatedAt: '2026-01-05T00:00:00Z' }
    ]);
    const result = searchPromptLibrary('plan');
    expect(result[0]?.id).toBe('fav');
    expect(result).toHaveLength(3);
  });

  it('caps query length and maximum result count', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({ id: String(index), title: `A ${index}`, body: 'A', tags: [], updatedAt: new Date().toISOString() }));
    installStorage(items);
    expect(searchPromptLibrary('A'.repeat(500))).toHaveLength(12);
    expect(searchPromptLibrary('A')).toHaveLength(12);
  });

  it('survives malformed local storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{broken' });
    expect(searchPromptLibrary('anything')).toEqual([]);
  });
});
