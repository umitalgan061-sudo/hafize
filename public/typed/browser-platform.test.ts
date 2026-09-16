import { describe, expect, it } from 'vitest';
import { boundedText, normalizeLineText, safeJsonParse, sameOriginPath } from './browser-platform.ts';

describe('browser platform primitives', () => {
  it('bounds arbitrary values deterministically', () => {
    expect(boundedText('abcdef', 3)).toBe('abc');
    expect(boundedText(null, 3)).toBe('null');
    expect(boundedText(undefined, 0)).toBe('');
  });

  it('normalizes CRLF without changing content semantics', () => {
    expect(normalizeLineText('a\r\nb\rb', 50)).toBe('a\nb\nb');
  });

  it('returns fallback for malformed JSON', () => {
    expect(safeJsonParse('{', { ok: false })).toEqual({ ok: false });
  });

  it('parses valid JSON with a stable generic type', () => {
    expect(safeJsonParse('{"ok":true}', { ok: false })).toEqual({ ok: true });
  });

  it('accepts same-origin paths', () => {
    expect(sameOriginPath('/api/models', 'https://hafize.test')).toBe('/api/models');
  });

  it('rejects cross-origin URLs', () => {
    expect(sameOriginPath('https://evil.test/x', 'https://hafize.test')).toBeNull();
  });

  it('rejects malformed URLs instead of throwing', () => {
    expect(sameOriginPath('%%%')).toBeNull();
  });
});
