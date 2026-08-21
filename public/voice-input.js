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
  const activeInstallations = new WeakMap();

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

  function createTranscriptSession() {
    const segments = [];

    function apply(event) {
      const results = event?.results;
      if (!results || !Number.isSafeInteger(results.length) || results.length < 0) {
        return Object.freeze({ changed: false, text: text(), finalText: finalText(), segmentCount: segments.length });
      }

      const requestedStart = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
      const start = Math.max(0, Math.min(requestedStart, results.length));
      let changed = false;

      if (segments.length > results.length) {
        segments.length = results.length;
        changed = true;
      }

      for (let index = start; index < results.length; index += 1) {
        const result = results[index];
        const transcript = normalizeTranscript(result?.[0]?.transcript);
        const isFinal = result?.isFinal === true;
        const previous = segments[index];

        if (!transcript) {
          if (previous !== undefined) {
            segments[index] = null;
            changed = true;
          }
          continue;
        }

        if (!previous || previous.text !== transcript || previous.isFinal !== isFinal) {
          segments[index] = Object.freeze({ text: transcript, isFinal });
          changed = true;
        }
      }

      return Object.freeze({ changed, text: text(), finalText: finalText(), segmentCount: segments.length });
    }

    function text() {
      return normalizeTranscript(segments.filter(Boolean).map((segment) => segment.text).join(' '));
    }

    function finalText() {
      return normalizeTranscript(segments.filter((segment) => segment?.isFinal).map((segment) => segment.text).join(' '));
    }

    function reset() {
      segments.length = 0;
    }

    function snapshot() {
      return Object.freeze(segments.map((segment) => segment ? Object.freeze({ ...segment }) : null));
    }

    return Object.freeze({ apply, text, finalText, reset, snapshot });
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
    if (activeInstallations.has(micButton)) throw new Error('VOICE_INPUT_ALREADY_INSTALLED');

    const toast = documentRef.querySelector?.('#toast');
    const toastBaseline = toast ? Object.freeze({
      textContent: toast.textContent,
      className: snapshotAttribute(toast, 'class')
    }) : null;
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
    let transcriptSession = null;
    let destroyed = false;
    let observer = null;
    let controller = null;

    function restoreOwnedDom() {
      micButton.disabled = baseline.disabled;
      micButton.textContent = baseline.textContent;
      micButton.title = baseline.title;
      restoreAttribute(micButton, 'aria-pressed', baseline.ariaPressed);
      restoreAttribute(micButton, 'aria-label', baseline.ariaLabel);
      if (toast && toastBaseline) {
        toast.textContent = toastBaseline.textContent;
        restoreAttribute(toast, 'class', toastBaseline.className);
      }
    }

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

    function releaseRecognition(active, method) {
      if (!active) return false;
      if (recognition === active) recognition = null;
      transcriptSession = null;
      setListening(false);
      try { active?.[method]?.(); } catch { /* browser recognition may already be ending */ }
      return true;
    }

    function stopRecognition() {
      if (destroyed || !recognition) return false;
      return releaseRecognition(recognition, 'stop');
    }

    function abortRecognition() {
      if (destroyed || !recognition) return false;
      return releaseRecognition(recognition, 'abort');
    }

    function startRecognition() {
      if (destroyed || !Recognition || input.disabled || baseline.disabled || listening || recognition) return;
      prefix = input.value || '';
      transcriptSession = createTranscriptSession();
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
        if (destroyed || recognition !== current || !transcriptSession) return;
        const snapshot = transcriptSession.apply(event);
        if (!snapshot.changed) return;
        input.value = mergeTranscript(prefix, snapshot.text, input.maxLength);
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
        transcriptSession = null;
        setListening(false);
        if (!documentRef.hidden) input.focus?.();
      };

      try {
        setListening(true);
        current.start();
      } catch {
        if (recognition === current) recognition = null;
        transcriptSession = null;
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
      if (listening || recognition) stopRecognition();
      else startRecognition();
    }

    function handleVisibilityChange() {
      if (!destroyed && documentRef.hidden && recognition) abortRecognition();
    }

    function removeBindings() {
      observer?.disconnect?.();
      micButton.removeEventListener?.('click', handleClick, true);
      documentRef.removeEventListener?.('visibilitychange', handleVisibilityChange);
    }

    try {
      micButton.addEventListener?.('click', handleClick, true);
      documentRef.addEventListener?.('visibilitychange', handleVisibilityChange);

      const MutationObserverCtor = root?.MutationObserver;
      observer = typeof MutationObserverCtor === 'function'
        ? new MutationObserverCtor(() => {
            if (destroyed) return;
            if (input.disabled && recognition) stopRecognition();
            renderButton();
          })
        : null;
      observer?.observe?.(input, { attributes: true, attributeFilter: ['disabled'] });

      renderButton();
    } catch (error) {
      destroyed = true;
      removeBindings();
      announce.dispose?.();
      transcriptSession = null;
      restoreOwnedDom();
      throw error;
    }

    controller = Object.freeze({
      isSupported: Boolean(Recognition),
      isListening: () => !destroyed && listening,
      start: startRecognition,
      stop: stopRecognition,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        removeBindings();
        announce.dispose?.();
        const active = recognition;
        recognition = null;
        transcriptSession = null;
        const wasListening = listening;
        listening = false;
        if (active) {
          try { active.abort?.(); } catch { /* no-op */ }
        }
        if (wasListening) dispatchVoiceInputState(documentRef, root, false);
        restoreOwnedDom();
        if (activeInstallations.get(micButton) === controller) activeInstallations.delete(micButton);
      }
    });
    activeInstallations.set(micButton, controller);
    return controller;
  }

  return Object.freeze({
    DEFAULT_LANGUAGE,
    VOICE_INPUT_STATE_EVENT,
    createTranscriptSession,
    dispatchVoiceInputState,
    getSpeechRecognitionConstructor,
    installVoiceInput,
    mapSpeechError,
    mergeTranscript,
    normalizeTranscript,
    readRecognitionText
  });
});