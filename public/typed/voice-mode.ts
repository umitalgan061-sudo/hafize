// Voice chat screen. The composer's microphone opens a full-screen conversation with Hafize:
// listen → send what was said → read the reply aloud → listen again, until the screen is closed.
// It drives the existing pieces instead of duplicating them: the composer form sends the message
// (app-shell.ts), voice-output.ts speaks (hafize:voice-output-speak), and while the screen is open
// it reports the microphone as busy (hafize:voice-input-state) so hands-free and the composer
// voice panel stay out of the way. Dictation into the composer remains on Ctrl+Shift+M.

import { createVoiceOrb, type OrbMood, type VoiceOrb } from './voice-orb.ts';
import { PIPER_PREFIX, downloadedKeys, loadCatalog } from './voice-library.ts';

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
const MAX_SILENT_RETRIES = 1;

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
  let final = '';
  let interim = '';
  for (let i = 0; i < (results?.length ?? 0); i += 1) {
    const result = results![i];
    const text = typeof result?.[0]?.transcript === 'string' ? String(result[0].transcript) : '';
    if (result?.isFinal) final += text; else interim += text;
  }
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
  return { final: clean(final), interim: clean(interim) };
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

type RecognitionLike = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void; onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: unknown }> & { isFinal?: boolean }> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; onstart: (() => void) | null; };

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

  let orb: VoiceOrb | null = null;
  let state: VoiceModeState = 'closed';
  let recognition: RecognitionLike | null = null;
  let muted = false;
  let silentRetries = 0;
  let awaitingReply = false;
  let sawBusy = false;
  let sendTimer: ReturnType<typeof setTimeout> | null = null;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let returnFocus: HTMLElement | null = null;
  let energy = 0;
  let nextPulseAt = 0;
  let pulseFrame: number | null = null;
  let micStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let samples: Uint8Array<ArrayBuffer> | null = null;
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
  const clearTimers = () => {
    if (sendTimer) clearTimeout(sendTimer);
    if (resumeTimer) clearTimeout(resumeTimer);
    sendTimer = null;
    resumeTimer = null;
  };

  const setState = (next: VoiceModeState, message?: string) => {
    state = next;
    screen.dataset.state = next;
    statusEl.textContent = message || statusText(next);
    orbButton.setAttribute('aria-label', next === 'speaking' ? 'Hafize\'nin sözünü kes ve konuş' : next === 'listening' ? 'Dinlemeyi bitir' : 'Konuşmaya başla');
    orb?.setMood((next === 'closed' ? 'idle' : next) as OrbMood);
    if (reduceMotion()) { orb?.setEnergy(next === 'listening' || next === 'speaking' ? 0.45 : 0.15); orb?.renderStill(); }
  };

  // ---- energy: microphone level while listening, rhythmic pulses while speaking ------------
  const micLevel = () => {
    if (!analyser || !samples) return 0;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) { const v = (samples[i] - 128) / 128; sum += v * v; }
    return Math.min(1, Math.sqrt(sum / samples.length) * 5);
  };
  const pulse = () => {
    pulseFrame = null;
    if (state === 'closed') return;
    const t = now();
    if (state === 'listening') energy = Math.max(micLevel(), energy * 0.9, analyser ? 0 : 0.2 + 0.12 * Math.sin(t / 300));
    else if (state === 'speaking') {
      if (t >= nextPulseAt) { energy = Math.max(energy, 0.35 + Math.random() * 0.35); nextPulseAt = t + 120 + Math.random() * 140; }
      energy *= 0.93;
    } else if (state === 'thinking') energy = 0.18 + 0.1 * Math.sin(t / 220);
    else energy *= 0.9;
    orb?.setEnergy(energy);
    screen.style.setProperty('--vm-energy', energy.toFixed(3));
    pulseFrame = root.requestAnimationFrame(pulse);
  };
  const openMic = async () => {
    const media = root.navigator?.mediaDevices;
    const Context = (root as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).AudioContext || (root as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (micStream || !media?.getUserMedia || !Context || reduceMotion()) return;
    try {
      const stream = await media.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (state === 'closed') { stream.getTracks().forEach((track) => track.stop()); return; }
      const context = new Context();
      const node = context.createAnalyser();
      node.fftSize = 512;
      context.createMediaStreamSource(stream).connect(node);
      micStream = stream; audioContext = context; analyser = node; samples = new Uint8Array(node.fftSize);
    } catch { /* no permission or device: the orb uses its gentle synthetic pulse */ }
  };
  const closeMic = () => {
    micStream?.getTracks().forEach((track) => track.stop());
    audioContext?.close().catch(() => {});
    micStream = null; audioContext = null; analyser = null; samples = null;
  };

  // ---- conversation loop ---------------------------------------------------------------------
  const stopSpeech = () => {
    const Custom = root.CustomEvent;
    if (typeof Custom === 'function') documentRef.dispatchEvent(new Custom(STOP_EVENT));
  };
  const stopRecognition = (abort = false) => {
    const active = recognition;
    recognition = null;
    if (!active) return;
    try { if (abort) active.abort(); else active.stop(); } catch { /* already ended */ }
  };

  const latestReply = () => {
    const nodes = messages?.querySelectorAll('.message.assistant .content');
    const node = nodes && nodes.length ? nodes[nodes.length - 1] : null;
    if (!node) return '';
    return (root as typeof globalThis & { HafizeChatMarkdown?: { sourceFor?: (n: Element) => string } }).HafizeChatMarkdown?.sourceFor?.(node) || node.textContent || '';
  };

  const send = (text: string) => {
    const message = text.trim();
    if (!message || state === 'closed') return;
    if (input.disabled) { setState('thinking', 'Önceki yanıt bitince gönderilecek…'); return; }
    clearTimers();
    stopRecognition(true);
    stopSpeech();
    input.value = message;
    input.dispatchEvent(new root.Event('input', { bubbles: true }));
    setCaption([message, '', ''], 'user');
    awaitingReply = true;
    sawBusy = false;
    setState('thinking');
    composer.requestSubmit();
    sendTimer = setTimeout(() => {
      sendTimer = null;
      if (awaitingReply && !sawBusy && !input.disabled) { awaitingReply = false; setState('idle', 'Mesaj gönderilemedi. Tekrar dene.'); }
    }, SEND_TIMEOUT_MS);
  };

  const listen = () => {
    if (state === 'closed' || muted || recognition) return;
    if (input.disabled) { setState('thinking'); return; }
    stopSpeech();
    clearTimers();
    let final = '';
    let interim = '';
    let errorCode = '';
    const current = new Recognition();
    recognition = current;
    current.lang = documentRef.documentElement.lang || 'tr-TR';
    current.interimResults = true;
    current.continuous = false;
    current.maxAlternatives = 1;
    current.onstart = () => { if (recognition === current) { setState('listening'); setCaption(['', '', ''], 'user'); } };
    current.onresult = (event) => {
      if (recognition !== current) return;
      ({ final, interim } = readTranscript(event.results));
      const spoken = [final, interim].filter(Boolean).join(' ');
      setCaption([captionTail(spoken, captionSize()), '', ''], 'user');
      energy = Math.max(energy, 0.5);
    };
    current.onerror = (event) => { errorCode = String(event?.error || ''); };
    current.onend = () => {
      if (recognition !== current) return;
      recognition = null;
      if (state === 'closed') return;
      const said = (final || interim).trim();
      if (said) { silentRetries = 0; send(said); return; }
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') { setState('idle', 'Mikrofon izni gerekli. Tarayıcı izinlerini kontrol et.'); return; }
      if (errorCode === 'audio-capture') { setState('idle', 'Mikrofon bulunamadı.'); return; }
      if (errorCode === 'network') { setState('idle', 'Ses tanıma servisine ulaşılamadı.'); return; }
      if (!muted && silentRetries < MAX_SILENT_RETRIES) { silentRetries += 1; listen(); return; }
      silentRetries = 0;
      setState(muted ? 'paused' : 'idle');
    };
    try { current.start(); }
    catch { recognition = null; setState('idle', 'Mikrofon başlatılamadı.'); }
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
  const open = (handoffText = '') => {
    if (state !== 'closed') return;
    const active = documentRef.activeElement as HTMLElement | null;
    returnFocus = active && active !== documentRef.body ? active : mic;
    documentRef.documentElement.dataset.voiceMode = 'true';
    screen.hidden = false;
    documentRef.body.classList.add('voice-mode-open');
    muted = false;
    silentRetries = 0;
    renderMute(); renderRate(); renderCaptions(); loadVoices();
    setCaption(['', '', '']);
    if (!orb && canvas) { orb = createVoiceOrb(canvas, root); screen.classList.toggle('vm-webgl', Boolean(orb)); }
    setState('idle');
    publishMic(true);
    if (reduceMotion()) orb?.renderStill();
    else { orb?.start(); if (pulseFrame == null) pulseFrame = root.requestAnimationFrame(pulse); }
    root.requestAnimationFrame(() => screen.classList.add('vm-visible'));
    orbButton.focus({ preventScroll: true });
    openMic();
    if (handoffText.trim()) send(handoffText);
    else listen();
  };
  const close = () => {
    if (state === 'closed') return;
    clearTimers();
    awaitingReply = false;
    stopRecognition(true);
    if (state === 'speaking') stopSpeech();
    state = 'closed';
    screen.dataset.state = 'closed';
    settings.hidden = true;
    settingsBtn.setAttribute('aria-expanded', 'false');
    orb?.stop();
    if (pulseFrame != null) root.cancelAnimationFrame(pulseFrame);
    pulseFrame = null;
    closeMic();
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
    if (state === 'speaking') { stopSpeech(); listen(); }
    else if (state === 'listening') stopRecognition(false);
    else if (state === 'idle' || state === 'paused') { if (muted) { muted = false; renderMute(); } listen(); }
  };
  const onInputMutation = () => {
    if (state === 'closed') return;
    if (input.disabled) { if (awaitingReply) sawBusy = true; if (state !== 'speaking') setState('thinking'); return; }
    if (!awaitingReply) { if (state === 'thinking') listen(); return; }
    awaitingReply = false;
    if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
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
    if (detail.speaking && detail.origin === ORIGIN) { if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; } setState('speaking'); return; }
    if (!detail.speaking && state === 'speaking') {
      setState(muted ? 'paused' : 'idle');
      resumeTimer = setTimeout(() => { resumeTimer = null; if (state === 'idle' && !muted) listen(); }, 350);
    }
  };
  const onProgress = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (state !== 'speaking' || detail?.source !== 'voice-output') return;
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
  const onVisibility = () => { if (documentRef.hidden && state !== 'closed') { stopRecognition(true); stopSpeech(); setState('paused', 'Sekme arka planda; devam etmek için dokun.'); } };

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
  on(micBtn, 'click', () => {
    muted = !muted;
    renderMute();
    if (muted) { stopRecognition(true); if (state === 'listening' || state === 'idle') setState('paused'); }
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

const api = Object.freeze({ statusText, readTranscript, captionCapacity, captionTail, captionWindow, installVoiceMode });
(globalThis as typeof globalThis & { HafizeVoiceMode?: unknown }).HafizeVoiceMode = api;
const start = () => installVoiceMode(document, globalThis);
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
