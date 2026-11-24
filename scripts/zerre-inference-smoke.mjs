import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as ort from 'onnxruntime-web/wasm';
import {zerrePhonemes} from '../public/typed/zerre-phonemes.ts';
import {zerrePack} from '../public/typed/zerre-pack.ts';

const base=zerrePack.url.replace(/model\.onnx$/,'');
const files=[['model.onnx',8549070],['model.json',893],['lexicon-tr.json',1174675]];
const [model,config,lexicon]=await Promise.all(files.map(async([path,expected])=>{
  const response=await fetch(base+path,{signal:AbortSignal.timeout(60_000)});
  assert.ok(response.ok,path+' download failed: '+response.status);
  const bytes=await response.arrayBuffer();assert.equal(bytes.byteLength,expected,path+' byte count');
  return bytes;
}));
const decoder=new TextDecoder(),cfg=JSON.parse(decoder.decode(config)),words=JSON.parse(decoder.decode(lexicon));
assert.deepEqual(cfg.symbols,words.symbols);
const {ids,stress}=zerrePhonemes('Merhaba, ben Hafize.',words);
assert.ok(ids.length>3&&ids.length<=cfg.max_tokens);assert.equal(ids.length,stress.length);
ort.env.wasm.numThreads=1;
const session=await ort.InferenceSession.create(new Uint8Array(model),{executionProviders:['wasm']});
const ints=values=>new ort.Tensor('int64',BigInt64Array.from(values,BigInt),[1,values.length]);
const scalar=value=>new ort.Tensor('float32',Float32Array.of(value),[1]);
const hashes=[];
try {
  for(let speaker=0;speaker<2;speaker++){
    const start=performance.now();
    const out=await session.run({tokens:ints(ids),stress:ints(stress),voice:new ort.Tensor('int64',BigInt64Array.of(BigInt(speaker)),[1]),speed:scalar(1),pitch_shift:scalar(0),pitch_range:scalar(1)});
    const audio=Float32Array.from(out.audio.data);
    assert.ok(audio.length>2400&&audio.length<=24000*40,'audio duration');
    assert.ok(audio.every(Number.isFinite),'finite samples');
    assert.ok(audio.some(value=>Math.abs(value)>0.001),'non-silent audio');
    hashes.push(createHash('sha256').update(new Uint8Array(audio.buffer)).digest('hex'));
    console.log('SES-'+(speaker?'B':'A')+': '+audio.length+' samples, '+Math.round(performance.now()-start)+' ms inference (CI CPU)');
  }
  assert.notEqual(hashes[0],hashes[1],'speaker waveform must differ');
  console.log('Zerre pinned model: both voices produced different non-silent 24 kHz PCM audio');
}finally{await session.release();}
