import { Disposer, on, query, safeStorage, writeStorage } from './browser-platform.ts';

export const VOICE_OUTPUT_LIMITS = Object.freeze({ speech: 2400, chunk: 240 });
export const VOICE_OUTPUT_STORAGE_KEY = 'hafize.voiceOutput.v1';

export function normalizeSpeechText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/```[\s\S]*?```/g, ' Kod bloğu atlandı. ').replace(/`([^`]+)`/g, '$1').replace(/https?:\/\/\S+/gi, ' bağlantı ').replace(/[*_#>|~]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, VOICE_OUTPUT_LIMITS.speech);
}

export function splitSpeechText(value: string, maxLength = VOICE_OUTPUT_LIMITS.chunk): string[] {
  const source = normalizeSpeechText(value); const limit = Number.isInteger(maxLength) && maxLength >= 80 ? maxLength : VOICE_OUTPUT_LIMITS.chunk; if (!source) return [];
  const sentences = source.match(/[^.!?…]+[.!?…]?/g) || [source]; const chunks: string[] = []; let current = '';
  for (const sentence of sentences) {
    const clean = sentence.trim(); if (!clean) continue; const candidate = current ? `${current} ${clean}` : clean;
    if (candidate.length <= limit) { current = candidate; continue; }
    if (current) chunks.push(current); if (clean.length <= limit) { current = clean; continue; }
    for (const word of clean.split(' ')) { const next = current ? `${current} ${word}` : word; if (next.length > limit && current) { chunks.push(current); current = word; } else current = next; }
  }
  if (current) chunks.push(current); return chunks;
}

export function installVoiceOutput(documentRef: Document = document, rootRef: Window = window): Readonly<{ isSupported: boolean; isEnabled: () => boolean; isSpeaking: () => boolean; setEnabled: (value: boolean) => boolean; speak: (value: string) => boolean; cancel: () => void; destroy: () => void }> | null {
  const toggle = query<HTMLButtonElement>(documentRef, '#voiceOutputToggle'); const card = query<HTMLElement>(documentRef, '.voice-card'); const mic = query<HTMLElement>(documentRef, '#micBtn'); const input = query<HTMLTextAreaElement>(documentRef, '#messageInput'); const composer = query<HTMLFormElement>(documentRef, '#composer'); const messages = query<HTMLElement>(documentRef, '#messages');
  if (!toggle || !card) return null;
  const synth = rootRef.speechSynthesis; const Utterance = rootRef.SpeechSynthesisUtterance; const supported = Boolean(synth && typeof synth.speak === 'function' && typeof Utterance === 'function');
  let enabled = supported && safeStorage(rootRef.localStorage, VOICE_OUTPUT_STORAGE_KEY, '') === 'true'; let speaking = false; let thinking = false; let queue: string[] = []; const disposer = new Disposer();
  const render = () => { toggle.disabled = !supported; toggle.setAttribute('aria-pressed', String(enabled)); toggle.textContent = supported ? enabled ? 'Sesli yanıt açık' : 'Sesli yanıt kapalı' : 'Sesli yanıt desteklenmiyor'; toggle.title = supported ? 'Hafize yanıtlarını bu cihazın yerleşik sesiyle oku' : 'Bu tarayıcı Speech Synthesis API desteklemiyor'; card.classList.toggle('speaking', speaking); card.classList.toggle('thinking', thinking && !speaking); };
  const cancel = () => { queue = []; speaking = false; try { synth?.cancel(); } catch {} render(); };
  const voice = () => { try { return synth?.getVoices?.().find((item) => String(item?.lang || '').toLowerCase().startsWith('tr')) || null; } catch { return null; } };
  const speakNext = () => { if (!enabled || !supported || !queue.length) { speaking = false; render(); return; } const utterance = new Utterance(queue.shift() || ''); utterance.lang = 'tr-TR'; utterance.rate = .98; utterance.pitch = 1; const selected = voice(); if (selected) utterance.voice = selected; utterance.onend = speakNext; utterance.onerror = () => { queue = []; speaking = false; render(); }; speaking = true; thinking = false; render(); try { synth!.speak(utterance); } catch { utterance.onerror(new SpeechSynthesisErrorEvent('error')); } };
  const speak = (value: string) => { if (!enabled || !supported || documentRef.hidden) return false; const chunks = splitSpeechText(value); if (!chunks.length) return false; cancel(); queue = chunks; speakNext(); return true; };
  const setEnabled = (value: boolean) => { enabled = supported && Boolean(value); writeStorage(rootRef.localStorage, VOICE_OUTPUT_STORAGE_KEY, String(enabled)); if (!enabled) cancel(); render(); return enabled; };
  const latestAssistantText = () => { const nodes = messages?.querySelectorAll('.message.assistant .content') || []; return nodes.length ? nodes[nodes.length - 1]?.textContent || '' : ''; };
  const sync = () => { const busy = Boolean(input?.disabled); if (busy) { thinking = true; if (speaking) cancel(); render(); return; } const finished = thinking; thinking = false; render(); if (finished) speak(latestAssistantText()); };
  const handleToggle = () => setEnabled(!enabled); const handleSubmit = () => cancel(); const visibility = () => { if (documentRef.hidden) cancel(); };
  on(toggle, 'click', handleToggle, undefined, disposer); on(composer, 'submit', handleSubmit, true, disposer); on(documentRef, 'visibilitychange', visibility, undefined, disposer);
  if (mic) { const observer = new MutationObserver(() => { if (mic.getAttribute('aria-pressed') === 'true') cancel(); }); observer.observe(mic, { attributes: true, attributeFilter: ['aria-pressed'] }); disposer.add(() => observer.disconnect()); }
  if (input) { const observer = new MutationObserver(sync); observer.observe(input, { attributes: true, attributeFilter: ['disabled'] }); disposer.add(() => observer.disconnect()); }
  render();
  return Object.freeze({ isSupported: supported, isEnabled: () => enabled, isSpeaking: () => speaking, setEnabled, speak, cancel, destroy: () => { cancel(); disposer.flush(); } });
}

const start = () => installVoiceOutput(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
