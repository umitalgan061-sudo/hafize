(function exposeHafizeHandsFree(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeHandsFree = api;
  const install = () => api.installHandsFree(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeHandsFree() {
  'use strict';

  const DEFAULT_WAKE_PHRASE = 'hafize';
  const STORAGE_KEY = 'hafize.handsfree.v1';
  const RESTART_DELAY_MS = 350;
  const VOICE_INPUT_STATE_EVENT = 'hafize:voice-input-state';

  function getRecognitionConstructor(root) {
    return root?.SpeechRecognition || root?.webkitSpeechRecognition || null;
  }

  function normalizeSpeech(value) {
    return typeof value === 'string'
      ? value.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
      : '';
  }

  function containsWakePhrase(value, wakePhrase = DEFAULT_WAKE_PHRASE) {
    const speech = normalizeSpeech(value);
    const wake = normalizeSpeech(wakePhrase);
    if (!speech || !wake) return false;
    return speech.split(' ').includes(wake);
  }

  function readRecognitionText(event) {
    if (!event?.results) return '';
    const chunks = [];
    const start = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for (let index = start; index < event.results.length; index += 1) {
      const transcript = event.results[index]?.[0]?.transcript;
      if (typeof transcript === 'string') chunks.push(transcript);
    }
    return chunks.join(' ').trim();
  }

  function installHandsFree(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#handsFreeToggle');
    const indicator = documentRef?.querySelector?.('#handsFreeIndicator');
    const micButton = documentRef?.querySelector?.('#micBtn');
    const input = documentRef?.querySelector?.('#messageInput');
    if (!toggle || !indicator || !micButton || !input) return null;

    const Recognition = getRecognitionConstructor(root);
    let enabled = false;
    let listening = false;
    let recognition = null;
    let restartTimer = null;
    let handoffPending = false;
    let voiceInputListening = false;
    let destroyed = false;

    function announce(message) {
      const toast = documentRef.querySelector?.('#toast');
      if (!toast || !message) return;
      toast.textContent = message;
      toast.classList?.remove?.('hidden');
    }

    function render() {
      toggle.setAttribute?.('aria-pressed', String(enabled));
      toggle.disabled = !Recognition;
      toggle.textContent = enabled ? 'Eller serbest açık' : 'Eller serbest kapalı';
      indicator.hidden = !enabled;
      indicator.textContent = enabled
        ? (voiceInputListening
            ? '○ Sesli giriş etkin'
            : listening
              ? '● “Hafize” için dinliyor'
              : '○ Eller serbest beklemede')
        : '';
      indicator.setAttribute?.('data-listening', String(listening));
      indicator.setAttribute?.('data-voice-input-listening', String(voiceInputListening));
    }

    function clearRestart() {
      if (restartTimer != null && typeof root?.clearTimeout === 'function') root.clearTimeout(restartTimer);
      restartTimer = null;
    }

    function stopRecognition({ abort = false } = {}) {
      clearRestart();
      const active = recognition;
      recognition = null;
      listening = false;
      render();
      if (!active) return;
      try {
        if (abort) active.abort?.();
        else active.stop?.();
      } catch { /* already stopped */ }
    }

    function scheduleRestart() {
      clearRestart();
      if (destroyed || !enabled || handoffPending || voiceInputListening || documentRef.hidden || input.disabled) return;
      if (typeof root?.setTimeout === 'function') restartTimer = root.setTimeout(startRecognition, RESTART_DELAY_MS);
    }

    function startRecognition() {
      clearRestart();
      if (destroyed || !enabled || !Recognition || recognition || voiceInputListening || documentRef.hidden || input.disabled) return;
      const current = new Recognition();
      current.lang = documentRef.documentElement?.lang || root?.navigator?.language || 'tr-TR';
      current.continuous = true;
      current.interimResults = false;
      current.maxAlternatives = 1;
      recognition = current;

      current.onstart = () => {
        if (recognition !== current) return;
        listening = true;
        render();
      };
      current.onresult = (event) => {
        if (!containsWakePhrase(readRecognitionText(event))) return;
        handoffPending = true;
        stopRecognition();
      };
      current.onerror = (event) => {
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          enabled = false;
          try { root?.localStorage?.removeItem?.(STORAGE_KEY); } catch { /* storage unavailable */ }
          announce('Eller serbest için mikrofon izni verilmedi.');
        }
      };
      current.onend = () => {
        if (recognition === current) {
          recognition = null;
          listening = false;
        }
        render();
        if (handoffPending) {
          handoffPending = false;
          micButton.click?.();
          scheduleRestart();
          return;
        }
        scheduleRestart();
      };

      try { current.start(); }
      catch {
        recognition = null;
        listening = false;
        render();
        scheduleRestart();
      }
    }

    function setEnabled(next, { persist = true } = {}) {
      if (destroyed) return;
      const requested = Boolean(next) && Boolean(Recognition);
      if (enabled === requested) return;
      enabled = requested;
      handoffPending = false;
      if (persist) {
        try {
          if (enabled) root?.localStorage?.setItem?.(STORAGE_KEY, 'on');
          else root?.localStorage?.removeItem?.(STORAGE_KEY);
        } catch { /* preference persistence is best effort */ }
      }
      if (enabled) {
        announce('Eller serbest açıldı. Mikrofon görünür şekilde “Hafize” uyandırma ifadesini dinler; mesaj otomatik gönderilmez.');
        startRecognition();
      } else {
        stopRecognition({ abort: true });
      }
      render();
    }

    function handleToggle() {
      if (!Recognition) {
        announce('Eller serbest bu tarayıcıda desteklenmiyor.');
        return;
      }
      setEnabled(!enabled);
    }

    function handleVisibility() {
      if (documentRef.hidden) stopRecognition({ abort: true });
      else scheduleRestart();
    }

    function handleVoiceInputState(event) {
      const detail = event?.detail;
      if (!detail || detail.source !== 'voice-input' || typeof detail.listening !== 'boolean') return;
      voiceInputListening = detail.listening;
      if (voiceInputListening) stopRecognition({ abort: true });
      else scheduleRestart();
      render();
    }

    toggle.addEventListener?.('click', handleToggle);
    documentRef.addEventListener?.('visibilitychange', handleVisibility);
    documentRef.addEventListener?.(VOICE_INPUT_STATE_EVENT, handleVoiceInputState);

    const MutationObserverCtor = root?.MutationObserver;
    const observer = typeof MutationObserverCtor === 'function'
      ? new MutationObserverCtor(() => {
          if (input.disabled) stopRecognition({ abort: true });
          else scheduleRestart();
        })
      : null;
    observer?.observe?.(input, { attributes: true, attributeFilter: ['disabled'] });

    render();
    return Object.freeze({
      isSupported: Boolean(Recognition),
      isEnabled: () => enabled,
      isListening: () => listening,
      isVoiceInputListening: () => voiceInputListening,
      enable: () => setEnabled(true),
      disable: () => setEnabled(false),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        enabled = false;
        handoffPending = false;
        voiceInputListening = false;
        clearRestart();
        observer?.disconnect?.();
        stopRecognition({ abort: true });
        toggle.removeEventListener?.('click', handleToggle);
        documentRef.removeEventListener?.('visibilitychange', handleVisibility);
        documentRef.removeEventListener?.(VOICE_INPUT_STATE_EVENT, handleVoiceInputState);
      }
    });
  }

  return Object.freeze({
    DEFAULT_WAKE_PHRASE,
    STORAGE_KEY,
    VOICE_INPUT_STATE_EVENT,
    containsWakePhrase,
    getRecognitionConstructor,
    installHandsFree,
    normalizeSpeech,
    readRecognitionText
  });
});
