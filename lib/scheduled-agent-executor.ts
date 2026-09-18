import type { AgentDefinition, AgentRegistry } from './agent-runtime.ts';
import type { AgentRunLedger } from './agent-run-ledger.ts';
// @ts-ignore Legacy delegated runner remains shared during migration.
import { runDelegatedAgent } from './delegated-agent-runner.mjs';
// @ts-ignore Typed credential boundary is the single policy source.
import { containsPlaintextCredential } from './plaintext-credential-policy.ts';

const clean=(value:unknown,max:number)=>{const text=typeof value==='string'?value.trim():'';return text&&text.length<=max?text:null;};
const errorCode=(value:unknown)=>{const text=clean(value,120);return text&&/^[A-Z0-9_:-]+$/.test(text)?text:'SCHEDULE_AGENT_RUN_FAILED';};

export function createScheduledAgentExecutor(args:{
  readonly registry:AgentRegistry;
  readonly model?:unknown;
  readonly complete:(payload:unknown,signal?:AbortSignal)=>Promise<unknown>;
  readonly maxTokens?:unknown;
  readonly nvidiaConfigured?:boolean;
  readonly githubReadConfigured?:boolean;
  readonly githubReadFile?:unknown;
  readonly runAgentTask?:typeof runDelegatedAgent;
}){
  const{registry,model,complete,maxTokens=2048,nvidiaConfigured=false,githubReadConfigured=false,githubReadFile,runAgentTask=runDelegatedAgent}=args;
  if(!Array.isArray(registry?.agents))throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:registry');
  if(typeof complete!=='function')throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:complete');
  if(typeof runAgentTask!=='function')throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:runAgentTask');
  const safeModel=clean(model,300);
  const tokenLimit=Number.isInteger(maxTokens)?Math.min(Math.max(Number(maxTokens),1),8192):2048;
  async function executeAgentTask({traceId,agent,task,...rest}:{readonly traceId?:unknown;readonly agent?:AgentDefinition;readonly task?:unknown;readonly [key:string]:unknown}={}){
    const safeTraceId=clean(traceId,128),safeTask=clean(task,20_000);
    const canonicalAgent=agent?.id?registry.agents.find(item=>item.id===agent.id):undefined;
    if(!safeTraceId||!safeTask||!canonicalAgent)return{ok:false as const,error:'INVALID_SCHEDULE_AGENT_TASK'};
    if(!safeModel)return{ok:false as const,error:'SCHEDULE_MODEL_NOT_CONFIGURED'};
    if(containsPlaintextCredential(safeTask))return{ok:false as const,error:'SCHEDULE_AGENT_TASK_CREDENTIAL_BLOCKED'};
    const ledger=rest.runLedger as AgentRunLedger;
    let result:Record<string,unknown>|null=null;
    try{
      result=await runAgentTask({agent:canonicalAgent,task:safeTask,traceId:safeTraceId,parentTaskId:ledger.rootTaskId,depth:0,registry,runLedger:ledger,model:safeModel,maxTokens:tokenLimit,complete,nvidiaConfigured:Boolean(nvidiaConfigured),githubReadConfigured:Boolean(githubReadConfigured),githubReadFile}) as Record<string,unknown>;
    }catch{result={ok:false,error:'SCHEDULE_AGENT_RUN_FAILED'};}
    if(result?.ok!==true){const error=errorCode(result?.error);ledger.finish({ok:false,detail:error});return{ok:false as const,error,taskLedger:ledger.snapshot()};}
    const content=typeof result.content==='string'?result.content:'';
    if(containsPlaintextCredential(content)){ledger.finish({ok:false,detail:'SCHEDULE_AGENT_RESULT_CREDENTIAL_BLOCKED'});return{ok:false as const,error:'SCHEDULE_AGENT_RESULT_CREDENTIAL_BLOCKED',taskLedger:ledger.snapshot()};}
    ledger.finish({ok:true});return{ok:true as const,content,taskLedger:ledger.snapshot()};
  }
  return Object.freeze({configured:Boolean(safeModel),executeAgentTask});
}
