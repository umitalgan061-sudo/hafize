import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 20 Kasım 2026: a voice's config address lost one digit of its commit and the voice could not be downloaded.
const { voices } = JSON.parse(readFileSync(new URL('../piper-voices.json', import.meta.url), 'utf8'));

describe('downloadable voice catalog', () => {
  it('pins every community voice to one full commit for both of its files', () => {
    for (const voice of voices.filter((item: { source?: string }) => item.source)) {
      const model = /\/resolve\/([0-9a-f]{40})\/[^/]+\.onnx$/.exec(voice.url)?.[1];
      const config = /\/resolve\/([0-9a-f]{40})\/[^/]+\.json$/.exec(voice.configUrl)?.[1];
      expect(model, voice.key).toBeTruthy();
      expect(config, voice.key).toBe(model);
    }
  });
  it('has unique keys and only Turkish voices', () => {
    expect(new Set(voices.map((voice: { key: string }) => voice.key)).size).toBe(voices.length);
    expect(voices.every((voice: { family: string }) => voice.family === 'tr')).toBe(true);
  });
});
