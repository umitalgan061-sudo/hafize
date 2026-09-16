import { describe, expect, it } from 'vitest';
import { formatCount, readReducedMotion, readTheme } from './settings-workspace.ts';

describe('settings workspace contracts', () => {
  const makeStorage = (entries: Record<string, string>): Storage => ({
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => { entries[key] = value; },
    removeItem: (key: string) => { delete entries[key]; },
    clear: () => { Object.keys(entries).forEach((key) => delete entries[key]); },
    key: (index: number) => Object.keys(entries)[index] ?? null,
    get length() { return Object.keys(entries).length; }
  } as Storage);

  it('reads supported theme values and falls back to system', () => {
    expect(readTheme(makeStorage({ 'hafize.theme.v1': 'dark' }))).toBe('dark');
    expect(readTheme(makeStorage({ 'hafize.theme.v1': 'unknown' }))).toBe('system');
  });

  it('reads reduced motion as a boolean preference', () => {
    expect(readReducedMotion(makeStorage({ 'hafize.reduced-motion.v1': 'true' }))).toBe(true);
    expect(readReducedMotion(makeStorage({ 'hafize.reduced-motion.v1': 'false' }))).toBe(false);
  });

  it('counts conversations and messages safely', () => {
    const storage = makeStorage({
      'hafize.conversations.v1': JSON.stringify([{ messages: [{ content: 'a' }, { content: 'b' }] }, { messages: [] }, {}])
    });
    expect(formatCount(storage)).toEqual({ conversations: 3, messages: 2 });
  });

  it('does not throw on malformed conversation data', () => {
    expect(formatCount(makeStorage({ 'hafize.conversations.v1': '{' }))).toEqual({ conversations: 0, messages: 0 });
  });
});
