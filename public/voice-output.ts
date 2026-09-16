type VoiceOutputWindow = Window & typeof globalThis & { HafizeVoiceOutput?: VoiceOutputApi };
type VoiceOutputApi = Readonly<{ readonly STORAGE_KEY: string; readonly normalizeSpeechText: (value: unknown) => string; readonly splitSpeechText: (value: unknown, maxLength?: number) => string[]; readonly installVoiceOutput: (documentRef: Document, root: VoiceOutputWindow) => VoiceOutputController | null }>;
export type VoiceOutputController = Readonly<{ readonly isSupported: boolean; readonly isEnabled: () => boolean; readonly isSpeaking: () => boolean; readonly setEnabled: (next: boolean) => boolean; readonly speak: (value: unknown) => boolean; readonly cancel: () => void; readonly syncStreamState: () => void; readonly destroy: () => void }>;

const STORAGE_KEY = 'hafize.voiceOutput.v1';
const MAX_SPEECH_LENGTH = 2_400;
const MAX_CHUNK_LENGTH = 240;
const clamp = (value: unknown, max: number): string => String(value ?? '').slice(0, max);

export function normalizeSpeechText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/```[\s\S]*?```/g, ' Kod bloğu atlandı. ').replace(/`([^`]+)`/g, '$1').replace(/https?:\/\/\S+/gi, ' bağlantı ').replace(/[*_#>|~]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_LENGTH);
}

export function splitSpeechText(value: unknown, maxLength = MAX_CHUNK_LENGTH): string[] {
  const text = normalizeSpeechText(value); if (!text) return [];
  const limit = Number.isInteger(maxLength) && maxLength >= 80 ? maxLength : MAX_CHUNK_LENGTH;
  const sentences = text.match(/[^.!?…]+[.!?…]?/g) ?? [text]; const chunks: string[] = []; let current = '';
  for (const sentence of sentences) {
    const clean = sentence.trim(); if (!clean) continue; const candidate = current ? `${current} ${clean}` : clean;
    if (candidate.length <= limit) { current = candidate; continue; }
    if (current) chunks.push(current);
    if (clean.length <= limit) { current = clean; continue; }
    current = '';
    for (const word of clean.split(' ')) { const next = current ? `${current} ${word}` : word; if (next.length > limit && current) { chunks.push(current); current = word; } else current = next; }
  }
  if (current) chunks.push(current); return chunks;
}

function readStoredEnabled(storage: Storage | null | undefined): boolean { try { return storage?.getItem(STORAGE_KEY) === 'true'; } catch { return false; } }
function writeStoredEnabled(storage: Storage | null | undefined, enabled: boolean): void { try { storage?.setItem(STORAGE_KEY, String(enabled)); } catch { /* optional persistence */ } }

function installVoiceOutput(documentRef: Document, root: VoiceOutputWindow): VoiceOutputController | null {
  const toggle = documentRef.querySelector<HTMLButtonElement>('#voiceOutputToggle'); const card = documentRef.querySelector<HTMLElement>('.voice-card'); const micButton = documentRef.querySelector<HTMLButtonElement>('#micBtn'); const messageInput = documentRef.querySelector<HTMLTextAreaElement>('#messageInput'); const composer = documentRef.querySelector<HTMLFormElement>('#composer'); const messages = documentRef.querySelector<HTMLElement>('#messages');
  if (!toggle || !card) return null;
  const synth = root.speechSynthesis; const Utterance = root.SpeechSynthesisUtterance; const supported = typeof synth?.speak === 'function' && typeof Utterance === 'function';
  let enabled = supported && readStoredEnabled(root.localStorage); let speaking = false; let thinking = false; let queue: string[] = [];
  const render = (): void => { toggle.disabled = !supported; toggle.setAttribute('aria-pressed', String(enabled)); toggle.textContent = supported ? (enabled ? 'Sesli yanıt açık' : 'Sesli yanıt kapalı') : 'Sesli yanıt desteklenmiyor'; toggle.title = supported ? 'Hafize yanıtlarını bu cihazın yerleşik sesiyle oku' : 'Bu tarayıcı Speech Synthesis API desteklemiyor'; card.classList.toggle('speaking', speaking); card.classList.toggle('thinking', thinking && !speaking); };
  const cancelSpeech = (): void => { queue = []; speaking = false; try { synth?.cancel(); } catch { /* no-op */ } render(); };
  const findTurkishVoice = (): SpeechSynthesisVoice | null => { try { return [...(synth?.getVoices() ?? [])].find((voice) => String(voice.lang).toLowerCase().startsWith('tr')) ?? null; } catch { return null; } };
  const speakNext = (): void => {
    if (!enabled || !supported || !queue.length || !Utterance || !synth) { speaking = false; render(); return; }
    const utterance = new Utterance(queue.shift() ?? ''); utterance.lang = 'tr-TR'; utterance.rate = 0.98; utterance.pitch = 1; const voice = findTurkishVoice(); if (voice) utterance.voice = voice;
    utterance.onend = speakNext; utterance.onerror = () => { queue = []; speaking = false; render(); }; speaking = true; thinking = false; render();
    try { synth.speak(utterance); } catch { queue = []; speaking = false; render(); }
  };
  const speak = (value: unknown): boolean => { if (!enabled || !supported || documentRef.hidden) return false; const chunks = splitSpeechText(value); if (!chunks.length) return false; cancelSpeech(); queue = chunks; speakNext(); return true; };
  const setEnabled = (next: boolean): boolean => { enabled = supported && Boolean(next); writeStoredEnabled(root.localStorage, enabled); if (!enabled) cancelSpeech(); render(); return enabled; };
  const latestAssistantText = (): string => { const nodes = messages?.querySelectorAll('.message.assistant .content') ?? []; return nodes.length ? nodes[nodes.length - 1]?.textContent ?? '' : ''; };
  const syncStreamState = (): void => { const busy = Boolean(messageInput?.disabled); if (busy) { thinking = true; if (speaking) cancelSpeech(); render(); return; } const responseJustFinished = thinking; thinking = false; render(); if (responseJustFinished) speak(latestAssistantText()); };
  const handleToggle = (): void => { setEnabled(!enabled); }; const handleSubmit = (): void => { cancelSpeech(); }; const handleVisibility = (): void => { if (documentRef.hidden) cancelSpeech(); };
  toggle.addEventListener('click', handleToggle); composer?.addEventListener('submit', handleSubmit, true); documentRef.addEventListener('visibilitychange', handleVisibility);
  const micObserver = micButton ? new MutationObserver(() => { if (micButton.getAttribute('aria-pressed') === 'true') cancelSpeech(); }) : null; micObserver?.observe(micButton, { attributes: true, attributeFilter: ['aria-pressed'] });
  const streamObserver = messageInput ? new MutationObserver(syncStreamState) : null; streamObserver?.observe(messageInput, { attributes: true, attributeFilter: ['disabled'] });
  render();
  return Object.freeze({ isSupported: supported, isEnabled: () => enabled, isSpeaking: () => speaking, setEnabled, speak, cancel: cancelSpeech, syncStreamState, destroy: () => { cancelSpeech(); micObserver?.disconnect(); streamObserver?.disconnect(); toggle.removeEventListener('click', handleToggle); composer?.removeEventListener('submit', handleSubmit, true); documentRef.removeEventListener('visibilitychange', handleVisibility); } });
}

export const HafizeVoiceOutput: VoiceOutputApi = Object.freeze({ STORAGE_KEY, normalizeSpeechText, splitSpeechText, installVoiceOutput });
const root = globalThis as VoiceOutputWindow; root.HafizeVoiceOutput = HafizeVoiceOutput;
const boot = (): void => { void installVoiceOutput(document, root); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
