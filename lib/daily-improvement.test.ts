
import {describe,it,expect,vi} from 'vitest';
import {openHafizeDb} from './hafize-db.ts';
import {createDailyImprovement,DAY_MS} from './daily-improvement.ts';
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
 const request=vi.fn(async(path,body)=>new Response(JSON.stringify(path==='/embeddings'?{data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}:{choices:[{message:body?.tools?(Array.isArray(body.messages)&&body.messages.some((m:any)=>m.role==='tool')?{content:'{"answer":45}'}:{tool_calls:[{function:{name:'benchmark_echo',arguments:'{"value":42}'}}]}):body?.max_tokens===512?{content:JSON.stringify({language:"Ankara'ya gittim.",reasoning:17.5,coding:[1,9,25]})}:{content:'{"capital":"Ankara","math":383,"code":12}'}}}]})));
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
