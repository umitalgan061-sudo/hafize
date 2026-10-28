export interface VoiceInputController { readonly isSupported:boolean; readonly isListening:()=>boolean; readonly start:()=>void; readonly stop:()=>void; readonly destroy:()=>void; }
export interface RecognitionResultLike { readonly transcript?:unknown; }
export type { RecognitionEventLike };
interface RecognitionEventLike { readonly results?:ArrayLike<ArrayLike<RecognitionResultLike>>; readonly resultIndex?:number; readonly error?:unknown; }
// The DOM lib does not declare a global SpeechRecognition in every configuration, so the shape is spelled out here. It matches the spec, keeping the runtime cast in getSpeechRecognitionConstructor the single source of truth for the constructor.
type RecognitionInstance={start:()=>void;stop:()=>void;abort:()=>void;lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;onstart:(()=>void)|null;onresult:((event:RecognitionEventLike)=>void)|null;onerror:((event:RecognitionEventLike)=>void)|null;onend:(()=>void)|null};
type RecognitionCtor=new()=>RecognitionInstance;
const DEFAULT_LANGUAGE='tr-TR',TOAST_DURATION_MS=4200;
/** hands-free.ts pauses its wake-word listener while this module owns the microphone. */
export const VOICE_INPUT_STATE_EVENT='hafize:voice-input-state';
export function getSpeechRecognitionConstructor(root:typeof globalThis):RecognitionCtor|null{const candidate=(root as typeof globalThis & {SpeechRecognition?:RecognitionCtor;webkitSpeechRecognition?:RecognitionCtor});return candidate.SpeechRecognition||candidate.webkitSpeechRecognition||null;}
export function normalizeTranscript(value:unknown):string{return typeof value==='string'?value.replace(/\s+/g,' ').trim():'';}
export function mergeTranscript(prefix:unknown,transcript:unknown,maxLength=12000):string{const before=typeof prefix==='string'?prefix.replace(/\s+$/g,''):'';const spoken=normalizeTranscript(transcript);const joined=before&&spoken?`${before} ${spoken}`:before||spoken;const limit=Number.isInteger(maxLength)&&maxLength>0?maxLength:12000;return joined.slice(0,limit);}
// Reads the whole session from index 0. The composer is rebuilt as prefix + transcript on every
// event, and resultIndex only marks the first result that changed, so starting there would drop
// words that were already final ("merhaba nasılsın" became "nasılsın").
export function readRecognitionText(event:RecognitionEventLike):string{if(!event?.results)return'';const chunks:string[]=[];for(let i=0;i<event.results.length;i++){const alt=event.results[i]?.[0];if(typeof alt?.transcript==='string')chunks.push(alt.transcript);}return normalizeTranscript(chunks.join(' '));}
export function mapSpeechError(code:unknown):string{switch(code){case'not-allowed':case'service-not-allowed':return'Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofon erişimini kontrol edebilirsin.';case'audio-capture':return'Kullanılabilir bir mikrofon bulunamadı.';case'no-speech':return'Ses algılanmadı. Mikrofonu tekrar deneyebilirsin.';case'network':return'Tarayıcının ses tanıma servisine ulaşılamadı.';case'language-not-supported':return'Türkçe ses tanıma bu tarayıcıda desteklenmiyor.';case'aborted':return'';default:return'Sesli giriş tamamlanamadı. Yazmaya devam edebilirsin.';}}
export function installVoiceInput(documentRef:Document,root:typeof globalThis):VoiceInputController|null{
 const micButton=documentRef.querySelector<HTMLButtonElement>('#micBtn'),input=documentRef.querySelector<HTMLTextAreaElement>('#messageInput');if(!micButton||!input)return null;
 const toast=documentRef.querySelector<HTMLElement>('#toast'),composer=documentRef.querySelector<HTMLElement>('#composer'),Recognition=getSpeechRecognitionConstructor(root);
 let recognition:RecognitionInstance|null=null,listening=false,prefix='',lastApplied='',reported=false;
 let timeoutId:ReturnType<typeof setTimeout>|null=null;const announce=(message:string)=>{if(!toast||!message)return;toast.textContent=message;toast.classList.remove('hidden');if(timeoutId)clearTimeout(timeoutId);timeoutId=setTimeout(()=>toast.classList.add('hidden'),TOAST_DURATION_MS);};
 const publish=()=>{if(reported===listening)return;reported=listening;const Custom=(root as typeof globalThis).CustomEvent;if(typeof Custom!=='function'||typeof documentRef.dispatchEvent!=='function')return;documentRef.dispatchEvent(new Custom(VOICE_INPUT_STATE_EVENT,{detail:{source:'voice-input',listening}}));};
 // An unsupported browser keeps the button clickable so the click can explain why nothing happens.
 const render=()=>{micButton.disabled=input.disabled;micButton.setAttribute('aria-pressed',String(listening));micButton.setAttribute('data-voice-supported',String(Boolean(Recognition)));micButton.setAttribute('aria-label',!Recognition?'Sesli giriş bu tarayıcıda desteklenmiyor':listening?'Sesli girişi durdur':'Sesli giriş');micButton.title=!Recognition?'Bu tarayıcı konuşma tanımayı desteklemiyor':listening?'Dinlemeyi durdur · Ctrl+Shift+M':'Sesli giriş · Ctrl+Shift+M';micButton.textContent=listening?'●':'◉';composer?.classList.toggle('voice-listening',listening);composer?.setAttribute('data-voice-listening',String(listening));publish();};
 const stop=()=>{if(!recognition||!listening)return;try{recognition.stop();}catch{listening=false;recognition=null;lastApplied='';render();}};
 const start=()=>{if(!Recognition||input.disabled||listening||recognition)return;prefix=input.value||'';lastApplied=prefix;const current=new Recognition();recognition=current;current.lang=documentRef.documentElement.lang||root.navigator.language||DEFAULT_LANGUAGE;current.interimResults=true;current.continuous=false;current.maxAlternatives=1;
  current.onstart=()=>{if(recognition!==current)return;listening=true;render();announce('Dinleniyor… Ses tanıma tarayıcı sağlayıcın tarafından işlenebilir; metin otomatik gönderilmez.');};
  // If the user edits the box while speaking, their text becomes the new prefix instead of being overwritten.
  current.onresult=(event:RecognitionEventLike)=>{if(recognition!==current)return;const transcript=readRecognitionText(event);if(!transcript)return;if(input.value!==lastApplied)prefix=input.value;const merged=mergeTranscript(prefix,transcript,input.maxLength>0?input.maxLength:12000);lastApplied=merged;input.value=merged;input.dispatchEvent(new root.Event('input',{bubbles:true}));};
  current.onerror=(event:RecognitionEventLike)=>{if(recognition!==current)return;const message=mapSpeechError(event.error);if(message)announce(message);};
  current.onend=()=>{if(recognition!==current)return;recognition=null;listening=false;lastApplied='';render();if(!documentRef.hidden){input.focus();const end=input.value.length;try{input.setSelectionRange?.(end,end);}catch{}}};
  try{current.start();}catch{recognition=null;listening=false;render();announce('Sesli giriş başlatılamadı.');}
 };
 const toggle=()=>{if(!Recognition)return announce('Bu tarayıcı konuşma tanımayı desteklemiyor. Yazılı giriş kullanılabilir.');if(input.disabled)return announce('Yanıt tamamlanınca sesli girişi kullanabilirsin.');if(listening)stop();else start();};
 const onClick=(event:MouseEvent)=>{event.preventDefault();event.stopImmediatePropagation();toggle();};
 const onShortcut=(event:KeyboardEvent)=>{if(event.repeat||!(event.ctrlKey||event.metaKey)||!event.shiftKey||String(event.key||'').toLowerCase()!=='m')return;event.preventDefault();toggle();};
 const onVisibility=()=>{if(documentRef.hidden&&recognition){try{recognition.abort();}catch{recognition=null;listening=false;render();}}};
 micButton.addEventListener('click',onClick,true);documentRef.addEventListener('visibilitychange',onVisibility);documentRef.addEventListener('keydown',onShortcut);
 const Observer=root.MutationObserver;const observer=Observer?new Observer(()=>{if(input.disabled&&listening)stop();render();}):null;observer?.observe(input,{attributes:true,attributeFilter:['disabled']});render();
 return Object.freeze({isSupported:Boolean(Recognition),isListening:()=>listening,start,stop,destroy(){observer?.disconnect();if(timeoutId)clearTimeout(timeoutId);const active=recognition;recognition=null;try{active?.abort();}catch{}listening=false;publish();composer?.classList.remove('voice-listening');composer?.removeAttribute?.('data-voice-listening');micButton.removeEventListener('click',onClick,true);documentRef.removeEventListener('visibilitychange',onVisibility);documentRef.removeEventListener('keydown',onShortcut);}});
}
const api=Object.freeze({DEFAULT_LANGUAGE,VOICE_INPUT_STATE_EVENT,getSpeechRecognitionConstructor,installVoiceInput,mapSpeechError,mergeTranscript,normalizeTranscript,readRecognitionText});
(globalThis as typeof globalThis & {HafizeVoiceInput?:unknown}).HafizeVoiceInput=api;
const start=()=>installVoiceInput(document,globalThis);
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
