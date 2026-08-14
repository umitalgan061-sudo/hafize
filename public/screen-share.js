(function exposeHafizeScreenShare(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeScreenShare = api;
    if (root.document) api.mountScreenShare({ root });
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScreenShare() {
  'use strict';

  const MAX_WIDTH = 1280;
  const MAX_HEIGHT = 720;
  const JPEG_QUALITY = 0.82;

  function stopStream(stream) {
    for (const track of stream?.getTracks?.() || []) {
      try { track.stop(); } catch {}
    }
  }

  function boundedSize(width, height) {
    const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
    const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
    const scale = Math.min(1, MAX_WIDTH / safeWidth, MAX_HEIGHT / safeHeight);
    return {
      width: Math.max(1, Math.round(safeWidth * scale)),
      height: Math.max(1, Math.round(safeHeight * scale))
    };
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

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob || blob.type !== 'image/jpeg') return reject(new Error('SCREEN_CAPTURE_ENCODE_FAILED'));
        resolve(blob);
      }, 'image/jpeg', JPEG_QUALITY);
    });
  }

  async function captureScreenFrame({ mediaDevices, document }) {
    if (typeof mediaDevices?.getDisplayMedia !== 'function') throw new Error('SCREEN_CAPTURE_UNSUPPORTED');
    if (!document?.createElement) throw new Error('SCREEN_CAPTURE_UNSUPPORTED');

    let stream;
    try {
      stream = await mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 1, max: 5 } },
        audio: false
      });
      const videoTrack = stream?.getVideoTracks?.()[0];
      if (!videoTrack) throw new Error('SCREEN_CAPTURE_NO_VIDEO');

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      await waitForVideo(video);

      const size = boundedSize(video.videoWidth, video.videoHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('SCREEN_CAPTURE_CANVAS_FAILED');
      context.drawImage(video, 0, 0, size.width, size.height);
      const blob = await canvasToBlob(canvas);
      video.srcObject = null;

      return Object.freeze({ blob, width: size.width, height: size.height, mimeType: blob.type });
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
        throw new Error('SCREEN_CAPTURE_CANCELLED');
      }
      throw error;
    } finally {
      stopStream(stream);
    }
  }

  function mountScreenShare({ root = globalThis } = {}) {
    const document = root.document;
    const button = document?.querySelector?.('#screenShareBtn');
    const panel = document?.querySelector?.('#screenSharePreview');
    const image = document?.querySelector?.('#screenShareImage');
    const status = document?.querySelector?.('#screenShareStatus');
    const removeButton = document?.querySelector?.('#screenShareRemove');
    if (!button || !panel || !image || !status || !removeButton) return null;

    let objectUrl = null;
    let currentCapture = null;

    function clearCapture() {
      if (objectUrl) root.URL?.revokeObjectURL?.(objectUrl);
      objectUrl = null;
      currentCapture = null;
      image.removeAttribute('src');
      panel.hidden = true;
      button.setAttribute('aria-pressed', 'false');
      status.textContent = 'Ekran görüntüsü tutulmuyor.';
      root.dispatchEvent?.(new root.CustomEvent('hafize:screen-capture-cleared'));
    }

    async function requestCapture() {
      if (button.disabled) return;
      button.disabled = true;
      status.textContent = 'Paylaşılacak pencere veya ekranı sen seçiyorsun…';
      try {
        const capture = await captureScreenFrame({ mediaDevices: root.navigator?.mediaDevices, document });
        clearCapture();
        currentCapture = capture;
        objectUrl = root.URL?.createObjectURL?.(capture.blob) || '';
        if (objectUrl) image.src = objectUrl;
        panel.hidden = false;
        button.setAttribute('aria-pressed', 'true');
        status.textContent = `${capture.width}×${capture.height} ekran görüntüsü yalnız bu sekmede hazır; Hafize'ye gönderilmedi.`;
        root.dispatchEvent?.(new root.CustomEvent('hafize:screen-capture-ready', {
          detail: { capture, width: capture.width, height: capture.height, mimeType: capture.mimeType }
        }));
      } catch (error) {
        if (error?.message === 'SCREEN_CAPTURE_CANCELLED') status.textContent = 'Ekran paylaşımı iptal edildi.';
        else if (error?.message === 'SCREEN_CAPTURE_UNSUPPORTED') status.textContent = 'Bu tarayıcı ekran paylaşımını desteklemiyor.';
        else status.textContent = 'Ekran görüntüsü alınamadı.';
      } finally {
        button.disabled = false;
      }
    }

    button.addEventListener('click', requestCapture);
    removeButton.addEventListener('click', clearCapture);
    root.addEventListener?.('pagehide', clearCapture, { once: true });

    return Object.freeze({
      clearCapture,
      requestCapture,
      getCapture: () => currentCapture
    });
  }

  return Object.freeze({ boundedSize, captureScreenFrame, mountScreenShare, stopStream });
});