import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/screen-share.js');

assert.equal(api.VIDEO_READY_TIMEOUT_MS, 10_000);
assert.deepEqual(api.boundedSize(1920, 1080), { width: 1280, height: 720 });
assert.deepEqual(api.boundedSize(800, 600), { width: 800, height: 600 });

function fakeVideo({ width = 0, height = 0 } = {}) {
  const listeners = new Map();
  return {
    videoWidth: width,
    videoHeight: height,
    listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      for (const listener of [...(listeners.get(type) || [])]) listener();
    }
  };
}

{
  const video = fakeVideo({ width: 1280, height: 720 });
  let scheduled = false;
  await api.waitForVideo(video, { setTimeoutImpl() { scheduled = true; } });
  assert.equal(scheduled, false, 'already-ready video does not install timeout');
}

{
  const video = fakeVideo();
  let timeoutCallback = null;
  let cleared = null;
  const pending = api.waitForVideo(video, {
    timeoutMs: 75,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 75);
      timeoutCallback = callback;
      return 22;
    },
    clearTimeoutImpl(timer) { cleared = timer; }
  });
  assert.equal(video.listeners.get('loadedmetadata').size, 1);
  assert.equal(video.listeners.get('error').size, 1);
  video.videoWidth = 640;
  video.videoHeight = 360;
  video.emit('loadedmetadata');
  await pending;
  assert.equal(cleared, 22);
  assert.equal(video.listeners.get('loadedmetadata').size, 0);
  assert.equal(video.listeners.get('error').size, 0);
  timeoutCallback();
}

{
  const video = fakeVideo();
  let timeoutCallback = null;
  let clearCount = 0;
  const pending = api.waitForVideo(video, {
    timeoutMs: 40,
    setTimeoutImpl(callback) { timeoutCallback = callback; return 31; },
    clearTimeoutImpl(timer) { assert.equal(timer, 31); clearCount += 1; }
  });
  timeoutCallback();
  await assert.rejects(pending, /SCREEN_CAPTURE_VIDEO_TIMEOUT/);
  assert.equal(clearCount, 1);
  assert.equal(video.listeners.get('loadedmetadata').size, 0);
  assert.equal(video.listeners.get('error').size, 0);
}

{
  const video = fakeVideo();
  let cleared = false;
  const pending = api.waitForVideo(video, {
    setTimeoutImpl() { return 19; },
    clearTimeoutImpl(timer) { assert.equal(timer, 19); cleared = true; }
  });
  video.emit('error');
  await assert.rejects(pending, /SCREEN_CAPTURE_VIDEO_FAILED/);
  assert.equal(cleared, true);
}

{
  const video = fakeVideo();
  await assert.rejects(api.waitForVideo(video, { timeoutMs: 0 }), /INVALID_SCREEN_CAPTURE_TIMEOUT/);
  await assert.rejects(api.waitForVideo(video, { timeoutMs: 60_001 }), /INVALID_SCREEN_CAPTURE_TIMEOUT/);
  await assert.rejects(api.waitForVideo(video, { setTimeoutImpl: null }), /SCREEN_CAPTURE_TIMER_UNSUPPORTED/);
  await assert.rejects(api.waitForVideo({}), /SCREEN_CAPTURE_VIDEO_FAILED/);
}

function captureFixture({ metadataMode = 'ready', canvasContext = true, blob = new Blob(['jpeg'], { type: 'image/jpeg' }) } = {}) {
  const stopped = [];
  const videoTrack = { stop() { stopped.push('video'); } };
  const audioTrack = { stop() { stopped.push('audio'); } };
  const stream = {
    getVideoTracks() { return [videoTrack]; },
    getTracks() { return [videoTrack, audioTrack]; }
  };
  let displayConstraints = null;
  const mediaDevices = {
    async getDisplayMedia(constraints) {
      displayConstraints = constraints;
      return stream;
    }
  };

  const video = fakeVideo(metadataMode === 'ready' ? { width: 1600, height: 900 } : {});
  video.play = async () => {};
  video.muted = false;
  video.playsInline = false;
  video.srcObject = null;

  const drawCalls = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext(type, options) {
      assert.equal(type, '2d');
      assert.deepEqual(options, { alpha: false });
      if (!canvasContext) return null;
      return { drawImage(...args) { drawCalls.push(args); } };
    },
    toBlob(callback, type, quality) {
      assert.equal(type, 'image/jpeg');
      assert.equal(quality, api.JPEG_QUALITY);
      callback(blob);
    }
  };
  const document = {
    createElement(tag) {
      if (tag === 'video') return video;
      if (tag === 'canvas') return canvas;
      throw new Error(`unexpected element ${tag}`);
    }
  };
  return { mediaDevices, document, stream, stopped, video, canvas, drawCalls, getDisplayConstraints: () => displayConstraints };
}

{
  const f = captureFixture();
  const capture = await api.captureScreenFrame({ mediaDevices: f.mediaDevices, document: f.document });
  assert.deepEqual(f.getDisplayConstraints(), { video: { frameRate: { ideal: 1, max: 5 } }, audio: false });
  assert.equal(capture.width, 1280);
  assert.equal(capture.height, 720);
  assert.equal(capture.mimeType, 'image/jpeg');
  assert.equal(capture.blob.type, 'image/jpeg');
  assert.equal(f.drawCalls.length, 1);
  assert.equal(f.canvas.width, 1280);
  assert.equal(f.canvas.height, 720);
  assert.deepEqual(f.stopped, ['video', 'audio'], 'all tracks stop after one-frame capture');
  assert.equal(f.video.srcObject, null);
}

{
  const f = captureFixture({ metadataMode: 'pending' });
  let timeoutCallback = null;
  const pending = api.captureScreenFrame({
    mediaDevices: f.mediaDevices,
    document: f.document,
    videoReadyTimeoutMs: 25,
    setTimeoutImpl(callback, delay) {
      assert.equal(delay, 25);
      timeoutCallback = callback;
      return 51;
    },
    clearTimeoutImpl(timer) { assert.equal(timer, 51); }
  });
  await Promise.resolve();
  assert.equal(typeof timeoutCallback, 'function');
  timeoutCallback();
  await assert.rejects(pending, /SCREEN_CAPTURE_VIDEO_TIMEOUT/);
  assert.deepEqual(f.stopped, ['video', 'audio'], 'timed-out screen share is always stopped');
}

{
  const f = captureFixture({ canvasContext: false });
  await assert.rejects(
    api.captureScreenFrame({ mediaDevices: f.mediaDevices, document: f.document }),
    /SCREEN_CAPTURE_CANVAS_FAILED/
  );
  assert.deepEqual(f.stopped, ['video', 'audio']);
}

{
  const stopped = [];
  const error = new Error('cancelled');
  error.name = 'NotAllowedError';
  const mediaDevices = { async getDisplayMedia() { throw error; } };
  await assert.rejects(
    api.captureScreenFrame({ mediaDevices, document: { createElement() {} } }),
    /SCREEN_CAPTURE_CANCELLED/
  );
  assert.deepEqual(stopped, []);
}

{
  const tracks = [{ stop() { throw new Error('device already stopped'); } }, { stop() {} }];
  assert.doesNotThrow(() => api.stopStream({ getTracks: () => tracks }));
}

console.log('screen share video readiness tests passed');
