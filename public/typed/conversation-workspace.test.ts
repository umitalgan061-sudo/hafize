import { describe, expect, it } from 'vitest';
import { cleanTag, cleanTitle, collectTags, filterConversations, matchesConversation, normalizeConversationList, normalizeState, sortConversations } from './conversation-workspace.ts';

const conversations = [
  { id: '1', title: 'Birinci', agentId: 'writer', toolsEnabled: false, archived: false, pinned: true, tags: ['İş'], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', messages: [{ id: 'm1', role: 'user' as const, content: 'rapor hazırla', at: '2026-01-01T00:00:00Z' }] },
  { id: '2', title: 'İkinci', agentId: 'research', toolsEnabled: true, archived: true, pinned: false, tags: ['Araştırma'], createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-02T00:00:00Z', messages: [{ id: 'm2', role: 'assistant' as const, content: 'kaynak özeti', at: '2026-02-01T00:00:00Z' }] }
];

describe('conversation workspace contracts', () => {
  it('cleans titles and tags at their boundary', () => {
    expect(cleanTitle('  Yeni   başlık  ')).toBe('Yeni başlık');
    expect(cleanTag('## İş')).toBe('İş');
  });

  it('normalizes malformed workspace state', () => {
    expect(normalizeState({ filter: 'nope', sort: 'nope', selected: [1, '2'] })).toEqual({ filter: 'all', sort: 'updated-desc', tag: '', query: '', selected: ['2'] });
  });

  it('removes duplicate conversation ids', () => {
    expect(normalizeConversationList([...conversations, conversations[0]]).map((item) => item.id)).toEqual(['1', '2']);
  });

  it('filters archived conversations correctly', () => {
    const state = normalizeState({ filter: 'archived' });
    expect(filterConversations(conversations, state).map((item) => item.id)).toEqual(['2']);
  });

  it('matches message body and tag search', () => {
    expect(matchesConversation(conversations[0], normalizeState({ query: 'rapor' }))).toBe(true);
    expect(matchesConversation(conversations[1], normalizeState({ query: 'iş' }))).toBe(false);
  });

  it('sorts by title and timestamps', () => {
    expect(sortConversations(conversations, 'title-asc').map((item) => item.id)).toEqual(['1', '2']);
    expect(sortConversations(conversations, 'updated-desc').map((item) => item.id)).toEqual(['2', '1']);
  });

  it('aggregates tags with counts', () => {
    const tags = collectTags([...conversations, { ...conversations[0], id: '3' }]);
    expect(tags[0]).toEqual({ label: 'İş', count: 2 });
  });
});
