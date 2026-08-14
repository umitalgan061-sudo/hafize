import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { boundedSize, captureScreenFrame, stopStream } = require('../public/screen-share.js');

assert.deepEqual(boundedSize(1920, 1080), { width: 1280, height: 720 });
assert.deepEqual(boundedSize(800, 600), { width: 800, height: 600 });
assert.deepEqual(boundedSize(0, 0), { width: 1, height: 1 });

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
const capture = await captureScreenFrame({
  mediaDevices: {
    getDisplayMedia: async (value) => {
      constraints = value;
      return captureStream;
    }
  },
  document
});
assert.deepEqual(constraints, { video: { frameRate: { ideal: 1, max: 5 } }, audio: false });
assert.equal(capture.width, 1280);
assert.equal(capture.height, 720);
assert.equal(capture.mimeType, 'image/jpeg');
assert.deepEqual(document.drawn[0], [0, 0, 1280, 720]);
assert.equal(captureStopped, 1);

await assert.rejects(
  captureScreenFrame({ mediaDevices: {}, document }),
  /SCREEN_CAPTURE_UNSUPPORTED/
);

let deniedStopped = 0;
await assert.rejects(
  captureScreenFrame({
    mediaDevices: {
      getDisplayMedia: async () => {
        const error = new Error('denied');
        error.name = 'NotAllowedError';
        throw error;
      }
    },
    document
  }),
  /SCREEN_CAPTURE_CANCELLED/
);
assert.equal(deniedStopped, 0);

let noVideoStopped = 0;
await assert.rejects(
  captureScreenFrame({
    mediaDevices: {
      getDisplayMedia: async () => ({
        getVideoTracks: () => [],
        getTracks: () => [{ stop: () => { noVideoStopped += 1; } }]
      })
    },
    document
  }),
  /SCREEN_CAPTURE_NO_VIDEO/
);
assert.equal(noVideoStopped, 1);

await assert.rejects(
  captureScreenFrame({
    mediaDevices: { getDisplayMedia: async () => captureStream },
    document: createDocument({ blobType: 'image/png' })
  }),
  /SCREEN_CAPTURE_ENCODE_FAILED/
);

console.log('screen share tests passed');
