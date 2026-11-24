import { describe, expect, it } from 'vitest';
import {
  captureSupport,
  frameDifference,
  frameSize,
  shouldAcceptCaptureResult,
  shouldSendFrame
} from './live-screen.ts';

describe('camera and screen capture lifecycle', () => {
  const base = {
    requestGeneration: 7,
    currentGeneration: 7,
    aborted: false,
    active: true,
    source: 'camera' as const,
    hidden: false
  };

  it('accepts an active camera response from the current session', () => {
    expect(shouldAcceptCaptureResult(base)).toBe(true);
  });

  it('discards aborted, stopped or superseded frame responses', () => {
    expect(shouldAcceptCaptureResult({ ...base, aborted: true })).toBe(false);
    expect(shouldAcceptCaptureResult({ ...base, active: false })).toBe(false);
    expect(shouldAcceptCaptureResult({ ...base, currentGeneration: 8 })).toBe(false);
    expect(shouldAcceptCaptureResult({ ...base, requestGeneration: 6 })).toBe(false);
  });

  it('blocks hidden camera capture but allows explicitly shared screens in another tab', () => {
    expect(shouldAcceptCaptureResult({ ...base, hidden: true })).toBe(false);
    expect(shouldAcceptCaptureResult({ ...base, source: 'screen', hidden: true })).toBe(true);
  });

  it('never samples while busy, and respects per-source change and time thresholds', () => {
    const old = Date.now() - 12_000;
    const now = Date.now();
    expect(shouldSendFrame({ source: 'camera', difference: 7, lastSentAt: old, now, busy: false })).toBe(true);
    expect(shouldSendFrame({ source: 'camera', difference: 5, lastSentAt: old, now, busy: false })).toBe(false);
    expect(shouldSendFrame({ source: 'camera', difference: 7, lastSentAt: now - 500, now, busy: false })).toBe(false);
    expect(shouldSendFrame({ source: 'camera', difference: 7, lastSentAt: old, now, busy: true })).toBe(false);
    expect(shouldSendFrame({ source: 'screen', difference: 0.5, lastSentAt: old, now, busy: false })).toBe(true);
    expect(shouldSendFrame({ source: 'screen', difference: 0.2, lastSentAt: old, now, busy: false })).toBe(false);
  });

  it('computes frame differences from RGB pixels and stays within output width', () => {
    const first = new Uint8ClampedArray([5, 5, 5, 255, 20, 20, 20, 255]);
    const second = new Uint8ClampedArray([5, 5, 5, 255, 100, 100, 100, 255]);
    expect(frameDifference(first, second)).toBe(50);
    expect(frameDifference(null, second)).toBe(100);
    expect(frameSize(3200, 1600)).toEqual({ width: 1600, height: 800 });
    expect(frameSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('requires secure capture support and never assumes a camera exists', () => {
    expect(captureSupport({ isSecureContext: false, navigator: {} })).toEqual({
      secure: false, screen: false, camera: false
    });
    expect(captureSupport({
      isSecureContext: true,
      navigator: { mediaDevices: { getUserMedia: () => Promise.resolve(null) } }
    })).toEqual({ secure: true, screen: false, camera: true });
  });
});
