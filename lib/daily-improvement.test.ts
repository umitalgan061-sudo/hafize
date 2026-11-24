
import {describe,it,expect,vi} from 'vitest';
import {openHafizeDb} from './hafize-db.ts';
import {createDailyImprovement,DAY_MS,dailyCycleSummary} from './daily-improvement.ts';
import {createModelLab} from './model-lab.ts';
describe('daily improvement',()=>{
  it('claims a 24h window durably, reports all experts and does not call paid APIs by default',async()=>{
    const db=openHafizeDb(':memory:');let clock=10000000;
    const request=vi.fn(async()=>new Response('{}'));
    const lab=createModelLab({allowed:['nvidia/example'],request});
    const options={db,lab,expertHealth:()=>[{agentId:'a',healthy:true,reasons:[],successRate:null,p99Ms:null,sampleCount:0}],now:()=>clock};
    const daily=createDailyImprovement(options);
    expect((await daily.tick())?.experts.map(x=>x.agentId)).toEqual(['a']);
    expect(await daily.tick()).toBeNull();
    expect(await createDailyImprovement(options).tick()).toBeNull();
    clock+=DAY_MS;
    expect((await createDailyImprovement(options).tick())?.state).toBe('completed');
    expect(createDailyImprovement(options).status().history).toHaveLength(2);
    expect(request).not.toHaveBeenCalled();
    db.close();
  });
  it('allows bounded synthetic probes when explicitly enabled',async()=>{
    const db=openHafizeDb(':memory:');
    const request=vi.fn(async(_path,body)=>new Response(JSON.stringify({choices:[{message:body?.tools?{tool_calls:[{function:{name:'benchmark_echo',arguments:'{"value":42}'}}]}:{content:'{"capital":"Ankara","math":383,"code":12}'}}]})));
    const lab=createModelLab({allowed:['nvidia/example'],request});
    const daily=createDailyImprovement({db,lab,expertHealth:()=>[],liveProbes:true});
    expect((await daily.tick())?.testedModels).toEqual(['nvidia/example']);
    expect(daily.status().report?.taskLeaders.general).toEqual(['nvidia/example']);
    expect(request).toHaveBeenCalledTimes(2);
    db.close();
  });
});

it('alternates deep and breadth days without exceeding the five-request budget',async()=>{
 const db=openHafizeDb(':memory:');let clock=10000000;
 const request=vi.fn(async(path:string,body:Record<string,unknown>|null)=>{
   if(path==='/embeddings')return new Response(JSON.stringify({data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}));
   const content=body?.max_tokens===512?JSON.stringify({language:"Ankara'ya gittim.",reasoning:17.5,coding:[1,9,25]}):'{"capital":"Ankara","math":383,"code":12}';
   let message:Record<string,unknown>={content};
   if(body?.tools){
     if(Array.isArray(body.messages)&&body.messages.some((m:unknown)=>Boolean(m&&typeof m==='object'&&'role' in m&&m.role==='tool')))message={content:'{"answer":45}'};
     else message={tool_calls:[{function:{name:'benchmark_echo',arguments:'{"value":42}'}}]};
   }
   return new Response(JSON.stringify({choices:[{message}]}));
 });
 const lab=createModelLab({allowed:['nvidia/a','nvidia/b','nvidia/c'],specialistModels:['nvidia/nemotron-3-embed-1b'],request,now:()=>clock});
 const daily=createDailyImprovement({db,lab,expertHealth:()=>[],liveProbes:true,now:()=>clock});
 const first=await daily.tick();
 expect(first?.deepTestedModels).toEqual(['nvidia/a']);
 expect(request.mock.calls.length).toBeLessThanOrEqual(5);
 request.mockClear();clock+=DAY_MS+1;
 const second=await daily.tick();
 expect(second?.deepTestedModels).toEqual([]);
 expect(second?.testedModels).toEqual(['nvidia/b','nvidia/c']);
 expect(request.mock.calls.length).toBeLessThanOrEqual(5);
 db.close();
});

it('records daily runtime evidence without enabling provider requests',async()=>{
 const db=openHafizeDb(':memory:');
 const request=vi.fn(async()=>new Response('{}'));
 const lab=createModelLab({allowed:['nvidia/example'],request});
 const row={model:'nvidia/example',attempts:10,headersOk:8,failures:2,streamFailures:1,meanHeaderMs:50};
 const daily=createDailyImprovement({db,lab,expertHealth:()=>[],runtimeEvidence:()=>[row]});
 expect((await daily.tick())?.runtimeEvidence).toEqual([row]);
 expect(daily.status().report?.runtimeEvidence).toEqual([row]);
 expect(request).not.toHaveBeenCalled();db.close();
});

it('marks a failed offline expert contract as partial without making provider calls',async()=>{
 const db=openHafizeDb(':memory:');
 const request=vi.fn(async()=>new Response('{}'));
 const lab=createModelLab({allowed:['nvidia/example'],request});
 const daily=createDailyImprovement({db,lab,expertHealth:()=>[],expertReadiness:()=>[{agentId:'expert-math',passed:false,mode:'offline_contract',checks:[{key:'model_profile',passed:false}]}]});
 expect(await daily.tick()).toMatchObject({state:'partial',error:'EXPERT_CONTRACT_CHECK_FAILED'});
 expect(request).not.toHaveBeenCalled();db.close();
});

it('durably recovers an interrupted report without reclaiming its 24 hour window',async()=>{
 const db=openHafizeDb(':memory:');let clock=10000000;
 const daily=createDailyImprovement({db,lab:null,expertHealth:()=>[],now:()=>clock});
 db.prepare('INSERT INTO hafize_daily_improvement(id,started_at,report) VALUES(1,?,?)').run(clock,JSON.stringify({state:'running',startedAt:new Date(clock).toISOString(),finishedAt:null,experts:[],testedModels:[],specialists:[],taskLeaders:{},liveProbes:false,error:null}));
 clock+=240001;expect(await daily.tick()).toBeNull();
 expect(daily.status().report).toMatchObject({state:'partial',error:'DAILY_INTERRUPTED_BEFORE_REPORT'});
 expect(daily.status().history).toHaveLength(1);db.close();
});
it('produces a bounded daily recommendation plan without external API calls',async()=>{
 const db=openHafizeDb(':memory:');
 const daily=createDailyImprovement({db,lab:null,expertHealth:()=>[]});
 const report=await daily.tick();
 expect(report?.plan?.mode).toBe('recommendation_only');
 expect(report?.plan?.tasks.map(t=>t.id)).toContain('model-lab-access');db.close();
});

it('discovers catalog on alternating days and stays within five daily provider requests',async()=>{
 const db=openHafizeDb(':memory:');let clock=10000000;
 const request=vi.fn(async(path:string,body:Record<string,unknown>|null)=>{
  if(path==='/models')return new Response(JSON.stringify({data:[{id:'nvidia/a'},{id:'nvidia/b'}]}));
  if(path==='/embeddings')return new Response(JSON.stringify({data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}));
  const content=body?.max_tokens===512?JSON.stringify({language:"Ankara'ya gittim.",reasoning:17.5,coding:[1,9,25]}):'{"capital":"Ankara","math":383,"code":12}';
  let message:Record<string,unknown>={content};
  if(body?.tools)message=Array.isArray(body.messages)&&body.messages.some((m:unknown)=>Boolean(m&&typeof m==='object'&&'role' in m&&m.role==='tool'))?{content:'{"answer":45}'}:{tool_calls:[{function:{name:'benchmark_echo',arguments:'{"value":42}'}}]};
  return new Response(JSON.stringify({choices:[{message}]}));
 });
 const lab=createModelLab({allowed:['nvidia/a','nvidia/b'],specialistModels:['nvidia/nemotron-3-embed-1b'],request,now:()=>clock});
 const daily=createDailyImprovement({db,lab,expertHealth:()=>[],discoverCatalog:true,liveProbes:true,now:()=>clock});
 expect((await daily.tick())?.catalogDiscovery).toBe(true);
 expect(request.mock.calls.length).toBeLessThanOrEqual(5);
 expect(request.mock.calls.some(([path])=>path==='/embeddings')).toBe(false);
 request.mockClear();clock+=DAY_MS+1;
 expect((await daily.tick())?.specialists).toEqual(['nvidia/nemotron-3-embed-1b']);
 expect(request.mock.calls.some(([path])=>path==='/models')).toBe(false);
 expect(request.mock.calls.length).toBeLessThanOrEqual(5);db.close();
});

it('reports only aggregate daily diagnostics without logging task contents',async()=>{
 const db=openHafizeDb(':memory:');const daily=createDailyImprovement({db,lab:null,expertHealth:()=>[{agentId:'a',healthy:false,reasons:['private diagnostic'],successRate:null,p99Ms:null,sampleCount:0}]});
 const report=await daily.tick();expect(report).not.toBeNull();const summary=dailyCycleSummary(report!);
 expect(summary).toMatchObject({state:'completed',experts:1,liveProbes:false,testedModels:0});
 expect(JSON.stringify(summary)).not.toContain('private diagnostic');expect(summary.recommendations).toBeGreaterThan(0);db.close();
});
