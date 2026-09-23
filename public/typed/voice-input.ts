export interface VoiceInputController { readonly isSupported:boolean; readonly isListening:()=>boolean; readonly start:()=>void; readonly stop:()=>void; readonly destroy:()=>void; }
interface RecognitionResultLike { readonly transcript?:unknown; }
interface RecognitionEventLike { readonly results?:ArrayLike<ArrayLike<RecognitionResultLike>>; readonly resultIndex?:number; readonly error?:unknown; }
interface SpeechRecognitionLike { lang:string; interimResults:boolean; continuous:boolean; maxAlternatives:number; start():void; stop():void; abort():void; }
type RecognitionInstance=SpeechRecognitionLike&{onstart:(()=>void)|null;onresult:((event:RecognitionEventLike)=>void)|null;onerror:((event:RecognitionEventLike)=>void)|null;onend:(()=>void)|null};
type RecognitionCtor=new()=>RecognitionInstance;
const DEFAULT_LANGUAGE='tr-TR',TOAST_DURATION_MS=4200;
export function getSpeechRecognitionConstructor(root:typeof globalThis):RecognitionCtor|null{const candidate=(root as typeof globalThis & {SpeechRecognition?:RecognitionCtor;webkitSpeechRecognition?:RecognitionCtor});
  return candidate.SpeechRecognition||candidate.webkitSpeechRecognition||null; }
export function normalizeTranscript(value:unknown):string{return typeof value==='string'?value.replace(/\s+/g,' ').trim():'';}
export function mergeTranscript(prefix:unknown,transcript:unknown,maxLength=12000):string{const before=typeof prefix==='string'?prefix.replace(/\s+$/g,
  ''):'';const spoken=normalizeTranscript(transcript);const joined=before&&spoken?`${before} ${spoken}`:before||spoken;const limit=Number.isInteger(maxLength)&&maxLength>0?maxLength:12000;return joined.slice(0, limit);}
export function readRecognitionText(event:RecognitionEventLike):string{if(!event?.results)return''; const chunks:string[]=[]; const start=typeof event.resultIndex==='number'&&Number.isInteger(event.resultIndex)?event.resultIndex:0;
  for(let i=start;i<event.results.length;i++){const alt=event.results[i]?.[0];if(typeof alt?.transcript==='string')chunks.push(alt.transcript);}return normalizeTranscript(chunks.join(' ')); }
export function mapSpeechError(code:unknown):string{switch(code){case'not-allowed':case'service-not-allowed':return'Mikrofon izni verilmedi. Tarayıcı izinlerinden mikrofon erişimini kontrol edebilirsin.';
  case'audio-capture':return'Kullanılabilir bir mikrofon bulunamadı.'; case'no-speech':return'Ses algılanmadı. Mikrofonu tekrar deneyebilirsin.'; case'network':return'Tarayıcının ses tanıma servisine ulaşılamadı.'; case'aborted':return'';
  default:return'Sesli giriş tamamlanamadı. Yazmaya devam edebilirsin.'; }}
export function installVoiceInput(documentRef:Document,root:typeof globalThis):VoiceInputController|null{
 const micButton=documentRef.querySelector<HTMLButtonElement>('#micBtn'),input=documentRef.querySelector<HTMLTextAreaElement>('#messageInput');if(!micButton||!input)return null;
 const toast=documentRef.querySelector<HTMLElement>('#toast'),Recognition=getSpeechRecognitionConstructor(root);let recognition:RecognitionInstance|null=null,listening=false,prefix='';
 let timeoutId:ReturnType<typeof setTimeout>|null=null;const announce=(message:string)=>{if(!toast||!message)return; toast.textContent=message; toast.classList.remove('hidden'); if(timeoutId)clearTimeout(timeoutId);
   timeoutId=setTimeout(()=>toast.classList.add('hidden'),TOAST_DURATION_MS); };
 const render=()=>{
  micButton.disabled=input.disabled;
  micButton.setAttribute('aria-pressed', String(listening));
  micButton.setAttribute('aria-label',
    !Recognition?'Sesli giriş bu tarayıcıda desteklenmiyor':listening?'Sesli girişi durdur':'Sesli giriş');
  micButton.textContent=listening?'●':'◉';
  micButton.title=!Recognition
    ?'Bu tarayıcı konuşma tanımayı desteklemiyor'
    :listening?'Dinlemeyi durdur':'Sesli giriş · ses tanıma tarayıcı sağlayıcın tarafından işlenebilir';
 };
 const stop=()=>{if(!recognition||!listening)return;try{recognition.stop();}catch{listening=false;recognition=null;render();}};
 const start=()=>{if(!Recognition||input.disabled||listening)return; prefix=input.value||''; recognition=new Recognition(); recognition.lang=documentRef.documentElement.lang||root.navigator.language||DEFAULT_LANGUAGE;
   recognition.interimResults=true; recognition.continuous=false; recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;render();announce('Dinleniyor… Ses metne dönüştürülür; otomatik gönderim yapılmaz.');};
  recognition.onresult=(event)=>{const transcript=readRecognitionText(event);if(!transcript)return;input.value=mergeTranscript(prefix,transcript,input.maxLength||12000);input.dispatchEvent(new Event('input',{bubbles:true}));};
  recognition.onerror=(event)=>{const message=mapSpeechError(event.error);if(message)announce(message);};
  recognition.onend=()=>{recognition=null;listening=false;render();if(!documentRef.hidden)input.focus();};
  try{recognition.start();}catch{recognition=null;listening=false;render();announce('Sesli giriş başlatılamadı.');}
 };
 const onClick=(event:MouseEvent)=>{event.preventDefault();event.stopImmediatePropagation();if(!Recognition)return announce('Bu tarayıcı konuşma tanımayı desteklemiyor.');if(input.disabled)return;if(listening)stop();else start();};
 const onVisibility=()=>{if(documentRef.hidden&&listening){try{recognition?.abort();}catch{} }};
 micButton.addEventListener('click',onClick,true);documentRef.addEventListener('visibilitychange',onVisibility);
 const Observer=(root as typeof globalThis&{MutationObserver?:typeof MutationObserver}).MutationObserver;
 const observer=Observer?new Observer(()=>{if(input.disabled&&listening)stop();render()}):null;
 observer?.observe(input,{attributes:true,attributeFilter:['disabled']});render();
 return Object.freeze({isSupported:Boolean(Recognition),isListening:()=>listening,start,stop,destroy(){observer?.disconnect(); if(timeoutId)clearTimeout(timeoutId); try{recognition?.abort();}catch{}recognition=null; listening=false;
   micButton.removeEventListener('click',onClick,true); documentRef.removeEventListener('visibilitychange',onVisibility); }});
}
const api=Object.freeze({DEFAULT_LANGUAGE,getSpeechRecognitionConstructor,installVoiceInput,mapSpeechError,mergeTranscript,normalizeTranscript,readRecognitionText});
(globalThis as typeof globalThis & {HafizeVoiceInput?:unknown}).HafizeVoiceInput=api;
const start=()=>installVoiceInput(document,globalThis);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
