import { describe, expect, it } from 'vitest';
import { classifyRecognitionError, containsWakePhrase, networkRetryDelay, normalizeRecognitionError, normalizeSpeech, HANDS_FREE_LIMITS, HANDS_FREE_RETRY_DELAYS } from './hands-free.ts';

describe('hands free contracts', () => {
  it('normalizes Turkish wake phrases', () => {
    expect(normalizeSpeech(' HAFİZE! Yardım eder misin? ')).toBe('hafize yardım eder misin');
  });

  it('requires word boundaries for wake phrases', () => {
    expect(containsWakePhrase('hafize yardım')).toBe(true);
    expect(containsWakePhrase('hafizeden')).toBe(false);
  });

  it('classifies network and terminal recognition errors', () => {
    expect(classifyRecognitionError('network').kind).toBe('network');
    expect(classifyRecognitionError('not-allowed').kind).toBe('terminal');
    expect(classifyRecognitionError('aborted').kind).toBe('aborted');
  });

  it('normalizes underscore error names', () => {
    expect(normalizeRecognitionError('SERVICE_NOT_ALLOWED')).toBe('service-not-allowed');
  });

  it('uses bounded exponential-like retry delays', () => {
    expect(networkRetryDelay(1)).toBe(2000);
    expect(networkRetryDelay(2)).toBe(5000);
    expect(networkRetryDelay(99)).toBe(HANDS_FREE_RETRY_DELAYS.at(-1));
  });

  it('keeps a finite safety session and cooldown', () => {
    expect(HANDS_FREE_LIMITS.session).toBe(30 * 60 * 1000);
    expect(HANDS_FREE_LIMITS.cooldown).toBe(1800);
  });
});
