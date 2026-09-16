import { describe, expect, it } from 'vitest';

describe('Smart Fill hints contract', () => {
  it('keeps input and preview bounds explicit', async () => {
    const source = await import('./prompt-library-smart-fill-hints.ts');
    expect(source.paintSmartFillHints).toBeTypeOf('function');
    const sourceText = await fetch(new URL('./prompt-library-smart-fill-hints.ts', import.meta.url)).then((response) => response.text());
    expect(sourceText).toContain('MAX_VALUE = 1000');
    expect(sourceText).toContain('MAX_PREVIEW = 8000');
  });

  it('uses textContent rather than HTML interpolation for counters', async () => {
    const sourceText = await fetch(new URL('./prompt-library-smart-fill-hints.ts', import.meta.url)).then((response) => response.text());
    expect(sourceText).toContain('textContent = `${length}/${MAX_VALUE}`');
    expect(sourceText).toContain('textContent = `${length}/${MAX_PREVIEW} karakter`');
    expect(sourceText).not.toContain('.innerHTML');
  });
});
