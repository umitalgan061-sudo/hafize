export interface ScheduleWorkerStore {
  readonly claimDue:(input:{readonly limit:number})=>Promise<readonly ScheduleEntry[]>;
  readonly complete:(id:string)=>Promise<unknown>;
  readonly fail:(id:string,input:{readonly error:string;readonly retryAt?:string})=>Promise<unknown>;
  readonly defer?:(id:string,input:{readonly error:string;readonly runAt:string})=>Promise<unknown>;
}
export interface ScheduleEntry {readonly scheduleId:string;readonly traceId:string;readonly agentId:string;readonly task:string;readonly attempts:number;readonly maxAttempts:number;}
const clean=(value:unknown)=>{const text=typeof value==='string'?value.trim():'';return /^[A-Z0-9_:-]{1,120}$/.test(text)?text:'SCHEDULE_EXECUTION_FAILED';};
export function createScheduleWorker({store,registry,executeAgentTask,now=()=>new Date(),retryDelayMs=60_000,maxBatch=4}:{readonly store:ScheduleWorkerStore;readonly registry:{readonly agents:readonly{readonly id:string}[]};readonly executeAgentTask:(input:unknown)=>Promise<{readonly ok?:boolean;readonly error?:unknown;readonly retryAt?:unknown}>;readonly now?:()=>Date|string|number;readonly retryDelayMs?:number;readonly maxBatch?:number}){
  if(!store?.claimDue||!store?.complete||!store?.fail)throw new Error('INVALID_SCHEDULE_WORKER:store');
  if(!Array.isArray(registry?.agents))throw new Error('INVALID_SCHEDULE_WORKER:registry');
  if(typeof executeAgentTask!=='function')throw new Error('INVALID_SCHEDULE_WORKER:executeAgentTask');
  const batch=Number.isInteger(maxBatch)?Math.min(Math.max(Number(maxBatch),1),16):4;
  const delay=Number.isInteger(retryDelayMs)?Math.min(Math.max(Number(retryDelayMs),1000),86_400_000):60_000;
  const date=()=>{const value=now();const d=value instanceof Date?new Date(value.getTime()):new Date(value);if(Number.isNaN(d.getTime()))throw new Error('INVALID_SCHEDULE_WORKER:now');return d;};
  const retryAt=(value:unknown)=>{const current=date();const parsed=new Date(String(value||''));return!Number.isNaN(parsed.getTime())&&parsed.getTime()>current.getTime()?parsed.toISOString():new Date(current.getTime()+delay).toISOString();};
  async function runDue({limit=batch}:{readonly limit?:number}={}){
    const safeLimit=Number.isInteger(limit)?Math.min(Math.max(Number(limit),1),batch):batch;
    const claimed=await store.claimDue({limit:safeLimit});const results:unknown[]=[];
    for(const schedule of claimed){
      const agent=registry.agents.find(item=>item.id===schedule.agentId);
      if(!agent){await store.fail(schedule.scheduleId,{error:'SCHEDULE_AGENT_NOT_FOUND'});results.push({scheduleId:schedule.scheduleId,ok:false,error:'SCHEDULE_AGENT_NOT_FOUND'});continue;}
      let result:{readonly ok?:boolean;readonly error?:unknown;readonly retryAt?:unknown};
      try{result=await executeAgentTask({scheduleId:schedule.scheduleId,traceId:schedule.traceId,agent,task:schedule.task,attempt:schedule.attempts});}catch{result={ok:false,error:'SCHEDULE_EXECUTION_FAILED'};}
      if(result?.ok){await store.complete(schedule.scheduleId);results.push({scheduleId:schedule.scheduleId,ok:true});continue;}
      const error=clean(result?.error);
      if(error==='SCHEDULE_LEASE_BUSY'&&store.defer){const at=retryAt(result.retryAt);await store.defer(schedule.scheduleId,{error,runAt:at});results.push({scheduleId:schedule.scheduleId,ok:false,error,retryScheduled:true,retryAt:at,attemptRefunded:true});continue;}
      const canRetry=schedule.attempts<schedule.maxAttempts;
      if(canRetry)await store.fail(schedule.scheduleId,{error,retryAt:new Date(date().getTime()+delay).toISOString()});else await store.fail(schedule.scheduleId,{error});
      results.push({scheduleId:schedule.scheduleId,ok:false,error,retryScheduled:canRetry});
    }
    return {claimed:claimed.length,results};
  }
  return Object.freeze({runDue});
}
