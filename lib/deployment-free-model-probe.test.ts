import {it,expect,vi} from 'vitest';
import {openHafizeDb} from './hafize-db.ts';
import {createModelLab} from './model-lab.ts';
import {GEMMA_4,OMNI} from './model-lab-provider-profile.ts';
import {deploymentFreeModelProbe} from './deployment-free-model-probe.ts';
it('runs only the five fixed synthetic targets and claims the expiry once',async()=>{
 const db=openHafizeDb(':memory:');const time=Date.parse('2026-01-01T00:00:00.000Z');const ids=['nvidia/nemotron-3.5-embed-1b','nvidia/nemotron-3.5-embed-8b'];
 const request=vi.fn(async(path:string,body:Record<string,unknown>|null)=>new Response(JSON.stringify(path==='/embeddings'?{data:[{index:0,embedding:[1,0]},{index:1,embedding:[1,0]},{index:2,embedding:[0,1]}]}:{choices:[{message:{content:body?.model==='nvidia/riva-translate-4b-instruct-v2'?'Teşekkür ederim.':'{"capital":"Ankara","math":383,"code":12}'}}]})));
 const lab=createModelLab({allowed:[GEMMA_4,OMNI],specialistModels:ids,request,now:()=>time});const log=vi.fn();const opts={db,lab,log,now:()=>time,until:new Date(time+60000).toISOString()};
 await deploymentFreeModelProbe({...opts,until:new Date(time-1).toISOString()});expect(request).not.toHaveBeenCalled();
 await deploymentFreeModelProbe(opts);await deploymentFreeModelProbe(opts);expect(request).toHaveBeenCalledTimes(5);
 expect(log).toHaveBeenCalledTimes(6);expect(log.mock.calls.slice(0,5).every(([line])=>String(line).includes('"status":"passed"'))).toBe(true);db.close();
});
