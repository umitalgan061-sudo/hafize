/**
 * Sesli giriş (Web Speech API) entegrasyonu.
 *
 * Modül tarayıcı dışında da içe aktarılabilir: tüm platform bağımlılıkları
 * `documentRef` ve `root` üzerinden enjekte edilir ve otomatik başlatma yalnızca
 * gerçek bir `document` bulunduğunda çalışır. Bu sayede davranış testleri
 * kaynağı Node altında doğrudan yükleyebilir.
 */

export interface SpeechAlternativeLike {
  readonly transcript?: unknown;
}

export interface SpeechRecognitionEventLike {
  readonly results?: ArrayLike<ArrayLike<SpeechAlternativeLike>> | undefined;
  readonly resultIndex?: number | undefined;
  readonly error?: unknown;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export interface MutationObserverLike {
  observe: (target: unknown, options: { attributes: boolean; attributeFilter: string[] }) => void;
  disconnect: () => void;
}

/** Sesli girişin ihtiyaç duyduğu global yüzey; testlerde sahte bir nesne verilir. */
export interface VoiceInputRoot {
  readonly SpeechRecognition?: SpeechRecognitionConstructor | undefined;
  readonly webkitSpeechRecognition?: SpeechRecognitionConstructor | undefined;
  readonly navigator?: { readonly language?: string | undefined } | undefined;
  readonly Event?: (new (type: string, options?: { bubbles?: boolean }) => unknown) | undefined;
  readonly MutationObserver?: (new (callback: () => void) => MutationObserverLike) | undefined;
  readonly setTimeout?: ((handler: () => void, timeout: number) => number) | undefined;
  readonly clearTimeout?: ((id: number) => void) | undefined;
}

export interface VoiceInputController {
  readonly isSupported: boolean;
  readonly isListening: () => boolean;
  readonly start: () => void;
  readonly stop: () => void;
  readonly destroy: () => void;
}

export const DEFAULT_LANGUAGE = 'tr-TR';
const TOAST_DURATION_MS = 4200;
const DEFAULT_MAX_TRANSCRIPT = 12000;

export function getSpeechRecognitionConstructor(root: VoiceInputRoot | null | undefined): SpeechRecognitionConstructor | null {
  return root?.SpeechRecognition || root?.webkitSpeechRecognition || null;
}

export function normalizeTranscript(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function mergeTranscript(prefix: unknown, transcript: unknown, maxLength: unknown = DEFAULT_MAX_TRANSCRIPT): string {
  const before = typeof prefix === 'string' ? prefix.replace(/\s+$/g, '') : '';
  const spoken = normalizeTranscript(transcript);
  const joined = before && spoken ? `${before} ${spoken}` : before || spoken;
  const limit = Number.isInteger(maxLength) && Number(maxLength) > 0 ? Number(maxLength) : DEFAULT_MAX_TRANSCRIPT;
  return joined.slice(0, limit);
}

export function readRecognitionText(event: SpeechRecognitionEventLike | null | undefined): string {
  const results = event?.results;
  if (!results) return '';
  const chunks: string[] = [];
  const start = Number.isInteger(event?.resultIndex) ? Number(event?.resultIndex) : 0;
  for (let index = start; index < results.length; index += 1) {
    const alternative = results[index]?.[0];
    if (typeof alternative?.transcript === 'string') chunks.push(alternative.transcript);
  }
  return normalizeTranscript(chunks.join(' '));
}

export function mapSpeechError(code: unknown): string {
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

function dispatchInputEvent(input: HTMLTextAreaElement, root: VoiceInputRoot): void {
  const EventCtor = root?.Event;
  if (typeof EventCtor === 'function') input.dispatchEvent(new EventCtor('input', { bubbles: true }) as Event);
  else input.dispatchEvent({ type: 'input', bubbles: true } as unknown as Event);
}

function createAnnouncer(toast: HTMLElement | null, root: VoiceInputRoot): (message: string) => void {
  let timeoutId: number | null = null;
  return (message: string): void => {
    if (!toast || !message) return;
    toast.textContent = message;
    toast.classList?.remove?.('hidden');
    if (timeoutId !== null && typeof root?.clearTimeout === 'function') root.clearTimeout(timeoutId);
    if (typeof root?.setTimeout === 'function') {
      timeoutId = root.setTimeout(() => toast.classList?.add?.('hidden'), TOAST_DURATION_MS);
    }
  };
}

export function installVoiceInput(documentRef: Document, root: VoiceInputRoot): VoiceInputController | null {
  const micButton = documentRef?.querySelector?.<HTMLButtonElement>('#micBtn');
  const input = documentRef?.querySelector?.<HTMLTextAreaElement>('#messageInput');
  if (!micButton || !input) return null;

  const toast = documentRef.querySelector?.<HTMLElement>('#toast') ?? null;
  const announce = createAnnouncer(toast, root);
  const Recognition = getSpeechRecognitionConstructor(root);
  let recognition: SpeechRecognitionLike | null = null;
  let listening = false;
  let prefix = '';

  function renderButton(): void {
    const unavailable = !Recognition;
    micButton!.disabled = Boolean(input!.disabled);
    micButton!.setAttribute?.('aria-pressed', String(listening));
    micButton!.setAttribute?.('aria-label', unavailable
      ? 'Sesli giriş bu tarayıcıda desteklenmiyor'
      : listening
        ? 'Sesli girişi durdur'
        : 'Sesli giriş');
    micButton!.textContent = listening ? '●' : '◉';
    micButton!.title = unavailable
      ? 'Bu tarayıcı konuşma tanımayı desteklemiyor'
      : listening
        ? 'Dinlemeyi durdur'
        : 'Sesli giriş · ses tanıma tarayıcı sağlayıcın tarafından işlenebilir';
  }

  function setListening(next: boolean): void {
    listening = Boolean(next);
    renderButton();
  }

  function stopRecognition(): void {
    if (!recognition || !listening) return;
    try {
      recognition.stop();
    } catch {
      setListening(false);
    }
  }

  function abortRecognition(): void {
    if (!recognition || !listening) return;
    try {
      recognition.abort();
    } catch {
      setListening(false);
    }
  }

  function startRecognition(): void {
    if (!Recognition || input!.disabled || listening) return;
    prefix = input!.value || '';
    recognition = new Recognition();
    recognition.lang = documentRef.documentElement?.lang || root?.navigator?.language || DEFAULT_LANGUAGE;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = (): void => {
      setListening(true);
      announce('Dinleniyor… Ses tanıma tarayıcı sağlayıcın tarafından işlenebilir; metin otomatik gönderilmez.');
    };
    recognition.onresult = (event: SpeechRecognitionEventLike): void => {
      const transcript = readRecognitionText(event);
      if (!transcript) return;
      input!.value = mergeTranscript(prefix, transcript, input!.maxLength);
      dispatchInputEvent(input!, root);
    };
    recognition.onerror = (event: SpeechRecognitionEventLike): void => {
      const message = mapSpeechError(event?.error);
      if (message) announce(message);
    };
    recognition.onend = (): void => {
      recognition = null;
      setListening(false);
      if (!documentRef.hidden) input!.focus?.();
    };

    try {
      recognition.start();
    } catch {
      recognition = null;
      setListening(false);
      announce('Sesli giriş başlatılamadı. Yazmaya devam edebilirsin.');
    }
  }

  function handleClick(event: Partial<MouseEvent>): void {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    if (!Recognition) {
      announce('Bu tarayıcı konuşma tanımayı desteklemiyor. Yazılı giriş kullanılabilir.');
      return;
    }
    if (input!.disabled) return;
    if (listening) stopRecognition();
    else startRecognition();
  }

  function handleVisibilityChange(): void {
    if (documentRef.hidden && listening) abortRecognition();
  }

  micButton.addEventListener?.('click', handleClick as EventListener, true);
  documentRef.addEventListener?.('visibilitychange', handleVisibilityChange);

  const MutationObserverCtor = root?.MutationObserver;
  const observer = typeof MutationObserverCtor === 'function'
    ? new MutationObserverCtor(() => {
        if (input.disabled && listening) stopRecognition();
        renderButton();
      })
    : null;
  observer?.observe?.(input, { attributes: true, attributeFilter: ['disabled'] });

  renderButton();

  return Object.freeze({
    isSupported: Boolean(Recognition),
    isListening: (): boolean => listening,
    start: startRecognition,
    stop: stopRecognition,
    destroy(): void {
      observer?.disconnect?.();
      if (recognition && listening) {
        try { recognition.abort?.(); } catch { /* tarayıcı çoktan kapatmış olabilir */ }
      }
      recognition = null;
      setListening(false);
      micButton.removeEventListener?.('click', handleClick as EventListener, true);
      documentRef.removeEventListener?.('visibilitychange', handleVisibilityChange);
    }
  });
}

const api = Object.freeze({
  DEFAULT_LANGUAGE,
  getSpeechRecognitionConstructor,
  installVoiceInput,
  mapSpeechError,
  mergeTranscript,
  normalizeTranscript,
  readRecognitionText
});

type VoiceInputGlobal = typeof globalThis & {
  HafizeVoiceInput?: typeof api;
  document?: Document;
};

const browserRoot = globalThis as VoiceInputGlobal;
browserRoot.HafizeVoiceInput = api;

/** Yalnızca tarayıcıda otomatik kurulum; Node altında import yan etkisi yoktur. */
if (browserRoot.document) {
  const doc = browserRoot.document;
  const boot = (): void => { installVoiceInput(doc, browserRoot as unknown as VoiceInputRoot); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
