import { describe, expect, it } from 'vitest';
import { isAtBottom, thinkingLabelFor } from './chat-scroll.ts';

describe('chat scroll position', () => {
  it('follows while the list is pinned to the bottom', () => {
    expect(isAtBottom({ scrollHeight: 1000, scrollTop: 600, clientHeight: 400 })).toBe(true);
    // A few pixels short still counts as "at the bottom" so a partial line does not break the follow.
    expect(isAtBottom({ scrollHeight: 1000, scrollTop: 520, clientHeight: 400 })).toBe(true);
  });

  it('stops following once the user scrolls up to read history', () => {
    expect(isAtBottom({ scrollHeight: 1000, scrollTop: 100, clientHeight: 400 })).toBe(false);
    expect(isAtBottom({ scrollHeight: 1000, scrollTop: 0, clientHeight: 400 })).toBe(false);
  });

  it('treats a list shorter than its viewport as at the bottom', () => {
    expect(isAtBottom({ scrollHeight: 300, scrollTop: 0, clientHeight: 400 })).toBe(true);
  });

  it('honours a custom tolerance', () => {
    expect(isAtBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 400 }, 150)).toBe(true);
    expect(isAtBottom({ scrollHeight: 1000, scrollTop: 500, clientHeight: 400 }, 50)).toBe(false);
  });
});

describe('thinking label rotation', () => {
  it('starts on the first label and rotates on a timer', () => {
    expect(thinkingLabelFor(0)).toBe('Düşünüyor');
    expect(thinkingLabelFor(2600)).toBe('Yazıyor');
    expect(thinkingLabelFor(5200)).toBe('Araştırıyor');
    expect(thinkingLabelFor(7800)).toBe('Yanıt hazırlıyor');
  });

  it('wraps around and never runs off the end', () => {
    expect(thinkingLabelFor(10_400)).toBe('Düşünüyor');
    expect(thinkingLabelFor(10_000_000)).toBeTruthy();
  });

  it('survives negative or non-finite input', () => {
    expect(thinkingLabelFor(-500)).toBe('Düşünüyor');
    expect(thinkingLabelFor(Number.NaN)).toBe('Düşünüyor');
  });

  it('accepts a custom label list', () => {
    expect(thinkingLabelFor(0, ['A'])).toBe('A');
    expect(thinkingLabelFor(2600, ['A', 'B'])).toBe('B');
  });
});
