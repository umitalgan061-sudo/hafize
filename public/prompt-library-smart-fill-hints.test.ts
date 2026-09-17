import { describe, expect, it } from 'vitest';
import { paintSmartFillHints } from './prompt-library-smart-fill-hints.ts';

describe('Smart Fill hints contract', () => {
  it('exports the typed paint function and keeps input bounds explicit', () => {
    expect(paintSmartFillHints).toBeTypeOf('function');
    const sourceText = paintSmartFillHints.toString();
    expect(sourceText).toContain('MAX_VALUE');
    expect(sourceText).toContain('MAX_PREVIEW');
  });

  it('uses textContent rather than HTML interpolation for counters', () => {
    const sourceText = paintSmartFillHints.toString();
    expect(sourceText).toContain('textContent = `${length}/${MAX_VALUE}`');
    expect(sourceText).toContain('textContent = `${length}/${MAX_PREVIEW} karakter`');
    expect(sourceText).not.toContain('.innerHTML');
  });
});
