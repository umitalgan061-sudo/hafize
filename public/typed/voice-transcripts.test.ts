import { describe, expect, it } from 'vitest';
import { readRecognitionText, mergeTranscript, normalizeTranscript } from './voice-input.js';
import type { RecognitionEventLike, RecognitionResultLike } from './voice-input.js';
import { normalizeSpeechText, splitSpeechText } from './voice-output.js';

function resultsOf(texts: string[]): RecognitionResultLike[][] {
  return texts.map((transcript) => [{ transcript }]);
}

function eventOf(texts: string[], resultIndex?: number): RecognitionEventLike {
  return { results: resultsOf(texts), ...(resultIndex === undefined ? {} : { resultIndex }) };
}

describe('voice-input transcripts', () => {
  it('normalizes whitespace and trims', () => {
    expect(normalizeTranscript('  merhaba   nasilsin  ')).toBe('merhaba nasilsin');
    expect(normalizeTranscript(undefined)).toBe('');
  });

  it('reads every accumulated result, not only the changed one', () => {
    // Chrome reports resultIndex as "the result that just changed". Starting there
    // dropped the words already transcribed in the same session.
    const event: RecognitionEventLike = { results: resultsOf(['merhaba', 'nasilsin', 'iyiyim']), resultIndex: 2 };
    expect(readRecognitionText(event)).toBe('merhaba nasilsin iyiyim');
  });

  it('handles a missing resultIndex', () => {
    expect(readRecognitionText({ results: resultsOf(['selam']) })).toBe('selam');
  });

  it('ignores empty or malformed events', () => {
    expect(readRecognitionText({})).toBe('');
    expect(readRecognitionText({ results: [] })).toBe('');
    expect(readRecognitionText({ results: [[{}], [{}]] })).toBe('');
  });

  it('merges a spoken chunk onto the existing prefix', () => {
    expect(mergeTranscript('merhaba', 'nasilsin')).toBe('merhaba nasilsin');
    expect(mergeTranscript('merhaba  ', '  nasilsin')).toBe('merhaba nasilsin');
    expect(mergeTranscript('merhaba', '')).toBe('merhaba');
    expect(mergeTranscript('', 'selam')).toBe('selam');
  });

  it('respects the length budget when merging', () => {
    const merged = mergeTranscript('a'.repeat(50), 'b'.repeat(50), 60);
    expect(merged).toHaveLength(60);
    expect(merged.startsWith('a'.repeat(49))).toBe(true);
  });
});

describe('voice-output speech preparation', () => {
  it('strips code blocks and links before speaking', () => {
    const text = normalizeSpeechText('Merhaba ```const a=1``` git https://example.com/x son');
    expect(text).not.toContain('const');
    expect(text).not.toContain('example.com');
    expect(text).toContain('git');
    expect(text).toContain('son');
  });

  it('drops markdown emphasis and heading markers', () => {
    expect(normalizeSpeechText('**kalın** _italik_ ### başlık')).toBe('kalın italik başlık');
    expect(normalizeSpeechText(undefined)).toBe('');
  });

  it('caps the spoken text', () => {
    expect(normalizeSpeechText('x'.repeat(5000))).toHaveLength(2400);
  });

  it('splits long text into speakable chunks under the limit', () => {
    const chunks = splitSpeechText(`${'a'.repeat(200)}. ${'b'.repeat(200)}.`);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(240);
    expect(chunks.join(' ').replace(/\s+/g, '')).toBe(`${'a'.repeat(200)}.${'b'.repeat(200)}.`);
  });

  it('packs sentences together while they fit under the limit', () => {
    const chunks = splitSpeechText('Bir cumle. Ikinci cumle! Ucuncu cumle?');
    expect(chunks).toEqual(['Bir cumle. Ikinci cumle! Ucuncu cumle?']);
  });

  it('returns nothing for empty or unreadable input', () => {
    expect(splitSpeechText('')).toEqual([]);
    expect(splitSpeechText('   ')).toEqual([]);
  });
});
