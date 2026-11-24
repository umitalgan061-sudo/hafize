// Optional, local-only Turkish TTS; model and dictionary are pinned to one upstream revision.
// Upstream: https://github.com/erkinemreta1/zerre-tts (Apache-2.0 model/code).
const revision='cf3cdfaaa54a9e8ec541081bb5c2e97c3d563db4';
const base='https://raw.githubusercontent.com/erkinemreta1/zerre-tts/'+revision+'/web/public/';
const cacheName='hafize-zerre-tr-v1';
const files=[['model.onnx',8549070],['model.json',893],['lexicon-tr.json',1174675]] as const;
export const zerreStyles=['SES-A','SES-B'] as const;
export const zerrePack={key:'tr-zerre-int8',name:'Zerre Türkçe · hafif (2 ses)',lang:'tr_TR',family:'tr',langName:'Türkçe',country:'Türkiye',quality:'medium',speakers:2,size:9724638,path:'zerre-int8',url:base+'model.onnx',configUrl:base+'model.json',source:'erkint/zerre-tts',license:'Apache-2.0 (veri hakları bağımsız doğrulanmadı)'};
export async function zerreDownloaded():Promise<boolean>{
  if(typeof caches==='undefined')return false;
  try{const c=await caches.open(cacheName);return (await Promise.all(files.map(async ([p])=>Boolean(await c.match(base+p))))).every(Boolean);}catch{return false;}
}
export async function downloadZerre(progress:(value:number)=>void,signal?:AbortSignal){
  const c=await caches.open(cacheName);let total=0;
  for(const [path,size] of files){
    signal?.throwIfAborted();
    const url=base+path,hit=await c.match(url);
    if(hit && Number(hit.headers.get('content-length'))===size){total+=size;progress(total/zerrePack.size);continue;}
    const res=await fetch(url,{signal});if(!res.ok||!res.body)throw Error('VOICE_DOWNLOAD_FAILED');
    const reader=res.body.getReader();const chunks:Uint8Array<ArrayBuffer>[]=[];let length=0;
    try{for(;;){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
      if(length>size){await reader.cancel();throw Error('VOICE_DOWNLOAD_INCOMPLETE');}
      chunks.push(new Uint8Array(value));progress(Math.min(.99,(total+length)/zerrePack.size));
    }}finally{reader.releaseLock();}
    if(length!==size)throw Error('VOICE_DOWNLOAD_INCOMPLETE');
    await c.put(url,new Response(new Blob(chunks),{headers:{'content-length':String(size)}}));
    total+=length;
  }
  signal?.throwIfAborted();progress(1);
}
type Audio={pcm:Float32Array;sampleRate:number};
type Pending={resolve:(a:Audio)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
let worker:Worker|undefined,sequence=0,initialization:Promise<void>|undefined;
const tasks=new Map<number,Pending>();
function reset(){
  worker?.terminate();worker=undefined;initialization=undefined;
  for(const t of tasks.values()){clearTimeout(t.timer);t.reject(Error('VOICE_ENGINE_STOPPED'));}tasks.clear();
}
function send(payload:Record<string,unknown>,transfer:Transferable[]=[]):Promise<Audio>{
  if(!worker){
    worker=new Worker('/typed-build/zerre-worker.js',{type:'module'});
    worker.onerror=reset;
    worker.onmessage=({data})=>{
      const task=tasks.get(data.id);if(!task)return;
      tasks.delete(data.id);clearTimeout(task.timer);
      if(data.error)task.reject(Error(String(data.error)));else task.resolve(data);
    };
  }
  const id=++sequence;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(reset,25_000);tasks.set(id,{resolve,reject,timer});
    try{worker!.postMessage({id,...payload},transfer);}catch{reset();}
  });
}
async function init(){
  if(!await zerreDownloaded())throw Error('VOICE_NOT_DOWNLOADED');
  const c=await caches.open(cacheName);
  const [model,config,lexicon]=await Promise.all(files.map(async ([p,size])=>{
    const res=await c.match(base+p);if(!res)throw Error('VOICE_NOT_DOWNLOADED');
    const bytes=await res.arrayBuffer();if(bytes.byteLength!==size)throw Error('VOICE_DOWNLOAD_INCOMPLETE');return bytes;
  }));
  await send({type:'load',model,config,lexicon},[model,config,lexicon]);
}
export async function synthesizeZerre(speaker:number,text:string,rate:number):Promise<Audio>{
  initialization??=init().catch(e=>{reset();throw e;});
  await initialization;
  const result=await send({type:'run',speaker:speaker===1?1:0,text,rate});
  if(!(result.pcm instanceof Float32Array)||!result.pcm.length||result.sampleRate!==24000)throw Error('VOICE_EMPTY_OUTPUT');
  return result;
}
export async function deleteZerre(){reset();await caches.delete(cacheName);}
