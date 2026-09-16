import { describe, expect, it } from 'vitest';
import { boundedSize, SCREEN_SHARE_LIMITS, stopStream } from './screen-share.ts';

describe('screen share contracts', () => {
  it('bounds large captured dimensions without upscaling', () => {
    expect(boundedSize(3840, 2160)).toEqual({ width: 1280, height: 720 });
    expect(boundedSize(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it('handles invalid dimensions safely', () => {
    expect(boundedSize(0, -10)).toEqual({ width: 1, height: 1 });
    expect(boundedSize(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ width: 1, height: 1 });
  });

  it('keeps media configuration explicit and bounded', () => {
    expect(SCREEN_SHARE_LIMITS.maxWidth).toBe(1280);
    expect(SCREEN_SHARE_LIMITS.maxHeight).toBe(720);
    expect(SCREEN_SHARE_LIMITS.jpegQuality).toBeLessThan(1);
  });

  it('stops all tracks defensively', () => {
    const stopped: string[] = [];
    const stream = { getTracks: () => [{ stop: () => stopped.push('a') }, { stop: () => stopped.push('b') }] } as unknown as MediaStream;
    stopStream(stream);
    expect(stopped).toEqual(['a', 'b']);
  });
});
