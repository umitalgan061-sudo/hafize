import { describe, expect, it } from 'vitest';
import { boundedText, sameOriginPath } from './browser-platform.ts';

describe('typed authentication boundary', () => {
  it('accepts same-origin API paths', () => {
    expect(sameOriginPath('/api/auth/session', 'https://hafize.test')).toBe('/api/auth/session');
  });

  it('rejects external authentication targets', () => {
    expect(sameOriginPath('https://evil.test/api/auth/session', 'https://hafize.test')).toBeNull();
  });

  it('bounds CSRF and server-provided strings', () => {
    expect(boundedText('a'.repeat(100), 10)).toHaveLength(10);
  });
});
