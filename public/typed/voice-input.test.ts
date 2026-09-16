import { describe, expect, it } from 'vitest';
import { containsWakePhrase, getSpeechRecognitionConstructor, mapSpeechError, mergeTranscript, normalizeRecognitionError, normalizeTranscript, readRecognitionText } from './hands-free.ts';
import { normalizeTranscript as normalizeVoiceTranscript, mergeTranscript as mergeVoiceTranscript } from './voice-input.ts';

describe('voice input contracts', () => {
  it('normalizes transcript whitespace without changing readable language', () => {
    expect(normalizeVoiceTranscript('  Merhaba   dünya \n bugün ')).toBe('Merhaba dünya bugün');
  });

  it('merges spoken text without duplicate whitespace', () => {
    expect(mergeVoiceTranscript('Merhaba', ' dünya  bugün ', 120)).toBe('Merhaba dünya bugün');
  });

  it('clips merged transcript at input limit', () => {
    expect(mergeVoiceTranscript('abc', 'defghi', 6)).toBe('abcdef');
  });

  it('maps microphone permission errors to actionable Turkish copy', () => {
    expect(mapSpeechError('not-allowed')).toMatch(/mikrofon izni/i);
    expect(mapSpeechError('audio-capture')).toMatch(/mikrofon/i);
    expect(mapSpeechError('aborted')).toBe('');
  });

  it('extracts recognition result chunks from a result event', () => {
    const event = { resultIndex: 0, results: [[{ transcript: 'Hafize' }], [{ transcript: ' merhaba' }]] };
    expect(readRecognitionText(event)).toBe('Hafize merhaba');
  });

  it('normalizes error codes consistently', () => {
    expect(normalizeRecognitionError('SERVICE_NOT_ALLOWED')).toBe('service-not-allowed');
  });

  it('detects single and multi-word wake phrases as token boundaries', () => {
    expect(containsWakePhrase('Merhaba Hafize')).toBe(true);
    expect(containsWakePhrase('Hafize yardımcı ol')).toBe(true);
    expect(containsWakePhrase('hafizeden')).toBe(false);
    expect(containsWakePhrase('Merhaba hafize yardım et', 'merhaba hafize')).toBe(true);
  });

  it('exposes both supported recognition constructor names', () => {
    const root = { SpeechRecognition: function Modern() {} } as unknown as Window;
    expect(getSpeechRecognitionConstructor(root)).toBe((root as any).SpeechRecognition);
  });

  it('handles missing recognition support', () => {
    expect(getSpeechRecognitionConstructor({} as Window)).toBeNull();
  });
});
