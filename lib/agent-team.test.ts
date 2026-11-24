import {describe,it,expect} from 'vitest';
import {loadAgentRegistry,authorizeAgentTool} from './agent-runtime.ts';
import {createAgentDelegator,independentTeamAgent} from './agent-delegation.ts';
import {createAgentRunLedger} from './agent-run-ledger.ts';
import {diversifyExpertModels,expertModelTask} from './expert-model-policy.ts';
describe('45-specialist team',()=>{
 it('registers 45 specialists with routing profiles and no new write permission',async()=>{
  const registry=await loadAgentRegistry();
  const experts=registry.agents.filter(a=>a.kind==='specialist');
  expect(experts).toHaveLength(45);
  for(const a of experts){expect(expertModelTask(a.id)).toBeTruthy();expect(authorizeAgentTool(a,'repo.merge').allowed).toBe(false);}
  const candidates=['a/model','b/model','c/model'];
  const first=new Set(experts.map(a=>diversifyExpertModels(a.id,candidates)[0]));
  expect(first.size).toBe(3);
 });
 it('executes all independent specialist tasks concurrently, reporting actual model evidence',async()=>{
  const registry=await loadAgentRegistry();
  const root=registry.agents.find(a=>a.kind==='primary')!;
  const eligible=registry.agents.filter(independentTeamAgent);
  const ledger=createAgentRunLedger({traceId:'team-test',agentId:root.id,maxEntries:8192});
  let active=0,peak=0;
  const d=createAgentDelegator({registry,traceId:'team-test',parentAgent:root,parentTaskId:ledger.rootTaskId,runLedger:ledger,executeAgent:async({agent,task})=>{
   active++;peak=Math.max(peak,active);await Promise.resolve();active--;return {ok:true,content:task,models:['actual/'+agent.id]};
  }});
  const batch=eligible.map(a=>({agentId:a.id,task:'Read and review'}));
  const r=await d.delegateBatch(batch);expect(r).toMatchObject({ok:true,value:{requested:batch.length,completed:batch.length,deliveryVerified:false}});
  for(const a of registry.agents.filter(a=>a.kind==='specialist'&&!independentTeamAgent(a)))expect(await d.delegate({agentId:a.id,task:'Plan'})).toMatchObject({ok:true});
  expect(peak).toBe(eligible.length);expect(peak).toBeGreaterThan(40);
  expect(ledger.snapshot().entries.filter(e=>e.action==='agent.delegate')).toHaveLength(45);
  // Re-review can continue beyond the previous artificial 60 delegation ceiling.
  for(let i=0;i<20;i++)expect(await d.delegate({agentId:eligible[0]!.id,task:'Review iteration '+i})).toMatchObject({ok:true});
  expect(ledger.snapshot().entries.filter(e=>e.action==='agent.delegate')).toHaveLength(65);
  const abort=new AbortController();abort.abort();
  expect(await d.delegate({agentId:eligible[0]!.id,task:'cancel'},{signal:abort.signal})).toMatchObject({ok:false,error:'DELEGATION_CANCELLED'});
 });
});

it('preserves successful independent results even when a provider rejects one role',async()=>{
 const registry=await loadAgentRegistry(),root=registry.agents.find(a=>a.kind==='primary')!,eligible=registry.agents.filter(independentTeamAgent);
 const ledger=createAgentRunLedger({traceId:'partial-team',agentId:root.id,maxEntries:8192});
 const d=createAgentDelegator({registry,traceId:'partial-team',parentAgent:root,parentTaskId:ledger.rootTaskId,runLedger:ledger,executeAgent:async({agent})=>agent.id===eligible[0]!.id?{ok:false,error:'PROVIDER_RATE_LIMITED'}:{ok:true,content:'x'.repeat(4500)}});
 const r=await d.delegateBatch(eligible.map(a=>({agentId:a.id,task:'Review'})));
 expect(r).toMatchObject({ok:true,value:{requested:eligible.length,completed:eligible.length-1,results:[{agentId:eligible[0]!.id,ok:false,error:'PROVIDER_RATE_LIMITED'},...eligible.slice(1).map(a=>({agentId:a.id,ok:true,truncated:true}))]}});
});
