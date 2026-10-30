import { SPEAKER_KEY, findVoice, isPiperVoice, speakChunk, synthesize, type SpeakHandle } from './voice-library.ts';
export interface VoiceOutputController { readonly isSupported:boolean; readonly isEnabled:()=>boolean; readonly isSpeaking:()=>boolean; readonly setEnabled:(next:boolean)=>boolean; readonly speak:(value:string)=>boolean; readonly cancel:()=>void; readonly syncStreamState:()=>void; readonly destroy:()=>void; }
export const STORAGE_KEY='hafize.voiceOutput.v1';
/** hands-free.ts pauses its wake-word listener while Hafize speaks, so it never hears itself. */
export const VOICE_OUTPUT_STATE_EVENT='hafize:voice-output-state';
/** Per-chunk and per-word progress for voice-visual.ts (charIndex -1 = a new chunk started). */
export const VOICE_OUTPUT_PROGRESS_EVENT='hafize:voice-output-progress';
/** Anything (e.g. the visual's stop button) can ask the speech to stop. */
export const VOICE_OUTPUT_STOP_EVENT='hafize:voice-output-stop';
/** Read one text aloud on request ({text, origin}), even when automatic voice replies are off. */
export const VOICE_OUTPUT_SPEAK_EVENT='hafize:voice-output-speak';
/** Speaking rate (0.7–1.5) and preferred voiceURI, set from the voice chat screen. */
export const RATE_KEY='hafize.voiceOutput.rate.v1';
export const VOICE_KEY='hafize.voiceOutput.voice.v1';
export function readRate(storage:Storage|null|undefined):number{try{const value=Number(storage?.getItem(RATE_KEY));return Number.isFinite(value)&&value>=0.7&&value<=1.5?value:1;}catch{return 1;}}
const MAX_SPEECH_LENGTH=2400,MAX_CHUNK_LENGTH=240;
// Piper renders a whole chunk before any of it plays, so shorter chunks mean a much quicker first word.
const PIPER_CHUNK_LENGTH=110;
// Errors the browser reports when *we* stopped the speech (new answer, new message, mic); not failures.
const SELF_INFLICTED_ERRORS=new Set(['interrupted','canceled','cancelled']);
export function normalizeSpeechText(value:unknown):string{if(typeof value!=='string')return'';return value
 .replace(/```[\s\S]*?```/g,' Kod bloğu atlandı. ')
 .replace(/!\[([^\]]*)\]\([^)]*\)/g,' $1 ')
 .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g,'$1')
 .replace(/`([^`]+)`/g,'$1')
 .replace(/https?:\/\/\S+/gi,' bağlantı ')
 .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm,' ')
 .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm,' ')
 .replace(/[*_#>|~]+/g,' ')
 // A heading or list item has no full stop; without one the voice runs it into the next line.
 .replace(/([^\s.!?…:;,])[ \t]*\n+/g,'$1. ')
 .replace(/\s+/g,' ').replace(/ ([.,;:!?…])/g,'$1').trim().slice(0,MAX_SPEECH_LENGTH);}
export function splitSpeechText(value:string,maxLength=MAX_CHUNK_LENGTH):string[]{const text=normalizeSpeechText(value);if(!text)return[];const limit=Number.isInteger(maxLength)&&maxLength>=80?maxLength:MAX_CHUNK_LENGTH;const sentences=text.match(/[^.!?…]+[.!?…]?/g)||[text];const chunks:string[]=[];let current='';for(const sentence of sentences){const clean=sentence.trim();if(!clean)continue;const candidate=current?`${current} ${clean}`:clean;if(candidate.length<=limit){current=candidate;continue;}if(current)chunks.push(current);if(clean.length<=limit){current=clean;continue;}let fragment='';for(const word of clean.split(' ')){if(word.length>limit){if(fragment){chunks.push(fragment);fragment='';}for(let i=0;i<word.length;i+=limit)chunks.push(word.slice(i,i+limit));continue;}const next=fragment?`${fragment} ${word}`:word;if(next.length>limit&&fragment){chunks.push(fragment);fragment=word;}else fragment=next;}current=fragment;}if(current)chunks.push(current);return chunks;}
/** Best Turkish voice: natural/online voices first, then any tr voice. */
export function pickTurkishVoice<T extends {lang?:string;name?:string;localService?:boolean;voiceURI?:string}>(voices:readonly T[]|null|undefined,preferredURI?:string|null):T|null{const turkish=(voices||[]).filter(v=>String(v?.lang||'').toLowerCase().replace('_','-').startsWith('tr'));if(preferredURI){const chosen=(voices||[]).find(v=>v?.voiceURI===preferredURI);if(chosen)return chosen;}if(!turkish.length)return null;const score=(v:T)=>{const name=String(v.name||'').toLowerCase();return(/natural|neural/.test(name)?4:0)+(/online|google/.test(name)?2:0)+(v.localService===false?1:0);};return[...turkish].sort((a,b)=>score(b)-score(a))[0]||null;}
function readEnabled(storage:Storage|null):boolean{try{return storage?.getItem(STORAGE_KEY)==='true';}catch{return false;}}
function writeEnabled(storage:Storage|null,enabled:boolean):void{try{storage?.setItem(STORAGE_KEY,String(enabled));}catch{}}
export function installVoiceOutput(documentRef:Document,root:typeof globalThis):VoiceOutputController|null{
 // The chat view hides the utility rail, so the composer carries its own icon toggle. Both share
 // data-voice-toggle="output" and are kept in sync.
 const found=typeof documentRef.querySelectorAll==='function'?[...documentRef.querySelectorAll<HTMLButtonElement>('[data-voice-toggle="output"]')]:[];const legacy=documentRef.querySelector<HTMLButtonElement>('#voiceOutputToggle');if(legacy&&!found.includes(legacy))found.push(legacy);const toggles=found;
 const card=documentRef.querySelector<HTMLElement>('.voice-card'),composer=documentRef.querySelector<HTMLFormElement>('#composer'),input=documentRef.querySelector<HTMLTextAreaElement>('#messageInput'),messages=documentRef.querySelector<HTMLElement>('#messages'),mic=documentRef.querySelector<HTMLButtonElement>('#micBtn'),toast=documentRef.querySelector<HTMLElement>('#toast');if(!toggles.length)return null;
 const synth=root.speechSynthesis,Utterance=root.SpeechSynthesisUtterance,supported=Boolean(synth&&typeof synth.speak==='function'&&Utterance),storage=root.localStorage;
 let enabled=supported&&readEnabled(storage),speaking=false,thinking=false,queue:string[]=[],generation=0,reported='',forced=false,origin='',voiceOverride:string|null=null,piperFailed=false,piperHandle:SpeakHandle|null=null,toastTimer:ReturnType<typeof setTimeout>|null=null;
 const isIcon=(toggle:HTMLButtonElement)=>toggle.id==='voiceOutputBtn';
 const publish=()=>{const key=`${speaking}|${speaking?origin:''}`;if(reported===key)return;reported=key;const Custom=(root as typeof globalThis).CustomEvent;if(typeof Custom!=='function'||typeof documentRef.dispatchEvent!=='function')return;documentRef.dispatchEvent(new Custom(VOICE_OUTPUT_STATE_EVENT,{detail:{source:'voice-output',speaking,origin:speaking?origin:''}}));};
 const render=()=>{for(const toggle of toggles){toggle.disabled=!supported;toggle.setAttribute('aria-pressed',String(enabled));toggle.setAttribute('data-voice-output-state',enabled?'on':'off');toggle.setAttribute('data-speaking',String(speaking));const label=supported?(enabled?(speaking?'Hafize konuşuyor · durdurmak için Esc':'Sesli yanıt açık'):'Sesli yanıt kapalı'):'Sesli yanıt desteklenmiyor';toggle.title=supported?label:'Bu tarayıcı sesli yanıtı desteklemiyor';toggle.setAttribute('aria-label',supported?(enabled?'Sesli yanıtı kapat':'Sesli yanıtı aç'):'Sesli yanıt desteklenmiyor');toggle.textContent=isIcon(toggle)?(supported?(enabled?'\u{1F50A}':'\u{1F508}'):'\u{1F507}'):label;}card?.classList.toggle('speaking',speaking);card?.classList.toggle('thinking',thinking&&!speaking);composer?.classList.toggle('voice-speaking',speaking);publish();};
 const announce=(message:string)=>{if(!toast)return;toast.textContent=message;toast.classList.remove('hidden');if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.add('hidden'),4200);};
 // Every cancel starts a new generation, so callbacks of an interrupted utterance cannot touch the next answer.
 const cancel=()=>{generation+=1;queue=[];forced=false;voiceOverride=null;piperFailed=false;piperHandle?.stop();piperHandle=null;const was=speaking;speaking=false;try{synth?.cancel();}catch{}if(was||thinking)render();else publish();};
 const chosenVoice=()=>{if(voiceOverride)return voiceOverride;try{return storage?.getItem(VOICE_KEY)||null;}catch{return null;}};
 const voice=()=>{try{const preferred=chosenVoice();return pickTurkishVoice(synth?.getVoices?.(),isPiperVoice(preferred)?null:preferred);}catch{return null;}};
 const chosenSpeaker=()=>{try{const value=Number(storage?.getItem(SPEAKER_KEY));return Number.isInteger(value)&&value>=0?value:0;}catch{return 0;}};
 const next=(token:number)=>{if(token!==generation)return;if((!enabled&&!forced)||!supported||documentRef.hidden||!queue.length){speaking=false;forced=false;render();return;}
  const text=queue.shift()!;const progress=(charIndex:number,charLength:number)=>{if(token!==generation)return;const Custom=(root as typeof globalThis).CustomEvent;if(typeof Custom!=='function'||typeof documentRef.dispatchEvent!=='function')return;documentRef.dispatchEvent(new Custom(VOICE_OUTPUT_PROGRESS_EVENT,{detail:{source:'voice-output',text,charIndex,charLength}}));};
  const chosen=chosenVoice();
  if(isPiperVoice(chosen)&&!piperFailed){
   // A downloaded voice: if it cannot speak, the rest of the answer falls back to a browser voice.
   const fail=(error:Error)=>{if(token!==generation)return;console.warn('[hafize] Piper sesi kullanılamadı:',error);piperFailed=true;piperHandle=null;queue.unshift(text);announce(error.message==='VOICE_NOT_DOWNLOADED'?'Seçili ses bu cihazda yok; tarayıcı sesi kullanılıyor.':error.message==='AUDIO_BLOCKED'?'Ses başlatılamadı; sayfaya bir kez tıklayıp yeniden dene.':'Seçili ses çalışmadı; tarayıcı sesi kullanılıyor.');next(token);};
   speaking=true;thinking=false;render();
   findVoice(chosen).then((piper)=>{if(token!==generation)return;if(!piper)throw new Error('VOICE_NOT_DOWNLOADED');const rate=readRate(storage),speaker=chosenSpeaker();
    piperHandle=speakChunk(piper,speaker,text,rate,{onstart:()=>progress(-1,0),onword:progress,onend:()=>{piperHandle=null;next(token);},onerror:fail});
    if(queue[0])synthesize(piper,speaker,queue[0],rate).catch(()=>undefined);}).catch(fail);
   return;
  }
  const utterance=new Utterance(text);const selected=voice();utterance.lang=selected?.lang||'tr-TR';utterance.rate=readRate(storage);utterance.pitch=1;if(selected)utterance.voice=selected;
  utterance.onstart=()=>progress(-1,0);
  utterance.onboundary=(event:{name?:string;charIndex?:number;charLength?:number})=>{if(event?.name&&event.name!=='word')return;const index=Number(event?.charIndex);if(!Number.isFinite(index)||index<0)return;const length=Number(event?.charLength)>0?Number(event.charLength):(text.slice(index).match(/^\S+/)?.[0].length||0);progress(index,length);};
  utterance.onend=()=>next(token);
  utterance.onerror=(event:{error?:string})=>{if(token!==generation)return;if(SELF_INFLICTED_ERRORS.has(String(event?.error||'')))return;queue=[];speaking=false;render();announce('Sesli yanıt tamamlanamadı.');};
  speaking=true;thinking=false;render();
  // Chrome can leave the engine paused after a tab switch; speak() then queues forever.
  try{if(synth.paused)synth.resume();synth.speak(utterance);}catch{queue=[];speaking=false;render();announce('Sesli yanıt tamamlanamadı.');}};
 const onVoicesChanged=()=>{render();};synth?.addEventListener?.('voiceschanged',onVoicesChanged);
 const speak=(value:string,options:{force?:boolean;origin?:string;voice?:string}={})=>{if((!enabled&&!options.force)||!supported||documentRef.hidden)return false;voiceOverride=options.voice||null;const chunks=splitSpeechText(value,isPiperVoice(chosenVoice())?PIPER_CHUNK_LENGTH:MAX_CHUNK_LENGTH);voiceOverride=null;if(!chunks.length)return false;cancel();voiceOverride=options.voice||null;forced=Boolean(options.force);origin=typeof options.origin==='string'?options.origin:'auto';queue=chunks;next(generation);return true;};
 const onSpeakRequest=(event:Event)=>{const detail=(event as CustomEvent).detail;if(typeof detail?.text!=='string')return;if(!supported){announce('Bu tarayıcı sesli okumayı desteklemiyor.');return;}speak(detail.text,{force:true,origin:typeof detail.origin==='string'?detail.origin:'request',voice:typeof detail.voice==='string'?detail.voice:undefined});};
 const setEnabled=(nextEnabled:boolean)=>{enabled=supported&&Boolean(nextEnabled);writeEnabled(storage,enabled);if(!enabled)cancel();render();return enabled;};
 const latest=()=>{const nodes=messages?.querySelectorAll('.message.assistant .content')||[];const node=nodes.length?nodes[nodes.length-1]:null;if(!node)return'';return (root as typeof globalThis & {HafizeChatMarkdown?:{sourceFor?:(n:Element)=>string}}).HafizeChatMarkdown?.sourceFor?.(node)||node.textContent||'';};
 const sync=()=>{const busy=Boolean(input?.disabled);if(busy){if(!thinking){thinking=true;if(speaking)cancel();render();}return;}const justFinished=thinking;thinking=false;render();if(justFinished&&documentRef.documentElement?.dataset?.voiceMode!=='true')speak(latest());};
 const onToggle=()=>{const on=setEnabled(!enabled);if(supported)announce(on?'Sesli yanıt açık: Hafize yanıtlarını sesli okuyacak.':'Sesli yanıt kapatıldı.');};
 const onSubmit=()=>cancel(),onVisibility=()=>{if(documentRef.hidden)cancel();};
 const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&speaking){cancel();}};
 const onStop=()=>{if(speaking)cancel();};
 for(const toggle of toggles)toggle.addEventListener('click',onToggle);composer?.addEventListener('submit',onSubmit,true);documentRef.addEventListener('visibilitychange',onVisibility);documentRef.addEventListener('keydown',onKey);documentRef.addEventListener(VOICE_OUTPUT_STOP_EVENT,onStop);documentRef.addEventListener(VOICE_OUTPUT_SPEAK_EVENT,onSpeakRequest);
 const Observer=root.MutationObserver;const micObserver=mic&&Observer?new Observer(()=>{if(mic.getAttribute('aria-pressed')==='true')cancel();}):null;micObserver?.observe(mic!,{attributes:true,attributeFilter:['aria-pressed']});
 const streamObserver=input&&Observer?new Observer(sync):null;streamObserver?.observe(input!,{attributes:true,attributeFilter:['disabled']});render();
 return Object.freeze({isSupported:supported,isEnabled:()=>enabled,isSpeaking:()=>speaking,setEnabled,speak,cancel,syncStreamState:sync,destroy(){cancel();micObserver?.disconnect();streamObserver?.disconnect();synth?.removeEventListener?.('voiceschanged',onVoicesChanged);if(toastTimer)clearTimeout(toastTimer);for(const toggle of toggles)toggle.removeEventListener('click',onToggle);composer?.removeEventListener('submit',onSubmit,true);documentRef.removeEventListener('visibilitychange',onVisibility);documentRef.removeEventListener('keydown',onKey);documentRef.removeEventListener(VOICE_OUTPUT_STOP_EVENT,onStop);documentRef.removeEventListener(VOICE_OUTPUT_SPEAK_EVENT,onSpeakRequest);}});
}
const api=Object.freeze({STORAGE_KEY,RATE_KEY,VOICE_KEY,VOICE_OUTPUT_STATE_EVENT,VOICE_OUTPUT_PROGRESS_EVENT,VOICE_OUTPUT_STOP_EVENT,VOICE_OUTPUT_SPEAK_EVENT,readRate,normalizeSpeechText,splitSpeechText,pickTurkishVoice,installVoiceOutput});
(globalThis as typeof globalThis & {HafizeVoiceOutput?:unknown}).HafizeVoiceOutput=api;
const start=()=>installVoiceOutput(document,globalThis);
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
