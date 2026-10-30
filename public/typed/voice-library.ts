// Downloadable Piper voices: catalog, on-demand download into Cache Storage, synthesis in workers
// and playback. Nothing heavy loads until a Piper voice is actually used, and a voice is only
// ever downloaded when the user asks for it in Settings. Speech never leaves this browser.

// url/configUrl are set on community voices, which live outside the official repository and are
// pinned to one commit; source and license are shown so the user can see where a voice comes from.
export interface PiperVoice { key: string; name: string; lang: string; family: string; langName: string; country: string; quality: string; speakers: number; size: number; path: string; url?: string; configUrl?: string; source?: string; license?: string; }
export interface SpeakHandle { stop(): void; }
export interface SpeakCallbacks { onstart?(): void; onword?(charIndex: number, charLength: number): void; onend?(): void; onerror?(error: Error): void; }

export const PIPER_PREFIX = 'piper:';
export const SPEAKER_KEY = 'hafize.voiceOutput.speaker.v1';
const CACHE_NAME = 'hafize-voices-v1';
const VOICE_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const PHONEMIZER = '/vendor/piper-phonemize/';
const SAMPLES: Record<string, string> = {
  tr: 'Merhaba, ben Hafize. Sesim böyle duyuluyor.', en: 'Hello, I am Hafize. This is how I sound.', de: 'Hallo, ich bin Hafize. So klingt meine Stimme.',
  fr: 'Bonjour, je suis Hafize. Voici ma voix.', es: 'Hola, soy Hafize. Así suena mi voz.', it: 'Ciao, sono Hafize. Questa è la mia voce.',
  ru: 'Привет, я Хафизе. Так звучит мой голос.', ar: 'مرحبا، أنا حافظة. هكذا يبدو صوتي.', nl: 'Hallo, ik ben Hafize. Zo klinkt mijn stem.', pt: 'Olá, eu sou Hafize. Esta é a minha voz.', pl: 'Cześć, jestem Hafize. Tak brzmi mój głos.', uk: 'Привіт, я Хафізе. Так звучить мій голос.'
};

// ---- pure helpers ----------------------------------------------------------------------------
export const isPiperVoice = (id: unknown): id is string => typeof id === 'string' && id.startsWith(PIPER_PREFIX);
export const piperKey = (id: string) => id.slice(PIPER_PREFIX.length);
export const sampleFor = (family: string) => SAMPLES[family] || SAMPLES.en;
export const modelUrl = (voice: Pick<PiperVoice, 'path' | 'url'>) => voice.url ?? VOICE_BASE + voice.path;
export const configUrl = (voice: Pick<PiperVoice, 'path' | 'url' | 'configUrl'>) => voice.configUrl ?? `${modelUrl(voice)}.json`;

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

/** Turkish first, then by language and name. */
export function sortVoices(voices: readonly PiperVoice[]): PiperVoice[] {
  return [...voices].sort((a, b) => Number(b.family === 'tr') - Number(a.family === 'tr') || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

export function filterVoices(voices: readonly PiperVoice[], family: string, query: string): PiperVoice[] {
  const needle = query.trim().toLocaleLowerCase('tr-TR');
  return voices.filter((voice) => (!family || voice.family === family)
    && (!needle || `${voice.name} ${voice.langName} ${voice.country} ${voice.lang}`.toLocaleLowerCase('tr-TR').includes(needle)));
}

/** Word start offsets with their share of the spoken duration; Piper reports no word timing. */
export function wordTimeline(text: string): Array<{ index: number; length: number; at: number }> {
  const words = [...text.matchAll(/\S+/g)].map((match) => ({ index: match.index ?? 0, length: match[0].length }));
  const total = words.reduce((sum, word) => sum + word.length + 1, 0) || 1;
  let used = 0;
  return words.map((word) => { const at = used / total; used += word.length + 1; return { ...word, at }; });
}

/** Gain that brings the loudest sample to 0.9, without boosting near-silence into noise. */
export function normalizedGain(pcm: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) peak = Math.max(peak, Math.abs(pcm[i]));
  return peak < 0.01 ? 1 : Math.min(8, 0.9 / peak);
}

/** The phonemizer uses one global id table; older models know fewer ids and fail on the rest. */
export function keepKnownPhonemes(ids: readonly number[], map: Record<string, readonly number[]>): number[] {
  const known = new Set(Object.values(map).flat());
  return ids.filter((id) => known.has(id));
}

// ---- catalog and storage ---------------------------------------------------------------------
let catalog: Promise<PiperVoice[]> | null = null;
export function loadCatalog(): Promise<PiperVoice[]> {
  catalog ||= fetch('/piper-voices.json').then((response) => {
    if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
    return response.json();
  }).then((data) => sortVoices(data.voices)).catch((error) => { catalog = null; throw error; });
  return catalog;
}

// Cache Storage needs a secure context (https or localhost). Elsewhere a voice lasts until reload.
const memory = new Map<string, ArrayBuffer>();
const openCache = async () => (typeof caches === 'undefined' ? null : caches.open(CACHE_NAME));
export const canStoreVoices = () => typeof caches !== 'undefined';

export async function isDownloaded(voice: Pick<PiperVoice, 'path' | 'url'>): Promise<boolean> {
  const url = modelUrl(voice);
  if (memory.has(url)) return true;
  const cache = await openCache();
  return Boolean(await cache?.match(url));
}

export async function downloadedKeys(voices: readonly PiperVoice[]): Promise<Set<string>> {
  const cache = await openCache();
  const stored = new Set((await cache?.keys() ?? []).map((request) => request.url));
  return new Set(voices.filter((voice) => stored.has(modelUrl(voice)) || memory.has(modelUrl(voice))).map((voice) => voice.key));
}

async function readWithProgress(response: Response, onProgress: (received: number) => void): Promise<Blob> {
  if (!response.body) return response.blob();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(received);
  }
  return new Blob(chunks as BlobPart[]);
}

export async function downloadVoice(voice: PiperVoice, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  const url = modelUrl(voice);
  const configAddress = configUrl(voice);
  const [configResponse, modelResponse] = await Promise.all([fetch(configAddress, { signal }), fetch(url, { signal })]);
  if (!configResponse.ok || !modelResponse.ok) throw new Error('VOICE_DOWNLOAD_FAILED');
  const config = await configResponse.blob();
  const model = await readWithProgress(modelResponse, (received) => onProgress(Math.min(1, received / Math.max(1, voice.size))));
  // The catalog knows the exact size, so a cut-off download is never stored as a usable voice.
  if (model.size + config.size !== voice.size) throw new Error('VOICE_DOWNLOAD_INCOMPLETE');
  const cache = await openCache();
  if (cache) {
    await navigator.storage?.persist?.().catch(() => false);
    await cache.put(configAddress, new Response(config));
    await cache.put(url, new Response(model));
  } else {
    memory.set(configAddress, await config.arrayBuffer());
    memory.set(url, await model.arrayBuffer());
  }
}

export async function removeVoice(voice: Pick<PiperVoice, 'path' | 'url' | 'configUrl'>): Promise<void> {
  const url = modelUrl(voice);
  const configAddress = configUrl(voice);
  memory.delete(url);
  memory.delete(configAddress);
  const cache = await openCache();
  await cache?.delete(url);
  await cache?.delete(configAddress);
  loaded.delete(url);
}

async function readStored(url: string): Promise<ArrayBuffer> {
  const held = memory.get(url);
  if (held) return held;
  const response = await (await openCache())?.match(url);
  if (!response) throw new Error('VOICE_NOT_DOWNLOADED');
  return response.arrayBuffer();
}

// ---- synthesis -------------------------------------------------------------------------------
let requestId = 0;
const waiting = new Map<number, { resolve(value: { pcm?: Float32Array }): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
let modelWorker: Worker | null = null;
// A worker that stops answering must not leave speech silently stuck: past these limits it is
// replaced and the caller gets an error, so voice-output can fall back to a browser voice.
const MODEL_TIMEOUT_MS: Record<string, number> = { init: 20_000, load: 60_000, run: 45_000 };
const PHONEMIZE_TIMEOUT_MS = 20_000;
function resetModelWorker(error: Error): void {
  modelWorker?.terminate();
  modelWorker = null;
  ready = null;
  loaded.clear();
  for (const entry of waiting.values()) { clearTimeout(entry.timer); entry.reject(error); }
  waiting.clear();
}
const callModel = (message: { type: string } & Record<string, unknown>, transfer: Transferable[] = []) => new Promise<{ pcm?: Float32Array }>((resolve, reject) => {
  if (!modelWorker) {
    modelWorker = new Worker('/typed-build/piper-worker.js', { type: 'module' });
    modelWorker.onmessage = ({ data }) => {
      const entry = waiting.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      waiting.delete(data.id);
      if (data.error) entry.reject(new Error(data.error)); else entry.resolve(data);
    };
    modelWorker.onerror = (event) => resetModelWorker(new Error(event.message || 'VOICE_WORKER_FAILED'));
  }
  const id = ++requestId;
  const timer = setTimeout(() => resetModelWorker(new Error('VOICE_TIMEOUT')), MODEL_TIMEOUT_MS[message.type] ?? 45_000);
  waiting.set(id, { resolve, reject, timer });
  modelWorker.postMessage({ id, ...message }, transfer);
});
let ready: Promise<unknown> | null = null;
const loaded = new Map<string, Promise<VoiceConfig>>();
type VoiceConfig = { audio: { sample_rate: number }; inference: { noise_scale: number; length_scale: number; noise_w: number }; num_speakers?: number; espeak: { voice: string }; phoneme_id_map: Record<string, number[]> };

function ensureLoaded(voice: PiperVoice): Promise<VoiceConfig> {
  const url = modelUrl(voice);
  let entry = loaded.get(url);
  if (!entry) {
    ready ||= callModel({ type: 'init', wasmPaths: '/typed-build/vendor/ort/' });
    entry = (async () => {
      const [configBytes, model] = await Promise.all([readStored(configUrl(voice)), readStored(url)]);
      await ready;
      // Memory-only voices must stay readable, so the worker gets a copy of those.
      await callModel({ type: 'load', key: voice.key, model: memory.has(url) ? model.slice(0) : model }, memory.has(url) ? [] : [model]);
      return JSON.parse(new TextDecoder().decode(configBytes)) as VoiceConfig;
    })();
    entry.catch(() => loaded.delete(url));
    loaded.set(url, entry);
  }
  return entry;
}

// The phonemizer prints one result per call, so calls run strictly one after another.
let phonemeWorker: Worker | null = null;
let phonemeQueue: Promise<unknown> = Promise.resolve();
function phonemize(text: string, config: VoiceConfig): Promise<number[]> {
  const run = () => new Promise<number[]>((resolve, reject) => {
    if (!phonemeWorker) {
      phonemeWorker = new Worker(`${PHONEMIZER}PhonemizeWebWorker.js`, { type: 'module' });
      phonemeWorker.postMessage({ type: 'constructor', data: {} });
      phonemeWorker.postMessage({ type: 'loadModule', data: [`${PHONEMIZER}piper_phonemize.wasm`, `${PHONEMIZER}piper_phonemize.data`] });
    }
    const worker = phonemeWorker;
    const fail = (error: Error) => { clearTimeout(timer); worker.terminate(); if (phonemeWorker === worker) phonemeWorker = null; reject(error); };
    const timer = setTimeout(() => fail(new Error('VOICE_TIMEOUT')), PHONEMIZE_TIMEOUT_MS);
    worker.onerror = (event) => fail(new Error(event.message || 'PHONEMIZER_FAILED'));
    worker.onmessage = ({ data }) => { if (data && Array.isArray(data.phoneme_ids)) { clearTimeout(timer); resolve(data.phoneme_ids); } };
    worker.postMessage({ type: 'phonemize', data: [text, [{ espeak: config.espeak, phoneme_id_map: config.phoneme_id_map }]] });
  });
  const result = phonemeQueue.then(run, run);
  phonemeQueue = result.catch(() => undefined);
  return result;
}

/** Remembers the last few chunks so a chunk prepared ahead of time starts without a gap. */
const prepared = new Map<string, Promise<{ pcm: Float32Array; sampleRate: number }>>();
export function synthesize(voice: PiperVoice, speaker: number, text: string, rate: number) {
  const id = `${voice.key}|${speaker}|${rate}|${text}`;
  let entry = prepared.get(id);
  if (!entry) {
    entry = (async () => {
      const config = await ensureLoaded(voice);
      const ids = keepKnownPhonemes(await phonemize(text, config), config.phoneme_id_map);
      if (!ids.length) throw new Error('VOICE_EMPTY_OUTPUT');
      const { pcm } = await callModel({ type: 'run', key: voice.key, ids, config: { audio: config.audio, inference: config.inference, num_speakers: config.num_speakers }, rate, speaker });
      if (!pcm?.length) throw new Error('VOICE_EMPTY_OUTPUT');
      return { pcm, sampleRate: config.audio.sample_rate };
    })();
    entry.catch(() => prepared.delete(id));
    prepared.set(id, entry);
    if (prepared.size > 4) prepared.delete(prepared.keys().next().value as string);
  }
  return entry;
}

// ---- playback --------------------------------------------------------------------------------
let context: AudioContext | null = null;
export function speakChunk(voice: PiperVoice, speaker: number, text: string, rate: number, callbacks: SpeakCallbacks): SpeakHandle {
  let stopped = false;
  let source: AudioBufferSourceNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const clear = () => { if (timer) clearInterval(timer); timer = null; };
  (async () => {
    const { pcm, sampleRate } = await synthesize(voice, speaker, text, rate);
    if (stopped) return;
    context ||= new AudioContext();
    if (context.state !== 'running') {
      // A page that has had no click yet may not start audio; do not wait forever for one.
      await Promise.race([context.resume(), new Promise((resolve) => setTimeout(resolve, 600))]);
      if ((context.state as AudioContextState) !== 'running') throw new Error('AUDIO_BLOCKED');
    }
    if (stopped) return;
    const buffer = context.createBuffer(1, pcm.length, sampleRate);
    buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const node = context.createBufferSource();
    node.buffer = buffer;
    // Models differ a lot in loudness (some peak near 0.17), so each chunk is brought to one level.
    const gain = context.createGain();
    gain.gain.value = normalizedGain(pcm);
    node.connect(gain).connect(context.destination);
    node.onended = () => { clear(); if (!stopped) callbacks.onend?.(); };
    source = node;
    const startedAt = context.currentTime;
    node.start();
    callbacks.onstart?.();
    const timeline = wordTimeline(text);
    let next = 0;
    timer = setInterval(() => {
      const progress = (context!.currentTime - startedAt) / buffer.duration;
      while (next < timeline.length && timeline[next].at <= progress) {
        callbacks.onword?.(timeline[next].index, timeline[next].length);
        next += 1;
      }
    }, 50);
  })().catch((error) => { clear(); if (!stopped) callbacks.onerror?.(error instanceof Error ? error : new Error(String(error))); });
  return { stop() { stopped = true; clear(); try { source?.stop(); } catch { /* already ended */ } } };
}

export async function findVoice(id: string): Promise<PiperVoice | null> {
  const key = piperKey(id);
  return (await loadCatalog()).find((voice) => voice.key === key) ?? null;
}
