import { describe, expect, it } from 'vitest';
import { normalize, searchableText, CHAT_HISTORY_SHORTCUT } from './chat-history-search.ts';

describe('chat history search contracts', () => {
  const sample = { title: 'Toplantı Notları', agentId: 'research', messages: [{ content: 'Müşteri analizi ve aksiyon maddeleri' }] };

  it('uses Turkish-aware normalization', () => {
    expect(normalize('  İÇERİK   TESTİ  ')).toBe('içerik testi');
  });

  it('indexes title, agent and message content', () => {
    const haystack = searchableText(sample);
    expect(haystack).toContain('toplantı notları');
    expect(haystack).toContain('research');
    expect(haystack).toContain('müşteri analizi');
  });

  it('handles absent messages without throwing', () => {
    expect(searchableText({ title: 'Yalnız başlık' })).toBe('yalnız başlık');
  });

  it('keeps keyboard shortcut intent explicit', () => {
    expect(CHAT_HISTORY_SHORTCUT.key).toBe('f');
    expect(CHAT_HISTORY_SHORTCUT.ctrlOrMeta).toBe(true);
    expect(CHAT_HISTORY_SHORTCUT.shift).toBe(true);
  });
});
