// Voice visual: an animated orb, a waveform and a live caption at the top of the composer while
// Hafize speaks or the microphone listens. It only reacts to the events the voice modules publish:
//   hafize:voice-output-state / hafize:voice-output-progress  (voice-output.ts)
//   hafize:voice-input-state                                  (voice-input.ts)
// The composer's ResizeObserver (ui-shell.ts) shrinks the chat while the panel is open, so it
// never covers the answer being read.

export type VoiceVisualState = 'idle' | 'speaking' | 'listening';
export interface VoiceVisualController { readonly state: () => VoiceVisualState; readonly destroy: () => void; }

const BAR_COUNT = 40;
const CAPTION_WINDOW = 120;
const OUTPUT_STATE_EVENT = 'hafize:voice-output-state';
const OUTPUT_PROGRESS_EVENT = 'hafize:voice-output-progress';
const OUTPUT_STOP_EVENT = 'hafize:voice-output-stop';
const INPUT_STATE_EVENT = 'hafize:voice-input-state';

/** A window of the chunk around the spoken word: [before, word, after], each trimmed to fit. */
export function captionParts(text: unknown, charIndex: number, charLength: number, windowSize = CAPTION_WINDOW): [string, string, string] {
  const value = typeof text === 'string' ? text : '';
  if (!value) return ['', '', ''];
  if (!Number.isInteger(charIndex) || charIndex < 0 || charIndex >= value.length) {
    return [value.length > windowSize ? `${value.slice(0, windowSize - 1).trimEnd()}…` : value, '', ''];
  }
  const length = Math.max(0, Math.min(Number.isInteger(charLength) ? charLength : 0, value.length - charIndex));
  const half = Math.max(10, Math.floor((windowSize - length) / 2));
  const from = Math.max(0, charIndex - half);
  const to = Math.min(value.length, charIndex + length + half);
  const before = (from > 0 ? '…' : '') + value.slice(from, charIndex);
  const after = value.slice(charIndex + length, to) + (to < value.length ? '…' : '');
  return [before, value.slice(charIndex, charIndex + length), after];
}

/** Bar heights (0..1) for one frame: a centred envelope, per-bar wobble, scaled by energy. */
export function waveHeights(count: number, time: number, energy: number, seed: readonly number[]): number[] {
  const heights: number[] = [];
  const level = Math.max(0, Math.min(1, energy));
  for (let i = 0; i < count; i += 1) {
    const centre = 1 - Math.abs((i - (count - 1) / 2) / ((count - 1) / 2 || 1));
    const envelope = 0.35 + 0.65 * centre;
    const wobble = 0.5 + 0.5 * Math.sin(time * (0.006 + (seed[i] ?? 0.5) * 0.008) + i * 1.7);
    heights.push(Math.min(1, 0.08 + level * envelope * (0.45 + 0.55 * wobble)));
  }
  return heights;
}

export function installVoiceVisual(documentRef: Document, root: typeof globalThis): VoiceVisualController | null {
  const composer = documentRef.querySelector<HTMLElement>('#composer');
  const input = documentRef.querySelector<HTMLTextAreaElement>('#messageInput');
  const mic = documentRef.querySelector<HTMLButtonElement>('#micBtn');
  if (!composer || !input || typeof documentRef.createElement !== 'function') return null;
  if (composer.querySelector('.voice-visual')) return null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const node = documentRef.createElement(tag);
    node.className = className;
    return node;
  };
  const panel = el('div', 'voice-visual');
  panel.setAttribute('data-state', 'idle');
  // The panel stays in the accessibility tree for its stop button; the moving parts and the
  // word-by-word caption are hidden from screen readers, which already hear the speech itself.
  // While idle the panel is collapsed with visibility:hidden (voice-visual CSS in polish.css).
  const inner = el('div', 'voice-visual-inner');
  const orb = el('div', 'voice-visual-orb');
  orb.setAttribute('aria-hidden', 'true');
  orb.append(el('span', 'voice-visual-core'), el('span', 'voice-visual-ring'), el('span', 'voice-visual-ring voice-visual-ring-2'));
  const body = el('div', 'voice-visual-body');
  const label = el('span', 'voice-visual-label');
  const wave = el('div', 'voice-visual-wave');
  const bars: HTMLElement[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) { const bar = el('i', ''); bars.push(bar); wave.append(bar); }
  wave.setAttribute('aria-hidden', 'true');
  const caption = el('p', 'voice-visual-caption');
  caption.setAttribute('aria-hidden', 'true');
  const captionBefore = el('span', '');
  const captionWord = el('mark', '');
  const captionAfter = el('span', '');
  caption.append(captionBefore, captionWord, captionAfter);
  body.append(label, wave, caption);
  const stop = el('button', 'voice-visual-stop');
  stop.type = 'button';
  stop.tabIndex = -1;
  stop.textContent = 'Durdur';
  inner.append(orb, body, stop);
  panel.append(inner);
  composer.insertBefore(panel, composer.firstChild);

  const seed = Array.from({ length: BAR_COUNT }, (_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
  const reduceMotion = () => documentRef.documentElement?.dataset?.reducedMotion === 'true'
    || Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  let speaking = false;
  let listening = false;
  let state: VoiceVisualState = 'idle';
  let energy = 0;
  let lastWordAt = 0;
  let nextSyllableAt = 0;
  let frame: number | null = null;
  let micStream: MediaStream | null = null;
  let micContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let samples: Uint8Array<ArrayBuffer> | null = null;
  let micToken = 0;

  const now = () => (typeof root.performance?.now === 'function' ? root.performance.now() : Date.now());

  const setCaption = (parts: [string, string, string]) => {
    captionBefore.textContent = parts[0];
    captionWord.textContent = parts[1];
    captionAfter.textContent = parts[2];
  };

  const paint = (time: number) => {
    const heights = waveHeights(BAR_COUNT, time, energy, seed);
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const bar = bars[i];
      const height = heights[i];
      if (!bar || height === undefined) continue;
      bar.style.transform = `scaleY(${height.toFixed(3)})`;
    }
    orb.style.setProperty('--voice-energy', energy.toFixed(3));
  };

  const readMicLevel = () => {
    if (!analyser || !samples) return 0;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const raw = samples[i];
      if (raw === undefined) continue;
      const v = (raw - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / samples.length) * 4.5);
  };

  const tick = () => {
    frame = null;
    if (state === 'idle') return;
    const t = now();
    if (state === 'speaking') {
      // Word boundaries give real rhythm; between them (or with voices that send none) small
      // syllable pulses keep the wave alive at a lower level.
      if (t >= nextSyllableAt) {
        const sinceWord = t - lastWordAt;
        energy = Math.max(energy, sinceWord < 900 ? 0.45 + Math.random() * 0.25 : 0.35 + Math.random() * 0.3);
        nextSyllableAt = t + 110 + Math.random() * 120;
      }
      energy *= 0.92;
    } else {
      const level = readMicLevel();
      energy = analyser ? Math.max(level, energy * 0.85) : 0.45 + 0.2 * Math.sin(t / 420) + 0.1 * Math.sin(t / 97);
    }
    paint(t);
    frame = root.requestAnimationFrame?.(tick) ?? null;
  };

  const startLoop = () => {
    if (frame != null || reduceMotion() || typeof root.requestAnimationFrame !== 'function') {
      if (reduceMotion()) { energy = 0.4; paint(0); }
      return;
    }
    frame = root.requestAnimationFrame(tick);
  };
  const stopLoop = () => {
    if (frame != null) root.cancelAnimationFrame?.(frame);
    frame = null;
    energy = 0;
    paint(0);
  };

  // Microphone level for the listening wave. Local only: an AnalyserNode reads the volume and
  // nothing is recorded or sent. Without permission or support it falls back to a calm pulse.
  const openMicLevel = async () => {
    const token = ++micToken;
    const media = root.navigator?.mediaDevices;
    const Context = (root as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (root as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!media?.getUserMedia || !Context || reduceMotion()) return;
    try {
      const stream = await media.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (token !== micToken || state !== 'listening') { stream.getTracks().forEach((track) => track.stop()); return; }
      const context = new Context();
      const node = context.createAnalyser();
      node.fftSize = 512;
      context.createMediaStreamSource(stream).connect(node);
      micStream = stream; micContext = context; analyser = node; samples = new Uint8Array(node.fftSize);
    } catch { /* permission denied or no device: keep the synthetic pulse */ }
  };
  const closeMicLevel = () => {
    micToken += 1;
    micStream?.getTracks().forEach((track) => track.stop());
    micContext?.close?.().catch?.(() => {});
    micStream = null; micContext = null; analyser = null; samples = null;
  };

  const render = () => {
    const next: VoiceVisualState = listening ? 'listening' : speaking ? 'speaking' : 'idle';
    if (next === state) return;
    const previous = state;
    state = next;
    panel.setAttribute('data-state', state);
    composer.toggleAttribute?.('data-voice-visual', state !== 'idle');
    stop.tabIndex = state === 'idle' ? -1 : 0;
    if (state === 'listening') {
      label.textContent = 'Seni dinliyorum';
      stop.textContent = 'Bitir';
      stop.setAttribute('aria-label', 'Sesli girişi bitir');
      setCaption(['Konuş; bitince “Bitir”e bas ya da sus.', '', '']);
      openMicLevel();
    } else {
      if (previous === 'listening') closeMicLevel();
      if (state === 'speaking') {
        label.textContent = 'Hafize konuşuyor';
        stop.textContent = 'Durdur';
        stop.setAttribute('aria-label', 'Sesli yanıtı durdur');
      }
    }
    if (state === 'idle') stopLoop();
    else startLoop();
  };

  const onOutputState = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.source !== 'voice-output' || typeof detail.speaking !== 'boolean') return;
    speaking = detail.speaking;
    if (!speaking) setCaption(['', '', '']);
    render();
  };
  const onOutputProgress = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.source !== 'voice-output') return;
    const index = Number(detail.charIndex);
    setCaption(captionParts(detail.text, index, Number(detail.charLength)));
    if (index >= 0) {
      lastWordAt = now();
      const word = String(detail.text || '').slice(index, index + Number(detail.charLength || 0));
      energy = Math.min(1, 0.55 + Math.min(word.length, 10) * 0.045);
    }
  };
  const onInputState = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.source !== 'voice-input' || typeof detail.listening !== 'boolean') return;
    listening = detail.listening;
    render();
  };
  const onStop = (event: Event) => {
    event.preventDefault();
    if (state === 'listening') mic?.click();
    else if (state === 'speaking') {
      const Custom = root.CustomEvent;
      if (typeof Custom === 'function') documentRef.dispatchEvent(new Custom(OUTPUT_STOP_EVENT));
    }
  };

  documentRef.addEventListener(OUTPUT_STATE_EVENT, onOutputState);
  documentRef.addEventListener(OUTPUT_PROGRESS_EVENT, onOutputProgress);
  documentRef.addEventListener(INPUT_STATE_EVENT, onInputState);
  stop.addEventListener('click', onStop);
  paint(0);

  return Object.freeze({
    state: () => state,
    destroy() {
      stopLoop();
      closeMicLevel();
      documentRef.removeEventListener(OUTPUT_STATE_EVENT, onOutputState);
      documentRef.removeEventListener(OUTPUT_PROGRESS_EVENT, onOutputProgress);
      documentRef.removeEventListener(INPUT_STATE_EVENT, onInputState);
      stop.removeEventListener('click', onStop);
      composer.removeAttribute('data-voice-visual');
      panel.remove();
    }
  });
}

const api = Object.freeze({ captionParts, waveHeights, installVoiceVisual });
(globalThis as typeof globalThis & { HafizeVoiceVisual?: unknown }).HafizeVoiceVisual = api;
const start = () => installVoiceVisual(document, globalThis);
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
