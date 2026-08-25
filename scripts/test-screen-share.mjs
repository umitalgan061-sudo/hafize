import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normalizeScreenCaptureMetadata } from '../lib/screen-capture-contract.mjs';

const require = createRequire(import.meta.url);
const { boundedSize, captureScreenFrame, stopStream } = require('../public/screen-share.js');

assert.deepEqual(boundedSize(1920, 1080), { width: 1280, height: 720 });
assert.deepEqual(boundedSize(800, 600), { width: 800, height: 600 });
assert.deepEqual(boundedSize(0, 0), { width: 1, height: 1 });

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

let stopped = 0;
const stream = {
  getTracks: () => [{ stop: () => { stopped += 1; } }, { stop: () => { stopped += 1; } }]
};
stopStream(stream);
assert.equal(stopped, 2);

function createDocument({ width = 1600, height = 900, blobType = 'image/jpeg' } = {}) {
  const drawn = [];
  return {
    drawn,
    createElement(tag) {
      if (tag === 'video') {
        return {
          muted: false,
          playsInline: false,
          srcObject: null,
          videoWidth: width,
          videoHeight: height,
          play: async () => undefined,
          addEventListener() {},
          removeEventListener() {}
        };
      }
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: (...args) => drawn.push(args.slice(1)) }),
          toBlob: (callback, type, quality) => {
            assert.equal(type, 'image/jpeg');
            assert.equal(quality, 0.82);
            callback({ type: blobType, size: 123 });
          }
        };
      }
      throw new Error(`unexpected tag ${tag}`);
    }
  };
}

let constraints = null;
let captureStopped = 0;
const captureStream = {
  getVideoTracks: () => [{ kind: 'video' }],
  getTracks: () => [{ stop: () => { captureStopped += 1; } }]
};
const document = createDocument();

await assert.rejects(
  captureScreenFrame({
    mediaDevices: { getDisplayMedia: async () => captureStream },
    document
  }),
  /SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT/
);
assert.equal(captureStopped, 0);

const capture = await captureScreenFrame({
  mediaDevices: {
    getDisplayMedia: async (value) => {
      constraints = value;
      return captureStream;
    }
  },
  document,
  explicitUserIntent: true
});
assert.deepEqual(constraints, { video: { frameRate: { ideal: 1, max: 5 } }, audio: false });
assert.equal(capture.width, 1280);
assert.equal(capture.height, 720);
assert.equal(capture.mimeType, 'image/jpeg');
assert.deepEqual(document.drawn[0], [0, 0, 1280, 720]);
assert.equal(captureStopped, 1);
assert.deepEqual(normalizeScreenCaptureMetadata(capture.metadata), {
  ok: true,
  metadata: {
    mimeType: 'image/jpeg',
    byteLength: 123,
    width: 1280,
    height: 720
  }
});

await assert.rejects(
  captureScreenFrame({ mediaDevices: {}, document, explicitUserIntent: true }),
  /SCREEN_CAPTURE_UNSUPPORTED/
);

await assert.rejects(
  captureScreenFrame({
    mediaDevices: {
      getDisplayMedia: async () => {
        const error = new Error('denied');
        error.name = 'NotAllowedError';
        throw error;
      }
    },
    document,
    explicitUserIntent: true
  }),
  /SCREEN_CAPTURE_CANCELLED/
);

let noVideoStopped = 0;
await assert.rejects(
  captureScreenFrame({
    mediaDevices: {
      getDisplayMedia: async () => ({
        getVideoTracks: () => [],
        getTracks: () => [{ stop: () => { noVideoStopped += 1; } }]
      })
    },
    document,
    explicitUserIntent: true
  }),
  /SCREEN_CAPTURE_NO_VIDEO/
);
assert.equal(noVideoStopped, 1);

await assert.rejects(
  captureScreenFrame({
    mediaDevices: { getDisplayMedia: async () => captureStream },
    document: createDocument({ blobType: 'image/png' }),
    explicitUserIntent: true
  }),
  /SCREEN_CAPTURE_ENCODE_FAILED/
);

console.log('screen share tests passed');
