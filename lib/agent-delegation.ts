// @ts-ignore Legacy agent registry remains shared during migration.
import { authorizeAgentTool } from './agent-runtime.mjs';
// @ts-ignore Legacy task handoff remains shared during migration.
import { formatTaskHandoff, normalizeTaskHandoff } from './task-handoff.mjs';
import type { AgentRunLedger } from './agent-run-ledger.ts';
import type { AgentToolPolicy } from './agent-runtime.ts';

interface Agent { readonly id:string; readonly name:string; readonly kind:string; readonly toolPolicy?:AgentToolPolicy|undefined; }
interface Registry { readonly agents:readonly Agent[]; readonly policy?:{readonly maxDelegationDepth?:number;readonly maxParallelAgents?:number}; }
interface Result { readonly ok:boolean; readonly content?:unknown; readonly error?:unknown; }
interface Lifecycle { readonly start:(input:{runId:string;parentRunId:string;parentSignal?:AbortSignal|null;execute:(input:{signal?:AbortSignal|undefined})=>Promise<Result>})=>{promise:Promise<{value?:Result}>;snapshot:()=>{state:string;error?:unknown}}; }

const bounded=(value:unknown,fallback:number,max:number)=>Number.isInteger(value)?Math.min(Math.max(Number(value),1),max):fallback;
const clean=(value:unknown,max:number)=>{const text=typeof value==='string'?value.trim():'';return text&&text.length<=max?text:null;};
const fail=(error:string)=>({ok:false as const,error});
const count=(ledger:AgentRunLedger)=>ledger.snapshot().entries.filter((entry)=>entry.action==='agent.delegate').length;

export function createAgentDelegator(args:{
  readonly registry:Registry;readonly traceId:unknown;readonly parentAgent:Agent;readonly parentTaskId:string;readonly runLedger:AgentRunLedger;
  readonly executeAgent:(input:{agent:Agent;task:string;traceId:string;depth:number;parentTaskId:string;signal?:AbortSignal|undefined})=>Promise<Result>;
  readonly lifecycle?:Lifecycle|null;readonly parentSignal?:AbortSignal|null;
}){
  const {registry,traceId,parentAgent,parentTaskId,runLedger,executeAgent,lifecycle=null,parentSignal=null}=args;
  if(!registry?.agents?.length)throw new Error('INVALID_DELEGATION_RUNTIME:registry');
  if(!parentAgent?.id)throw new Error('INVALID_DELEGATION_RUNTIME:parentAgent');
  if(typeof traceId!=='string'||!traceId.trim())throw new Error('INVALID_DELEGATION_RUNTIME:traceId');
  const maxDepth=bounded(registry.policy?.maxDelegationDepth,1,8),maxFanOut=bounded(registry.policy?.maxParallelAgents,1,16);
  function handoff(value:unknown){
    const normalized=normalizeTaskHandoff(value);if(!normalized.ok)return null;
    const item=normalized.handoff;
    if(!(item.successCriteria.length||item.constraints.length||item.evidenceRequired.length))return item;
    const formatted=formatTaskHandoff(item);return formatted.ok?{...item,task:formatted.task}:null;
  }
  async function delegate(value:unknown,{depth=0}:{readonly depth?:number}={}){
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
        const run=lifecycle.start({runId:task.taskId,parentRunId:parentTaskId,parentSignal,execute:({signal})=>executeAgent({agent:target,task:String(input.task),traceId:String(traceId).trim(),depth:Number(depth)+1,parentTaskId:task.taskId,signal})});
        const completed=await run.promise;result=completed.value;
        if(run.snapshot().state==='cancelled')result=fail('DELEGATION_CANCELLED');
        if(!result)result=fail(String(run.snapshot().error||'DELEGATED_AGENT_FAILED'));
      }else{
        result=await executeAgent({agent:target,task:String(input.task),traceId:String(traceId).trim(),depth:Number(depth)+1,parentTaskId:task.taskId});
      }
    }catch{result=fail('DELEGATED_AGENT_FAILED');}
    if(!result?.ok){
      const error=clean(result?.error,120)||'DELEGATED_AGENT_FAILED';
      runLedger.recordDelegationFinish(task.taskId,{ok:false,error});return fail(error);
    }
    runLedger.recordDelegationFinish(task.taskId,{ok:true});
    return {ok:true as const,value:{agentId:target.id,agentName:target.name,content:typeof result.content==='string'?result.content:''}};
  }
  return Object.freeze({delegate});
}