import { describe, expect, it } from 'vitest';
import { normalizeSpeechText, splitSpeechText, VOICE_OUTPUT_LIMITS } from './voice-output.ts';

describe('voice output text pipeline', () => {
  it('removes code blocks before speech synthesis', () => {
    expect(normalizeSpeechText('Merhaba ```js const x = 1``` dünya')).toBe('Merhaba Kod bloğu atlandı. dünya');
  });

  it('keeps inline code readable while removing markdown punctuation', () => {
    expect(normalizeSpeechText('`merhaba` **dünya**')).toBe('merhaba dünya');
  });

  it('replaces URLs with a spoken link placeholder', () => {
    expect(normalizeSpeechText('Detay: https://example.com/test?a=1')).toContain('bağlantı');
  });

  it('clips oversized speech payloads', () => {
    const value = normalizeSpeechText('x'.repeat(VOICE_OUTPUT_LIMITS.speech + 200));
    expect(value.length).toBe(VOICE_OUTPUT_LIMITS.speech);
  });

  it('returns empty chunks for empty content', () => {
    expect(splitSpeechText('')).toEqual([]);
  });

  it('preserves sentence boundaries when chunking', () => {
    const chunks = splitSpeechText('Birinci cümle. İkinci cümle. Üçüncü cümle.', 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('Birinci cümle.');
  });

  it('never emits a chunk above requested size for normal words', () => {
    const chunks = splitSpeechText('bir iki üç dört beş altı yedi sekiz dokuz on', 20);
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true);
  });

  it('normalizes whitespace for deterministic playback', () => {
    expect(normalizeSpeechText('  çok   boşluklu\nmetin  ')).toBe('çok boşluklu metin');
  });
});
