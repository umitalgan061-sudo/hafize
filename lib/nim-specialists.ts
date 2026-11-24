import {HttpRuntimeError} from './http-runtime.ts';
import {sniffImageType} from './media-tools.ts';

const MAX_FILE=6*1024*1024;
const MAX_REPLY=8*1024*1024;
type Kind='asr'|'tts'|'parse';
const fail=(code:string,status=400):never=>{throw new HttpRuntimeError(code,status);};
function endpoint(value:unknown):string|null{
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const u=new URL(value.trim());
    if(u.username||u.password||u.search||u.hash||u.pathname!=='/')return null;
    if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))return null;
    return u.origin;
  }catch{return null;}
}
function lang(value:unknown):string{
  if(typeof value!=='string'||!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value))return fail('NIM_LANGUAGE_INVALID');
  return value;
}
function wav(bytes:Buffer){return bytes.length>=44&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE';}
function decode(value:unknown):Buffer{
  if(typeof value!=='string'||value.length>Math.ceil(MAX_FILE/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)return fail('NIM_FILE_INVALID');
  const bytes=Buffer.from(value,'base64');
  if(!bytes.length||bytes.length>MAX_FILE||bytes.toString('base64')!==value)return fail('NIM_FILE_INVALID');
  return bytes;
}
async function boundedResponse(response:Response,limit=MAX_REPLY){
  if(!response.ok){await response.body?.cancel().catch(()=>{});return fail('NIM_UPSTREAM_ERROR',response.status===429?429:502);}
  if(!response.body)return fail('NIM_EMPTY_RESPONSE',502);
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>limit){await reader.cancel();return fail('NIM_RESPONSE_TOO_LARGE',502);}chunks.push(result.value);}}
  finally{reader.releaseLock();}
  return Buffer.concat(chunks,size);
}
function json(bytes:Buffer):Record<string,unknown>{
  try{const result=JSON.parse(bytes.toString('utf8'));if(result&&typeof result==='object'&&!Array.isArray(result))return result;}catch{}
  return fail('NIM_RESPONSE_INVALID',502);
}
/** Explicit operator-configured standalone NIM deployments; never sends the catalog key to them. */
export function createNimSpecialists({env,fetchImpl=globalThis.fetch}:{env:Record<string,string|undefined>;fetchImpl?:typeof fetch}){
  const bases={asr:endpoint(env.HAFIZE_NIM_ASR_URL),tts:endpoint(env.HAFIZE_NIM_TTS_URL),parse:endpoint(env.HAFIZE_NIM_PARSE_URL)};
  const languages=(env.HAFIZE_NIM_TTS_LANGUAGES||'').split(',').map(s=>s.trim()).filter(s=>/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(s)).slice(0,30);
  const asrLanguages=(env.HAFIZE_NIM_ASR_LANGUAGES||'').split(',').map(s=>s.trim()).filter(s=>/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(s)).slice(0,30);
  let active=0;
  async function send(kind:Kind,path:string,form:FormData,signal?:AbortSignal){
    const base=bases[kind];if(!base)return fail('NIM_SERVICE_NOT_CONFIGURED',503);
    if(active>=2)return fail('NIM_SERVICE_BUSY',429);
    signal?.throwIfAborted();active++;
    try{
      const response=await fetchImpl(base+path,{method:'POST',body:form,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)});
      return await boundedResponse(response);
    }catch(error){if(error instanceof HttpRuntimeError)throw error;if(signal?.aborted)throw error;return fail('NIM_SERVICE_UNAVAILABLE',503);}
    finally{active--;}
  }
  async function transcribe(input:{data:unknown;language:unknown},signal?:AbortSignal){
    const language=lang(input.language);if(!asrLanguages.includes(language))return fail('NIM_LANGUAGE_NOT_CONFIGURED');
    const bytes=decode(input.data);if(!wav(bytes))return fail('NIM_AUDIO_FORMAT',415);
    const form=new FormData();form.set('file',new Blob([new Uint8Array(bytes)],{type:'audio/wav'}),'audio.wav');form.set('language',language);form.set('response_format','json');
    const response=json(await send('asr','/v1/audio/transcriptions',form,signal));
    if(typeof response.text!=='string'||!response.text.trim()||response.text.length>50000)return fail('NIM_TRANSCRIPT_INVALID',502);
    return {text:response.text,language,provider:'configured-nim-asr'};
  }
  async function synthesize(input:{text:unknown;language:unknown},signal?:AbortSignal){
    const language=lang(input.language);if(!languages.includes(language))return fail('NIM_LANGUAGE_NOT_CONFIGURED');
    if(typeof input.text!=='string'||!input.text.trim()||input.text.length>2000)return fail('NIM_TEXT_INVALID');
    const form=new FormData();form.set('text',input.text);form.set('language',language);form.set('encoding','LINEAR_PCM');
    const bytes=await send('tts','/v1/audio/synthesize',form,signal);
    if(!wav(bytes))return fail('NIM_AUDIO_INVALID_RESPONSE',502);
    return {data:bytes.toString('base64'),mime:'audio/wav',language,provider:'configured-nim-tts'};
  }
  async function parse(input:{data:unknown},signal?:AbortSignal){
    const bytes=decode(input.data);const mime=sniffImageType(bytes);
    if(mime!=='image/png'&&mime!=='image/jpeg')return fail('NIM_DOCUMENT_FORMAT',415);
    const form=new FormData();form.set('document',new Blob([new Uint8Array(bytes)],{type:mime}),mime==='image/png'?'page.png':'page.jpg');
    const response=json(await send('parse','/v1/parse',form,signal));
    if(typeof response.content!=='string'||!response.content.trim()||response.content.length>200000)return fail('NIM_DOCUMENT_INVALID_RESPONSE',502);
    const finish=typeof response.finish_reason==='string'?response.finish_reason:null;
    return {content:response.content,finishReason:finish,truncated:finish==='length',provider:'configured-nim-parse'};
  }
  return Object.freeze({transcribe,synthesize,parse,status:()=>({asr:Boolean(bases.asr&&asrLanguages.length),tts:Boolean(bases.tts&&languages.length),parse:Boolean(bases.parse),asrLanguages,ttsLanguages:languages,verified:false as const})});
}
