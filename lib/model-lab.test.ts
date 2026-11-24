import { describe, expect, it, vi } from 'vitest';
import { createModelLab, modelLabCommand, modelTaskKind, formatModelLabStatus } from './model-lab.ts';
const a = 'nvidia/example-a', b = 'nvidia/example-b';
const reply = (message: unknown) => new Response(JSON.stringify({ choices: [{ message }] }));
const valid = { content: JSON.stringify({ capital: 'Ankara', math: 383, code: 12 }) };
const tool = { tool_calls: [{ function: { name: 'benchmark_echo', arguments: '{"value":42}' } }] };
describe('NVIDIA model lab', () => {
  it('discovers exact model IDs without treating listing as proof of access', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: a }, { id: b }, { id: 'bad' }] })));
    const lab = createModelLab({ allowed: [a], request });
    expect((await lab.discover()).catalog?.ids).toEqual([a,b]);
    expect(lab.status().results).toEqual([]);
    expect(lab.preferred('general',[a,b])).toEqual([]);
    await expect(lab.probe(b)).rejects.toThrow('MODEL_LAB_MODEL_NOT_ALLOWED');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('tests the exact model with only synthetic inputs and caches evidence', async () => {
    const request = vi.fn(async (_path, body) => {
      expect(body.model).toBe(a);
      return reply(body.tools ? tool : valid);
    });
    const lab = createModelLab({ allowed: [a,b], request });
    const row = await lab.probe(a);
    expect(row).toMatchObject({ status: 'passed', chat: true, turkish: true, reasoning: true, coding: true, tools: true, toolProbeStatus: 'passed', requests: 2 });
    expect(lab.preferred('coding',[b,a])).toEqual([a]);
    expect(await lab.probe(a)).toEqual(row);
    expect(request).toHaveBeenCalledTimes(2);
    expect(formatModelLabStatus(lab.status())).toContain('genel zekâ sıralaması değildir');
  });
  it('separates text success from failed tool calling and ignores wrong arguments', async () => {
    const lab = createModelLab({ allowed: [a], request: async (_path, body) => reply(body?.tools ? { tool_calls: [{ function: { name:'benchmark_echo',arguments:'{"value":43}' } }] } : valid) });
    expect(await lab.probe(a)).toMatchObject({ status: 'passed', tools: false, toolProbeStatus: 'invalid_response' });
    expect(lab.preferred('agent',[a])).toEqual([]);
  });
  it('does not route failed quota models as verified', async () => {
    const lab = createModelLab({ allowed: [a], request: async () => new Response('', {status:429}) });
    expect(await lab.probe(a)).toMatchObject({status:'rate_limited',chat:false,requests:1});
    expect(lab.preferred('general',[a])).toEqual([]);
  });
  it('bounds API requests across models and expires benchmark evidence', async () => {
    let time = 1000000;
    const ids = Array.from({length:7},(_,i)=>'nvidia/test-'+i);
    const lab = createModelLab({ allowed:ids, now:()=>time, request:async (_path,body)=>reply(body?.tools?tool:valid) });
    for (const model of ids.slice(0,6)) await lab.probe(model);
    expect(lab.status().requestsRemaining).toBe(0);
    await expect(lab.probe(ids[6]!)).rejects.toThrow('MODEL_LAB_BUDGET');
    time += 24*60*60_000+1;
    expect(lab.preferred('agent',ids)).toEqual([]);
    expect(lab.status().requestsRemaining).toBe(12);
  });
  it('cancels without recording false evidence', async () => {
    const controller = new AbortController(); controller.abort();
    const request = vi.fn(async()=>reply(valid));
    const lab=createModelLab({allowed:[a],request});
    await expect(lab.probe(a,controller.signal)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(lab.status().results).toEqual([]);
  });
  it('only routes explicit standalone lab commands and classifies task types',()=>{
    expect(modelLabCommand('Model testi: nvidia/example-a')).toEqual({action:'probe',model:a});
    expect(modelLabCommand('NVIDIA modellerini listele')).toEqual({action:'discover'});
    expect(modelLabCommand('Model laboratuvarı')).toEqual({action:'status'});
    expect(modelLabCommand('Model testi: https://example.com/x')).toBeNull();
    expect(modelTaskKind({messages:[{role:'user',content:'GitHub commit oluştur'}]})).toBe('coding');
    expect(modelTaskKind({messages:[{role:'user',content:'Selam'}]})).toBe('fast');
    expect(modelTaskKind({tools:[{}]})).toBe('agent');
  });
});


describe('model lab bounded batches', () => {
  it('tests two candidates per command, skips fresh observations, and activates verified candidates',async()=>{
    const ids=[a,b,'nvidia/example-c'];
    const requests:string[]=[];
    const lab=createModelLab({allowed:ids,now:()=>1000000,request:async (_path,body)=>{
      requests.push(String(body?.model)); return reply(body?.tools?tool:valid);
    }});
    const first=await lab.batch();
    expect(first.completed.map(x=>x.model)).toEqual([a,b]);
    expect(first.pendingModels).toEqual([ids[2]]);
    expect(lab.status().verifiedAgentModels).toEqual([a,b]);
    expect((await lab.batch()).completed.map(x=>x.model)).toEqual([ids[2]]);
    expect(requests).toEqual([a,a,b,b,ids[2],ids[2]]);
    expect((await lab.batch()).completed).toEqual([]);
  });
  it('halts a batch on a rate limit, honors cooldown and does not probe the next model',async()=>{
    let time=1000000;
    const request=vi.fn(async()=>new Response('',{status:429,headers:{'Retry-After':'1200'}}));
    const lab=createModelLab({allowed:[a,b],request,now:()=>time});
    const first=await lab.batch();
    expect(first.completed).toHaveLength(1);
    expect(first.paused).toBe(true);
    expect((await lab.batch()).completed).toEqual([]);
    await expect(lab.probe(b)).rejects.toThrow('MODEL_LAB_PROVIDER_PAUSED');
    expect(request).toHaveBeenCalledTimes(1);
    time+=1200001;
    expect((await lab.batch()).completed).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('retains chat evidence when only the tool probe fails',async()=>{
    const lab=createModelLab({allowed:[a],request:async (_path,body)=>{
      if(body?.tools) throw new Error('network');
      return reply(valid);
    }});
    expect(await lab.probe(a)).toMatchObject({status:'passed',chat:true,tools:false,toolProbeStatus:'failed'});
    expect(lab.preferred('agent',[a])).toEqual([]);
    expect(lab.preferred('general',[a])).toEqual([a]);
  });
  it('recognizes explicit batch continuation, never mixed instructions',()=>{
    expect(modelLabCommand('Model testlerine devam et')).toEqual({action:'batch'});
    expect(modelLabCommand('NVIDIA model testlerini başlat')).toEqual({action:'batch'});
    expect(modelLabCommand('Model testlerine devam et ve dosyaları sil')).toBeNull();
  });
});

describe('model lab v2', () => {
  it('classifies Turkish suffixes and multimodal text, and keeps tool compatibility for fast tasks', () => {
    expect(modelTaskKind({messages:[{role:'user',content:'Yazılımı geliştir'}]})).toBe('coding');
    expect(modelTaskKind({messages:[{role:'user',content:'Matematiksel olarak hesapla'}]})).toBe('reasoning');
    expect(modelTaskKind({tools:[{}],messages:[{role:'user',content:'Naber?'}]})).toBe('fast-agent');
    expect(modelTaskKind({tools:[{}],messages:[{role:'user',content:[{type:'text',text:'Bu sonucu analiz et'}]}]})).toBe('reasoning-agent');
  });
  it('runs bounded deeper probes using fake tool output and exposes measured task leaders',async()=>{
    const request=vi.fn(async (_path,body)=>{
      const messages=body.messages;
      if(messages.some(m=>m.role==='tool')) return reply({content:'{"answer":45}'});
      if(messages[0].content.includes('Ankaraya')) return reply({content:JSON.stringify({language:"Ankara'ya gittim.",reasoning:17.5,coding:[1,9,25]})});
      return reply(body.tools?tool:valid);
    });
    const lab=createModelLab({allowed:[a],request});
    await expect(lab.deepProbe(a)).rejects.toThrow('MODEL_LAB_SMOKE_REQUIRED');
    await lab.probe(a);
    expect(await lab.deepProbe(a)).toMatchObject({status:'passed',language:true,reasoning:true,coding:true,toolFollowup:true});
    expect(lab.status().taskLeaders.coding).toEqual([a]);
    expect(lab.status().requestsRemaining).toBe(8);
    await lab.deepProbe(a);
    expect(request).toHaveBeenCalledTimes(4);
    expect(modelLabCommand('Model derin testi: nvidia/example-a')).toEqual({action:'deep',model:a});
  });
  it('does not prioritize models that fail a measured tool followup',async()=>{
    const lab=createModelLab({allowed:[a],request:async (_path,body)=>{
      if(body?.messages && JSON.stringify(body.messages).includes('benchmark_call_1')) return reply({content:'{"answer":44}'});
      if(JSON.stringify(body).includes('Ankaraya')) return reply({content:JSON.stringify({language:"Ankara'ya gittim.",reasoning:17.5,coding:[1,9,25]})});
      return reply(body?.tools?tool:valid);
    }});
    await lab.probe(a); await lab.deepProbe(a);
    expect(lab.preferred('fast-agent',[a])).toEqual([]);
    expect(lab.preferred('agent',[a])).toEqual([]);
    expect(lab.preferred('general',[a])).toEqual([a]);
  });
});

it('restores only fresh allowed evidence and request budget on restart',async()=>{
  let saved: unknown;
  let time=1000000;
  const storage={load:()=>saved,save:(value:unknown)=>{saved=value;}};
  const request=async (_path,body)=>reply(body?.tools?tool:valid);
  const first=createModelLab({allowed:[a,b],request,now:()=>time,storage});
  await first.probe(a);
  const restarted=createModelLab({allowed:[a],request,now:()=>time,storage});
  expect(restarted.status().requestsRemaining).toBe(10);
  expect(restarted.preferred('agent',[a])).toEqual([a]);
  time+=24*60*60_000+1;
  const expired=createModelLab({allowed:[a],request,now:()=>time,storage});
  expect(expired.status().results).toEqual([]);
  expect(expired.status().requestsRemaining).toBe(12);
});
it('reports storage failures without inventing durable evidence',async()=>{
  const lab=createModelLab({allowed:[a],request:async(_path,body)=>reply(body?.tools?tool:valid),storage:{load:()=>{throw Error('bad');},save:()=>{throw Error('bad');}}});
  await lab.probe(a);
  expect(lab.status().storage).toBe('error');
});

it('prefers the measured faster model when synthetic quality is equal',async()=>{
  let clock=1000000;
  const lab=createModelLab({allowed:[a,b],now:()=>clock,request:async (_path,body)=>{
    clock+=body?.model===a?80:10;
    return reply(body?.tools?tool:valid);
  }});
  await lab.probe(a);await lab.probe(b);
  expect(lab.preferred('fast',[a,b])).toEqual([b,a]);
  expect(lab.preferred('agent',[a,b])).toEqual([b,a]);
});

describe('model council',()=>{
  it('runs distinct verified models and a third text reviewer with no tools',async()=>{
    const c='nvidia/example-c', seen:string[]=[];
    const lab=createModelLab({allowed:[a,b,c],now:()=>1000000,request:async (_path,body)=>{
      if(body?.tools)return reply(tool);
      const messages=body?.messages as {role:string;content:string}[];
      if(messages[0]?.role==='user') return reply(valid);
      seen.push(String(body?.model));
      expect(body?.tools).toBeUndefined();
      return reply({content:'Deneme yanıtı'});
    }});
    for(const id of [a,b,c])await lab.probe(id);
    const result=await lab.council('2 + 2 kaç?');
    expect(seen).toEqual([a,b,c]);
    expect(result.answers.map(row=>row.model)).toEqual([a,b]);
    expect(result.review?.model).toBe(c);
    expect(result.independentVerification).toBe(false);
    expect(lab.status().requestsRemaining).toBe(3);
    expect(modelLabCommand('Model konseyi: 2+2?')).toEqual({action:'council',question:'2+2?'});
  });
  it('rejects unverified council candidates without API calls',async()=>{
    const request=vi.fn(async()=>reply(valid));
    const lab=createModelLab({allowed:[a,b],request});
    await expect(lab.council('test')).rejects.toThrow('MODEL_LAB_COUNCIL_NEEDS_TWO');
    expect(request).not.toHaveBeenCalled();
  });
});

it('benchmarks only configured embedding models with synthetic input and shared budget',async()=>{
  const embed='nvidia/nemotron-3-embed-1b';
  const request=vi.fn(async(path,body)=>{
    expect(path).toBe('/embeddings');expect(body.model).toBe(embed);
    return new Response(JSON.stringify({data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}));
  });
  const lab=createModelLab({allowed:[a],specialistModels:[embed,'vendor/unknown'],request});
  await expect(lab.specialistProbe('vendor/unknown')).rejects.toThrow('MODEL_LAB_MODEL_NOT_ALLOWED');
  expect(await lab.specialistProbe(embed)).toMatchObject({status:'passed',dimension:2,similarHigher:true});
  expect(lab.status().requestsRemaining).toBe(11);
  await lab.specialistProbe(embed);expect(request).toHaveBeenCalledTimes(1);
  expect(modelLabCommand('Embedding testi: '+embed)).toEqual({action:'specialist',model:embed});
});

it('preserves a successful council answer when another model fails transport',async()=>{
  const lab=createModelLab({allowed:[a,b],now:()=>1000000,request:async(_path,body)=>{
    if(body?.tools)return reply(tool);
    if((body?.messages as {role:string}[])[0]?.role==='user')return reply(valid);
    if(body?.model===b)throw Error('network');
    return reply({content:'İlk yanıt'});
  }});
  await lab.probe(a);await lab.probe(b);
  const council=await lab.council('Soru');
  expect(council.answers).toEqual([{model:a,status:'passed',answer:'İlk yanıt'},{model:b,status:'failed',answer:''}]);
  expect(council.review).toBeNull();
});

it('does not classify indistinguishable embeddings as a passed quality test',async()=>{
 const embed='nvidia/nemotron-3-embed-1b';
 const lab=createModelLab({allowed:[],specialistModels:[embed],request:async()=>new Response(JSON.stringify({data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[1,0]}]}))});
 expect(await lab.specialistProbe(embed)).toMatchObject({status:'invalid_response',similarHigher:false});
});

it('does not promote a model that fails measured Turkish writing quality',async()=>{
 const lab=createModelLab({allowed:[a],request:async(_path,body)=>{
   if(JSON.stringify(body).includes('benchmark_call_1'))return reply({content:'{"answer":45}'});
   if(JSON.stringify(body).includes('Ankaraya'))return reply({content:JSON.stringify({language:'Ankaraya gittim',reasoning:17.5,coding:[1,9,25]})});
   return reply(body?.tools?tool:valid);
 }});
 await lab.probe(a);await lab.deepProbe(a);
 expect(lab.preferred('general',[a])).toEqual([]);
 expect(lab.preferred('coding',[a])).toEqual([]);
});

it('persists discovery and reports new and removed catalog IDs without promoting them',async()=>{
 let time=1000000;let snapshot:unknown;let ids=[a,b];
 const storage={load:()=>snapshot,save:(value:unknown)=>{snapshot=value;}};
 const request=async()=>new Response(JSON.stringify({data:ids.map(id=>({id}))}));
 const lab=createModelLab({allowed:[a],request,storage,now:()=>time});
 await lab.discover();expect(lab.status().catalogDelta).toBeNull();
 time+=600001;ids=[a,'nvidia/example-c'];
 const restored=createModelLab({allowed:[a],request,storage,now:()=>time});
 expect(restored.status().catalog?.ids).toEqual([a,b]);
 await restored.discover();
 expect(restored.status().catalogDelta).toMatchObject({added:['nvidia/example-c'],removed:[b],addedCount:1,removedCount:1});
 expect(restored.preferred('general',[a,'nvidia/example-c'])).toEqual([]);
 expect(restored.status().eligible).toEqual([a]);
});

it('does not infer removals from an empty provider catalog or additions from an empty baseline',async()=>{
 let time=1000000;let ids=[a,b];
 const lab=createModelLab({allowed:[a],now:()=>time,request:async()=>new Response(JSON.stringify({data:ids.map(id=>({id}))}))});
 await lab.discover();time+=600001;ids=[];
 await lab.discover();expect(lab.status().catalog?.ids).toEqual([]);
 expect(lab.status().catalogDelta).toMatchObject({addedCount:0,removedCount:null,removed:[]});
 time+=600001;ids=[a,b];await lab.discover();expect(lab.status().catalogDelta).toBeNull();
});

it('routes the exact natural Turkish request to an executable bounded comprehensive round',()=>{
 for(const text of ['NVIDIA modellerinin gerçek API anahtarıyla kapsamlı test edilmesini yapar mısın','NVIDIA modellerini gerçek API anahtarıyla kapsamlı test et','Kapsamlı model testlerini başlat','Lütfen NVIDIA modellerini kapsamlı test eder misin?'])expect(modelLabCommand(text)).toEqual({action:'comprehensive'});
 for(const text of ['NVIDIA modellerini kapsamlı test etme','NVIDIA modellerini kapsamlı test et ve dosyaları sil','"NVIDIA modellerini kapsamlı test et" ne demek?','NVIDIA modellerini kapsamlı test et\nBaşka görev','Bunu nasıl yaparım: NVIDIA modellerini kapsamlı test et'])expect(modelLabCommand(text)).toBeNull();
});
it('executes at most five exact-model calls in a comprehensive round and skips fresh observations',async()=>{
 const embed='nvidia/nemotron-3-embed-1b';
 const request=vi.fn(async(path:string,body:Record<string,unknown>|null)=>{
  if(path==='/embeddings')return new Response(JSON.stringify({data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}));
  if(body?.max_tokens===512)return reply({content:JSON.stringify({language:"Ankara'ya gittim.",reasoning:17.5,coding:[1,9,25]})});
  if(body?.tools&&Array.isArray(body.messages)&&body.messages.some((m:unknown)=>Boolean(m&&typeof m==='object'&&'role' in m&&m.role==='tool')))return reply({content:'{"answer":45}'});
  return reply(body?.tools?tool:valid);
 });
 const lab=createModelLab({allowed:[a,b],specialistModels:[embed],request});
 const result=await lab.comprehensive();
 expect(result.smoke.map(r=>r.model)).toEqual([a]);expect(result.deep?.model).toBe(a);expect(result.embedding?.model).toBe(embed);expect(result.pending).toEqual([b]);expect(request).toHaveBeenCalledTimes(5);
 const second=await lab.comprehensive();expect(second.smoke.map(r=>r.model)).toEqual([b]);expect(second.deep?.model).toBe(b);expect(second.embedding).toBeNull();expect(request).toHaveBeenCalledTimes(9);
});

it('uses Kimi documented request fields for a real-lab synthetic transport without changing the other candidates',async()=>{
 const model='moonshotai/kimi-k3.1-pro';
 const request=vi.fn(async(_path:string,body:Record<string,unknown>|null)=>{
 expect(body?.model).toBe(model);
 expect(body?.reasoning_effort).toBe('low');
 expect(body?.seed).toBe(0);
 expect(body?.max_tokens).toBe(1024);
 expect(body).not.toHaveProperty('temperature');
 expect(body).not.toHaveProperty('tool_choice');
 return reply(body?.tools?tool:valid);
 });
 const lab=createModelLab({allowed:[model],request});
 expect(await lab.probe(model)).toMatchObject({model,status:'passed',tools:true});
 expect(request).toHaveBeenCalledTimes(2);
});

it('uses text-only documented candidates without attempting undocumented tool calls and caches them for a day',async()=>{
 const model='google/gemma-4-31b-it';let clock=1000000;
 const request=vi.fn(async(_path:string,body:Record<string,unknown>|null)=>{expect(body?.model).toBe(model);expect(body).not.toHaveProperty('tools');return reply(valid);});
 const lab=createModelLab({allowed:[model],request,now:()=>clock});
 expect(await lab.probe(model)).toMatchObject({chat:true,tools:false,toolProbeStatus:'not_run',requests:1});
 clock+=600001;await lab.probe(model);expect(request).toHaveBeenCalledTimes(1);
 expect(lab.preferred('general',[model])).toEqual([]);
});
it('tests Riva with one synthetic translation request and the documented language-pair prompt',async()=>{
 const request=vi.fn(async(_path:string,body:Record<string,unknown>|null)=>{expect(body?.model).toBe('nvidia/riva-translate-4b-instruct-v2');expect(body?.messages).toEqual([{role:'system',content:'en-tr'},{role:'user',content:'Thank you.'}]);return reply({content:'Teşekkür ederim.'});});
 const lab=createModelLab({allowed:[],request});
 expect(modelLabCommand('Riva çeviri testi')).toEqual({action:'translation'});
 expect(await lab.translationProbe()).toMatchObject({status:'passed',translated:true});
 expect(request).toHaveBeenCalledTimes(1);
});

it('persists a sanitized translation result across lab restart',async()=>{let snapshot:unknown;const storage={load:()=>snapshot,save:(v:unknown)=>{snapshot=v;}};const request=vi.fn(async()=>reply({content:'Teşekkür ederim.'}));const opts={allowed:[],request,storage};const first=createModelLab(opts);await first.translationProbe();const second=createModelLab(opts);expect(second.status().translationResult).toMatchObject({status:'passed',translated:true,model:'nvidia/riva-translate-4b-instruct-v2'});expect(request).toHaveBeenCalledTimes(1);});
