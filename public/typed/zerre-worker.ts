import * as ort from 'onnxruntime-web/wasm';
import {zerrePhonemes} from './zerre-phonemes.ts';
let session:ort.InferenceSession|undefined;
let lexicon:Parameters<typeof zerrePhonemes>[1]|undefined;
let maxTokens=512;
ort.env.wasm.wasmPaths='/typed-build/vendor/ort/';
ort.env.wasm.numThreads=1;
type Request={id:number;type:'load';model:ArrayBuffer;config:ArrayBuffer;lexicon:ArrayBuffer}|{id:number;type:'run';speaker:number;text:string;rate:number};
let serial=Promise.resolve();
async function handle(data:Request){
  if(data.type==='load'){
    const decoder=new TextDecoder(),cfg=JSON.parse(decoder.decode(data.config)),words=JSON.parse(decoder.decode(data.lexicon));
    if(cfg.sample_rate!==24000||!Array.isArray(cfg.symbols)||!Array.isArray(words.symbols)||JSON.stringify(cfg.symbols)!==JSON.stringify(words.symbols)||!words.words||!Array.isArray(cfg.voices)||cfg.voices.length!==2)throw Error('VOICE_CONFIG_INVALID');
    maxTokens=Math.min(512,Number(cfg.max_tokens)||512);
    session=await ort.InferenceSession.create(new Uint8Array(data.model),{executionProviders:['wasm']});lexicon=words;
    return {ok:true};
  }
  if(!session||!lexicon)throw Error('VOICE_NOT_LOADED');
  if(typeof data.text!=='string'||data.text.length>500)throw Error('VOICE_TEXT_INVALID');
  const {ids,stress}=zerrePhonemes(data.text,lexicon);
  if(ids.length<3||ids.length>maxTokens)throw Error('VOICE_TEXT_INVALID');
  const ints=(values:number[])=>new ort.Tensor('int64',BigInt64Array.from(values,BigInt),[1,values.length]);
  const scalar=(value:number)=>new ort.Tensor('float32',Float32Array.of(value),[1]);
  const result=await session.run({
    tokens:ints(ids),stress:ints(stress),voice:new ort.Tensor('int64',BigInt64Array.of(BigInt(data.speaker===1?1:0)),[1]),
    speed:scalar(Number.isFinite(data.rate)?Math.min(1.5,Math.max(.7,data.rate)):1),pitch_shift:scalar(0),pitch_range:scalar(1)
  });
  const pcm=Float32Array.from(result.audio.data as Float32Array);
  if(!pcm.length||pcm.length>24000*40||!pcm.every(Number.isFinite))throw Error('VOICE_EMPTY_OUTPUT');
  return {pcm,sampleRate:24000};
}
self.onmessage=({data}:MessageEvent<Request>)=>{
  serial=serial.then(async()=>{
    try{const result=await handle(data);(self as unknown as Worker).postMessage({id:data.id,...result},result.pcm?[result.pcm.buffer]:[]);}
    catch(error){(self as unknown as Worker).postMessage({id:data.id,error:String((error as Error)?.message||error)});}
  });
};
