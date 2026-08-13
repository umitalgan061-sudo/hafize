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
  const MAX_SPEECH_LENGTH = 2400;
  const MAX_CHUNK_LENGTH = 240;

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
    if (!toggle || !card) return null;

    const synth = root?.speechSynthesis;
    const Utterance = root?.SpeechSynthesisUtterance;
    const supported = Boolean(synth && typeof synth.speak === 'function' && typeof Utterance === 'function');
    let enabled = supported && readStoredEnabled(root?.localStorage);
    let speaking = false;
    let thinking = false;
    let queue = [];

    function render() {
      toggle.disabled = !supported;
      toggle.setAttribute?.('aria-pressed', String(enabled));
      toggle.textContent = supported
        ? enabled ? 'Sesli yanıt açık' : 'Sesli yanıt kapalı'
        : 'Sesli yanıt desteklenmiyor';
      toggle.title = supported
        ? 'Hafize yanıtlarını bu cihazın yerleşik sesiyle oku'
        : 'Bu tarayıcı Speech Synthesis API desteklemiyor';
      card.classList?.toggle?.('speaking', speaking);
      card.classList?.toggle?.('thinking', thinking && !speaking);
    }

    function cancelSpeech() {
      queue = [];
      speaking = false;
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

    function speakNext() {
      if (!enabled || !supported || !queue.length) {
        speaking = false;
        render();
        return;
      }
      const text = queue.shift();
      const utterance = new Utterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.98;
      utterance.pitch = 1;
      const voice = findTurkishVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = speakNext;
      utterance.onerror = () => {
        queue = [];
        speaking = false;
        render();
      };
      speaking = true;
      thinking = false;
      render();
      try { synth.speak(utterance); } catch { utterance.onerror(); }
    }

    function speak(value) {
      if (!enabled || !supported) return false;
      const chunks = splitSpeechText(value);
      if (!chunks.length) return false;
      cancelSpeech();
      queue = chunks;
      speakNext();
      return true;
    }

    function setEnabled(next) {
      enabled = supported && Boolean(next);
      writeStoredEnabled(root?.localStorage, enabled);
      if (!enabled) cancelSpeech();
      render();
      return enabled;
    }

    function handleToggle() { setEnabled(!enabled); }
    function handleAssistantStart() {
      thinking = true;
      if (speaking) cancelSpeech();
      render();
    }
    function handleAssistantComplete(event) {
      thinking = false;
      render();
      speak(event?.detail?.content || '');
    }
    function handleAssistantIdle() {
      thinking = false;
      render();
    }
    function handleUserSubmit() { cancelSpeech(); }
    function handleVisibility() {
      if (documentRef.hidden) cancelSpeech();
    }

    toggle.addEventListener?.('click', handleToggle);
    root?.addEventListener?.('hafize:assistant-start', handleAssistantStart);
    root?.addEventListener?.('hafize:assistant-complete', handleAssistantComplete);
    root?.addEventListener?.('hafize:assistant-idle', handleAssistantIdle);
    root?.addEventListener?.('hafize:user-submit', handleUserSubmit);
    documentRef.addEventListener?.('visibilitychange', handleVisibility);

    const Observer = root?.MutationObserver;
    const observer = micButton && typeof Observer === 'function'
      ? new Observer(() => {
          if (micButton.getAttribute?.('aria-pressed') === 'true') cancelSpeech();
        })
      : null;
    observer?.observe?.(micButton, { attributes: true, attributeFilter: ['aria-pressed'] });

    render();
    return Object.freeze({
      isSupported: supported,
      isEnabled: () => enabled,
      isSpeaking: () => speaking,
      setEnabled,
      speak,
      cancel: cancelSpeech,
      destroy() {
        cancelSpeech();
        observer?.disconnect?.();
        toggle.removeEventListener?.('click', handleToggle);
        root?.removeEventListener?.('hafize:assistant-start', handleAssistantStart);
        root?.removeEventListener?.('hafize:assistant-complete', handleAssistantComplete);
        root?.removeEventListener?.('hafize:assistant-idle', handleAssistantIdle);
        root?.removeEventListener?.('hafize:user-submit', handleUserSubmit);
        documentRef.removeEventListener?.('visibilitychange', handleVisibility);
      }
    });
  }

  return Object.freeze({ STORAGE_KEY, normalizeSpeechText, splitSpeechText, installVoiceOutput });
});
