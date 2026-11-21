import { describe, expect, it } from 'vitest';
import { recognitionProfile } from './voice-mode.ts';

describe('real microphone listening profile', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 26_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Mobile/15E148',
  ])('does not forcibly terminate every finalized result on iPhone / iPad: %s', (agent) => {
    const profile = recognitionProfile(agent);
    expect(profile.continuous).toBe(false);
    expect(profile.awaitNaturalEnd).toBe(true);
    expect(profile.resumeAfterSpeechMs).toBeGreaterThan(120);
    expect(profile.noResultTimeoutMs).toBeGreaterThanOrEqual(12_000);
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',
    'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/131.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15',
  ])('uses continuous sessions and fast endpointing off iOS: %s', (agent) => {
    const profile = recognitionProfile(agent);
    expect(profile.continuous).toBe(true);
    expect(profile.awaitNaturalEnd).toBe(false);
    expect(profile.resumeAfterSpeechMs).toBe(120);
  });

  it('uses a safe default for malformed or missing browser identifiers', () => {
    expect(recognitionProfile(null).continuous).toBe(true);
    expect(recognitionProfile(undefined).awaitNaturalEnd).toBe(false);
    expect(recognitionProfile({ userAgent: 'iPhone' }).awaitNaturalEnd).toBe(false);
  });
});
