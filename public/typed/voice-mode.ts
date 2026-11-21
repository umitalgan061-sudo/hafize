// Voice chat screen. The composer's microphone opens a full-screen conversation with Hafize:
// listen → send what was said → read the reply aloud → listen again, until the screen is closed.
// It drives the existing pieces instead of duplicating them: the composer form sends the message
// (app-shell.ts), voice-output.ts speaks (hafize:voice-output-speak), and while the screen is open
// it reports the microphone as busy (hafize:voice-input-state) so hands-free and the composer
// voice panel stay out of the way. Dictation into the composer remains on Ctrl+Shift+M.

import { createVoiceOrb, type OrbMood, type VoiceOrb } from './voice-orb.ts';
import { PIPER_PREFIX, SPEAKER_KEY, downloadedKeys, loadCatalog } from './voice-library.ts';

/** A streaming reply is read as short, *complete* phrases to minimize time to first sound.
 * The cursor uses character offsets in the raw model response (not normalized speech).
 * Never cut an open fenced code block; voice-output omits code safely once completed.
 */
export function nextSpeakable(text: string, from: number, done = false): { piece: string; end: number } {
  const offset = Number.isSafeInteger(from) && from > 0 ? Math.min(from, text.length) : 0;
  if (done) return { piece: text.slice(offset), end: text.length };
  const fences = text.match(/```/g)?.length ?? 0;
  const safe = fences % 2 ? text.lastIndexOf('```') : text.length;
  const pending = text.slice(offset, Math.max(offset, safe));
  if (!pending.trim()) return { piece: '', end: offset };
  // Prefer the earliest full sentence rather than batching several into one slow TTS job.
  // Avoid decimal points, years, and the 1. used to number list items.
  const sentence = /(?<!\d)[.!?…]+["'”’)]*\s+|\n+/gu.exec(pending);
  if (sentence) {
    const end = sentence.index + sentence[0].length;
    return { piece: pending.slice(0, end), end: offset + end };
  }
  // When the model writes a very long unpunctuated sentence, read a natural pause
  // instead of remaining in "thinking" until the entire response arrives.
  if (pending.length < 130) return { piece: '', end: offset };
  const window = pending.slice(0, Math.min(210, pending.length));
  let cut = 0;
  for (const match of window.matchAll(/(?<!\d)[,;:—]\s+/gu)) {
    const end = match.index + match[0].length;
    if (end >= 75) { cut = end; break; }
  }
  if (!cut) {
    for (const match of window.matchAll(/\s+/gu)) {
      const end = match.index + match[0].length;
      if (end >= 120) { cut = end; break; }
    }
  }
  if (!cut) return { piece: '', end: offset };
  return { piece: pending.slice(0, cut), end: offset + cut };
}

export type VoiceModeState = 'closed' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused';
export interface VoiceModeController { readonly state: () => VoiceModeState; readonly open: () => void; readonly close: () => void; readonly destroy: () => void; }

const SPEAK_EVENT = 'hafize:voice-output-speak';
const STOP_EVENT = 'hafize:voice-output-stop';
const OUTPUT_STATE_EVENT = 'hafize:voice-output-state';
const OUTPUT_PROGRESS_EVENT = 'hafize:voice-output-progress';
const INPUT_STATE_EVENT = 'hafize:voice-input-state';
const RATE_KEY = 'hafize.voiceOutput.rate.v1';
const VOICE_KEY = 'hafize.voiceOutput.voice.v1';
const CAPTIONS_KEY = 'hafize.voiceMode.captions.v1';
const ORIGIN = 'voice-mode';
const SEND_TIMEOUT_MS = 4000;
const FEED_INTERVAL_MS = 150;
const MAX_SILENT_RETRIES = 4;
const END_OF_TURN_MS = 700;
const RESTART_DELAY_MS = 450;
const RECOGNITION_START_TIMEOUT_MS = 6000;
const RECOGNITION_STOP_TIMEOUT_MS = 1800;
const IOS_NATURAL_END_GRACE_MS = 3500;

/** Browser recognition has no permanent full-duplex stream. On iOS, prefer
 * natural end-of-utterance to forced stop() because some Safari versions lose
 * the next microphone session entirely after a forced stop.
 */
export function recognitionProfile(userAgent: unknown): {
  continuous: boolean; awaitNaturalEnd: boolean; noResultTimeoutMs: number; resumeAfterSpeechMs: number;
} {
  const ios = typeof userAgent === 'string' && /iPhone|iPad|iPod|Macintosh[^)]*Mobile/i.test(userAgent);
  return { continuous: !ios, awaitNaturalEnd: ios,
    noResultTimeoutMs: ios ? 14_000 : 22_000,
    resumeAfterSpeechMs: ios ? 850 : 120 };
}

export function statusText(state: VoiceModeState): string {
  switch (state) {
    case 'listening': return 'Dinliyorum…';
    case 'thinking': return 'Düşünüyor…';
    case 'speaking': return 'Hafize konuşuyor · sözünü kesmek için dokun';
    case 'paused': return 'Mikrofon kapalı';
    case 'idle': return 'Konuşmak için küreye dokun';
    default: return '';
  }
}

/** Final + interim text of a recognition event, read from index 0 (see voice-input.ts). */
export function readTranscript(results: ArrayLike<ArrayLike<{ transcript?: unknown }> & { isFinal?: boolean }> | null | undefined): { final: string; interim: string } {
  const final: string[] = [];
  const interim: string[] = [];
  for (let i = 0; i < (results?.length ?? 0); i += 1) {
    const result = results![i];
    const text = typeof result?.[0]?.transcript === 'string' ? String(result[0].transcript) : '';
    if (result?.isFinal) final.push(text); else interim.push(text);
  }
  const clean = (parts: string[]) => parts.join(' ').replace(/\s+/g, ' ').trim();
  return { final: clean(final), interim: clean(interim) };
}

/** A DOM redraw creates new elements for old messages; only a new message id is a new answer. */
export function isFreshVoiceReply(role: string | null, id: string | null, previousId: string | null): boolean {
  return role === 'assistant' && Boolean(id) && id !== previousId;
}

/** How many characters fit in the caption's lines, so text is trimmed on purpose, not clipped mid-line. */
export function captionCapacity(width: number, fontSize: number, lines = 3): number {
  if (!(width > 0) || !(fontSize > 0)) return 180;
  return Math.max(40, Math.min(240, Math.floor(width / (fontSize * 0.56)) * lines));
}

/** The latest words of what the user is saying; the start scrolls away, not the newest words. */
export function captionTail(text: string, size: number): string {
  return text.length > size ? `…${text.slice(text.length - size + 1).trimStart()}` : text;
}

/** [before, word, after] around the spoken word, sized by captionCapacity. */
export function captionWindow(text: unknown, charIndex: number, charLength: number, size = 180): [string, string, string] {
  const value = typeof text === 'string' ? text : '';
  if (!value) return ['', '', ''];
  if (!Number.isInteger(charIndex) || charIndex < 0 || charIndex >= value.length) {
    return [value.length > size ? `${value.slice(0, size - 1).trimEnd()}…` : value, '', ''];
  }
  const length = Math.max(0, Math.min(charLength | 0, value.length - charIndex));
  const lead = Math.min(charIndex, Math.floor(size * 0.35));
  const from = charIndex - lead;
  const to = Math.min(value.length, from + size);
  return [(from > 0 ? '…' : '') + value.slice(from, charIndex), value.slice(charIndex, charIndex + length), value.slice(charIndex + length, to) + (to < value.length ? '…' : '')];
}

const ICONS = {
  captions: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 11h4M13 11h4M7 15h7"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};

const TEMPLATE = `
<div class="vm-backdrop" aria-hidden="true"></div>
<header class="vm-top">
  <button type="button" class="vm-icon vm-captions" aria-pressed="true" aria-label="Altyazıyı gizle" title="Altyazı">${ICONS.captions}</button>
  <div class="vm-title"><strong>Hafize</strong><span>sesli sohbet</span></div>
  <button type="button" class="vm-icon vm-settings-btn" aria-expanded="false" aria-controls="vmSettings" aria-label="Ses ayarları" title="Ses ayarları">${ICONS.settings}</button>
</header>
<section class="vm-settings" id="vmSettings" hidden aria-label="Ses ayarları">
  <label class="vm-field"><span>Konuşma hızı <output class="vm-rate-out">1.00×</output></span><input class="vm-rate" type="range" min="0.7" max="1.5" step="0.05" value="1"></label>
  <label class="vm-field"><span>Ses</span><select class="vm-voice"><option value="">Otomatik (en doğal Türkçe ses)</option></select></label>
  <button type="button" class="vm-sample">▶ Örnek dinle</button>
</section>
<main class="vm-stage">
  <section class="vm-camera-host" aria-label="Görüşme kamerası"><button class="vm-camera-start soft-btn" type="button">Kamerayı aç</button></section>
  <button type="button" class="vm-orb" aria-label="Konuşmaya başla">
    <span class="vm-orb-fallback" aria-hidden="true"></span>
    <canvas class="vm-canvas" aria-hidden="true"></canvas>
  </button>
  <p class="vm-status" role="status" aria-live="polite"></p>
  <p class="vm-caption" aria-hidden="true"><span class="vm-cap-before"></span><mark class="vm-cap-word"></mark><span class="vm-cap-after"></span></p>
</main>
<footer class="vm-bar">
  <form class="vm-input">
    <button type="button" class="vm-plus" aria-label="Dosya ekle" title="Dosya ekle">${ICONS.plus}</button>
    <input class="vm-text" type="text" autocomplete="off" spellcheck="false" placeholder="Hafize'ye yaz" aria-label="Hafize'ye yaz">
    <button type="submit" class="vm-send" aria-label="Gönder" hidden>${ICONS.send}</button>
  </form>
  <button type="button" class="vm-mic" aria-pressed="false" aria-label="Mikrofonu kapat" title="Mikrofonu kapat">${ICONS.mic}</button>
  <button type="button" class="vm-close" aria-label="Sesli sohbeti kapat" title="Kapat (Esc)">${ICONS.close}</button>
</footer>`;

type RecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: unknown }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; onstart: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
};

export function installVoiceMode(documentRef: Document, root: typeof globalThis): VoiceModeController | null {
  const composer = documentRef.querySelector<HTMLFormElement>('#composer');
  const input = documentRef.querySelector<HTMLTextAreaElement>('#messageInput');
  const mic = documentRef.querySelector<HTMLButtonElement>('#micBtn');
  const messages = documentRef.querySelector<HTMLElement>('#messages');
  const Recognition = ((root as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }).SpeechRecognition
    || (root as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition) ?? null;
  if (!composer || !input || !mic || !documentRef.body || !Recognition) return null;
  if (documentRef.querySelector('.voice-mode')) return null;

  const screen = documentRef.createElement('div');
  screen.className = 'voice-mode';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-label', 'Hafize ile sesli sohbet');
  screen.hidden = true;
  screen.innerHTML = TEMPLATE; // constant markup; every dynamic value below goes through textContent
  documentRef.body.append(screen);
  const $ = <T extends Element>(selector: string) => screen.querySelector(selector) as T;
  const orbButton = $<HTMLButtonElement>('.vm-orb');
  const canvas = $<HTMLCanvasElement>('.vm-canvas');
  const statusEl = $<HTMLElement>('.vm-status');
  const captionEl = $<HTMLElement>('.vm-caption');
  const capBefore = $<HTMLElement>('.vm-cap-before');
  const capWord = $<HTMLElement>('.vm-cap-word');
  const capAfter = $<HTMLElement>('.vm-cap-after');
  const captionsBtn = $<HTMLButtonElement>('.vm-captions');
  const settingsBtn = $<HTMLButtonElement>('.vm-settings-btn');
  const settings = $<HTMLElement>('.vm-settings');
  const rateInput = $<HTMLInputElement>('.vm-rate');
  const rateOut = $<HTMLOutputElement>('.vm-rate-out');
  const voiceSelect = $<HTMLSelectElement>('.vm-voice');
  const sampleBtn = $<HTMLButtonElement>('.vm-sample');
  const form = $<HTMLFormElement>('.vm-input');
  const textInput = $<HTMLInputElement>('.vm-text');
  const sendBtn = $<HTMLButtonElement>('.vm-send');
  const plusBtn = $<HTMLButtonElement>('.vm-plus');
  const micBtn = $<HTMLButtonElement>('.vm-mic');
  const closeBtn = $<HTMLButtonElement>('.vm-close');

  const storage = (() => { try { return root.localStorage; } catch { return null; } })();
  const read = (key: string) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
  const write = (key: string, value: string) => { try { storage?.setItem(key, value); } catch { /* private mode */ } };
  const reduceMotion = () => documentRef.documentElement.dataset.reducedMotion === 'true' || Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const now = () => root.performance?.now?.() ?? Date.now();
  const speechProfile = recognitionProfile(root.navigator?.userAgent);

  let orb: VoiceOrb | null = null;
  let state: VoiceModeState = 'closed';
  let recognition: RecognitionLike | null = null;
  let muted = false;
  let manualEnd = false;
  let silentRetries = 0;
  let awaitingReply = false;
  let sawBusy = false;
  let spokenUpTo = 0;
  let streamStarted = false;
  let streamStopped = false;
  let nodeBeforeSend: string | null = null;
  let pendingUtterance = '';
  let feedTimer: ReturnType<typeof setInterval> | null = null;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let endOfTurnTimer: ReturnType<typeof setTimeout> | null = null;
  let recognitionStartTimer: ReturnType<typeof setTimeout> | null = null;
  let recognitionStopTimer: ReturnType<typeof setTimeout> | null = null;
  let recognitionNoResultTimer: ReturnType<typeof setTimeout> | null = null;
  let returnFocus: HTMLElement | null = null;
  let energy = 0;
  let nextPulseAt = 0;
  let pulseFrame: number | null = null;
  let captionsOn = read(CAPTIONS_KEY) !== 'false';

  const captionSize = () => captionCapacity(captionEl.clientWidth, parseFloat(root.getComputedStyle(captionEl).fontSize));
  const setCaption = (parts: [string, string, string], kind: 'user' | 'hafize' | '' = '') => {
    capBefore.textContent = parts[0];
    capWord.textContent = parts[1];
    capAfter.textContent = parts[2];
    captionEl.dataset.kind = kind;
    captionEl.classList.toggle('is-empty', !parts.join('').trim());
  };
  const publishMic = (busy: boolean) => {
    const Custom = root.CustomEvent;
    if (typeof Custom === 'function') documentRef.dispatchEvent(new Custom(INPUT_STATE_EVENT, { detail: { source: 'voice-input', listening: busy } }));
  };
  const clearRecognitionTimers = () => {
    if (endOfTurnTimer) clearTimeout(endOfTurnTimer);
    if (recognitionStartTimer) clearTimeout(recognitionStartTimer);
    if (recognitionStopTimer) clearTimeout(recognitionStopTimer);
    if (recognitionNoResultTimer) clearTimeout(recognitionNoResultTimer);
    endOfTurnTimer = null;
    recognitionStartTimer = null;
    recognitionStopTimer = null;
    recognitionNoResultTimer = null;
  };
  const clearTimers = () => {
    if (sendTimer) clearTimeout(sendTimer);
    if (resumeTimer) clearTimeout(resumeTimer);
    sendTimer = null;
    resumeTimer = null;
    clearRecognitionTimers();
  };

  const setState = (next: VoiceModeState, message?: string) => {
    state = next;
    screen.dataset.state = next;
    if (next !== 'listening') delete screen.dataset.micPhase;
    statusEl.textContent = message || statusText(next);
    orbButton.setAttribute('aria-label', next === 'speaking' ? 'Hafize\'nin sözünü kes ve konuş' : next === 'listening' ? 'Dinlemeyi bitir' : 'Konuşmaya başla');
    orb?.setMood((next === 'closed' ? 'idle' : next) as OrbMood);
    if (reduceMotion()) { orb?.setEnergy(next === 'listening' || next === 'speaking' ? 0.45 : 0.15); orb?.renderStill(); }
  };

  // Only SpeechRecognition owns the microphone. A second getUserMedia stream for a
  // decorative visual can steal the iPhone's capture device during subsequent turns.
  // The orb animates from ASR results and a gentle idle pulse instead.
  const pulse = () => {
    pulseFrame = null;
    if (state === 'closed') return;
    const t = now();
    if (state === 'listening') energy = Math.max(energy * 0.9, 0.2 + 0.12 * Math.sin(t / 300));
    else if (state === 'speaking') {
      if (t >= nextPulseAt) { energy = Math.max(energy, 0.35 + Math.random() * 0.35); nextPulseAt = t + 120 + Math.random() * 140; }
      energy *= 0.93;
    } else if (state === 'thinking') energy = 0.18 + 0.1 * Math.sin(t / 220);
    else energy *= 0.9;
    orb?.setEnergy(energy);
    screen.style.setProperty('--vm-energy', energy.toFixed(3));
    pulseFrame = root.requestAnimationFrame(pulse);
  };

  // ---- conversation loop ---------------------------------------------------------------------
  const stopSpeech = () => {
    const Custom = root.CustomEvent;
    if (typeof Custom === 'function') documentRef.dispatchEvent(new Custom(STOP_EVENT));
  };
  const stopRecognition = (abort = false) => {
    const active = recognition;
    if (abort) { recognition = null; clearRecognitionTimers(); }
    if (!active) return;
    try { if (abort) active.abort(); else active.stop(); } catch { /* already ended */ }
    if (abort || recognition !== active) return;
    if (recognitionStopTimer) clearTimeout(recognitionStopTimer);
    // Some iOS WebKit builds do not fire "end" after stop(). This would freeze
    // the UI in "listening" indefinitely. Complete the turn exactly once.
    recognitionStopTimer = setTimeout(() => {
      recognitionStopTimer = null;
      if (recognition !== active) return;
      active.onend?.();
      try { active.abort(); } catch { /* already finished */ }
    }, RECOGNITION_STOP_TIMEOUT_MS);
  };

  const latestMessage = (): HTMLElement | null => {
    const nodes = messages?.querySelectorAll<HTMLElement>('article.message');
    return nodes?.length ? nodes[nodes.length - 1]! : null;
  };
  const latestReplyNode = (): HTMLElement | null => {
    const article = latestMessage();
    if (!isFreshVoiceReply(article?.classList.contains('assistant') ? 'assistant' : null, article?.dataset.messageId ?? null, nodeBeforeSend)) return null;
    return article?.querySelector<HTMLElement>('.content') ?? null;
  };
  const latestReply = () => {
    const node = latestReplyNode();
    if (!node) return '';
    const content = (root as typeof globalThis & { HafizeChatMarkdown?: { sourceFor?: (n: Element) => string } }).HafizeChatMarkdown?.sourceFor?.(node) || node.textContent || '';
    // The shell uses an ellipsis before the model has produced its first token.
    return content.trim() === '…' ? '' : content;
  };

  // The reply is spoken a sentence at a time as it arrives, instead of after the whole of it is written.
  const stopFeeding = () => { if (feedTimer) { clearInterval(feedTimer); feedTimer = null; } };
  const feedSpeech = (done = false) => {
    if (!awaitingReply || streamStopped || !latestReplyNode()) return;
    const { piece, end } = nextSpeakable(latestReply(), spokenUpTo, done);
    const Custom = root.CustomEvent;
    if (!piece.trim() || typeof Custom !== 'function') return;
    spokenUpTo = end;
    if (!streamStarted) { streamStarted = true; setCaption(['', '', ''], 'hafize'); }
    documentRef.dispatchEvent(new Custom(SPEAK_EVENT, { detail: { text: piece, origin: ORIGIN, append: true } }));
  };

  const send = (text: string) => {
    const message = text.trim();
    if (!message || state === 'closed') return;
    clearTimers();
    if (input.disabled) {
      // A user can barge in while the old turn is still streaming. Keep the new words
      // and cancel the old request (the shell treats a submit while busy as Stop).
      pendingUtterance = message;
      awaitingReply = false;
      stopFeeding();
      stopRecognition(true);
      stopSpeech();
      setCaption([message, '', ''], 'user');
      composer.requestSubmit();
      setState('thinking', 'Önceki yanıt durduruluyor…');
      return;
    }
    pendingUtterance = '';
    manualEnd = false;
    stopRecognition(true);
    stopSpeech();
    input.value = message;
    input.dispatchEvent(new root.Event('input', { bubbles: true }));
    setCaption([message, '', ''], 'user');
    awaitingReply = true;
    sawBusy = false;
    spokenUpTo = 0;
    streamStarted = false;
    streamStopped = false;
    // Use stable message ids, not DOM node identity. renderMessages() replaces all
    // nodes each time; the old answer used to be spoken again as the new answer.
    nodeBeforeSend = latestMessage()?.dataset.messageId ?? null;
    setState('thinking');
    composer.requestSubmit();
    stopFeeding();
    feedTimer = setInterval(() => feedSpeech(), FEED_INTERVAL_MS);
    sendTimer = setTimeout(() => {
      sendTimer = null;
      if (awaitingReply && !sawBusy && !input.disabled) {
        awaitingReply = false;
        stopFeeding();
        setState('idle', 'Mesaj gönderilemedi. Tekrar söyleyebilirsin.');
        if (!muted) resumeTimer = setTimeout(() => { resumeTimer = null; if (state === 'idle') listen(); }, 500);
      }
    }, SEND_TIMEOUT_MS);
  };

  const retryListening = (message: string, failed = true) => {
    if (state === 'closed' || muted || documentRef.hidden) return;
    // A normal silence is not an error. Keep listening until the person closes
    // the screen; only genuine start/network failures have a retry budget.
    if (failed && silentRetries >= MAX_SILENT_RETRIES) {
      silentRetries = 0;
      setState('idle', speechProfile.awaitNaturalEnd
        ? 'Ses tanıma yanıt vermiyor. iPhone Safari’yi tamamen kapatıp yeniden açmayı veya mikrofon iznini kontrol etmeyi dene.'
        : 'Mikrofon bağlantısı kesildi. Yeniden başlatmak için küreye dokun.');
      return;
    }
    if (failed) silentRetries += 1;
    else silentRetries = 0;
    setState('thinking', message);
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (state !== 'closed' && !muted) listen();
    }, failed ? RESTART_DELAY_MS + (silentRetries - 1) * 250 : 700);
  };

  const listen = () => {
    if (state === 'closed' || muted || recognition || documentRef.hidden) return;
    manualEnd = false;
    if (input.disabled) { setState('thinking'); return; }
    stopSpeech();
    clearTimers();
    let final = '';
    let interim = '';
    let errorCode = '';
    let recognitionStarted = false;
    let errorHandled = false;
    let recognizedSomething = false;
    let heardSpeech = false;
    let current: RecognitionLike;
    try { current = new Recognition(); }
    catch { retryListening('Mikrofon oluşturulamadı, yeniden deneniyor…'); return; }
    recognition = current;
    current.lang = 'tr-TR';
    current.interimResults = true;
    current.continuous = speechProfile.continuous;
    current.maxAlternatives = 1;
    current.onstart = () => {
      if (recognition !== current) return;
      recognitionStarted = true;
      if (recognitionStartTimer) clearTimeout(recognitionStartTimer);
      recognitionStartTimer = null;
      setState('listening', 'Mikrofon oturumu açık · konuşabilirsin');
      screen.dataset.micPhase = 'ready';
      setCaption(['', '', ''], 'user');
      if (recognitionNoResultTimer) clearTimeout(recognitionNoResultTimer);
      recognitionNoResultTimer = setTimeout(() => {
        recognitionNoResultTimer = null;
        if (recognition !== current || recognizedSomething || muted || documentRef.hidden) return;
        // Safari can dispatch "start" and show the system mic dot, yet never
        // produce speechstart/result/error/end. Recover the stuck session.
        recognition = null;
        clearRecognitionTimers();
        try { current.abort(); } catch { /* session may already be gone */ }
        retryListening('Mikrofon açık görünüyor ama ses tanıma yanıt vermiyor · yeniden deniyorum…', true);
      }, speechProfile.noResultTimeoutMs);
    };
    current.onaudiostart = () => {
      if (recognition !== current || recognizedSomething) return;
      screen.dataset.micPhase = 'connected';
      statusEl.textContent = 'Mikrofon bağlantısı kuruldu · konuşabilirsin';
    };
    current.onspeechstart = () => {
      if (recognition !== current) return;
      heardSpeech = true;
      screen.dataset.micPhase = 'speech';
      energy = Math.max(energy, 0.7);
      statusEl.textContent = 'Sesini algıladım · dinliyorum…';
    };
    current.onspeechend = () => {
      if (recognition !== current) return;
      screen.dataset.micPhase = 'ending';
      statusEl.textContent = 'Konuşman tamamlanıyor…';
      // Safari naturally ends after one utterance. Desktop needs its own
      // endpoint when the recognizer is configured for continuous dictation.
      if (!speechProfile.awaitNaturalEnd && (final || interim) && !endOfTurnTimer) {
        endOfTurnTimer = setTimeout(() => {
          endOfTurnTimer = null;
          if (recognition === current) stopRecognition(false);
        }, END_OF_TURN_MS + 350);
      }
    };
    current.onresult = (event) => {
      if (recognition !== current) return;
      ({ final, interim } = readTranscript(event.results));
      recognizedSomething = Boolean(final || interim);
      if (recognizedSomething) {
        silentRetries = 0;
        if (recognitionNoResultTimer) clearTimeout(recognitionNoResultTimer);
        recognitionNoResultTimer = null;
        screen.dataset.micPhase = 'transcribing';
        statusEl.textContent = 'Seni duyuyorum · söylediklerin yazıya çevriliyor…';
      }
      const spoken = [final, interim].filter(Boolean).join(' ');
      setCaption([captionTail(spoken, captionSize()), '', ''], 'user');
      energy = Math.max(energy, 0.5);
      if (endOfTurnTimer) clearTimeout(endOfTurnTimer);
      endOfTurnTimer = null;
      // A final ASR result is not proof the user has finished speaking. Allow a
      // short silence for an additional phrase instead of sending a half question.
      if (final && !interim) {
        // Give iOS natural one-shot end priority. Forcing stop() too soon
        // can break subsequent speech recognition sessions on WebKit.
        endOfTurnTimer = setTimeout(() => {
          endOfTurnTimer = null;
          if (recognition === current) stopRecognition(false);
        }, speechProfile.awaitNaturalEnd ? IOS_NATURAL_END_GRACE_MS : END_OF_TURN_MS);
      }
    };
    current.onerror = (event) => {
      if (recognition !== current) return;
      errorCode = String(event?.error || '');
      if (errorHandled) return;
      errorHandled = true;
      // Some WebKit builds dispatch error but never end. A bounded stop turns
      // that into a retry or a clear permission/device message instead of a hang.
      stopRecognition(false);
    };
    current.onend = () => {
      if (recognition !== current) return;
      recognition = null;
      clearRecognitionTimers();
      if (state === 'closed' || muted || documentRef.hidden) return;
      const said = [final, interim].filter(Boolean).join(' ').trim();
      if (said) { silentRetries = 0; manualEnd = false; send(said); return; }
      if (heardSpeech && !errorCode) {
        retryListening('Ses algılandı fakat metne çevrilemedi · yeniden dinliyorum…', true);
        return;
      }
      if (manualEnd) { manualEnd = false; setState('paused', 'Dinleme durduruldu. Devam etmek için küreye dokun.'); return; }
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed' || errorCode === 'security') { setState('idle', 'Mikrofon izni gerekli. Tarayıcı izinlerini kontrol et.'); return; }
      if (errorCode === 'audio-capture') { setState('idle', 'Mikrofon bulunamadı.'); return; }
      if (errorCode === 'language-not-supported') { setState('idle', 'Türkçe ses tanıma desteklenmiyor.'); return; }
      retryListening(errorCode === 'network' ? 'Ses bağlantısı yeniden kuruluyor…' : 'Dinlemeye yeniden bağlanıyorum…', Boolean(errorCode && errorCode !== 'no-speech' && errorCode !== 'aborted'));
    };
    try {
      current.start();
      recognitionStartTimer = setTimeout(() => {
        recognitionStartTimer = null;
        if (recognition !== current || recognitionStarted) return;
        recognition = null;
        try { current.abort(); } catch { /* recognition may have already ended */ }
        retryListening('Mikrofon yanıt vermedi, yeniden deneniyor…');
      }, RECOGNITION_START_TIMEOUT_MS);
    } catch {
      recognition = null;
      clearRecognitionTimers();
      retryListening('Mikrofon yeniden başlatılıyor…');
    }
  };

  const loadVoices = () => {
    const synth = root.speechSynthesis;
    const voices = (synth?.getVoices?.() || []).filter((v) => String(v.lang || '').toLowerCase().replace('_', '-').startsWith('tr'));
    const saved = read(VOICE_KEY) || '';
    while (voiceSelect.options.length > 1) voiceSelect.remove(1);
    for (const v of voices) {
      const option = documentRef.createElement('option');
      option.value = v.voiceURI;
      option.textContent = `${v.name.replace(/\s*-\s*Turkish.*$/i, '').replace(/^Microsoft\s+/i, '')}${v.localService ? '' : ' · çevrimiçi'}`;
      voiceSelect.append(option);
    }
    voiceSelect.value = voices.some((v) => v.voiceURI === saved) ? saved : '';
    // Voices downloaded in Settings; the full library lives there, this is only the quick switch.
    loadCatalog().then(async (catalog) => {
      const owned = await downloadedKeys(catalog);
      const current = read(VOICE_KEY) || '';
      for (const entry of catalog.filter((voice) => owned.has(voice.key) || `${PIPER_PREFIX}${voice.key}` === current)) {
        const value = `${PIPER_PREFIX}${entry.key}`;
        if ([...voiceSelect.options].some((option) => option.value === value)) continue;
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = `${entry.name} · ${entry.langName} · indirilen ses`;
        voiceSelect.append(option);
      }
      if ([...voiceSelect.options].some((option) => option.value === current)) voiceSelect.value = current;
    }).catch(() => { /* the catalog is optional here */ });
  };
  const renderRate = () => {
    const value = Number(read(RATE_KEY));
    const rate = Number.isFinite(value) && value >= 0.7 && value <= 1.5 ? value : 1;
    rateInput.value = String(rate);
    rateOut.textContent = `${rate.toFixed(2)}×`;
  };
  const renderCaptions = () => {
    screen.classList.toggle('vm-no-captions', !captionsOn);
    captionsBtn.setAttribute('aria-pressed', String(captionsOn));
    captionsBtn.setAttribute('aria-label', captionsOn ? 'Altyazıyı gizle' : 'Altyazıyı göster');
  };
  const renderMute = () => {
    micBtn.setAttribute('aria-pressed', String(muted));
    micBtn.innerHTML = muted ? ICONS.micOff : ICONS.mic; // constant icon markup
    micBtn.setAttribute('aria-label', muted ? 'Mikrofonu aç' : 'Mikrofonu kapat');
    micBtn.title = muted ? 'Mikrofonu aç' : 'Mikrofonu kapat';
  };

  // ---- open / close ----------------------------------------------------------------------------
  // A downloaded voice loads its model on first use; do that now, not while the first answer waits.
  const open = (handoffText = '') => {
    if (state !== 'closed') return;
    const active = documentRef.activeElement as HTMLElement | null;
    returnFocus = active && active !== documentRef.body ? active : mic;
    documentRef.documentElement.dataset.voiceMode = 'true';
    screen.hidden = false;
    documentRef.dispatchEvent(new CustomEvent('hafize:voice-camera-open',{detail:screen.querySelector('.vm-camera-host')}));
    documentRef.body.classList.add('voice-mode-open');
    muted = false;
    silentRetries = 0;
    pendingUtterance = '';
    manualEnd = false;
    renderMute(); renderRate(); renderCaptions(); loadVoices();
    setCaption(['', '', '']);
    if (!orb && canvas) { orb = createVoiceOrb(canvas, root); screen.classList.toggle('vm-webgl', Boolean(orb)); }
    setState('idle');
    publishMic(true);
    if (reduceMotion()) orb?.renderStill();
    else { orb?.start(); if (pulseFrame == null) pulseFrame = root.requestAnimationFrame(pulse); }
    root.requestAnimationFrame(() => screen.classList.add('vm-visible'));
    orbButton.focus({ preventScroll: true });
    if (handoffText.trim()) send(handoffText);
    else listen();
  };
  const close = () => {
    if (state === 'closed') return;
    documentRef.dispatchEvent(new Event('hafize:voice-camera-close'));
    clearTimers();
    stopFeeding();
    awaitingReply = false;
    pendingUtterance = '';
    stopRecognition(true);
    if (state === 'speaking') stopSpeech();
    state = 'closed';
    screen.dataset.state = 'closed';
    settings.hidden = true;
    settingsBtn.setAttribute('aria-expanded', 'false');
    orb?.stop();
    if (pulseFrame != null) root.cancelAnimationFrame(pulseFrame);
    pulseFrame = null;
    screen.classList.remove('vm-visible');
    documentRef.body.classList.remove('voice-mode-open');
    delete documentRef.documentElement.dataset.voiceMode;
    publishMic(false);
    setTimeout(() => { if (state === 'closed') screen.hidden = true; }, reduceMotion() ? 0 : 260);
    (returnFocus && returnFocus.isConnected ? returnFocus : mic).focus?.({ preventScroll: true });
  };

  // ---- events --------------------------------------------------------------------------------
  // Capture on document runs before voice-input's own capture listener on the button, so the
  // microphone opens this screen instead of starting dictation.
  const onMicClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target?.closest?.('#micBtn') || mic.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // hands-free.ts clicks the button after the wake phrase and may already have put the request
    // ("Hafize, yarın hava nasıl?") into the composer: send it straight away.
    const handoff = !event.isTrusted ? input.value : '';
    if (handoff) { input.value = ''; input.dispatchEvent(new root.Event('input', { bubbles: true })); }
    open(handoff);
  };
  const onOrb = () => {
    if (state === 'speaking') {
      // Barge-in stops both TTS and any in-flight generation, then reopens ASR.
      streamStopped = true;
      awaitingReply = false;
      stopFeeding();
      stopSpeech();
      if (input.disabled) {
        composer.requestSubmit();
        setState('thinking', 'Yanıt durduruluyor, ardından dinleyeceğim…');
      } else {
        setState('idle');
        listen();
      }
    } else if (state === 'listening') {
      // On an empty transcript the user's tap means "pause", not "restart".
      manualEnd = true;
      stopRecognition(false);
    } else if (state === 'idle' || state === 'paused') { if (muted) { muted = false; renderMute(); } listen(); }
  };
  const onInputMutation = () => {
    if (state === 'closed') return;
    if (input.disabled) { if (awaitingReply) sawBusy = true; if (state !== 'speaking') setState('thinking'); return; }
    if (pendingUtterance) {
      const queued = pendingUtterance;
      pendingUtterance = '';
      send(queued);
      return;
    }
    if (!awaitingReply) { if (state === 'thinking') listen(); return; }
    stopFeeding();
    if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
    if (streamStarted || streamStopped) {
      feedSpeech(true);
      awaitingReply = false;
      if (state !== 'speaking') listen();
      return;
    }
    awaitingReply = false;
    const reply = latestReply();
    const Custom = root.CustomEvent;
    if (reply && root.speechSynthesis && typeof Custom === 'function') {
      setCaption(['', '', ''], 'hafize');
      documentRef.dispatchEvent(new Custom(SPEAK_EVENT, { detail: { text: reply, origin: ORIGIN } }));
      // voice-output answers with hafize:voice-output-state; if it cannot speak, keep listening.
      resumeTimer = setTimeout(() => { resumeTimer = null; if (state === 'thinking') listen(); }, 1500);
    } else listen();
  };
  const onOutputState = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (state === 'closed' || detail?.source !== 'voice-output') return;
    if (detail.speaking && (detail.origin === ORIGIN || detail.origin === 'voice-mode-sample')) { if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; } setState('speaking'); return; }
    if (detail.speaking && detail.origin !== ORIGIN && detail.origin !== 'voice-mode-sample') return;
    if (!detail.speaking && state === 'speaking') {
      // Spoke faster than the reply is arriving: the next sentence is on its way.
      if (awaitingReply) { setState('thinking'); return; }
      setState(muted ? 'paused' : 'idle');
      resumeTimer = setTimeout(() => { resumeTimer = null; if (state === 'idle' && !muted) listen(); }, speechProfile.resumeAfterSpeechMs);
    }
  };
  const onProgress = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (state !== 'speaking' || detail?.source !== 'voice-output'
        || (detail.origin !== ORIGIN && detail.origin !== 'voice-mode-sample')) return;
    const index = Number(detail.charIndex);
    setCaption(captionWindow(detail.text, index, Number(detail.charLength), captionSize()), 'hafize');
    if (index >= 0) energy = Math.max(energy, 0.75);
  };
  const onKey = (event: KeyboardEvent) => {
    if (state === 'closed') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!settings.hidden) { settings.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); settingsBtn.focus(); }
      else close();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...screen.querySelectorAll<HTMLElement>('button:not([hidden]):not([disabled]), input, select')].filter((el) => !el.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  const onVisibility = () => {
    if (state === 'closed') return;
    if (documentRef.hidden) {
      clearTimers(); stopFeeding(); awaitingReply = false; pendingUtterance = '';
      manualEnd = false; stopRecognition(true); stopSpeech();
      setState('paused', 'Uygulama arka planda; geri dönünce küreye dokun.');
    } else if (state === 'paused' && !muted) {
      // Safari requires a new foreground gesture to re-open a paused microphone.
      setState('paused', 'Devam etmek için küreye dokun.');
    }
  };

  const listeners: Array<() => void> = [];
  const on = (target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  on(documentRef, 'click', onMicClick as EventListener, true);
  on(documentRef, 'keydown', onKey as EventListener, true);
  on(documentRef, 'visibilitychange', onVisibility);
  on(documentRef, OUTPUT_STATE_EVENT, onOutputState);
  on(documentRef, OUTPUT_PROGRESS_EVENT, onProgress);
  on(orbButton, 'click', onOrb);
  on(closeBtn, 'click', close);
  on(documentRef,'hafize:camera-talk',()=>open());
  on($<HTMLButtonElement>('.vm-camera-start'),'click',()=>documentRef.dispatchEvent(new Event('hafize:voice-camera-start')));
  if (typeof root.addEventListener==='function') on(root,'pagehide',close);
  on(micBtn, 'click', () => {
    muted = !muted;
    renderMute();
    if (muted) {
      manualEnd = false;
      clearRecognitionTimers();
      stopRecognition(true);
      if (state === 'listening' || state === 'idle' || state === 'thinking') setState('paused');
    }
    else if (state === 'paused' || state === 'idle') listen();
  });
  on(captionsBtn, 'click', () => { captionsOn = !captionsOn; write(CAPTIONS_KEY, String(captionsOn)); renderCaptions(); });
  on(settingsBtn, 'click', () => {
    settings.hidden = !settings.hidden;
    settingsBtn.setAttribute('aria-expanded', String(!settings.hidden));
    if (!settings.hidden) { loadVoices(); rateInput.focus(); }
  });
  on(rateInput, 'input', () => { write(RATE_KEY, rateInput.value); rateOut.textContent = `${Number(rateInput.value).toFixed(2)}×`; });
  on(voiceSelect, 'change', () => { if (voiceSelect.value) write(VOICE_KEY, voiceSelect.value); else { try { storage?.removeItem(VOICE_KEY); } catch { /* ignore */ } } });
  on(sampleBtn, 'click', () => {
    stopRecognition(true);
    const Custom = root.CustomEvent;
    setState('thinking', 'Ses örneği hazırlanıyor…');
    if (typeof Custom === 'function') documentRef.dispatchEvent(new Custom(SPEAK_EVENT, { detail: { text: 'Merhaba, ben Hafize. Sesim böyle duyuluyor.', origin: 'voice-mode-sample' } }));
  });
  on(plusBtn, 'click', () => { close(); documentRef.querySelector<HTMLButtonElement>('#attachBtn')?.click(); });
  on(textInput, 'input', () => { sendBtn.hidden = !textInput.value.trim(); if (textInput.value) stopRecognition(true); });
  on(form, 'submit', (event) => { event.preventDefault(); const text = textInput.value; textInput.value = ''; sendBtn.hidden = true; send(text); });
  if (root.speechSynthesis) on(root.speechSynthesis, 'voiceschanged', () => { if (state !== 'closed') loadVoices(); });
  const Observer = root.MutationObserver;
  const observer = Observer ? new Observer(onInputMutation) : null;
  observer?.observe(input, { attributes: true, attributeFilter: ['disabled'] });

  return Object.freeze({
    state: () => state,
    open: () => open(),
    close,
    destroy() { close(); observer?.disconnect(); listeners.forEach((off) => off()); orb?.destroy(); screen.remove(); }
  });
}

const api = Object.freeze({ statusText, readTranscript, isFreshVoiceReply, recognitionProfile, captionCapacity, captionTail, captionWindow, installVoiceMode });
(globalThis as typeof globalThis & { HafizeVoiceMode?: unknown }).HafizeVoiceMode = api;
const start = () => installVoiceMode(document, globalThis);
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
