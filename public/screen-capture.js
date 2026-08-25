const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const MIME_TYPE = 'image/jpeg';
const JPEG_QUALITY = 0.86;

function stopTracks(stream) {
  for (const track of stream?.getTracks?.() || []) {
    try { track.stop(); } catch {}
  }
}

function userCancelled(error) {
  return error?.name === 'NotAllowedError' || error?.name === 'AbortError';
}

function waitForVideo(video) {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onError);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('SCREEN_CAPTURE_VIDEO_FAILED')); };
    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

function targetSize(width, height) {
  const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('SCREEN_CAPTURE_ENCODE_FAILED'));
      else resolve(blob);
    }, MIME_TYPE, JPEG_QUALITY);
  });
}

export function createScreenCaptureController({
  mediaDevices = globalThis.navigator?.mediaDevices,
  documentRef = globalThis.document,
  urlApi = globalThis.URL
} = {}) {
  let previewUrl = null;
  let active = false;

  function revokePreview() {
    if (previewUrl) {
      try { urlApi?.revokeObjectURL?.(previewUrl); } catch {}
      previewUrl = null;
    }
  }

  async function captureOnce({ explicitUserIntent = false } = {}) {
    if (explicitUserIntent !== true) {
      return { ok: false, error: 'SCREEN_CAPTURE_REQUIRES_EXPLICIT_USER_INTENT' };
    }
    if (active) return { ok: false, error: 'SCREEN_CAPTURE_ALREADY_ACTIVE' };
    if (typeof mediaDevices?.getDisplayMedia !== 'function') {
      return { ok: false, error: 'SCREEN_CAPTURE_UNSUPPORTED' };
    }
    if (!documentRef?.createElement) {
      return { ok: false, error: 'SCREEN_CAPTURE_DOCUMENT_UNAVAILABLE' };
    }

    active = true;
    let stream = null;
    try {
      stream = await mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const video = documentRef.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play?.();
      await waitForVideo(video);

      if (!Number.isFinite(video.videoWidth) || !Number.isFinite(video.videoHeight)
        || video.videoWidth < 1 || video.videoHeight < 1) {
        throw new Error('SCREEN_CAPTURE_INVALID_DIMENSIONS');
      }

      const size = targetSize(video.videoWidth, video.videoHeight);
      const canvas = documentRef.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext?.('2d');
      if (!context) throw new Error('SCREEN_CAPTURE_CANVAS_UNAVAILABLE');
      context.drawImage(video, 0, 0, size.width, size.height);

      const blob = await canvasToBlob(canvas);
      revokePreview();
      previewUrl = urlApi?.createObjectURL?.(blob) || null;

      return {
        ok: true,
        capture: {
          blob,
          previewUrl,
          metadata: {
            explicitUserIntent: true,
            mimeType: MIME_TYPE,
            byteLength: blob.size,
            width: size.width,
            height: size.height
          }
        }
      };
    } catch (error) {
      if (userCancelled(error)) return { ok: false, cancelled: true, error: 'SCREEN_CAPTURE_CANCELLED' };
      return { ok: false, error: error?.message || 'SCREEN_CAPTURE_FAILED' };
    } finally {
      stopTracks(stream);
      active = false;
    }
  }

  function dispose() {
    revokePreview();
  }

  return Object.freeze({ captureOnce, dispose });
}

export const SCREEN_CAPTURE_CLIENT_POLICY = Object.freeze({
  maxWidth: MAX_WIDTH,
  maxHeight: MAX_HEIGHT,
  mimeType: MIME_TYPE,
  audio: false,
  singleFrameOnly: true
});
