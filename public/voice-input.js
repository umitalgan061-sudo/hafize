(function exposeHafizeVoiceInput(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module?.exports) {
    module.exports = api;
    return;
  }

  root.HafizeVoiceInput = api;
  const install = () => api.installVoiceInput(root.document, root);
  if (root.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(typeof globalThis !== 'undefined' ? globalThis : self, function createHafizeVoiceInput() {
  'use strict';

  const DEFAULT_LANGUAGE = 'tr-TR';
  const TOAST_DURATION_MS = 4200;
  const VOICE_INPUT_STATE_EVENT = 'hafize:voice-input-state';

  function getSpeechRecognitionConstructor(root) {
    return root?.SpeechRecognition || root?.webkitSpeechRecognition || null;
  }

  function normalizeTranscript(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function mergeTranscript(prefix, transcript, maxLength = 12000) {
    const before = typeof prefix === 'string' ? prefix.replace(/\s+$/g, '') : '';
    const spoken = normalizeTranscript(transcript);
    const joined = before && spoken ? `${before} ${spoken}` : before || spoken;
    const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 12000;
    return joined.slice(0, limit);
  }

  function readRecognitionText(event) {
    if (!event?.results) return '';
    const chunks = [];
    const start = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for (let index = start; index < event.results.length; index += 1) {
      const alternative = event.results[index]?.[0];
      if (typeof alternative?.transcript === 'string') chunks.push(alternative.transcript);
    }
    return normalizeTranscript(chunks.join(' '));
  }

  function mapSpeechError(code) {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofon erişimini kontrol edebilirsin.';
      case 'audio-capture':
        return 'Kullanılabilir bir mikrofon bulunamadı.';
      case 'no-speech':
        return 'Ses algılanmadı. Mikrofonu tekrar deneyebilirsin.';
      case 'network':
        return 'Tarayıcının ses tanıma servisine ulaşılamadı.';
      case 'aborted':
        return '';
      default:
        return 'Sesli giriş tamamlanamadı. Yazmaya devam edebilirsin.';
    }
  }

  function dispatchInputEvent(input, root) {
    const EventCtor = root?.Event;
    if (typeof EventCtor === 'function') input.dispatchEvent(new EventCtor('input', { bubbles: true }));
    else input.dispatchEvent({ type: 'input', bubbles: true });
  }

  function dispatchVoiceInputState(documentRef, root, listening) {
    if (typeof documentRef?.dispatchEvent !== 'function') return false;
    const detail = Object.freeze({ listening: Boolean(listening), source: 'voice-input' });
    const CustomEventCtor = root?.CustomEvent;
    let event;
    if (typeof CustomEventCtor === 'function') {
      event = new CustomEventCtor(VOICE_INPUT_STATE_EVENT, { detail });
    } else {
      const EventCtor = root?.Event;
      if (typeof EventCtor === 'function') {
        event = new EventCtor(VOICE_INPUT_STATE_EVENT);
        try { Object.defineProperty(event, 'detail', { value: detail }); } catch { return false; }
      } else {
        event = { type: VOICE_INPUT_STATE_EVENT, detail };
      }
    }
    documentRef.dispatchEvent(event);
    return true;
  }

  function createAnnouncer(toast, root) {
    let timeoutId = null;
    const announce = (message) => {
      if (!toast || !message) return;
      toast.textContent = message;
      toast.classList?.remove?.('hidden');
      if (timeoutId && typeof root?.clearTimeout === 'function') root.clearTimeout(timeoutId);
      if (typeof root?.setTimeout === 'function') {
        timeoutId = root.setTimeout(() => {
          timeoutId = null;
          toast.classList?.add?.('hidden');
        }, TOAST_DURATION_MS);
      }
    };
    announce.dispose = () => {
      if (timeoutId != null && typeof root?.clearTimeout === 'function') root.clearTimeout(timeoutId);
      timeoutId = null;
    };
    return announce;
  }

  function snapshotAttribute(element, name) {
    const present = Boolean(element?.hasAttribute?.(name));
    return Object.freeze({ present, value: present ? element.getAttribute(name) : null });
  }

  function restoreAttribute(element, name, snapshot) {
    if (snapshot.present) element.setAttribute?.(name, snapshot.value ?? '');
    else element.removeAttribute?.(name);
  }

  function installVoiceInput(documentRef, root) {
    const micButton = documentRef?.querySelector?.('#micBtn');
    const input = documentRef?.querySelector?.('#messageInput');
    if (!micButton || !input) return null;

    const toast = documentRef.querySelector?.('#toast');
    const announce = createAnnouncer(toast, root);
    const Recognition = getSpeechRecognitionConstructor(root);
    const baseline = Object.freeze({
      disabled: Boolean(micButton.disabled),
      textContent: micButton.textContent,
      title: micButton.title,
      ariaPressed: snapshotAttribute(micButton, 'aria-pressed'),
      ariaLabel: snapshotAttribute(micButton, 'aria-label')
    });
    let recognition = null;
    let listening = false;
    let prefix = '';
    let destroyed = false;

    function renderButton() {
      if (destroyed) return;
      const unavailable = !Recognition;
      const busy = Boolean(input.disabled);
      micButton.disabled = baseline.disabled || busy;
      micButton.setAttribute?.('aria-pressed', String(listening));
      micButton.setAttribute?.('aria-label', unavailable
        ? 'Sesli giriş bu tarayıcıda desteklenmiyor'
        : listening
          ? 'Sesli girişi durdur'
          : 'Sesli giriş');
      micButton.textContent = listening ? '●' : '◉';
      micButton.title = unavailable
        ? 'Bu tarayıcı konuşma tanımayı desteklemiyor'
        : listening
          ? 'Dinlemeyi durdur'
          : 'Sesli giriş · ses tanıma tarayıcı sağlayıcın tarafından işlenebilir';
    }

    function setListening(next) {
      const target = !destroyed && Boolean(next);
      const changed = listening !== target;
      listening = target;
      renderButton();
      if (changed) dispatchVoiceInputState(documentRef, root, listening);
    }

    function stopRecognition() {
      if (destroyed || !recognition || !listening) return;
      try {
        recognition.stop();
      } catch {
        setListening(false);
      }
    }

    function abortRecognition() {
      if (destroyed || !recognition || !listening) return;
      try {
        recognition.abort();
      } catch {
        setListening(false);
      }
    }

    function startRecognition() {
      if (destroyed || !Recognition || input.disabled || baseline.disabled || listening) return;
      prefix = input.value || '';
      const current = new Recognition();
      recognition = current;
      current.lang = documentRef.documentElement?.lang || root?.navigator?.language || DEFAULT_LANGUAGE;
      current.interimResults = true;
      current.continuous = false;
      current.maxAlternatives = 1;

      current.onstart = () => {
        if (destroyed || recognition !== current) return;
        setListening(true);
        announce('Dinleniyor… Ses tanıma tarayıcı sağlayıcın tarafından işlenebilir; metin otomatik gönderilmez.');
      };
      current.onresult = (event) => {
        if (destroyed || recognition !== current) return;
        const transcript = readRecognitionText(event);
        if (!transcript) return;
        input.value = mergeTranscript(prefix, transcript, input.maxLength);
        dispatchInputEvent(input, root);
      };
      current.onerror = (event) => {
        if (destroyed || recognition !== current) return;
        const message = mapSpeechError(event?.error);
        if (message) announce(message);
      };
      current.onend = () => {
        if (destroyed || recognition !== current) return;
        recognition = null;
        setListening(false);
        if (!documentRef.hidden) input.focus?.();
      };

      try {
        setListening(true);
        current.start();
      } catch {
        if (recognition === current) recognition = null;
        setListening(false);
        if (!destroyed) announce('Sesli giriş başlatılamadı. Yazmaya devam edebilirsin.');
      }
    }

    function handleClick(event) {
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      if (destroyed) return;
      if (!Recognition) {
        announce('Bu tarayıcı konuşma tanımayı desteklemiyor. Yazılı giriş kullanılabilir.');
        return;
      }
      if (input.disabled || baseline.disabled) return;
      if (listening) stopRecognition();
      else startRecognition();
    }

    function handleVisibilityChange() {
      if (!destroyed && documentRef.hidden && listening) abortRecognition();
    }

    micButton.addEventListener?.('click', handleClick, true);
    documentRef.addEventListener?.('visibilitychange', handleVisibilityChange);

    const MutationObserverCtor = root?.MutationObserver;
    const observer = typeof MutationObserverCtor === 'function'
      ? new MutationObserverCtor(() => {
          if (destroyed) return;
          if (input.disabled && listening) stopRecognition();
          renderButton();
        })
      : null;
    observer?.observe?.(input, { attributes: true, attributeFilter: ['disabled'] });

    renderButton();

    return Object.freeze({
      isSupported: Boolean(Recognition),
      isListening: () => listening,
      start: startRecognition,
      stop: stopRecognition,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        observer?.disconnect?.();
        announce.dispose?.();
        const active = recognition;
        recognition = null;
        const wasListening = listening;
        listening = false;
        if (active && wasListening) {
          try { active.abort?.(); } catch { /* no-op */ }
        }
        if (wasListening) dispatchVoiceInputState(documentRef, root, false);
        micButton.removeEventListener?.('click', handleClick, true);
        documentRef.removeEventListener?.('visibilitychange', handleVisibilityChange);
        micButton.disabled = baseline.disabled;
        micButton.textContent = baseline.textContent;
        micButton.title = baseline.title;
        restoreAttribute(micButton, 'aria-pressed', baseline.ariaPressed);
        restoreAttribute(micButton, 'aria-label', baseline.ariaLabel);
      }
    });
  }

  return Object.freeze({
    DEFAULT_LANGUAGE,
    VOICE_INPUT_STATE_EVENT,
    dispatchVoiceInputState,
    getSpeechRecognitionConstructor,
    installVoiceInput,
    mapSpeechError,
    mergeTranscript,
    normalizeTranscript,
    readRecognitionText
  });
});
