
import {describe,it,expect} from 'vitest';
import {openHafizeDb} from './hafize-db.ts';
import {loadAgentRegistry} from './agent-runtime.ts';
import {createExpertRegistry} from './expert-registry.ts';
describe('expert recovery and quotas',()=>{
 it('ages out historical failures so an expert can recover',async()=>{
 const db=openHafizeDb(':memory:');let now=100000000;
 const registry=await loadAgentRegistry();const experts=createExpertRegistry({db,registry,now:()=>now});
 const id='expert-math';
 for(let i=0;i<5;i++)experts.audit({parentTraceId:'trace',childAgentId:id,task:'test',result:'failure',latencyMs:1,ok:false});
 expect(experts.healthCheck(id).healthy).toBe(false);
 expect(experts.resolve('matematik').some(x=>x.agentId===id)).toBe(false);
 now+=86400001;
 expect(experts.healthCheck(id)).toMatchObject({healthy:true,sampleCount:0,successRate:null});
 expect(experts.resolve('matematik').some(x=>x.agentId===id)).toBe(true);
 db.close();
 });
 it('does not reserve a quota for unknown or primary agents, enforces the registered limit',async()=>{
 const db=openHafizeDb(':memory:');const registry=await loadAgentRegistry();const experts=createExpertRegistry({db,registry});
 expect(experts.consumeCall('unknown')).toBe(false);expect(experts.consumeCall(registry.defaultAgent)).toBe(false);
 const id='expert-math';const cap=experts.quotaStatus(id).callsPerDay;
 for(let i=0;i<cap;i++)expect(experts.consumeCall(id)).toBe(true);
 expect(experts.consumeCall(id)).toBe(false);expect(experts.quotaStatus(id).calls).toBe(cap);db.close();
 });
});
