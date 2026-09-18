import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';

const CREATE_FIELDS = new Set(['agentId','task','runAt','maxAttempts']);
interface Principal { readonly authenticated?: boolean; readonly subject?: unknown; }
interface ScheduleEntry { readonly scheduleId:string; readonly traceId:string; readonly agentId:string; readonly task:string; readonly runAt:unknown; readonly status:string; readonly attempts:number; readonly maxAttempts:number; readonly lastError:unknown; readonly createdAt:string; readonly updatedAt:string; readonly ownerId:string; }
interface ScheduleStore { readonly add:(input:Record<string,unknown>)=>Promise<ScheduleEntry>; readonly read:(id:string)=>Promise<ScheduleEntry|null>; readonly snapshot:()=>Promise<{readonly entries:readonly ScheduleEntry[]}>; readonly cancel:(id:string)=>Promise<ScheduleEntry>; }
interface Registry { readonly agents:readonly {readonly id:string}[]; }
type Result = { readonly ok:false; readonly error:string } | { readonly ok:true; readonly schedule:unknown } | { readonly ok:true; readonly schedules:readonly unknown[] };

function principalSubject(principal: Principal | undefined): string | null {
  if (!principal || principal.authenticated !== true) return null;
  const subject=typeof principal.subject==='string'?principal.subject.trim():'';
  return subject&&subject.length<=200?subject:null;
}
function publicSchedule(entry: ScheduleEntry): Omit<ScheduleEntry,'ownerId'> {
  const {ownerId:_ownerId,...publicValue}=entry; return publicValue;
}
function fail(error:string): {ok:false;error:string} { return {ok:false,error}; }
function mapStoreError(error: unknown): string {
  const message=error instanceof Error?error.message:'';
  if(message==='TASK_SCHEDULE_FULL') return 'SCHEDULE_CAPACITY_REACHED';
  if(message.startsWith('INVALID_TASK_SCHEDULE')) return 'INVALID_SCHEDULE';
  return 'SCHEDULE_COMMAND_FAILED';
}
export function createScheduleCommandBoundary({
  store, registry, createTraceId
}: { readonly store:ScheduleStore; readonly registry:Registry; readonly createTraceId:()=>unknown }): Readonly<{
  create:(input?:{readonly principal?:Principal;readonly input?:Record<string,unknown>})=>Promise<Result>;
  list:(input?:{readonly principal?:Principal})=>Promise<Result>;
  cancel:(input?:{readonly principal?:Principal;readonly scheduleId?:unknown})=>Promise<Result>;
}> {
  if(!store?.add||!store?.read||!store?.snapshot||!store?.cancel) throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:store');
  if(!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:registry');
  if(typeof createTraceId!=='function') throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:createTraceId');
  async function create({principal,input}={}: {readonly principal?:Principal;readonly input?:Record<string,unknown>}={}):Promise<Result>{
    const ownerId=principalSubject(principal); if(!ownerId) return fail('AUTH_REQUIRED');
    if(!input||Array.isArray(input)||typeof input!=='object') return fail('INVALID_SCHEDULE_COMMAND');
    for(const key of Object.keys(input)) if(!CREATE_FIELDS.has(key)) return fail('INVALID_SCHEDULE_COMMAND');
    const agentId=typeof input.agentId==='string'?input.agentId.trim():'';
    const agent=registry.agents.find((item)=>item.id===agentId)||null; if(!agent) return fail('INVALID_AGENT');
    const task=typeof input.task==='string'?input.task.trim():'';
    if(!task||task.length>20000) return fail('INVALID_SCHEDULE_COMMAND');
    if(containsPlaintextCredential(task)) return fail('SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED');
    let traceId=''; try { traceId=String(createTraceId()||'').trim(); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if(!traceId) return fail('SCHEDULE_COMMAND_FAILED');
    try {
      const schedule=await store.add({ownerId,traceId,agentId:agent.id,task,runAt:input.runAt,maxAttempts:input.maxAttempts});
      return {ok:true,schedule:publicSchedule(schedule)};
    } catch(error) { return fail(mapStoreError(error)); }
  }
  async function list({principal}: {readonly principal?:Principal}={}):Promise<Result>{
    const ownerId=principalSubject(principal); if(!ownerId) return fail('AUTH_REQUIRED');
    try { return {ok:true,schedules:(await store.snapshot()).entries.filter((entry)=>entry.ownerId===ownerId).map(publicSchedule)}; }
    catch { return fail('SCHEDULE_COMMAND_FAILED'); }
  }
  async function cancel({principal,scheduleId}: {readonly principal?:Principal;readonly scheduleId?:unknown}={}):Promise<Result>{
    const ownerId=principalSubject(principal); if(!ownerId) return fail('AUTH_REQUIRED');
    const id=typeof scheduleId==='string'?scheduleId.trim():''; if(!id) return fail('INVALID_SCHEDULE_COMMAND');
    let current:ScheduleEntry|null=null; try { current=await store.read(id); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if(!current||current.ownerId!==ownerId) return fail('SCHEDULE_NOT_FOUND');
    if(current.status!=='scheduled') return fail('SCHEDULE_NOT_CANCELLABLE');
    try { return {ok:true,schedule:publicSchedule(await store.cancel(id))}; } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
  }
  return Object.freeze({create,list,cancel});
}