import { Disposer, on, query, boundedText, text } from './browser-platform.ts';

export const VOICE_INPUT_DEFAULT_LANGUAGE = 'tr-TR';
export const VOICE_INPUT_TOAST_DURATION_MS = 4200;

export function getSpeechRecognitionConstructor(root: Window): any { return (root as any).SpeechRecognition || (root as any).webkitSpeechRecognition || null; }
export function normalizeTranscript(value: unknown): string { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''; }
export function mergeTranscript(prefix: string, transcript: string, maxLength = 12000): string { const before = typeof prefix === 'string' ? prefix.replace(/\s+$/g, '') : ''; const spoken = normalizeTranscript(transcript); const joined = before && spoken ? `${before} ${spoken}` : before || spoken; const limit = Number.isInteger(maxLength) && maxLength > 0 ? maxLength : 12000; return joined.slice(0, limit); }
export function readRecognitionText(event: any): string { if (!event?.results) return ''; const chunks: string[] = []; const start = Number.isInteger(event.resultIndex) ? event.resultIndex : 0; for (let i = start; i < event.results.length; i++) { const transcript = event.results[i]?.[0]?.transcript; if (typeof transcript === 'string') chunks.push(transcript); } return normalizeTranscript(chunks.join(' ')); }
export function mapSpeechError(code: unknown): string { switch (code) { case 'not-allowed': case 'service-not-allowed': return 'Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofon erişimini kontrol edebilirsin.'; case 'audio-capture': return 'Kullanılabilir bir mikrofon bulunamadı.'; case 'no-speech': return 'Ses algılanmadı. Mikrofonu tekrar deneyebilirsin.'; case 'network': return 'Tarayıcının ses tanıma servisine ulaşılamadı.'; case 'aborted': return ''; default: return 'Sesli giriş tamamlanamadı. Yazmaya devam edebilirsin.'; } }

export function mountVoiceInput(documentRef: Document = document, rootRef: Window = window): Readonly<{ isSupported: boolean; isListening: () => boolean; start: () => void; stop: () => void; destroy: () => void }> | null {
  const mic = query<HTMLButtonElement>(documentRef, '#micBtn'); const input = query<HTMLTextAreaElement>(documentRef, '#messageInput'); if (!mic || !input) return null;
  const Recognition = getSpeechRecognitionConstructor(rootRef); const disposer = new Disposer(); let recognition: any = null; let listening = false; let prefix = '';
  const toast = query<HTMLElement>(documentRef, '#toast'); let timer = 0;
  const announce = (message: string) => { if (!toast || !message) return; toast.textContent = boundedText(message, 220); toast.classList.remove('hidden'); rootRef.clearTimeout(timer); timer = rootRef.setTimeout(() => toast.classList.add('hidden'), VOICE_INPUT_TOAST_DURATION_MS); };
  const render = () => { mic.disabled = input.disabled; mic.setAttribute('aria-pressed', String(listening)); mic.textContent = listening ? '●' : '◉'; mic.setAttribute('aria-label', Recognition ? listening ? 'Sesli girişi durdur' : 'Sesli giriş' : 'Sesli giriş bu tarayıcıda desteklenmiyor'); mic.title = Recognition ? (listening ? 'Dinlemeyi durdur' : 'Sesli giriş · ses tanıma tarayıcı sağlayıcın tarafından işlenebilir') : 'Bu tarayıcı konuşma tanımayı desteklemiyor'; };
  const stop = () => { if (!recognition || !listening) return; try { recognition.stop(); } catch { listening = false; recognition = null; render(); } };
  const abort = () => { if (!recognition || !listening) return; try { recognition.abort(); } catch {} };
  const start = () => { if (!Recognition || input.disabled || listening) { if (!Recognition) announce('Bu tarayıcı konuşma tanımayı desteklemiyor. Yazılı giriş kullanılabilir.'); return; } prefix = input.value || ''; recognition = new Recognition(); recognition.lang = documentRef.documentElement.lang || rootRef.navigator.language || VOICE_INPUT_DEFAULT_LANGUAGE; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => { listening = true; render(); announce('Dinleniyor… Ses tanıma tarayıcı sağlayıcın tarafından işlenebilir; metin otomatik gönderilmez.'); };
    recognition.onresult = (event: any) => { const value = readRecognitionText(event); if (!value) return; input.value = mergeTranscript(prefix, value, input.maxLength); input.dispatchEvent(new Event('input', { bubbles: true })); };
    recognition.onerror = (event: any) => { const message = mapSpeechError(event?.error); if (message) announce(message); };
    recognition.onend = () => { recognition = null; listening = false; render(); if (!documentRef.hidden) input.focus(); };
    try { recognition.start(); } catch { recognition = null; listening = false; render(); announce('Sesli giriş başlatılamadı. Yazmaya devam edebilirsin.'); }
  };
  const click = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); if (listening) stop(); else start(); };
  const visibility = () => { if (documentRef.hidden) abort(); };
  on(mic, 'click', click, true, disposer); on(documentRef, 'visibilitychange', visibility, undefined, disposer); if (timer) disposer.add(() => rootRef.clearTimeout(timer));
  const observer = new MutationObserver(() => { if (input.disabled && listening) stop(); render(); }); observer.observe(input, { attributes: true, attributeFilter: ['disabled'] }); disposer.add(() => observer.disconnect()); render();
  return Object.freeze({ isSupported: Boolean(Recognition), isListening: () => listening, start, stop, destroy: () => { abort(); recognition = null; listening = false; render(); rootRef.clearTimeout(timer); disposer.flush(); } });
}

const start = () => mountVoiceInput(document, window);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
