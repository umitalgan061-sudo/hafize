import {describe,it,expect,vi} from 'vitest';
import {createVoiceActivityGate,pcmTo16k,nimVoiceStatus,NimRecognition} from './nim-voice.ts';
describe('configured NIM voice',()=>{
 it('keeps the start of a phrase and never uploads silence as a phrase',()=>{
  const gate=createVoiceActivityGate(16000);
  const silence=new Float32Array(1600),speech=new Float32Array(1600).fill(.06);
  for(let i=0;i<5;i++)expect(gate.push(silence).started).toBe(false);
  expect(gate.take()).toBeNull();expect(gate.push(speech).started).toBe(true);
  gate.push(speech);gate.push(speech);
  for(let i=0;i<8;i++)expect(gate.push(silence).done).toBe(false);
  expect(gate.push(silence).done).toBe(true);expect(gate.take()!.length).toBeGreaterThan(1600*12);
  expect(pcmTo16k(new Float32Array(48000).fill(.5),48000)).toHaveLength(16000);
 });
 it('only offers actual configured Turkish languages and uses authenticated requests',async()=>{
  const fetch=vi.fn(async()=>Response.json({asr:true,asrLanguages:['en-US','tr-TR'],tts:true,ttsLanguages:['en']}));
  const root={HafizeAuth:{fetch}} as unknown as typeof globalThis;
  await expect(nimVoiceStatus(root)).resolves.toEqual({asrLanguage:'tr-TR',ttsLanguage:null});
  expect(fetch).toHaveBeenCalledWith('/api/nim-specialists',{signal:undefined});
  await expect(nimVoiceStatus({} as typeof globalThis)).resolves.toEqual({asrLanguage:null,ttsLanguage:null});
 });
 it('stops a stream that resolves after the recognition has been cancelled',async()=>{
  let resolve!: (s:MediaStream)=>void;const stop=vi.fn();
  const pending=new Promise<MediaStream>(r=>{resolve=r;});
  const root={navigator:{mediaDevices:{getUserMedia:()=>pending}},AudioContext:class{}} as unknown as typeof globalThis;
  const r=new NimRecognition(root,'tr');r.onend=vi.fn();r.start();r.abort();
  resolve({getTracks:()=>[{stop}]} as unknown as MediaStream);await Promise.resolve();await Promise.resolve();
  expect(stop).toHaveBeenCalledTimes(1);expect(r.onend).toHaveBeenCalledTimes(1);
 });
});
