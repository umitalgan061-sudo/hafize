import { authorizeAgentTool, type AgentDefinition } from './agent-runtime.ts';
import { formatTaskHandoff, normalizeTaskHandoff } from './task-handoff.ts';
import type { AgentRunLedger } from './agent-run-ledger.ts';

type Agent = AgentDefinition;
interface Registry { readonly agents:readonly Agent[]; readonly policy?:{readonly maxDelegationDepth?:number;readonly maxParallelAgents?:number}; }
interface Result { readonly ok:boolean; readonly content?:unknown; readonly error?:unknown; readonly models?:readonly string[]; }
interface Lifecycle { readonly start:(input:{runId:string;parentRunId:string;parentSignal?:AbortSignal|null;execute:(input:{signal?:AbortSignal})=>Promise<Result>})=>{promise:Promise<{value?:Result}>;snapshot:()=>{state:string;error?:unknown}}; }

const bounded=(value:unknown,fallback:number,max:number)=>Number.isInteger(value)?Math.min(Math.max(Number(value),1),max):fallback;
const clean=(value:unknown,max:number)=>{const text=typeof value==='string'?value.trim():'';return text&&text.length<=max?text:null;};
const fail=(error:string)=>({ok:false as const,error});
const count=(ledger:AgentRunLedger)=>ledger.snapshot().entries.filter((entry)=>entry.action==='agent.delegate').length;

export function createAgentDelegator(args:{
  readonly registry:Registry;readonly traceId:unknown;readonly parentAgent:Agent;readonly parentTaskId:string;readonly runLedger:AgentRunLedger;
  readonly executeAgent:(input:{agent:Agent;task:string;traceId:string;depth:number;parentTaskId:string;signal?:AbortSignal})=>Promise<Result>;
  readonly lifecycle?:Lifecycle|null;readonly parentSignal?:AbortSignal|null;
}){
  const {registry,traceId,parentAgent,parentTaskId,runLedger,executeAgent,lifecycle=null,parentSignal=null}=args;
  if(!registry?.agents?.length)throw new Error('INVALID_DELEGATION_RUNTIME:registry');
  if(!parentAgent?.id)throw new Error('INVALID_DELEGATION_RUNTIME:parentAgent');
  if(typeof traceId!=='string'||!traceId.trim())throw new Error('INVALID_DELEGATION_RUNTIME:traceId');
  const maxDepth=bounded(registry.policy?.maxDelegationDepth,1,8),maxFanOut=bounded(registry.policy?.maxParallelAgents,1,60);
  function handoff(value:unknown){
    const normalized=normalizeTaskHandoff(value);if(!normalized.ok)return null;
    const item=normalized.handoff;
    if(!(item.successCriteria.length||item.constraints.length||item.evidenceRequired.length))return item;
    const formatted=formatTaskHandoff(item);return formatted.ok?{...item,task:formatted.task}:null;
  }
  async function delegate(value:unknown,{depth=0,signal}:{readonly depth?:number;readonly signal?:AbortSignal}={}){
    if(signal?.aborted||parentSignal?.aborted)return fail('DELEGATION_CANCELLED');
    const runSignal=signal&&parentSignal?AbortSignal.any([signal,parentSignal]):signal??parentSignal??undefined;
    const authorization=authorizeAgentTool(parentAgent,'agent.delegate');
    if(!authorization.allowed)return fail('DELEGATION_NOT_AUTHORIZED');
    if(!Number.isInteger(depth)||depth<0)return fail('INVALID_DELEGATION_DEPTH');
    if(depth>=maxDepth)return fail('DELEGATION_DEPTH_EXCEEDED');
    const input=handoff(value);if(!input)return fail('INVALID_DELEGATION_ARGUMENTS');
    const target=registry.agents.find((agent)=>agent.id===String(input.agentId));
    if(!target)return fail('DELEGATION_TARGET_NOT_FOUND');
    if(target.id===parentAgent.id)return fail('SELF_DELEGATION_NOT_ALLOWED');
    if(target.kind!=='specialist')return fail('DELEGATION_TARGET_NOT_SPECIALIST');
    if(count(runLedger)>=maxFanOut)return fail('DELEGATION_FANOUT_EXCEEDED');
    const task=runLedger.recordDelegationStart(target.id,{parentTaskId});
    let result:Result|undefined;
    try{
      if(lifecycle){
        const run=lifecycle.start({runId:task.taskId,parentRunId:parentTaskId,parentSignal:runSignal,execute:({signal})=>executeAgent({agent:target,task:String(input.task),traceId:String(traceId).trim(),depth:Number(depth)+1,parentTaskId:task.taskId,signal})});
        const completed=await run.promise;result=completed?.value;
        if(run.snapshot().state==='cancelled')result=fail('DELEGATION_CANCELLED');
        if(!result)result=fail(String(run.snapshot().error||'DELEGATED_AGENT_FAILED'));
      }else{
        result=await executeAgent({agent:target,task:String(input.task),traceId:String(traceId).trim(),depth:Number(depth)+1,parentTaskId:task.taskId,signal:runSignal});
      }
    }catch(error){result=fail(String((error as {message?:unknown})?.message)==='AGENT_CONCURRENCY_EXCEEDED'?'DELEGATION_CONCURRENCY_EXCEEDED':'DELEGATED_AGENT_FAILED');}
    if(runSignal?.aborted)result=fail('DELEGATION_CANCELLED');
    if(!result?.ok){
      const error=clean(result?.error,120)||'DELEGATED_AGENT_FAILED';
      runLedger.recordDelegationFinish(task.taskId,{ok:false,error});return fail(error);
    }
    runLedger.recordDelegationFinish(task.taskId,{ok:true});
    return {ok:true as const,value:{agentId:target.id,agentName:target.name,content:typeof result.content==='string'?result.content:'',...(result.models?.length?{models:[...new Set(result.models)].slice(0,20)}:{})}};
  }
  // Batches are read-only specialist work. One root turn awaits one batch at a time.
  // Nested orchestrators cannot launch batches, avoiding recursive pool deadlock.
  async function delegateBatch(raw:unknown,signal?:AbortSignal){
    if(parentAgent.kind!=='primary'||!authorizeAgentTool(parentAgent,'agent.delegate').allowed)return fail('TEAM_NOT_AUTHORIZED');
    if(!Array.isArray(raw)||raw.length<1||raw.length>8)return fail('TEAM_BATCH_SIZE');
    const inputs=raw.map(handoff);
    if(inputs.some(i=>!i)||new Set(inputs.map(i=>i?.agentId)).size!==inputs.length)return fail('TEAM_INVALID_OR_DUPLICATE_AGENT');
    for(const input of inputs){
      const target=registry.agents.find(a=>a.id===input!.agentId);
      if(!target||target.kind!=='specialist'||authorizeAgentTool(target,'agent.delegate').allowed)return fail('TEAM_TARGET_NOT_INDEPENDENT');
    }
    if(count(runLedger)+raw.length>maxFanOut)return fail('DELEGATION_FANOUT_EXCEEDED');
    const results:Array<unknown>=new Array(raw.length);
    let next=0;
    await Promise.all(Array.from({length:Math.min(3,raw.length)},async()=>{
      while(next<raw.length){
        const i=next++;
        if(signal?.aborted||parentSignal?.aborted){results[i]={agentId:inputs[i]!.agentId,ok:false,error:'DELEGATION_CANCELLED'};continue;}
        const result=await delegate(raw[i],{depth:0,signal});
        if(result.ok){
          const value=result.value;
          results[i]={agentId:value.agentId,ok:true,models:value.models??[],content:value.content.slice(0,6000),truncated:value.content.length>6000};
        }else results[i]={agentId:inputs[i]!.agentId,ok:false,error:result.error};
      }
    }));
    return {ok:true as const,value:{requested:raw.length,completed:results.filter(r=>(r as {ok:boolean}).ok).length,results,deliveryVerified:false}};
  }
  return Object.freeze({delegate,delegateBatch});
}