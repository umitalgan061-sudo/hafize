(function exposeHafizeVoiceOutput(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module?.exports) module.exports = api;
  else {
    root.HafizeVoiceOutput = api;
    const install = () => api.installVoiceOutput(root.document, root);
    if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeVoiceOutput() {
  'use strict';

  const STORAGE_KEY = 'hafize.voiceOutput.v1';
  const VOICE_INPUT_STATE_EVENT = 'hafize:voice-input-state';
  const VOICE_OUTPUT_STATE_EVENT = 'hafize:voice-output-state';
  const MAX_SPEECH_LENGTH = 2400;
  const MAX_CHUNK_LENGTH = 240;
  const DEFAULT_SPEECH_RATE = 0.98;
  const SPEECH_RATE_OPTIONS = Object.freeze([0.85, 0.98, 1.15, 1.3]);

  function normalizeSpeechText(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/```[\s\S]*?```/g, ' Kod bloğu atlandı. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/https?:\/\/\S+/gi, ' bağlantı ')
      .replace(/[*_#>|~]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_SPEECH_LENGTH);
  }

  function splitSpeechText(value, maxLength = MAX_CHUNK_LENGTH) {
    const text = normalizeSpeechText(value);
    if (!text) return [];
    const limit = Number.isInteger(maxLength) && maxLength >= 80 ? maxLength : MAX_CHUNK_LENGTH;
    const sentences = text.match(/[^.!?…]+[.!?…]?/g) || [text];
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
      const clean = sentence.trim();
      if (!clean) continue;
      if ((current ? `${current} ${clean}` : clean).length <= limit) {
        current = current ? `${current} ${clean}` : clean;
        continue;
      }
      if (current) chunks.push(current);
      if (clean.length <= limit) {
        current = clean;
        continue;
      }
      const words = clean.split(' ');
      current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > limit && current) {
          chunks.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function normalizeSpeechRate(value) {
    const rate = Number(value);
    return SPEECH_RATE_OPTIONS.includes(rate) ? rate : DEFAULT_SPEECH_RATE;
  }

  function readStoredEnabled(storage) {
    try { return storage?.getItem?.(STORAGE_KEY) === 'true'; } catch { return false; }
  }

  function writeStoredEnabled(storage, enabled) {
    try { storage?.setItem?.(STORAGE_KEY, String(Boolean(enabled))); } catch { /* storage is optional */ }
  }

  function installVoiceOutput(documentRef, root) {
    const toggle = documentRef?.querySelector?.('#voiceOutputToggle');
    const card = documentRef?.querySelector?.('.voice-card');
    const micButton = documentRef?.querySelector?.('#micBtn');
    const messageInput = documentRef?.querySelector?.('#messageInput');
    const composer = documentRef?.querySelector?.('#composer');
    const messages = documentRef?.querySelector?.('#messages');
    if (!toggle || !card) return null;

    let generatedPauseToggle = false;
    let generatedStatus = false;
    let pauseToggle = documentRef?.querySelector?.('#voicePauseToggle');
    let status = documentRef?.querySelector?.('#voiceOutputStatus');
    if (!pauseToggle && typeof documentRef?.createElement === 'function') {
      pauseToggle = documentRef.createElement('button');
      pauseToggle.id = 'voicePauseToggle';
      pauseToggle.type = 'button';
      pauseToggle.className = 'voice-output-pause';
      pauseToggle.hidden = true;
      pauseToggle.setAttribute?.('aria-pressed', 'false');
      pauseToggle.textContent = 'Sesli yanıtı duraklat';
      toggle.insertAdjacentElement?.('afterend', pauseToggle) || toggle.parentNode?.append?.(pauseToggle);
      generatedPauseToggle = Boolean(pauseToggle.parentNode);
    }
    if (!status && typeof documentRef?.createElement === 'function') {
      status = documentRef.createElement('small');
      status.id = 'voiceOutputStatus';
      status.className = 'voice-output-status';
      status.setAttribute?.('role', 'status');
      status.setAttribute?.('aria-live', 'polite');
      status.setAttribute?.('aria-atomic', 'true');
      status.textContent = 'Sesli yanıt kapalı.';
      const anchor = pauseToggle || toggle;
      anchor.insertAdjacentElement?.('afterend', status) || anchor.parentNode?.append?.(status);
      generatedStatus = Boolean(status.parentNode);
    }

    let generatedRateWrap = false;
    let rateWrap = documentRef?.querySelector?.('#voiceRateWrap');
    let rateSelect = documentRef?.querySelector?.('#voiceRateSelect');
    if (!rateSelect && typeof documentRef?.createElement === 'function') {
      rateWrap = documentRef.createElement('label');
      rateWrap.id = 'voiceRateWrap';
      rateWrap.className = 'voice-rate-wrap';
      const rateLabel = documentRef.createElement('span');
      rateLabel.textContent = 'Konuşma hızı';
      rateSelect = documentRef.createElement('select');
      rateSelect.id = 'voiceRateSelect';
      rateSelect.setAttribute?.('aria-label', 'Sesli yanıt konuşma hızı');
      const rateLabels = new Map([[0.85, 'Yavaş · 0,85×'], [0.98, 'Normal · 0,98×'], [1.15, 'Hızlı · 1,15×'], [1.3, 'Çok hızlı · 1,30×']]);
      for (const rate of SPEECH_RATE_OPTIONS) {
        const option = documentRef.createElement('option');
        option.value = String(rate);
        option.textContent = rateLabels.get(rate);
        rateSelect.append?.(option);
      }
      rateWrap.append?.(rateLabel, rateSelect);
      const anchor = status || pauseToggle || toggle;
      anchor.insertAdjacentElement?.('afterend', rateWrap) || anchor.parentNode?.append?.(rateWrap);
      generatedRateWrap = Boolean(rateWrap.parentNode);
    }

    const synth = root?.speechSynthesis;
    const Utterance = root?.SpeechSynthesisUtterance;
    const supported = Boolean(synth && typeof synth.speak === 'function' && typeof Utterance === 'function');
    const pauseSupported = supported && typeof synth.pause === 'function' && typeof synth.resume === 'function';
    let enabled = supported && readStoredEnabled(root?.localStorage);
    let speechRate = DEFAULT_SPEECH_RATE;
    let speaking = false;
    let paused = false;
    let thinking = false;
    let queue = [];
    let speechGeneration = 0;
    let activeUtterance = null;
    let lastPublishedState = '';

    function publishState() {
      const state = paused ? 'paused' : speaking ? 'speaking' : thinking ? 'thinking' : 'idle';
      const signature = `${state}:${enabled}:${supported}`;
      if (signature === lastPublishedState) return;
      lastPublishedState = signature;
      if (typeof documentRef?.dispatchEvent !== 'function' || typeof root?.CustomEvent !== 'function') return;
      try {
        documentRef.dispatchEvent(new root.CustomEvent(VOICE_OUTPUT_STATE_EVENT, {
          detail: Object.freeze({ source: 'voice-output', state, speaking, thinking, enabled, supported })
        }));
      } catch { /* status event is best-effort; speech behavior stays local */ }
    }

    function render() {
      toggle.disabled = !supported;
      toggle.setAttribute?.('aria-pressed', String(enabled));
      toggle.textContent = supported
        ? enabled ? 'Sesli yanıt açık' : 'Sesli yanıt kapalı'
        : 'Sesli yanıt desteklenmiyor';
      toggle.title = supported
        ? 'Hafize yanıtlarını bu cihazın yerleşik sesiyle oku'
        : 'Bu tarayıcı Speech Synthesis API desteklemiyor';

      if (pauseToggle) {
        pauseToggle.hidden = !pauseSupported || !enabled || !speaking;
        pauseToggle.disabled = !pauseSupported || !enabled || !speaking;
        pauseToggle.setAttribute?.('aria-pressed', String(paused));
        pauseToggle.textContent = paused ? 'Sesli yanıtı sürdür' : 'Sesli yanıtı duraklat';
        pauseToggle.title = paused ? 'Sesli yanıtı kaldığı yerden sürdür' : 'Sesli yanıtı geçici olarak duraklat';
      }
      if (status) {
        status.textContent = !supported
          ? 'Sesli yanıt bu tarayıcıda desteklenmiyor.'
          : !enabled
            ? 'Sesli yanıt kapalı.'
            : paused
              ? 'Sesli yanıt duraklatıldı.'
              : speaking
                ? 'Hafize konuşuyor.'
                : thinking
                  ? 'Hafize yanıt hazırlıyor.'
                  : 'Sesli yanıt hazır.';
      }
      if (rateWrap) rateWrap.hidden = !supported || !enabled;
      if (rateSelect) {
        rateSelect.disabled = !supported || !enabled || speaking;
        rateSelect.value = String(speechRate);
      }

      card.classList?.toggle?.('speaking', speaking && !paused);
      card.classList?.toggle?.('paused', paused);
      card.classList?.toggle?.('thinking', thinking && !speaking);
      publishState();
    }

    function cancelSpeech() {
      speechGeneration += 1;
      queue = [];
      speaking = false;
      paused = false;
      activeUtterance = null;
      try { synth?.cancel?.(); } catch { /* no-op */ }
      render();
    }

    function findTurkishVoice() {
      try {
        const voices = synth?.getVoices?.() || [];
        return voices.find((voice) => String(voice?.lang || '').toLowerCase().startsWith('tr')) || null;
      } catch {
        return null;
      }
    }

    function speakNext(generation = speechGeneration) {
      if (generation !== speechGeneration) return;
      if (!enabled || !supported || !queue.length) {
        activeUtterance = null;
        speaking = false;
        paused = false;
        render();
        return;
      }
      const utterance = new Utterance(queue.shift());
      activeUtterance = utterance;
      utterance.lang = 'tr-TR';
      utterance.rate = speechRate;
      utterance.pitch = 1;
      const voice = findTurkishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (generation !== speechGeneration || activeUtterance !== utterance) return;
        activeUtterance = null;
        paused = false;
        speakNext(generation);
      };
      utterance.onerror = () => {
        if (generation !== speechGeneration || activeUtterance !== utterance) return;
        speechGeneration += 1;
        queue = [];
        activeUtterance = null;
        speaking = false;
        paused = false;
        render();
      };
      speaking = true;
      paused = false;
      thinking = false;
      render();
      try { synth.speak(utterance); } catch { utterance.onerror(); }
    }

    function speak(value) {
      if (!enabled || !supported || documentRef?.hidden) return false;
      const chunks = splitSpeechText(value);
      if (!chunks.length) return false;
      cancelSpeech();
      queue = chunks;
      speakNext(speechGeneration);
      return true;
    }

    function togglePause() {
      if (!pauseSupported || !enabled || !speaking) return false;
      try {
        if (paused) {
          synth.resume();
          paused = false;
        } else {
          synth.pause();
          paused = true;
        }
      } catch {
        cancelSpeech();
        return false;
      }
      render();
      return true;
    }

    function setSpeechRate(value) {
      const next = normalizeSpeechRate(value);
      if (speaking) return speechRate;
      speechRate = next;
      render();
      return speechRate;
    }

    function handleRateChange() {
      if (!rateSelect || speaking) return;
      setSpeechRate(rateSelect.value);
    }

    function setEnabled(next) {
      enabled = supported && Boolean(next);
      writeStoredEnabled(root?.localStorage, enabled);
      if (!enabled) cancelSpeech();
      else render();
      return enabled;
    }

    function latestAssistantText() {
      const nodes = messages?.querySelectorAll?.('.message.assistant .content') || [];
      return nodes.length ? nodes[nodes.length - 1]?.textContent || '' : '';
    }

    function syncStreamState() {
      const busy = Boolean(messageInput?.disabled);
      if (busy) {
        thinking = true;
        if (speaking) cancelSpeech();
        render();
        return;
      }
      const responseJustFinished = thinking;
      thinking = false;
      render();
      if (responseJustFinished) speak(latestAssistantText());
    }

    function handleToggle() { setEnabled(!enabled); }
    function handlePause() { togglePause(); }
    function handleSubmit() { cancelSpeech(); }
    function handleVisibility() {
      if (documentRef.hidden) cancelSpeech();
    }
    function handleVoiceInputState(event) {
      const detail = event?.detail;
      if (detail?.source !== 'voice-input' || detail.listening !== true) return;
      cancelSpeech();
    }

    toggle.addEventListener?.('click', handleToggle);
    pauseToggle?.addEventListener?.('click', handlePause);
    rateSelect?.addEventListener?.('change', handleRateChange);
    composer?.addEventListener?.('submit', handleSubmit, true);
    documentRef.addEventListener?.('visibilitychange', handleVisibility);
    documentRef.addEventListener?.(VOICE_INPUT_STATE_EVENT, handleVoiceInputState);

    const Observer = root?.MutationObserver;
    const micObserver = micButton && typeof Observer === 'function'
      ? new Observer(() => {
          if (micButton.getAttribute?.('aria-pressed') === 'true') cancelSpeech();
        })
      : null;
    micObserver?.observe?.(micButton, { attributes: true, attributeFilter: ['aria-pressed'] });

    const streamObserver = messageInput && typeof Observer === 'function'
      ? new Observer(syncStreamState)
      : null;
    streamObserver?.observe?.(messageInput, { attributes: true, attributeFilter: ['disabled'] });

    render();
    return Object.freeze({
      isSupported: supported,
      isPauseSupported: pauseSupported,
      isEnabled: () => enabled,
      isSpeaking: () => speaking,
      isPaused: () => paused,
      getSpeechRate: () => speechRate,
      setSpeechRate,
      setEnabled,
      speak,
      togglePause,
      cancel: cancelSpeech,
      syncStreamState,
      destroy() {
        cancelSpeech();
        micObserver?.disconnect?.();
        streamObserver?.disconnect?.();
        toggle.removeEventListener?.('click', handleToggle);
        pauseToggle?.removeEventListener?.('click', handlePause);
        rateSelect?.removeEventListener?.('change', handleRateChange);
        composer?.removeEventListener?.('submit', handleSubmit, true);
        documentRef.removeEventListener?.('visibilitychange', handleVisibility);
        documentRef.removeEventListener?.(VOICE_INPUT_STATE_EVENT, handleVoiceInputState);
        if (generatedPauseToggle) pauseToggle?.remove?.();
        if (generatedStatus) status?.remove?.();
        if (generatedRateWrap) rateWrap?.remove?.();
      }
    });
  }

  return Object.freeze({
    STORAGE_KEY,
    VOICE_INPUT_STATE_EVENT,
    VOICE_OUTPUT_STATE_EVENT,
    DEFAULT_SPEECH_RATE,
    SPEECH_RATE_OPTIONS,
    normalizeSpeechRate,
    normalizeSpeechText,
    splitSpeechText,
    installVoiceOutput
  });
});