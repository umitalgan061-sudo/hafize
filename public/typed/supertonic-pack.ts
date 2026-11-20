export const styles = ['F1','F2','F3','F4','F5','M1','M2','M3','M4','M5'];
const base = 'https://huggingface.co/Supertone/supertonic-3/resolve/724fb5abbf5502583fb520898d45929e62f02c0b';
const cacheName = 'hafize-supertonic3-v1';
const files = [
  ...['tts.json','unicode_indexer.json','duration_predictor.onnx','text_encoder.onnx','vector_estimator.onnx','vocoder.onnx'].map(file => 'onnx/' + file),
  ...styles.map(style => 'voice_styles/' + style + '.json'),
];
export const pack = {key:'tr-supertonic3', name:'Supertonic 3', lang:'tr_TR', family:'tr', langName:'Türkçe', country:'Türkiye', quality:'yüksek', speakers:10, size:401000000, path:'supertonic3', url:base + '/voice_styles/F1.json'};
export async function downloadPack(progress: (n:number)=>void, signal?:AbortSignal) {
  const cache = await caches.open(cacheName);
  let received = 0;
  for (const file of files) {
    signal?.throwIfAborted();
    const url = base + '/' + file;
    const saved = await cache.match(url);
    if (saved) { received += Number(saved.headers.get('content-length') || 0); continue; }
    const response = await fetch(url, {signal});
    if (!response.ok || !response.body) throw Error('VOICE_DOWNLOAD_FAILED');
    let bytes = 0;
    const stream = response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
      transform(chunk, controller) { bytes += chunk.byteLength; progress(Math.min(0.99,(received+bytes)/pack.size)); controller.enqueue(chunk); }
    }));
    await cache.put(url,new Response(stream, {headers: response.headers.has('content-length') ? {'content-length':response.headers.get('content-length')!} : {}}));
    received += bytes;
  }
  signal?.throwIfAborted();
  progress(1);
}
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number,{resolve:(v:{pcm:Float32Array;sampleRate:number})=>void;reject:(e:Error)=>void}>();
function releaseWorker() {
  worker?.terminate(); worker = undefined;
  for (const task of pending.values()) task.reject(Error('VOICE_ENGINE_STOPPED'));
  pending.clear();
}
export async function deletePack() { releaseWorker(); await caches.delete(cacheName); }
export function synthesizePack(speaker:number,text:string,rate:number) {
  if (!worker) {
    worker = new Worker('/typed-build/supertonic-worker.js',{type:'module'});
    worker.onerror = releaseWorker;
    worker.onmessage = ({data}) => {
      const task = pending.get(data.id);
      pending.delete(data.id);
      if (data.error || !data.pcm?.length) task?.reject(Error(data.error || 'VOICE_EMPTY_OUTPUT'));
      else task?.resolve(data);
    };
  }
  const id = ++sequence;
  return new Promise<{pcm:Float32Array;sampleRate:number}>((resolve,reject)=>{
    pending.set(id,{resolve,reject});
    worker!.postMessage({id,text,rate,base,style:styles[speaker] || styles[0]});
  });
}