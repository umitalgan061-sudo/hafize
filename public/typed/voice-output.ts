export interface VoiceOutputController { readonly isSupported:boolean; readonly isEnabled:()=>boolean; readonly isSpeaking:()=>boolean; readonly setEnabled:(next:boolean)=>boolean; readonly speak:(value:string)=>boolean;
  readonly cancel:()=>void; readonly syncStreamState:()=>void; readonly destroy:()=>void; }
export const STORAGE_KEY='hafize.voiceOutput.v1',MAX_SPEECH_LENGTH=2400,MAX_CHUNK_LENGTH=240;
export function normalizeSpeechText(value:unknown):string{if(typeof value!=='string')return'';return value.replace(/\`\`\`[\s\S]*?\`\`\`/g, ' Kod bloğu atlandı. ').replace(/\`([^\`]+)\`/g, '$1').replace(/https?:\/\/\S+/gi,
  ' bağlantı ').replace(/[*_#>|~]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_LENGTH);}
export function splitSpeechText(value:string,maxLength=MAX_CHUNK_LENGTH):string[]{
 const text=normalizeSpeechText(value);if(!text)return[];
 const limit=Number.isInteger(maxLength)&&maxLength>=80?maxLength:MAX_CHUNK_LENGTH;
 const sentences=text.match(/[^.!?…]+[.!?…]?/g)||[text];
 const chunks:string[]=[];let current='';
 for(const sentence of sentences){
  const clean=sentence.trim();if(!clean)continue;
  const candidate=current?`${current} ${clean}`:clean;
  if(candidate.length<=limit){current=candidate;continue;}
  if(current)chunks.push(current);
  if(clean.length<=limit){current=clean;continue;}
  let fragment='';
  for(const word of clean.split(' ')){const next=fragment?`${fragment} ${word}`:word;if(next.length>limit&&fragment){chunks.push(fragment);fragment=word;}else fragment=next;}
  current=fragment;
 }
 if(current)chunks.push(current);return chunks;
}
function readEnabled(storage:Storage|null):boolean{try{return storage?.getItem(STORAGE_KEY)==='true';}catch{return false;}}
function writeEnabled(storage:Storage|null,enabled:boolean):void{try{storage?.setItem(STORAGE_KEY,String(enabled));}catch{}}
export function installVoiceOutput(documentRef:Document,root:typeof globalThis):VoiceOutputController|null{
 const toggle=documentRef.querySelector<HTMLButtonElement>('#voiceOutputToggle'), card=documentRef.querySelector<HTMLElement>('.voice-card'), composer=documentRef.querySelector<HTMLFormElement>('#composer'),
   input=documentRef.querySelector<HTMLTextAreaElement>('#messageInput'), messages=documentRef.querySelector<HTMLElement>('#messages'), mic=documentRef.querySelector<HTMLButtonElement>('#micBtn');if(!toggle||!card)return null;
 const synth=root.speechSynthesis, Utterance=root.SpeechSynthesisUtterance, supported=Boolean(synth&&typeof synth.speak==='function'&&Utterance), storage=root.localStorage;let enabled=supported&&readEnabled(storage), speaking=false,
   thinking=false, queue:string[]=[];
 const render=()=>{toggle.disabled=!supported;toggle.setAttribute('aria-pressed', String(enabled));toggle.textContent=supported?(enabled?'Sesli yanıt açık':'Sesli yanıt kapalı'):'Sesli yanıt desteklenmiyor';card.classList.toggle('speaking',
   speaking);card.classList.toggle('thinking', thinking&&!speaking);};
 const cancel=()=>{queue=[];speaking=false;try{synth?.cancel();}catch{}render();};
 const voice=()=>{try{return synth?.getVoices?.().find(v=>String(v.lang||'').toLowerCase().startsWith('tr'))||null;}catch{return null;}};
 const next=()=>{if(!enabled||!supported||!queue.length){speaking=false;render();return;}const utterance=new Utterance(queue.shift()!); utterance.lang='tr-TR'; utterance.rate=.98; utterance.pitch=1; const selected=voice();
   if(selected)utterance.voice=selected; utterance.onend=next; utterance.onerror=()=>{queue=[];speaking=false;render();}; speaking=true; thinking=false; render();
   try{synth.speak(utterance);}catch{utterance.onerror?.(new SpeechSynthesisErrorEvent('error',{error:'synthesis-failed',utterance}));}};
 const speak=(value:string)=>{if(!enabled||!supported||documentRef.hidden)return false;const chunks=splitSpeechText(value);if(!chunks.length)return false;cancel();queue=chunks;next();return true;};
 const setEnabled=(nextEnabled:boolean)=>{enabled=supported&&Boolean(nextEnabled);writeEnabled(storage,enabled);if(!enabled)cancel();render();return enabled;};
 const latest=()=>{const nodes=messages?.querySelectorAll('.message.assistant .content')||[]; const node=nodes.length?nodes[nodes.length-1]:null;
   return (root as typeof globalThis & {HafizeChatMarkdown?:{sourceFor?:(n:Element)=>string}}).HafizeChatMarkdown?.sourceFor?.(node!)||node?.textContent||''; };
 const sync=()=>{const busy=Boolean(input?.disabled);if(busy){thinking=true;if(speaking)cancel();render();return;}const justFinished=thinking;thinking=false;render();if(justFinished)speak(latest());};
 const onToggle=()=>setEnabled(!enabled),onSubmit=()=>cancel(),onVisibility=()=>{if(documentRef.hidden)cancel()};
 toggle.addEventListener('click',onToggle);composer?.addEventListener('submit',onSubmit,true);documentRef.addEventListener('visibilitychange',onVisibility);
 const Observer=root.MutationObserver;const micObserver=mic&&Observer?new Observer(()=>{if(mic.getAttribute('aria-pressed')==='true')cancel();}):null;micObserver?.observe(mic!,{attributes:true,attributeFilter:['aria-pressed']});
 const streamObserver=input&&Observer?new Observer(sync):null;streamObserver?.observe(input!,{attributes:true,attributeFilter:['disabled']});render();
 return Object.freeze({isSupported:supported,isEnabled:()=>enabled,isSpeaking:()=>speaking,setEnabled,speak,cancel,syncStreamState:sync,destroy(){cancel(); micObserver?.disconnect(); streamObserver?.disconnect();
   toggle.removeEventListener('click',onToggle); composer?.removeEventListener('submit',onSubmit,true); documentRef.removeEventListener('visibilitychange',onVisibility); }});
}
const api=Object.freeze({STORAGE_KEY,normalizeSpeechText,splitSpeechText,installVoiceOutput});
(globalThis as typeof globalThis & {HafizeVoiceOutput?:unknown}).HafizeVoiceOutput=api;
const start=()=>installVoiceOutput(document,globalThis);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
