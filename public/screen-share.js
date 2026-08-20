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
  const VIDEO_READY_TIMEOUT_MS = 10_000;

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

  function waitForVideo(video, {
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    timeoutMs = VIDEO_READY_TIMEOUT_MS
  } = {}) {
    if (video?.videoWidth > 0 && video?.videoHeight > 0) return Promise.resolve();
    if (!video?.addEventListener || !video?.removeEventListener) return Promise.reject(new Error('SCREEN_CAPTURE_VIDEO_FAILED'));
    if (typeof setTimeoutImpl !== 'function' || typeof clearTimeoutImpl !== 'function') return Promise.reject(new Error('SCREEN_CAPTURE_TIMER_UNSUPPORTED'));
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) return Promise.reject(new Error('INVALID_SCREEN_CAPTURE_TIMEOUT'));

    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('error', onError);
        if (timer !== null) clearTimeoutImpl(timer);
        timer = null;
      };
      const settle = (callback) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const onReady = () => settle(resolve);
      const onError = () => settle(() => reject(new Error('SCREEN_CAPTURE_VIDEO_FAILED')));
      const onTimeout = () => settle(() => reject(new Error('SCREEN_CAPTURE_VIDEO_TIMEOUT')));
      video.addEventListener('loadedmetadata', onReady, { once: true });
      video.addEventListener('error', onError, { once: true });
      timer = setTimeoutImpl(onTimeout, timeoutMs);
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

  async function captureScreenFrame({
    mediaDevices,
    document,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    videoReadyTimeoutMs = VIDEO_READY_TIMEOUT_MS
  }) {
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
      await waitForVideo(video, { setTimeoutImpl, clearTimeoutImpl, timeoutMs: videoReadyTimeoutMs });

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

  function readAttribute(node, name) {
    return node?.getAttribute?.(name);
  }

  function restoreAttribute(node, name, value) {
    if (!node) return;
    if (value === null || value === undefined) node.removeAttribute?.(name);
    else node.setAttribute?.(name, value);
  }

  function mountScreenShare({ root = globalThis } = {}) {
    const document = root.document;
    const button = document?.querySelector?.('#screenShareBtn');
    const panel = document?.querySelector?.('#screenSharePreview');
    const image = document?.querySelector?.('#screenShareImage');
    const status = document?.querySelector?.('#screenShareStatus');
    const removeButton = document?.querySelector?.('#screenShareRemove');
    if (!button || !panel || !image || !status || !removeButton) return null;

    const initialState = Object.freeze({
      buttonDisabled: Boolean(button.disabled),
      buttonPressed: readAttribute(button, 'aria-pressed'),
      panelHidden: Boolean(panel.hidden),
      imageSrc: readAttribute(image, 'src'),
      statusText: status.textContent || ''
    });

    let objectUrl = null;
    let currentCapture = null;
    let destroyed = false;
    let generation = 1;
    let requestInFlight = false;

    function revokeObjectUrl() {
      if (objectUrl) root.URL?.revokeObjectURL?.(objectUrl);
      objectUrl = null;
    }

    function resetCaptureUi({ announce = true } = {}) {
      revokeObjectUrl();
      currentCapture = null;
      image.removeAttribute?.('src');
      panel.hidden = true;
      button.setAttribute?.('aria-pressed', 'false');
      status.textContent = 'Ekran görüntüsü tutulmuyor.';
      if (announce && !destroyed) {
        root.dispatchEvent?.(new root.CustomEvent('hafize:screen-capture-cleared'));
      }
    }

    function clearCapture() {
      if (destroyed) return false;
      generation += 1;
      resetCaptureUi();
      return true;
    }

    async function requestCapture() {
      if (destroyed || requestInFlight || button.disabled) return null;
      const requestGeneration = ++generation;
      requestInFlight = true;
      button.disabled = true;
      status.textContent = 'Paylaşılacak pencere veya ekranı sen seçiyorsun…';
      try {
        const capture = await captureScreenFrame({ mediaDevices: root.navigator?.mediaDevices, document });
        if (destroyed || requestGeneration !== generation) return null;

        resetCaptureUi({ announce: false });
        currentCapture = capture;
        objectUrl = root.URL?.createObjectURL?.(capture.blob) || '';
        if (objectUrl) image.setAttribute?.('src', objectUrl);
        panel.hidden = false;
        button.setAttribute?.('aria-pressed', 'true');
        status.textContent = `${capture.width}×${capture.height} ekran görüntüsü yalnız bu sekmede hazır; Hafize'ye gönderilmedi.`;
        root.dispatchEvent?.(new root.CustomEvent('hafize:screen-capture-ready', {
          detail: { capture, width: capture.width, height: capture.height, mimeType: capture.mimeType }
        }));
        return capture;
      } catch (error) {
        if (destroyed || requestGeneration !== generation) return null;
        if (error?.message === 'SCREEN_CAPTURE_CANCELLED') status.textContent = 'Ekran paylaşımı iptal edildi.';
        else if (error?.message === 'SCREEN_CAPTURE_UNSUPPORTED') status.textContent = 'Bu tarayıcı ekran paylaşımını desteklemiyor.';
        else if (error?.message === 'SCREEN_CAPTURE_VIDEO_TIMEOUT') status.textContent = 'Ekran paylaşımı görüntüsü zamanında hazırlanamadı; paylaşım kapatıldı.';
        else status.textContent = 'Ekran görüntüsü alınamadı.';
        return null;
      } finally {
        if (!destroyed && requestGeneration === generation) button.disabled = initialState.buttonDisabled;
        requestInFlight = false;
      }
    }

    function onPageHide() {
      if (!destroyed) clearCapture();
    }

    button.addEventListener('click', requestCapture);
    removeButton.addEventListener('click', clearCapture);
    root.addEventListener?.('pagehide', onPageHide);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      button.removeEventListener?.('click', requestCapture);
      removeButton.removeEventListener?.('click', clearCapture);
      root.removeEventListener?.('pagehide', onPageHide);
      revokeObjectUrl();
      currentCapture = null;
      requestInFlight = false;
      button.disabled = initialState.buttonDisabled;
      restoreAttribute(button, 'aria-pressed', initialState.buttonPressed);
      panel.hidden = initialState.panelHidden;
      restoreAttribute(image, 'src', initialState.imageSrc);
      status.textContent = initialState.statusText;
    }

    return Object.freeze({
      clearCapture,
      requestCapture,
      getCapture: () => destroyed ? null : currentCapture,
      destroy
    });
  }

  return Object.freeze({
    MAX_WIDTH,
    MAX_HEIGHT,
    JPEG_QUALITY,
    VIDEO_READY_TIMEOUT_MS,
    boundedSize,
    waitForVideo,
    captureScreenFrame,
    mountScreenShare,
    stopStream
  });
});