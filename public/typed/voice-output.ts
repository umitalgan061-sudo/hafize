import { SPEAKER_KEY, findVoice, isPiperVoice, speakChunk, synthesize, unlockAudio, type SpeakHandle } from './voice-library.ts';
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
const MAX_SPEECH_LENGTH=200000,MAX_CHUNK_LENGTH=240;
// Piper renders a whole chunk before any of it plays, so shorter chunks mean a much quicker first word.
const PIPER_CHUNK_LENGTH=110;
// Deliberate cancellation invalidates the token. Unexpected browser "interrupted" events
// must still finish the turn, or mobile speech can permanently lock the mic.
const MAX_UTTERANCE_MS=45_000;
// A phone ignores speech that starts without a touch: no sound, no start, no end, no error. Without this the label
// said "Hafize konuşuyor" over silence (20 Kasım 2026, the owner's iPhone).
export const START_TIMEOUT_MS=6000;
export const NOT_STARTED='Ses başlatılamadı; ekrana bir kez dokunup 🔊 Seslendir\'e bas.';
export function normalizeSpeechText(value:unknown):string{if(typeof value!=='string')return'';return value
 .replace(/```[\s\S]*?```/g,' Kod bloğu atlandı. ')
 .replace(/!\[([^\]]*)\]\([^)]*\)/g,' $1 ')
 .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g,'$1')
 .replace(/`([^`]+)`/g,'$1')
 .replace(/https?:\/\/\S+/gi,' bağlantı ')
 .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm,' ')
 .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm,' ')
 .replace(/%(\d+(?:[.,]\d+)?)/g,'yüzde $1')
 .replace(/\b(Dr|Prof|Doç)\.(?=\s+\p{L})/gu, (_, title: string) => (title === 'Dr' ? 'Doktor' : title === 'Prof' ? 'Profesör' : 'Doçent'))
 .replace(/[*_#>|~]+/g,' ')
 .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu,' ')
 // A heading or list item has no full stop; without one the voice runs it into the next line.
 .replace(/([^\s.!?…:;,])[ \t]*\n+/g,'$1. ')
 .replace(/\s+/g,' ').replace(/ ([.,;:!?…])/g,'$1').trim().slice(0,MAX_SPEECH_LENGTH);}
export function splitSpeechText(value: string, maxLength = MAX_CHUNK_LENGTH): string[] {
 const text = normalizeSpeechText(value);
 const limit = Number.isInteger(maxLength) && maxLength >= 80 ? maxLength : MAX_CHUNK_LENGTH;
 const chunks: string[] = [];
 let rest = text;
 while (rest.length > limit) {
   const window = rest.slice(0, limit + 1);
   let cut = 0;
   // Prefer ending an utterance at a sentence boundary, then at a pause within the sentence.
   for (const boundary of [/[.!?…]["”’)]*\s+/gu, /[,;:—]\s+/gu, /\s+/gu]) {
     for (const match of window.matchAll(boundary)) cut = match.index! + match[0].trimEnd().length;
     if (cut > 0) break;
   }
   if (!cut) cut = limit;
   chunks.push(rest.slice(0, cut).trimEnd());
   rest = rest.slice(cut).trimStart();
 }
 if (rest) chunks.push(rest);
 return chunks;
}
/** Best Turkish voice: natural/online voices first, then any tr voice. */
export function pickTurkishVoice<T extends {lang?:string;name?:string;localService?:boolean;voiceURI?:string}>(voices:readonly T[]|null|undefined,preferredURI?:string|null):T|null{const turkish=(voices||[]).filter(v=>String(v?.lang||'').toLowerCase().replace('_','-').startsWith('tr'));if(preferredURI){const chosen=turkish.find(v=>v?.voiceURI===preferredURI);if(chosen)return chosen;}if(!turkish.length)return null;const score=(v:T)=>{const name=String(v.name||'').toLowerCase();return(/natural|neural|premium|enhanced|geliştirilmiş|doğal/.test(name)?6:0)+(/online|google/.test(name)?2:0)+(v.localService===false?1:0);};return[...turkish].sort((a,b)=>score(b)-score(a))[0]||null;}
function readEnabled(storage:Storage|null):boolean{try{return storage?.getItem(STORAGE_KEY)==='true';}catch{return false;}}
function writeEnabled(storage:Storage|null,enabled:boolean):void{try{storage?.setItem(STORAGE_KEY,String(enabled));}catch{}}
export function installVoiceOutput(documentRef:Document,root:typeof globalThis):VoiceOutputController|null{
 // The chat view hides the utility rail, so the composer carries its own icon toggle. Both share
 // data-voice-toggle="output" and are kept in sync.
 const found=typeof documentRef.querySelectorAll==='function'?[...documentRef.querySelectorAll<HTMLButtonElement>('[data-voice-toggle="output"]')]:[];const legacy=documentRef.querySelector<HTMLButtonElement>('#voiceOutputToggle');if(legacy&&!found.includes(legacy))found.push(legacy);const toggles=found;
 const card=documentRef.querySelector<HTMLElement>('.voice-card'),composer=documentRef.querySelector<HTMLFormElement>('#composer'),input=documentRef.querySelector<HTMLTextAreaElement>('#messageInput'),messages=documentRef.querySelector<HTMLElement>('#messages'),mic=documentRef.querySelector<HTMLButtonElement>('#micBtn'),toast=documentRef.querySelector<HTMLElement>('#toast');if(!toggles.length)return null;
 const synth=root.speechSynthesis,Utterance=root.SpeechSynthesisUtterance,supported=Boolean(synth&&typeof synth.speak==='function'&&Utterance),storage=root.localStorage;
 let enabled=supported&&readEnabled(storage),speaking=false,thinking=false,queue:string[]=[],generation=0,reported='',forced=false,origin='',voiceOverride:string|null=null,speakerOverride:number|null=null,piperHandle:SpeakHandle|null=null,toastTimer:ReturnType<typeof setTimeout>|null=null,speechUnlocked=false;
 const isIcon=(toggle:HTMLButtonElement)=>toggle.id==='voiceOutputBtn';
 const publish=()=>{const key=`${speaking}|${speaking?origin:''}`;if(reported===key)return;reported=key;const Custom=(root as typeof globalThis).CustomEvent;if(typeof Custom!=='function'||typeof documentRef.dispatchEvent!=='function')return;documentRef.dispatchEvent(new Custom(VOICE_OUTPUT_STATE_EVENT,{detail:{source:'voice-output',speaking,origin:speaking?origin:''}}));};
 const render=()=>{for(const toggle of toggles){toggle.disabled=!supported;toggle.setAttribute('aria-pressed',String(enabled));toggle.setAttribute('data-voice-output-state',enabled?'on':'off');toggle.setAttribute('data-speaking',String(speaking));const label=supported?(enabled?(speaking?'Hafize konuşuyor · durdurmak için Esc':'Sesli yanıt açık'):'Sesli yanıt kapalı'):'Sesli yanıt desteklenmiyor';toggle.title=supported?label:'Bu tarayıcı sesli yanıtı desteklemiyor';toggle.setAttribute('aria-label',supported?(enabled?'Sesli yanıtı kapat':'Sesli yanıtı aç'):'Sesli yanıt desteklenmiyor');toggle.textContent=isIcon(toggle)?(supported?(enabled?'\u{1F50A}':'\u{1F508}'):'\u{1F507}'):label;}card?.classList.toggle('speaking',speaking);card?.classList.toggle('thinking',thinking&&!speaking);composer?.classList.toggle('voice-speaking',speaking);publish();};
 const announce=(message:string)=>{if(!toast)return;toast.textContent=message;toast.classList.remove('hidden');if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.add('hidden'),4200);};
 // Every cancel starts a new generation, so callbacks of an interrupted utterance cannot touch the next answer.
 const cancel=()=>{generation+=1;queue=[];forced=false;voiceOverride=null;speakerOverride=null;piperHandle?.stop();piperHandle=null;const was=speaking;speaking=false;try{synth?.cancel();}catch{}if(was||thinking)render();else publish();};
 const chosenVoice=()=>{if(voiceOverride)return voiceOverride;try{return storage?.getItem(VOICE_KEY)||null;}catch{return null;}};
 const voice=()=>{try{const preferred=chosenVoice();return pickTurkishVoice(synth?.getVoices?.(),isPiperVoice(preferred)?null:preferred);}catch{return null;}};
 const chosenSpeaker=()=>{if(speakerOverride!==null)return speakerOverride;try{const value=Number(storage?.getItem(SPEAKER_KEY));return Number.isInteger(value)&&value>=0?value:0;}catch{return 0;}};
 const next=(token:number)=>{if(token!==generation)return;if((!enabled&&!forced)||!supported||documentRef.hidden||!queue.length){speaking=false;forced=false;render();return;}
  const text=queue.shift()!;const progress=(charIndex:number,charLength:number)=>{if(token!==generation)return;const Custom=(root as typeof globalThis).CustomEvent;if(typeof Custom!=='function'||typeof documentRef.dispatchEvent!=='function')return;documentRef.dispatchEvent(new Custom(VOICE_OUTPUT_PROGRESS_EVENT,{detail:{source:'voice-output',origin,text,charIndex,charLength}}));};
  const chosen=chosenVoice();
  if(isPiperVoice(chosen)){
   // Preserve the selected speaker if synthesis or playback fails.
   let settled=false;
   let watchdog:ReturnType<typeof setTimeout>|null=null;
   const fail=(error:Error)=>{
     if(token!==generation||settled)return;
     settled=true;if(watchdog)clearTimeout(watchdog);
     piperHandle?.stop();
     console.warn('[hafize] İndirilen ses başlatılamadı:',error);
     piperHandle=null;queue=[];speaking=false;forced=false;render();
     if(error.message==='AUDIO_BLOCKED') announce(NOT_STARTED);
     else if(error.message==='VOICE_NOT_DOWNLOADED') announce('Seçili ses bu cihazda eksik. Ayarlar > Ses bölümünden yeniden indirebilirsin.');
     else announce('Seçili ses başlatılamadı. Ses ayarlarında Dinle ile yeniden dene.');
   };
   speaking=true;thinking=false;render();
   watchdog=setTimeout(()=>fail(new Error('VOICE_SYNTHESIS_TIMEOUT')),45_000);
   findVoice(chosen).then((piper)=>{if(token!==generation||settled)return;if(!piper)throw new Error('VOICE_NOT_DOWNLOADED');const rate=readRate(storage),speaker=chosenSpeaker();
    piperHandle=speakChunk(piper,speaker,text,rate,{onstart:()=>progress(-1,0),onword:progress,onend:()=>{if(settled||token!==generation)return;settled=true;if(watchdog)clearTimeout(watchdog);piperHandle=null;next(token);},onerror:fail});
    if(queue[0])synthesize(piper,speaker,queue[0],rate).catch(()=>undefined);}).catch(fail);
   return;
  }
  const utterance=new Utterance(text);const selected=voice();utterance.lang=selected?.lang||'tr-TR';utterance.rate=readRate(storage);utterance.pitch=1;if(selected)utterance.voice=selected;
  let started=false,finished=false;
  utterance.onstart=()=>{if(token!==generation||finished)return;started=true;progress(-1,0);};
  utterance.onboundary=(event:{name?:string;charIndex?:number;charLength?:number})=>{if(token!==generation||finished)return;if(event?.name&&event.name!=='word')return;const index=Number(event?.charIndex);if(!Number.isFinite(index)||index<0)return;const length=Number(event?.charLength)>0?Number(event.charLength):(text.slice(index).match(/^\S+/)?.[0].length||0);progress(index,length);};
  utterance.onend=()=>{if(token!==generation||finished)return;finished=true;started=true;next(token);};
  utterance.onerror=()=>{if(token!==generation||finished)return;finished=true;started=true;generation+=1;queue=[];speaking=false;render();announce('Sesli yanıt kesildi. Konuşmaya devam edebilirsin.');};
  speaking=true;thinking=false;render();
  // Chrome can leave the engine paused after a tab switch; speak() then queues forever.
  try{if(synth.paused)synth.resume();synth.speak(utterance);}catch{finished=true;queue=[];speaking=false;render();announce('Sesli yanıt tamamlanamadı.');return;}
  setTimeout(()=>{if(token!==generation||started||finished||!speaking)return;finished=true;generation+=1;queue=[];speaking=false;try{synth.cancel();}catch{}render();announce(NOT_STARTED);},START_TIMEOUT_MS);
  // onstart without onend/onerror also happens on phones; never hold the microphone forever.
  setTimeout(()=>{if(token!==generation||finished||!speaking)return;finished=true;generation+=1;queue=[];speaking=false;try{synth.cancel();}catch{}render();announce('Sesli yanıt duraksadı. Tekrar konuşabilirsin.');},MAX_UTTERANCE_MS);};
 // Inside the first touch or key press: opens audio for later answers (iPhone allows sound only after one).
 const unlock=()=>{unlockAudio();if(speechUnlocked||!supported)return;speechUnlocked=true;try{const silent=new Utterance(' ');silent.volume=0;synth.speak(silent);}catch{}};
 const onVoicesChanged=()=>{render();};synth?.addEventListener?.('voiceschanged',onVoicesChanged);
 const speak=(value:string,options:{force?:boolean;origin?:string;voice?:string;speaker?:number;append?:boolean}={})=>{if((!enabled&&!options.force)||!supported||documentRef.hidden)return false;voiceOverride=options.voice||null;const chunks=splitSpeechText(value,isPiperVoice(chosenVoice())?PIPER_CHUNK_LENGTH:MAX_CHUNK_LENGTH);voiceOverride=null;if(!chunks.length)return false;if(options.append&&speaking&&origin===options.origin){const wasEmpty=!queue.length;queue.push(...chunks);const chosen=chosenVoice();if(wasEmpty&&isPiperVoice(chosen))findVoice(chosen).then((piper)=>{if(piper&&queue[0])return synthesize(piper,chosenSpeaker(),queue[0],readRate(storage));}).catch(()=>undefined);return true;}cancel();voiceOverride=options.voice||null;speakerOverride=Number.isInteger(options.speaker)&&Number(options.speaker)>=0?Number(options.speaker):null;forced=Boolean(options.force);origin=typeof options.origin==='string'?options.origin:'auto';queue=chunks;next(generation);return true;};
 const onSpeakRequest=(event:Event)=>{const detail=(event as CustomEvent).detail;if(typeof detail?.text!=='string')return;if(!supported){announce('Bu tarayıcı sesli okumayı desteklemiyor.');return;}if(detail.origin?.startsWith('voice-preview:')) unlockAudio();speak(detail.text,{force:true,origin:typeof detail.origin==='string'?detail.origin:'request',voice:typeof detail.voice==='string'?detail.voice:undefined,speaker:Number.isInteger(detail.speaker)&&detail.speaker>=0?detail.speaker:undefined,append:detail.append===true});};
 const setEnabled=(nextEnabled:boolean)=>{enabled=supported&&Boolean(nextEnabled);writeEnabled(storage,enabled);if(!enabled)cancel();render();return enabled;};
 const latest=()=>{const nodes=messages?.querySelectorAll('.message.assistant .content')||[];const node=nodes.length?nodes[nodes.length-1]:null;if(!node)return'';return (root as typeof globalThis & {HafizeChatMarkdown?:{sourceFor?:(n:Element)=>string}}).HafizeChatMarkdown?.sourceFor?.(node)||node.textContent||'';};
 const sync=()=>{const busy=Boolean(input?.disabled);if(busy){if(!thinking){thinking=true;if(speaking&&documentRef.documentElement?.dataset?.voiceMode!=='true')cancel();render();}return;}const justFinished=thinking;thinking=false;render();if(justFinished&&documentRef.documentElement?.dataset?.voiceMode!=='true')speak(latest());};
 const onToggle=()=>{const on=setEnabled(!enabled);if(supported)announce(on?'Sesli yanıt açık: Hafize yanıtlarını sesli okuyacak.':'Sesli yanıt kapatıldı.');};
 const onSubmit=()=>cancel(),onVisibility=()=>{if(documentRef.hidden)cancel();};
 const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&speaking){cancel();}};
 const onStop=()=>{if(speaking)cancel();};
 for(const type of ['pointerdown','touchend','keydown'])documentRef.addEventListener(type,unlock,true);
 for(const toggle of toggles)toggle.addEventListener('click',onToggle);composer?.addEventListener('submit',onSubmit,true);documentRef.addEventListener('visibilitychange',onVisibility);documentRef.addEventListener('keydown',onKey);documentRef.addEventListener(VOICE_OUTPUT_STOP_EVENT,onStop);documentRef.addEventListener(VOICE_OUTPUT_SPEAK_EVENT,onSpeakRequest);
 const Observer=root.MutationObserver;const micObserver=mic&&Observer?new Observer(()=>{if(mic.getAttribute('aria-pressed')==='true')cancel();}):null;micObserver?.observe(mic!,{attributes:true,attributeFilter:['aria-pressed']});
 const streamObserver=input&&Observer?new Observer(sync):null;streamObserver?.observe(input!,{attributes:true,attributeFilter:['disabled']});render();
 return Object.freeze({isSupported:supported,isEnabled:()=>enabled,isSpeaking:()=>speaking,setEnabled,speak,cancel,syncStreamState:sync,destroy(){cancel();for(const type of ['pointerdown','touchend','keydown'])documentRef.removeEventListener(type,unlock,true);micObserver?.disconnect();streamObserver?.disconnect();synth?.removeEventListener?.('voiceschanged',onVoicesChanged);if(toastTimer)clearTimeout(toastTimer);for(const toggle of toggles)toggle.removeEventListener('click',onToggle);composer?.removeEventListener('submit',onSubmit,true);documentRef.removeEventListener('visibilitychange',onVisibility);documentRef.removeEventListener('keydown',onKey);documentRef.removeEventListener(VOICE_OUTPUT_STOP_EVENT,onStop);documentRef.removeEventListener(VOICE_OUTPUT_SPEAK_EVENT,onSpeakRequest);}});
}
const api=Object.freeze({STORAGE_KEY,RATE_KEY,VOICE_KEY,VOICE_OUTPUT_STATE_EVENT,VOICE_OUTPUT_PROGRESS_EVENT,VOICE_OUTPUT_STOP_EVENT,VOICE_OUTPUT_SPEAK_EVENT,readRate,normalizeSpeechText,splitSpeechText,pickTurkishVoice,installVoiceOutput});
(globalThis as typeof globalThis & {HafizeVoiceOutput?:unknown}).HafizeVoiceOutput=api;
const start=()=>installVoiceOutput(document,globalThis);
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
