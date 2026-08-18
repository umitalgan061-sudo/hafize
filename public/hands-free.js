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
  const RESTART_DELAY_MS = 350;
  const HANDOFF_TIMEOUT_MS = 1500;
  const POST_OUTPUT_COOLDOWN_MS = 1800;
  const SESSION_LIMIT_MS = 30 * 60 * 1000;
  const NETWORK_RETRY_DELAYS_MS = Object.freeze([2_000, 5_000, 15_000, 30_000, 60_000]);
  const TERMINAL_RECOGNITION_ERRORS = new Set([
    'audio-capture',
    'not-allowed',
    'security',
    'service-not-allowed',
    'language-not-supported'
  ]);
  const VOICE_INPUT_STATE_EVENT = 'hafize:voice-input-state';
  const VOICE_OUTPUT_STATE_EVENT = 'hafize:voice-output-state';

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
    if (!wake.includes(' ')) return speech.split(' ').includes(wake);
    return ` ${speech} `.includes(` ${wake} `);
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

  function normalizeRecognitionError(value) {
    return typeof value === 'string'
      ? value.trim().toLocaleLowerCase('en-US').replace(/_/g, '-')
      : 'unknown';
  }

  function classifyRecognitionError(value) {
    const code = normalizeRecognitionError(value);
    if (code === 'aborted') return Object.freeze({ code, kind: 'aborted' });
    if (code === 'no-speech') return Object.freeze({ code, kind: 'idle' });
    if (code === 'network') return Object.freeze({ code, kind: 'network' });
    if (TERMINAL_RECOGNITION_ERRORS.has(code)) return Object.freeze({ code, kind: 'terminal' });
    return Object.freeze({ code, kind: 'terminal' });
  }

  function networkRetryDelay(streak) {
    if (!Number.isInteger(streak) || streak < 1) return 0;
    return NETWORK_RETRY_DELAYS_MS[Math.min(streak, NETWORK_RETRY_DELAYS_MS.length) - 1];
  }

  function terminalRecognitionMessage(code) {
    if (code === 'audio-capture') return 'Eller serbest mikrofonu kullanamadı. Mikrofonu kontrol edip yeniden aç.';
    if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'security') {
      return 'Eller serbest için mikrofon izni kullanılamıyor. İzni kontrol edip yeniden aç.';
    }
    if (code === 'language-not-supported') return 'Eller serbest konuşma dili bu tarayıcıda desteklenmiyor.';
    return 'Eller serbest konuşma tanıma hatası nedeniyle kapatıldı. Devam etmek için yeniden aç.';
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
    let handoffTimer = null;
    let sessionTimer = null;
    let cooldownTimer = null;
    let handoffWaiting = false;
    let coolingDown = false;
    let voiceInputListening = false;
    let voiceOutputSpeaking = false;
    let networkErrorStreak = 0;
    let restartDelayMs = RESTART_DELAY_MS;
    let lastRecognitionError = '';
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
            : handoffWaiting
              ? '○ Sesli giriş hazırlanıyor'
              : voiceOutputSpeaking
                ? '○ Hafize konuşuyor'
                : coolingDown
                  ? '○ Yankı koruması etkin'
                  : restartTimer && restartDelayMs > RESTART_DELAY_MS
                    ? '○ Konuşma servisine yeniden bağlanıyor'
                    : listening
                      ? '● “Hafize” için dinliyor'
                      : '○ Eller serbest beklemede')
        : '';
      indicator.setAttribute?.('data-listening', String(listening));
      indicator.setAttribute?.('data-handoff-waiting', String(handoffWaiting));
      indicator.setAttribute?.('data-cooling-down', String(coolingDown));
      indicator.setAttribute?.('data-voice-input-listening', String(voiceInputListening));
      indicator.setAttribute?.('data-voice-output-speaking', String(voiceOutputSpeaking));
      indicator.setAttribute?.('data-network-retry', String(networkErrorStreak));
    }

    function clearRestart() {
      if (restartTimer != null && typeof root?.clearTimeout === 'function') root.clearTimeout(restartTimer);
      restartTimer = null;
    }

    function clearHandoff() {
      if (handoffTimer != null && typeof root?.clearTimeout === 'function') root.clearTimeout(handoffTimer);
      handoffTimer = null;
      handoffWaiting = false;
    }

    function clearSessionTimer() {
      if (sessionTimer != null && typeof root?.clearTimeout === 'function') root.clearTimeout(sessionTimer);
      sessionTimer = null;
    }

    function clearCooldown() {
      if (cooldownTimer != null && typeof root?.clearTimeout === 'function') root.clearTimeout(cooldownTimer);
      cooldownTimer = null;
      coolingDown = false;
    }

    function resetRecognitionRecovery() {
      networkErrorStreak = 0;
      restartDelayMs = RESTART_DELAY_MS;
      lastRecognitionError = '';
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

    function scheduleRestart(delayMs = restartDelayMs) {
      clearRestart();
      if (
        destroyed
        || !enabled
        || handoffWaiting
        || coolingDown
        || voiceInputListening
        || voiceOutputSpeaking
        || documentRef.hidden
        || input.disabled
      ) return;
      const boundedDelay = Number.isFinite(delayMs) && delayMs >= RESTART_DELAY_MS
        ? Math.min(delayMs, NETWORK_RETRY_DELAYS_MS.at(-1))
        : RESTART_DELAY_MS;
      restartDelayMs = boundedDelay;
      if (typeof root?.setTimeout === 'function') restartTimer = root.setTimeout(startRecognition, boundedDelay);
      render();
    }

    function disableForRecognitionError(code) {
      enabled = false;
      clearSessionTimer();
      clearHandoff();
      clearCooldown();
      clearRestart();
      stopRecognition({ abort: true });
      render();
      announce(terminalRecognitionMessage(code));
    }

    function handleRecognitionError(value) {
      const classification = classifyRecognitionError(value);
      lastRecognitionError = classification.code;
      if (classification.kind === 'aborted') return classification;
      if (classification.kind === 'idle') {
        restartDelayMs = RESTART_DELAY_MS;
        return classification;
      }
      if (classification.kind === 'network') {
        networkErrorStreak += 1;
        if (networkErrorStreak > NETWORK_RETRY_DELAYS_MS.length) {
          disableForRecognitionError('network');
          return Object.freeze({ code: classification.code, kind: 'terminal' });
        }
        restartDelayMs = networkRetryDelay(networkErrorStreak);
        if (networkErrorStreak === 1) announce('Eller serbest konuşma servisine yeniden bağlanmayı deniyor.');
        return classification;
      }
      disableForRecognitionError(classification.code);
      return classification;
    }

    function expireSession() {
      sessionTimer = null;
      if (destroyed || !enabled) return;
      enabled = false;
      clearHandoff();
      clearCooldown();
      stopRecognition({ abort: true });
      render();
      announce('Eller serbest dinleme 30 dakikalık güvenlik süresi sonunda kapatıldı. Devam etmek için yeniden aç.');
    }

    function armSessionTimer() {
      clearSessionTimer();
      if (!enabled || destroyed || typeof root?.setTimeout !== 'function') return;
      sessionTimer = root.setTimeout(expireSession, SESSION_LIMIT_MS);
    }

    function beginPostOutputCooldown() {
      clearCooldown();
      if (!enabled || destroyed) return;
      coolingDown = true;
      render();
      if (typeof root?.setTimeout !== 'function') {
        coolingDown = false;
        render();
        scheduleRestart();
        return;
      }
      cooldownTimer = root.setTimeout(() => {
        cooldownTimer = null;
        if (destroyed || !enabled) return;
        coolingDown = false;
        render();
        scheduleRestart();
      }, POST_OUTPUT_COOLDOWN_MS);
    }

    function armHandoffFallback() {
      if (!handoffWaiting || voiceInputListening || destroyed || !enabled) return;
      if (typeof root?.setTimeout !== 'function') {
        handoffWaiting = false;
        render();
        scheduleRestart();
        return;
      }
      handoffTimer = root.setTimeout(() => {
        handoffTimer = null;
        if (!handoffWaiting || voiceInputListening || destroyed || !enabled) return;
        handoffWaiting = false;
        render();
        announce('Sesli giriş başlatılamadı; “Hafize” dinlemesi yeniden açıldı.');
        scheduleRestart();
      }, HANDOFF_TIMEOUT_MS);
    }

    function beginVoiceHandoff() {
      if (handoffWaiting || coolingDown || voiceInputListening || voiceOutputSpeaking) return;
      handoffWaiting = true;
      render();
      stopRecognition();
    }

    function startRecognition() {
      clearRestart();
      if (
        destroyed
        || !enabled
        || !Recognition
        || recognition
        || handoffWaiting
        || coolingDown
        || voiceInputListening
        || voiceOutputSpeaking
        || documentRef.hidden
        || input.disabled
      ) return;
      const current = new Recognition();
      current.lang = documentRef.documentElement?.lang || root?.navigator?.language || 'tr-TR';
      current.continuous = true;
      current.interimResults = false;
      current.maxAlternatives = 1;
      recognition = current;

      current.onstart = () => {
        if (recognition !== current) return;
        listening = true;
        resetRecognitionRecovery();
        render();
      };
      current.onresult = (event) => {
        if (coolingDown || voiceOutputSpeaking || !containsWakePhrase(readRecognitionText(event))) return;
        beginVoiceHandoff();
      };
      current.onerror = (event) => {
        if (recognition !== current) return;
        handleRecognitionError(event?.error);
      };
      current.onend = () => {
        if (recognition === current) {
          recognition = null;
          listening = false;
        }
        render();
        if (!enabled || destroyed) return;
        if (handoffWaiting) {
          micButton.click?.();
          if (handoffWaiting && !voiceInputListening) armHandoffFallback();
          return;
        }
        scheduleRestart();
      };

      try { current.start(); }
      catch {
        recognition = null;
        listening = false;
        const classification = handleRecognitionError('unknown');
        render();
        if (classification.kind !== 'terminal') scheduleRestart();
      }
    }

    function setEnabled(next) {
      if (destroyed) return;
      const requested = Boolean(next) && Boolean(Recognition);
      if (enabled === requested) return;
      enabled = requested;
      clearHandoff();
      clearCooldown();
      clearSessionTimer();
      resetRecognitionRecovery();
      if (enabled) {
        announce('Eller serbest bu oturum için 30 dakika açıldı. Mikrofon görünür şekilde “Hafize” uyandırma ifadesini dinler; mesaj otomatik gönderilmez.');
        armSessionTimer();
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
      if (documentRef.hidden) {
        clearHandoff();
        clearCooldown();
        stopRecognition({ abort: true });
      } else {
        scheduleRestart();
      }
    }

    function handleVoiceInputState(event) {
      const detail = event?.detail;
      if (!detail || detail.source !== 'voice-input' || typeof detail.listening !== 'boolean') return;
      voiceInputListening = detail.listening;
      if (voiceInputListening) {
        clearHandoff();
        clearCooldown();
        stopRecognition({ abort: true });
      } else {
        clearHandoff();
        scheduleRestart();
      }
      render();
    }

    function handleVoiceOutputState(event) {
      const detail = event?.detail;
      if (!detail || detail.source !== 'voice-output' || typeof detail.speaking !== 'boolean') return;
      const wasSpeaking = voiceOutputSpeaking;
      voiceOutputSpeaking = detail.speaking;
      if (voiceOutputSpeaking) {
        clearCooldown();
        clearRestart();
        stopRecognition({ abort: true });
      } else if (wasSpeaking) {
        beginPostOutputCooldown();
      } else {
        scheduleRestart();
      }
      render();
    }

    toggle.addEventListener?.('click', handleToggle);
    documentRef.addEventListener?.('visibilitychange', handleVisibility);
    documentRef.addEventListener?.(VOICE_INPUT_STATE_EVENT, handleVoiceInputState);
    documentRef.addEventListener?.(VOICE_OUTPUT_STATE_EVENT, handleVoiceOutputState);

    const MutationObserverCtor = root?.MutationObserver;
    const observer = typeof MutationObserverCtor === 'function'
      ? new MutationObserverCtor(() => {
          if (input.disabled) {
            clearHandoff();
            clearCooldown();
            stopRecognition({ abort: true });
          } else {
            scheduleRestart();
          }
        })
      : null;
    observer?.observe?.(input, { attributes: true, attributeFilter: ['disabled'] });

    render();
    return Object.freeze({
      isSupported: Boolean(Recognition),
      isEnabled: () => enabled,
      isListening: () => listening,
      isHandoffWaiting: () => handoffWaiting,
      isCoolingDown: () => coolingDown,
      isVoiceInputListening: () => voiceInputListening,
      isVoiceOutputSpeaking: () => voiceOutputSpeaking,
      getNetworkErrorStreak: () => networkErrorStreak,
      getRestartDelayMs: () => restartDelayMs,
      getLastRecognitionError: () => lastRecognitionError,
      enable: () => setEnabled(true),
      disable: () => setEnabled(false),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        enabled = false;
        voiceInputListening = false;
        voiceOutputSpeaking = false;
        resetRecognitionRecovery();
        clearSessionTimer();
        clearHandoff();
        clearCooldown();
        clearRestart();
        observer?.disconnect?.();
        stopRecognition({ abort: true });
        toggle.removeEventListener?.('click', handleToggle);
        documentRef.removeEventListener?.('visibilitychange', handleVisibility);
        documentRef.removeEventListener?.(VOICE_INPUT_STATE_EVENT, handleVoiceInputState);
        documentRef.removeEventListener?.(VOICE_OUTPUT_STATE_EVENT, handleVoiceOutputState);
      }
    });
  }

  return Object.freeze({
    DEFAULT_WAKE_PHRASE,
    HANDOFF_TIMEOUT_MS,
    NETWORK_RETRY_DELAYS_MS,
    POST_OUTPUT_COOLDOWN_MS,
    RESTART_DELAY_MS,
    SESSION_LIMIT_MS,
    VOICE_INPUT_STATE_EVENT,
    VOICE_OUTPUT_STATE_EVENT,
    classifyRecognitionError,
    containsWakePhrase,
    getRecognitionConstructor,
    installHandsFree,
    networkRetryDelay,
    normalizeRecognitionError,
    normalizeSpeech,
    readRecognitionText,
    terminalRecognitionMessage
  });
});