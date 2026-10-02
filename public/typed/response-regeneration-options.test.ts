import { describe, expect, it } from 'vitest';
import {
  buildRegenerationMessages,
  normalizeRegenerationInstruction,
  presetById,
  REGENERATION_PRESETS
} from './response-regeneration-options.ts';

describe('regeneration options', () => {
  it('normalizes bounded custom instruction values', () => {
    expect(normalizeRegenerationInstruction('\0  daha kısa  ')).toBe('daha kısa');
    expect(normalizeRegenerationInstruction(null)).toBe('');
    expect(normalizeRegenerationInstruction('x'.repeat(900))).toHaveLength(600);
  });

  it('resolves only known presets', () => {
    expect(presetById('concise')).toEqual(REGENERATION_PRESETS[0]);
    expect(presetById('unknown')).toBe(null);
  });

  it('keeps transient instructions separate from visible history persistence', () => {
    const messages = buildRegenerationMessages(
      [{ role: 'user', content: 'Asıl soru' }, { role: 'assistant', content: 'Eski cevap' }],
      'Daha kısa yaz'
    );
    expect(messages).toEqual([
      { role: 'user', content: 'Asıl soru' },
      { role: 'assistant', content: 'Eski cevap' },
      { role: 'user', content: 'Daha kısa yaz' }
    ]);
  });

  it('ignores malformed history entries', () => {
    expect(buildRegenerationMessages([{ role: 'tool', content: 'secret' }, null, { role: 'user', content: 'x' }], '')).toEqual([
      { role: 'user', content: 'x' }
    ]);
  });
});
