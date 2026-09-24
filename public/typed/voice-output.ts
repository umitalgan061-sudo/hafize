/**
 * Sesli yanıt (Speech Synthesis) entegrasyonu.
 *
 * Sesli yanıt yalnızca kullanıcı açıkça açtığında çalışır; tercih cihazda
 * saklanır ve sunucuya gönderilmez. Modül tarayıcı dışında da içe aktarılabilir:
 * platform bağımlılıkları `documentRef` ve `root` üzerinden enjekte edilir.
 */

export interface SpeechSynthesisVoiceLike {
  readonly lang?: string | undefined;
  readonly name?: string | undefined;
}

export interface SpeechSynthesisUtteranceLike {
  lang?: string;
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoiceLike | null;
  onend?: (() => void) | null;
  onerror?: (() => void) | null;
}

export type SpeechSynthesisUtteranceConstructor = new (text: string) => SpeechSynthesisUtteranceLike;

export interface SpeechSynthesisLike {
  speak: (utterance: SpeechSynthesisUtteranceLike) => void;
  cancel?: () => void;
  getVoices?: () => readonly SpeechSynthesisVoiceLike[];
}

export interface VoiceOutputObserver {
  observe: (target: unknown, options: { attributes: boolean; attributeFilter: string[] }) => void;
  disconnect: () => void;
}

export interface ChatMarkdownBridge {
  readonly sourceFor?: ((node: unknown) => string | null | undefined) | undefined;
}

/** Sesli yanıtın ihtiyaç duyduğu global yüzey; testlerde sahte bir nesne verilir. */
export interface VoiceOutputRoot {
  readonly speechSynthesis?: SpeechSynthesisLike | undefined;
  readonly SpeechSynthesisUtterance?: SpeechSynthesisUtteranceConstructor | undefined;
  readonly localStorage?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  readonly MutationObserver?: (new (callback: () => void) => VoiceOutputObserver) | undefined;
  readonly HafizeChatMarkdown?: ChatMarkdownBridge | undefined;
}

export interface VoiceOutputController {
  readonly isSupported: boolean;
  readonly isEnabled: () => boolean;
  readonly isSpeaking: () => boolean;
  readonly setEnabled: (next: boolean) => boolean;
  readonly speak: (value: string) => boolean;
  readonly cancel: () => void;
  readonly syncStreamState: () => void;
  readonly destroy: () => void;
}

export const STORAGE_KEY = 'hafize.voiceOutput.v1';
const MAX_SPEECH_LENGTH = 2400;
const MAX_CHUNK_LENGTH = 240;

export function normalizeSpeechText(value: unknown): string {
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

export function splitSpeechText(value: unknown, maxLength: unknown = MAX_CHUNK_LENGTH): string[] {
  const text = normalizeSpeechText(value);
  if (!text) return [];
  const limit = Number.isInteger(maxLength) && Number(maxLength) >= 80 ? Number(maxLength) : MAX_CHUNK_LENGTH;
  const sentences = text.match(/[^.!?…]+[.!?…]?/g) || [text];
  const chunks: string[] = [];
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
    current = '';
    for (const word of clean.split(' ')) {
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

function readStoredEnabled(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try { return storage?.getItem?.(STORAGE_KEY) === 'true'; } catch { return false; }
}

function writeStoredEnabled(storage: Pick<Storage, 'setItem'> | undefined, enabled: boolean): void {
  try { storage?.setItem?.(STORAGE_KEY, String(Boolean(enabled))); } catch { /* depolama opsiyoneldir */ }
}

export function installVoiceOutput(documentRef: Document, root: VoiceOutputRoot): VoiceOutputController | null {
  const toggle = documentRef?.querySelector?.<HTMLButtonElement>('#voiceOutputToggle');
  const card = documentRef?.querySelector?.<HTMLElement>('.voice-card');
  const micButton = documentRef?.querySelector?.<HTMLElement>('#micBtn');
  const messageInput = documentRef?.querySelector?.<HTMLTextAreaElement>('#messageInput');
  const composer = documentRef?.querySelector?.<HTMLFormElement>('#composer');
  const messages = documentRef?.querySelector?.<HTMLElement>('#messages');
  if (!toggle || !card) return null;

  const synth = root?.speechSynthesis;
  const Utterance = root?.SpeechSynthesisUtterance;
  const supported = Boolean(synth && typeof synth.speak === 'function' && typeof Utterance === 'function');
  let enabled = supported && readStoredEnabled(root?.localStorage);
  let speaking = false;
  let thinking = false;
  let queue: string[] = [];

  function render(): void {
    toggle!.disabled = !supported;
    toggle!.setAttribute?.('aria-pressed', String(enabled));
    toggle!.textContent = supported
      ? enabled ? 'Sesli yanıt açık' : 'Sesli yanıt kapalı'
      : 'Sesli yanıt desteklenmiyor';
    toggle!.title = supported
      ? 'Hafize yanıtlarını bu cihazın yerleşik sesiyle oku'
      : 'Bu tarayıcı Speech Synthesis API desteklemiyor';
    card!.classList?.toggle?.('speaking', speaking);
    card!.classList?.toggle?.('thinking', thinking && !speaking);
  }

  function cancelSpeech(): void {
    queue = [];
    speaking = false;
    try { synth?.cancel?.(); } catch { /* tarayıcı kuyruğu zaten boş olabilir */ }
    render();
  }

  function findTurkishVoice(): SpeechSynthesisVoiceLike | null {
    try {
      const voices = synth?.getVoices?.() || [];
      return voices.find((voice) => String(voice?.lang || '').toLowerCase().startsWith('tr')) || null;
    } catch {
      return null;
    }
  }

  function speakNext(): void {
    const next = queue.shift();
    if (!enabled || !supported || !Utterance || !synth || next === undefined) {
      speaking = false;
      render();
      return;
    }
    const utterance = new Utterance(next);
    utterance.lang = 'tr-TR';
    utterance.rate = 0.98;
    utterance.pitch = 1;
    const voice = findTurkishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = speakNext;
    utterance.onerror = (): void => {
      queue = [];
      speaking = false;
      render();
    };
    speaking = true;
    thinking = false;
    render();
    try { synth.speak(utterance); } catch { utterance.onerror?.(); }
  }

  function speak(value: string): boolean {
    if (!enabled || !supported || documentRef?.hidden) return false;
    const chunks = splitSpeechText(value);
    if (!chunks.length) return false;
    cancelSpeech();
    queue = chunks;
    speakNext();
    return true;
  }

  function setEnabled(next: boolean): boolean {
    enabled = supported && Boolean(next);
    writeStoredEnabled(root?.localStorage, enabled);
    if (!enabled) cancelSpeech();
    render();
    return enabled;
  }

  function latestAssistantText(): string {
    const nodes = messages?.querySelectorAll?.('.message.assistant .content') || [];
    const node = nodes.length ? nodes[nodes.length - 1] : null;
    if (!node) return '';
    // Markdown kaynağı render edilmiş düğüme tercih edilir: `normalizeSpeechText`
    // kod bloklarını ve bağlantıları zaten ayıklar, `textContent` ise bu
    // işaretleri kaybetmiştir.
    const source = root.HafizeChatMarkdown?.sourceFor?.(node);
    return source || node.textContent || '';
  }

  function syncStreamState(): void {
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

  function handleToggle(): void { setEnabled(!enabled); }
  function handleSubmit(): void { cancelSpeech(); }
  function handleVisibility(): void {
    if (documentRef.hidden) cancelSpeech();
  }

  toggle.addEventListener?.('click', handleToggle);
  composer?.addEventListener?.('submit', handleSubmit, true);
  documentRef.addEventListener?.('visibilitychange', handleVisibility);

  const Observer = root?.MutationObserver;
  const micObserver = micButton && typeof Observer === 'function'
    ? new Observer(() => {
        if (micButton.getAttribute?.('aria-pressed') === 'true') cancelSpeech();
      })
    : null;
  if (micButton) micObserver?.observe?.(micButton, { attributes: true, attributeFilter: ['aria-pressed'] });

  const streamObserver = messageInput && typeof Observer === 'function'
    ? new Observer(syncStreamState)
    : null;
  if (messageInput) streamObserver?.observe?.(messageInput, { attributes: true, attributeFilter: ['disabled'] });

  render();
  return Object.freeze({
    isSupported: supported,
    isEnabled: (): boolean => enabled,
    isSpeaking: (): boolean => speaking,
    setEnabled,
    speak,
    cancel: cancelSpeech,
    syncStreamState,
    destroy(): void {
      cancelSpeech();
      micObserver?.disconnect?.();
      streamObserver?.disconnect?.();
      toggle.removeEventListener?.('click', handleToggle);
      composer?.removeEventListener?.('submit', handleSubmit, true);
      documentRef.removeEventListener?.('visibilitychange', handleVisibility);
    }
  });
}

const api = Object.freeze({ STORAGE_KEY, normalizeSpeechText, splitSpeechText, installVoiceOutput });

type VoiceOutputGlobal = typeof globalThis & {
  HafizeVoiceOutput?: typeof api;
  document?: Document;
};

const browserRoot = globalThis as VoiceOutputGlobal;
browserRoot.HafizeVoiceOutput = api;

/** Yalnızca tarayıcıda otomatik kurulum; Node altında import yan etkisi yoktur. */
if (browserRoot.document) {
  const doc = browserRoot.document;
  const boot = (): void => { installVoiceOutput(doc, browserRoot as unknown as VoiceOutputRoot); };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
