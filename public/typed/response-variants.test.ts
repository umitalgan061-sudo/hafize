import {
  MAX_RESPONSE_ALTERNATES,
  canRegenerateResponse,
  createGenerationSnapshot,
  normalizeResponseAlternates,
  rememberResponseAlternate,
  restoreLatestResponseAlternate
} from './response-variants';

describe('response variants', () => {
  it('normalizes newest-first alternate history with a hard cap', () => {
    expect(normalizeResponseAlternates([' C ', 'B', 'A', 'B', 9], 3)).toEqual(['C', 'B', 'A']);
    expect(normalizeResponseAlternates(['A', 'B'], 0)).toEqual([]);
  });

  it('remembers the latest previous response without duplicates', () => {
    expect(rememberResponseAlternate(['B', 'A'], 'C')).toEqual(['C', 'B', 'A'].slice(0, MAX_RESPONSE_ALTERNATES));
    expect(rememberResponseAlternate(['B', 'A'], 'B')).toEqual(['B', 'A']);
  });

  it('restores the latest previous response while preserving the replaced value', () => {
    expect(restoreLatestResponseAlternate('C', ['B', 'A'])).toEqual({
      current: 'B',
      alternates: ['C', 'A']
    });
  });

  it('rejects regeneration unless the last message is a non-empty assistant response', () => {
    expect(canRegenerateResponse([{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }], 1)).toBe(true);
    expect(canRegenerateResponse([{ role: 'assistant', content: 'y' }], 0)).toBe(false);
    expect(canRegenerateResponse([{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }, { role: 'user', content: 'z' }], 1)).toBe(false);
    expect(canRegenerateResponse([{ role: 'user', content: 'x' }, { role: 'assistant', content: ' ' }], 1)).toBe(false);
  });

  it('sanitizes local generation metadata', () => {
    const snapshot = createGenerationSnapshot(' model ', ' agent ', true, 12.8, '2026-09-28T06:00:00.000Z');
    expect(snapshot).toMatchObject({ model: 'model', agentId: 'agent', toolsEnabled: true, durationMs: 12 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(createGenerationSnapshot(null, null, false, -1).durationMs).toBe(null);
  });
});
