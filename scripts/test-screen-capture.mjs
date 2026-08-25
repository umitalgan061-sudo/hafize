import assert from 'node:assert/strict';
import { normalizeScreenCaptureMetadata } from '../lib/screen-capture-contract.mjs';
import {
  createScreenCaptureController,
  SCREEN_CAPTURE_CLIENT_POLICY
} from '../public/screen-capture.js';

assert.deepEqual(normalizeScreenCaptureMetadata({
  explicitUserIntent: true,
  mimeType: 'image/jpeg',
  byteLength: 1024,
  width: 1280,
  height: 720
}), {
  ok: true,
  metadata: {
    mimeType: 'image/jpeg',
    byteLength: 1024,
    width: 1280,
    height: 720
  }
});

for (const invalid of [
  null,
  { explicitUserIntent: false, mimeType: 'image/jpeg', byteLength: 1, width: 1, height: 1 },
  { explicitUserIntent: true, mimeType: 'image/png', byteLength: 1, width: 1, height: 1 },
  { explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 0, width: 1, height: 1 },
  { explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 1, width: 1281, height: 720 },
  { explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 1, width: 1280, height: 721 },
  { explicitUserIntent: true, mimeType: 'image/jpeg', byteLength: 1, width: 1, height: 1, title: 'secret' }
]) {
  assert.equal(normalizeScreenCaptureMetadata(invalid).ok, false);
}

const trackCalls = [];
const stream = {
  getTracks: () => [{ stop: () => trackCalls.push('stop') }]
};
const mediaCalls = [];
const mediaDevices = {
  getDisplayMedia: async (constraints) => {
    mediaCalls.push(constraints);
    return stream;
  }
};

let drawArgs = null;
const blob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
const video = {
  muted: false,
  playsInline: false,
  srcObject: null,
  videoWidth: 2560,
  videoHeight: 1440,
  play: async () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({ drawImage: (...args) => { drawArgs = args; } }),
  toBlob: (callback, mimeType, quality) => {
    assert.equal(mimeType, 'image/jpeg');
    assert.equal(quality, 0.86);
    callback(blob);
  }
};
const documentRef = {
  createElement: (tag) => {
    if (tag === 'video') return video;
    if (tag === 'canvas') return canvas;
    throw new Error(`unexpected element:${tag}`);
  }
};
const urlCalls = [];
const urlApi = {
  createObjectURL: (value) => {
    assert.equal(value, blob);
    urlCalls.push(['create']);
    return 'blob:preview-1';
  },
  revokeObjectURL: (value) => urlCalls.push(['revoke', value])
};

const controller = createScreenCaptureController({ mediaDevices, documentRef, urlApi });
assert.deepEqual(await controller.captureOnce(), {
  ok: false,
  error: 'SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT'
});
assert.equal(mediaCalls.length, 0);

const result = await controller.captureOnce({ explicitUserIntent: true });
assert.equal(result.ok, true);
assert.equal(result.capture.blob, blob);
assert.equal(result.capture.previewUrl, 'blob:preview-1');
assert.deepEqual(result.capture.metadata, {
  explicitUserIntent: true,
  mimeType: 'image/jpeg',
  byteLength: blob.size,
  width: 1280,
  height: 720
});
assert.deepEqual(mediaCalls, [{ video: true, audio: false }]);
assert.equal(video.muted, true);
assert.equal(video.playsInline, true);
assert.equal(video.srcObject, stream);
assert.equal(canvas.width, 1280);
assert.equal(canvas.height, 720);
assert.deepEqual(drawArgs.slice(1), [0, 0, 1280, 720]);
assert.deepEqual(trackCalls, ['stop']);
assert.deepEqual(normalizeScreenCaptureMetadata(result.capture.metadata), {
  ok: true,
  metadata: {
    mimeType: 'image/jpeg',
    byteLength: blob.size,
    width: 1280,
    height: 720
  }
});
controller.dispose();
assert.deepEqual(urlCalls, [['create'], ['revoke', 'blob:preview-1']]);

const unsupported = createScreenCaptureController({ mediaDevices: {}, documentRef, urlApi });
assert.deepEqual(await unsupported.captureOnce({ explicitUserIntent: true }), {
  ok: false,
  error: 'SCREEN_CAPTURE_UNSUPPORTED'
});

const cancelled = createScreenCaptureController({
  mediaDevices: {
    getDisplayMedia: async () => {
      const error = new Error('user denied');
      error.name = 'NotAllowedError';
      throw error;
    }
  },
  documentRef,
  urlApi
});
assert.deepEqual(await cancelled.captureOnce({ explicitUserIntent: true }), {
  ok: false,
  cancelled: true,
  error: 'SCREEN_CAPTURE_CANCELLED'
});

let failureTrackStopped = false;
const noCanvas = createScreenCaptureController({
  mediaDevices: {
    getDisplayMedia: async () => ({
      getTracks: () => [{ stop: () => { failureTrackStopped = true; } }]
    })
  },
  documentRef: {
    createElement: (tag) => tag === 'video'
      ? { ...video, videoWidth: 800, videoHeight: 600 }
      : { width: 0, height: 0, getContext: () => null }
  },
  urlApi
});
assert.deepEqual(await noCanvas.captureOnce({ explicitUserIntent: true }), {
  ok: false,
  error: 'SCREEN_CAPTURE_CANVAS_UNAVAILABLE'
});
assert.equal(failureTrackStopped, true);

assert.equal(SCREEN_CAPTURE_CLIENT_POLICY.audio, false);
assert.equal(SCREEN_CAPTURE_CLIENT_POLICY.singleFrameOnly, true);
assert.equal(SCREEN_CAPTURE_CLIENT_POLICY.maxWidth, 1280);
assert.equal(SCREEN_CAPTURE_CLIENT_POLICY.maxHeight, 720);

console.log('screen capture tests passed');
