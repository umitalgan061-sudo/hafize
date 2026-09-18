// @ts-ignore Legacy credential policy remains shared during migration.
import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';
const CREATE_FIELDS=new Set(['agentId','task','runAt','maxAttempts']);
interface Principal{readonly authenticated?:boolean;readonly subject?:unknown;}
interface Entry{readonly ownerId:string;readonly scheduleId:string;readonly traceId:string;readonly agentId:string;readonly task:string;readonly runAt:unknown;readonly status:string;readonly attempts:number;readonly maxAttempts:number;readonly lastError:unknown;readonly createdAt:string;readonly updatedAt:string;}
interface Store{readonly add:(input:Record<string,unknown>)=>Promise<Entry>;readonly read:(id:string)=>Promise<Entry|null>;readonly snapshot:()=>Promise<{entries:readonly Entry[]}>;readonly cancel:(id:string)=>Promise<Entry>;}
const subject=(principal:Principal|undefined)=>{if(principal?.authenticated!==true)return null;const value=typeof principal.subject==='string'?principal.subject.trim():'';return value&&value.length<=200?value:null;};
const fail=(error:string)=>({ok:false as const,error});
const publicEntry=(entry:Entry)=>{const{ownerId:_owner,...value}=entry;return value;};
const storeError=(error:unknown)=>{const message=error instanceof Error?error.message:'';if(message==='TASK_SCHEDULE_FULL')return'SCHEDULE_CAPACITY_REACHED';if(message.startsWith('INVALID_TASK_SCHEDULE'))return'INVALID_SCHEDULE';return'SCHEDULE_COMMAND_FAILED';};
export function createScheduleCommandBoundary(args:{readonly store:Store;readonly registry:{readonly agents:readonly{readonly id:string}[]};readonly createTraceId:()=>unknown;}){
  const{store,registry,createTraceId}=args;
  if(!store?.add||!store?.read||!store?.snapshot||!store?.cancel)throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:store');
  async function create(input:{readonly principal?:Principal;readonly input?:Record<string,unknown>}={}){
    const ownerId=subject(input.principal);if(!ownerId)return fail('AUTH_REQUIRED');
    const data=input.input;if(!data||Array.isArray(data)||typeof data!=='object')return fail('INVALID_SCHEDULE_COMMAND');
    if(Object.keys(data).some((key)=>!CREATE_FIELDS.has(key)))return fail('INVALID_SCHEDULE_COMMAND');
    const agentId=typeof data.agentId==='string'?data.agentId.trim():'';const agent=registry.agents.find((item)=>item.id===agentId);
    if(!agent)return fail('INVALID_AGENT');const task=typeof data.task==='string'?data.task.trim():'';
    if(!task||task.length>20_000)return fail('INVALID_SCHEDULE_COMMAND');if(containsPlaintextCredential(task))return fail('SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED');
    const traceId=String(createTraceId()||'').trim();if(!traceId)return fail('SCHEDULE_COMMAND_FAILED');
    try{return{ok:true as const,schedule:publicEntry(await store.add({ownerId,traceId,agentId:agent.id,task,runAt:data.runAt,maxAttempts:data.maxAttempts}))};}catch(error){return fail(storeError(error));}
  }
  async function list(input:{readonly principal?:Principal}={}){
    const ownerId=subject(input.principal);if(!ownerId)return fail('AUTH_REQUIRED');
    try{return{ok:true as const,schedules:(await store.snapshot()).entries.filter((entry)=>entry.ownerId===ownerId).map(publicEntry)};}catch{return fail('SCHEDULE_COMMAND_FAILED');}
  }
  async function cancel(input:{readonly principal?:Principal;readonly scheduleId?:unknown}={}){
    const ownerId=subject(input.principal);if(!ownerId)return fail('AUTH_REQUIRED');
    const id=typeof input.scheduleId==='string'?input.scheduleId.trim():'';if(!id)return fail('INVALID_SCHEDULE_COMMAND');
    let current:Entry|null;try{current=await store.read(id);}catch{return fail('SCHEDULE_COMMAND_FAILED');}
    if(!current||current.ownerId!==ownerId)return fail('SCHEDULE_NOT_FOUND');if(current.status!=='scheduled')return fail('SCHEDULE_NOT_CANCELLABLE');
    try{return{ok:true as const,schedule:publicEntry(await store.cancel(id))};}catch{return fail('SCHEDULE_COMMAND_FAILED');}
  }
  return Object.freeze({create,list,cancel});
}