import {wavOf,type SpeakHandle,type SpeakCallbacks,playWavChunk} from './voice-library.ts';
export const NIM_ASR_KEY='hafize.voiceMode.nimAsr.v1';
export const NIM_TTS_VOICE='nim:turkish';
export type NimVoiceStatus={asrLanguage:string|null;ttsLanguage:string|null};
const empty=():NimVoiceStatus=>({asrLanguage:null,ttsLanguage:null});
const authFetch=(root:typeof globalThis)=>(root as typeof globalThis&{HafizeAuth?:{fetch?:typeof fetch}}).HafizeAuth?.fetch;
const turkish=(values:unknown)=>Array.isArray(values)?values.find(x=>x==='tr-TR')??values.find(x=>x==='tr')??null:null;
export async function nimVoiceStatus(root:typeof globalThis,signal?:AbortSignal):Promise<NimVoiceStatus>{
 const f=authFetch(root);if(!f)return empty();
 try{const response=await f('/api/nim-specialists',{signal});if(!response.ok)return empty();const data=await response.json();return {asrLanguage:data?.asr===true?turkish(data.asrLanguages):null,ttsLanguage:data?.tts===true?turkish(data.ttsLanguages):null};}
 catch{return empty();}
}
async function request(root:typeof globalThis,path:'transcribe'|'synthesize',payload:Record<string,unknown>,signal:AbortSignal){
 signal.throwIfAborted();const f=authFetch(root);if(!f)throw Error('NIM_AUTH_UNAVAILABLE');
 const response=await f('/api/nim-specialists/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
 if(!response.ok)throw Error('NIM_VOICE_HTTP_'+response.status);
 return response.json();
}
export function pcmTo16k(samples:Float32Array,rate:number):Float32Array{
 if(rate===16000)return samples;
 const out=new Float32Array(Math.floor(samples.length*16000/rate));
 for(let i=0;i<out.length;i++){const from=Math.floor(i*rate/16000),to=Math.min(samples.length,Math.max(from+1,Math.floor((i+1)*rate/16000)));let sum=0;for(let j=from;j<to;j++)sum+=samples[j]!;out[i]=sum/(to-from);}
 return out;
}
function base64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export function nimSpeakChunk(root:typeof globalThis,text:string,rate:number,callbacks:SpeakCallbacks):SpeakHandle{
 const controller=new AbortController();const signal=controller.signal;let handle:SpeakHandle|null=null;
 void (async()=>{
 const status=await nimVoiceStatus(root,signal);signal.throwIfAborted();
 if(!status.ttsLanguage)throw Error('NIM_TTS_NOT_CONFIGURED');
 const data=await request(root,'synthesize',{text,language:status.ttsLanguage},signal);
 if(data?.mime!=='audio/wav'||typeof data.data!=='string'||data.data.length>12*1024*1024)throw Error('NIM_TTS_INVALID_AUDIO');
 const bytes=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0));signal.throwIfAborted();
 handle=playWavChunk(async()=>bytes,text,callbacks,rate);
 })().catch(e=>{if(!signal.aborted)callbacks.onerror?.(e instanceof Error?e:Error('NIM_TTS_FAILED'));});
 return {stop(){controller.abort();handle?.stop();}};
}
/** One-shot voice-activity gate. Keep a short preroll to retain the first consonant.
 * Audio is held in RAM only; send only a captured utterance, never idle microphone audio. */
export function createVoiceActivityGate(rate:number,{silenceMs=850,maxMs=30000,minSpeechMs=180,preRollMs=300}={}){
 let buffers:Float32Array[]=[],pre:Float32Array[]=[],preFrames=0,frames=0,speechFrames=0,quietFrames=0,started=false;
 let floor=0.004;
 const sampleLimit=rate*maxMs/1000,preLimit=rate*preRollMs/1000;
 const join=()=>{const data=new Float32Array(frames);let i=0;for(const b of buffers){data.set(b,i);i+=b.length;}return data;};
 return {
  push(chunk:Float32Array){
   const data=new Float32Array(chunk);let energy=0;for(const v of data)energy+=v*v;
   const rms=Math.sqrt(energy/Math.max(1,data.length)),voiced=rms>Math.max(0.012,floor*3.1);
   if(!started&&!voiced){floor=Math.min(0.025,Math.max(0.002,0.96*floor+0.04*rms));pre.push(data);preFrames+=data.length;while(preFrames>preLimit&&pre.length>1)preFrames-=pre.shift()!.length;return {started:false,done:false};}
   const newly=!started; if(newly){started=true;buffers=pre;frames=preFrames;pre=[];preFrames=0;}
   buffers.push(data);frames+=data.length;
   if(voiced){speechFrames+=data.length;quietFrames=0;}else quietFrames+=data.length;
   return {started:newly,done:quietFrames>=rate*silenceMs/1000||frames>=sampleLimit};
  },
  take(){return started&&speechFrames>=rate*minSpeechMs/1000?join():null;}
 };
}
type ResultEvent={results?:ArrayLike<ArrayLike<{transcript?:unknown}>&{isFinal?:boolean}>};
/** Alternate, explicitly selected capture path. Browser AEC/NS are requested
 * for this single stream. NIM endpoint is batch ASR, not a streaming ASR protocol. */
export class NimRecognition{
 lang='tr-TR';interimResults=false;continuous=false;maxAlternatives=1;
 onstart:(()=>void)|null=null;onend:(()=>void)|null=null;onresult:((event:ResultEvent)=>void)|null=null;onerror:((event:{error?:string})=>void)|null=null;
 onaudiostart:(()=>void)|null=null;onspeechstart:(()=>void)|null=null;onspeechend:(()=>void)|null=null;
 private controller=new AbortController();private stream:MediaStream|null=null;private ctx:AudioContext|null=null;private node:ScriptProcessorNode|null=null;
 private source:MediaStreamAudioSourceNode|null=null;private gain:GainNode|null=null;private gate:ReturnType<typeof createVoiceActivityGate>|null=null;
 private timer:ReturnType<typeof setTimeout>|null=null;private finished=false;private ending=false;
 constructor(private root:typeof globalThis,private language:string){}
 start(){void this.begin();}
 private async begin(){
  try{
   const media=this.root.navigator?.mediaDevices;const Context=this.root.AudioContext||(this.root as typeof globalThis&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!media?.getUserMedia||!Context)throw Error('audio-capture');
   const stream=await media.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
   if(this.finished||this.ending){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;const ctx=new Context();this.ctx=ctx;await ctx.resume();if(this.finished||this.ending)return;
   this.gate=createVoiceActivityGate(ctx.sampleRate);
   this.source=ctx.createMediaStreamSource(stream);this.node=ctx.createScriptProcessor(2048,1,1);this.gain=ctx.createGain();this.gain.gain.value=0;
   this.node.onaudioprocess=e=>{if(this.ending||this.finished)return;const frame=this.gate!.push(e.inputBuffer.getChannelData(0));if(frame.started)this.onspeechstart?.();if(frame.done)this.stop();};
   this.source.connect(this.node);this.node.connect(this.gain);this.gain.connect(ctx.destination);
   this.onstart?.();this.onaudiostart?.();
   this.timer=setTimeout(()=>this.stop(),60000);
  }catch(e){if(!this.finished&&!this.ending){const name=(e as Error)?.name;this.fail(name==='NotAllowedError'?'not-allowed':'audio-capture');}}
 }
 private release(){
  if(this.timer)clearTimeout(this.timer);this.timer=null;
  if(this.node){this.node.onaudioprocess=null;try{this.node.disconnect();}catch{}}
  try{this.source?.disconnect();this.gain?.disconnect();}catch{}
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  if(this.ctx)void this.ctx.close().catch(()=>undefined);this.ctx=null;
 }
 private finish(){if(this.finished)return;this.finished=true;this.release();this.gate=null;this.onend?.();}
 private fail(error:string){if(this.finished)return;this.ending=true;this.release();this.onerror?.({error});this.finish();}
 stop(){if(this.finished||this.ending)return;this.ending=true;
  const rate=this.ctx?.sampleRate??16000,data=this.gate?.take()??null;this.release();this.gate=null;
  if(!data){this.finish();return;}
  this.onspeechend?.();
  const signal=this.controller.signal;
  void (async()=>{
   const wav=wavOf(pcmTo16k(data,rate),16000,1);
   const response=await request(this.root,'transcribe',{data:base64(wav),language:this.language},signal);
   if(this.finished||signal.aborted)return;
   if(typeof response?.text==='string'&&response.text.trim()){
    const result=Object.assign([{transcript:response.text.trim()}],{isFinal:true});this.onresult?.({results:[result]});
   }
   this.finish();
  })().catch(()=>{if(!signal.aborted)this.fail('network');});
 }
 abort(){if(this.finished)return;this.controller.abort();this.finish();}
}
