(function exposeHafizeScreenShare(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeScreenShare = api;
  const boot = () => api.bootstrapScreenShare({ root, documentRef: root.document });
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeScreenShareApi() {
  'use strict';

  const DEFAULT_CONSTRAINTS = Object.freeze({ video: true, audio: false });

  function getVideoTracks(stream) {
    return typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
  }

  function stopTracks(stream) {
    if (typeof stream?.getTracks !== 'function') return;
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch {}
    }
  }

  function createScreenShareController({ mediaDevices, onChange = () => {} } = {}) {
    let stream = null;
    let session = 0;

    function emit(state, detail = {}) {
      onChange(Object.freeze({ state, active: Boolean(stream), stream, ...detail }));
    }

    function stop(reason = 'user') {
      if (!stream) {
        emit('idle', { reason });
        return { ok: true, active: false, reason };
      }
      const current = stream;
      stream = null;
      session += 1;
      stopTracks(current);
      emit('stopped', { reason });
      return { ok: true, active: false, reason };
    }

    async function start({ userInitiated = false } = {}) {
      if (!userInitiated) return { ok: false, error: 'SCREEN_SHARE_REQUIRES_USER_GESTURE' };
      if (stream) return { ok: true, active: true, stream };
      if (typeof mediaDevices?.getDisplayMedia !== 'function') {
        emit('unsupported');
        return { ok: false, error: 'SCREEN_SHARE_UNSUPPORTED' };
      }

      const requestSession = ++session;
      emit('requesting');
      let candidate;
      try {
        candidate = await mediaDevices.getDisplayMedia(DEFAULT_CONSTRAINTS);
      } catch (error) {
        const code = error?.name === 'NotAllowedError' ? 'SCREEN_SHARE_DENIED' : 'SCREEN_SHARE_FAILED';
        emit('error', { error: code });
        return { ok: false, error: code };
      }

      const tracks = getVideoTracks(candidate);
      if (requestSession !== session || tracks.length === 0) {
        stopTracks(candidate);
        const error = tracks.length ? 'SCREEN_SHARE_CANCELLED' : 'SCREEN_SHARE_NO_VIDEO';
        emit('error', { error });
        return { ok: false, error };
      }

      stream = candidate;
      const activeSession = session;
      for (const track of tracks) {
        track.addEventListener?.('ended', () => {
          if (stream === candidate && session === activeSession) stop('source-ended');
        }, { once: true });
      }
      emit('active');
      return { ok: true, active: true, stream };
    }

    function status() {
      return Object.freeze({ active: Boolean(stream), stream });
    }

    return Object.freeze({ start, stop, status });
  }

  function bootstrapScreenShare({ root, documentRef } = {}) {
    const button = documentRef?.querySelector?.('#screenShareBtn');
    const panel = documentRef?.querySelector?.('#screenSharePanel');
    const preview = documentRef?.querySelector?.('#screenSharePreview');
    const status = documentRef?.querySelector?.('#screenShareStatus');
    if (!button || !panel || !preview || !status) return null;

    function render(change) {
      const state = change?.state || 'idle';
      const active = state === 'active';
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? '▣ Ekran paylaşımı açık' : '▣ Ekran paylaş';
      panel.hidden = !active;

      if (active) {
        preview.srcObject = change.stream;
        preview.play?.().catch?.(() => {});
        status.textContent = 'Yalnız seçtiğin ekran yerel önizlemede. Görüntü otomatik gönderilmez veya kaydedilmez.';
        return;
      }

      preview.srcObject = null;
      if (state === 'requesting') status.textContent = 'Paylaşılacak ekranı tarayıcı penceresinden seç.';
      else if (state === 'unsupported') status.textContent = 'Bu tarayıcı güvenli ekran paylaşımını desteklemiyor.';
      else if (change?.error === 'SCREEN_SHARE_DENIED') status.textContent = 'Ekran paylaşımı izni verilmedi.';
      else if (state === 'error') status.textContent = 'Ekran paylaşımı başlatılamadı.';
      else status.textContent = 'Ekran paylaşımı kapalı.';
    }

    const controller = createScreenShareController({
      mediaDevices: root?.navigator?.mediaDevices,
      onChange: render
    });

    button.addEventListener('click', async () => {
      if (controller.status().active) controller.stop('user');
      else await controller.start({ userInitiated: true });
    });

    documentRef.addEventListener?.('visibilitychange', () => {
      if (documentRef.hidden && controller.status().active) controller.stop('hidden');
    });
    root?.addEventListener?.('pagehide', () => controller.stop('pagehide'), { once: true });
    render({ state: 'idle' });
    return controller;
  }

  return Object.freeze({ DEFAULT_CONSTRAINTS, createScreenShareController, bootstrapScreenShare });
});
