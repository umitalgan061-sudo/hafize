import { describe, expect, it } from 'vitest';
import { nextSpeakable } from './voice-mode.ts';
import { AUDIO_STALL_TIMEOUT_MS, hasAudioStalled } from './voice-library.ts';

describe('incremental natural speech output', () => {
  it('speaks a first complete phrase without waiting for a whole paragraph', () => {
    const text = 'Merhaba. Nasılsın bugün? Biraz sohbet edelim.';
    const one = nextSpeakable(text, 0);
    expect(one).toEqual({ piece: 'Merhaba. ', end: 9 });
    const two = nextSpeakable(text, one.end);
    expect(two.piece).toBe('Nasılsın bugün? ');
    expect(nextSpeakable(text, two.end).piece).toBe('');
    expect(nextSpeakable(text, two.end, true).piece).toBe('Biraz sohbet edelim.');
  });

  it('never breaks numbers, while keeping a complete first sentence', () => {
    const text = '2026. yılda 1. adım 3.50 oldu. Her şey yolunda.';
    const part = nextSpeakable(text, 0);
    expect(part.piece).toBe('2026. yılda 1. adım 3.50 oldu. ');
    expect(nextSpeakable(text, part.end, true).piece).toBe('Her şey yolunda.');
  });

  it('starts a very long unpunctuated sentence at a word boundary', () => {
    const source = 'Bugün bütün işlerin nasıl gittiğini merak ediyorum ve eğer istersen birlikte güzel bir sohbet ederek günü biraz daha keyifli hale getirebiliriz çünkü konuşmak için buradayım '.repeat(3);
    const first = nextSpeakable(source, 0);
    expect(first.end).toBeGreaterThanOrEqual(120);
    expect(first.end).toBeLessThanOrEqual(210);
    expect(first.piece.endsWith(' ')).toBe(true);
    const second = nextSpeakable(source, first.end);
    expect(second.end).toBeGreaterThan(first.end);
  });

  it('never leaks an unfinished fenced code block into live speech', () => {
    const source = 'Açıklayayım. ```javascript\nconst secret = 42;';
    const first = nextSpeakable(source, 0);
    expect(first.piece).toBe('Açıklayayım. ');
    expect(nextSpeakable(source, first.end).piece).toBe('');
    const complete = source + '\n```\nİşlem bitti.';
    expect(nextSpeakable(complete, first.end, true).piece).toContain('```');
  });

  it('does not duplicate or lose text through partial-stream updates', () => {
    const chunks = [
      'Selam, ben Hafize',
      '. Bugün size',
      ' İstanbul hakkında bilgi vereceğim',
      '. Birinci adım tamamlandı',
      ', ikinci adıma geçelim.',
    ];
    let text = '';
    let cursor = 0;
    let spoken = '';
    for (const delta of chunks) {
      text += delta;
      for (;;) {
        const part = nextSpeakable(text, cursor);
        if (!part.piece) break;
        expect(part.end).toBeGreaterThan(cursor);
        spoken += part.piece;
        cursor = part.end;
      }
    }
    const tail = nextSpeakable(text, cursor, true);
    spoken += tail.piece;
    expect(spoken).toBe(text);
    expect(tail.end).toBe(text.length);
    expect(nextSpeakable(text, text.length, true).piece).toBe('');
  });

  it('bounds invalid cursors safely', () => {
    expect(nextSpeakable('Merhaba.', -99, true).piece).toBe('Merhaba.');
    expect(nextSpeakable('Merhaba.', 100, true).piece).toBe('');
  });
});

describe('downloaded voice playback stalls', () => {
  it('recognizes a stalled audio element without using a permanent speaking lock', () => {
    expect(hasAudioStalled(10_000, 10_000)).toBe(false);
    expect(hasAudioStalled(10_000 + AUDIO_STALL_TIMEOUT_MS - 1, 10_000)).toBe(false);
    expect(hasAudioStalled(10_000 + AUDIO_STALL_TIMEOUT_MS, 10_000)).toBe(true);
    expect(hasAudioStalled(Number.NaN, 10_000)).toBe(false);
  });
});
