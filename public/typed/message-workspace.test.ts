import { describe, expect, it } from 'vitest';
import { cleanTag, cleanText, filterViews, mergeRecord, normalizeFeedback, normalizeRecord, normalizeState, removeEmptyRecords, sortViews } from './message-workspace.ts';

const base = {
  id: 'r1', conversationId: 'c1', messageId: 'm1', saved: true, feedback: 'up' as const,
  note: 'faydalı', tags: ['İş'], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z'
};
const other = {
  id: 'r2', conversationId: 'c1', messageId: 'm2', saved: false, feedback: '' as const,
  note: '', tags: ['Araştırma'], createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-04T00:00:00Z'
};

describe('message workspace contracts', () => {
  it('cleans text and tags', () => {
    expect(cleanText('  a\0  b  ', 20)).toBe('a\0  b'.replace('\0', ''));
    expect(cleanTag('### İş')).toBe('İş');
  });

  it('normalizes invalid feedback to empty', () => {
    expect(normalizeFeedback('maybe')).toBe('');
    expect(normalizeFeedback('down')).toBe('down');
  });

  it('rejects records without ids', () => {
    expect(normalizeRecord({ conversationId: 'c1', messageId: '' })).toBeNull();
  });

  it('creates and updates a record through one merge function', () => {
    const created = mergeRecord(null, { conversationId: 'c2', messageId: 'm2', saved: true });
    expect(created.saved).toBe(true);
    const updated = mergeRecord(created, { note: 'test' });
    expect(updated.note).toBe('test');
    expect(updated.id).toBe(created.id);
  });

  it('normalizes workspace state and preserves a bounded selection', () => {
    const state = normalizeState({ query: '  RAPOR ', filter: 'saved', sort: 'notes', selected: ['a', 2] });
    expect(state).toEqual({ query: 'rapor', filter: 'saved', sort: 'notes', selected: ['a'] });
  });

  it('filters by message body and metadata', () => {
    const views = [
      { record: base, role: 'assistant' as const, content: 'müşteri raporu hazır' },
      { record: other, role: 'user' as const, content: 'araştırma notu' }
    ];
    expect(filterViews(views, normalizeState({ filter: 'saved' })).map((item) => item.record.id)).toEqual(['r1']);
    expect(filterViews(views, normalizeState({ query: 'rapor' })).map((item) => item.record.id)).toEqual(['r1']);
  });

  it('sorts feedback before neutral records when requested', () => {
    const views = [
      { record: other, role: 'user' as const, content: 'a' },
      { record: base, role: 'assistant' as const, content: 'b' }
    ];
    expect(sortViews(views, 'feedback')[0].record.id).toBe('r1');
  });

  it('removes records carrying no user state', () => {
    const empty = mergeRecord(null, { conversationId: 'c3', messageId: 'm3' });
    expect(removeEmptyRecords([base, empty]).map((item) => item.id)).toEqual(['r1']);
  });
});
