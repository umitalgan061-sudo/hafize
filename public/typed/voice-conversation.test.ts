import { describe, expect, it } from 'vitest';
import { readTranscript, isFreshVoiceReply } from './voice-mode.ts';
import { isLightweightVoiceTurn } from './voice-turn-routing.ts';

function result(text: string, isFinal: boolean) {
  return Object.assign([{ transcript: text }], { isFinal });
}

describe('voice conversation turn isolation', () => {
  it('never mistakes a redrawn copy of the previous answer for the new reply', () => {
    expect(isFreshVoiceReply('assistant', 'answer-old', 'answer-old')).toBe(false);
    expect(isFreshVoiceReply('user', 'question-new', 'answer-old')).toBe(false);
    expect(isFreshVoiceReply('assistant', 'answer-new', 'answer-old')).toBe(true);
    expect(isFreshVoiceReply('assistant', null, 'answer-old')).toBe(false);
    expect(isFreshVoiceReply(null, 'answer-new', 'answer-old')).toBe(false);
  });

  it('keeps every finalized phrase and only the latest interim result', () => {
    expect(readTranscript([result('Yarın', true), result(' Ankara', true), result(' hava nasıl', false)]))
      .toEqual({ final: 'Yarın Ankara', interim: 'hava nasıl' });
    expect(readTranscript([result('Beni duyuyor', true), result(' musun', true)]))
      .toEqual({ final: 'Beni duyuyor musun', interim: '' });
    expect(readTranscript(null)).toEqual({ final: '', interim: '' });
  });
});

describe('low latency voice routing', () => {
  it.each([
    'Naber?', 'Hafize, naber?', 'Merhaba', 'Nasıl gidiyor?',
    'Beni duyuyor musun?', 'Teşekkürler!', 'Biraz sohbet edelim.'
  ])('streams ordinary conversation without running the agent tools: %s', (value) => {
    expect(isLightweightVoiceTurn(value)).toBe(true);
  });

  it.each([
    'Yarın Ankara hava nasıl?', 'Merhaba, yarın hava nasıl?',
    'İstanbul uçuşlarını araştır', 'GitHub depomu incele',
    'Son haberleri özetle', '', '10 dakika sonra hatırlat'
  ])('does not bypass tools for actual tasks: %s', (value) => {
    expect(isLightweightVoiceTurn(value)).toBe(false);
  });
});
