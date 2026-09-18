const DEFAULT_ERROR='SCHEDULE_EXECUTION_FAILED';
const LEASE_BUSY='SCHEDULE_LEASE_BUSY';
const LEASE_LOST='SCHEDULE_LEASE_LOST';

export interface LeaseContract {
  readonly leaseMs:number;
  readonly acquire:(scheduleId:string)=>Promise<{status:'busy';retryAt?:string}|{status:'completed'}|{status:'acquired';fence:string}>;
  readonly renew:(input:{scheduleId:string;fence:string})=>Promise<{status:string}>;
  readonly complete:(input:{scheduleId:string;fence:string})=>Promise<{status:string}>;
  readonly release:(input:{scheduleId:string;fence:string})=>Promise<{status:string}>;
}
function interval(value:unknown,leaseMs:number):number{const fallback=Math.max(250,Math.floor(leaseMs/2));return Number.isInteger(value)?Math.min(Math.max(Number(value),100),Math.max(100,leaseMs-100)):fallback;}
export function createScheduleLeaseGuardedExecutor({lease,executeAgentTask,renewIntervalMs}:{readonly lease:LeaseContract;readonly executeAgentTask:(input:unknown)=>Promise<unknown>;readonly renewIntervalMs?:number}){
  if(!lease||typeof lease.acquire!=='function'||typeof lease.renew!=='function'||typeof lease.complete!=='function'||typeof lease.release!=='function'||!Number.isInteger(lease.leaseMs)||lease.leaseMs<1000)throw new Error('INVALID_SCHEDULE_LEASE_EXECUTOR:lease');
  if(typeof executeAgentTask!=='function')throw new Error('INVALID_SCHEDULE_LEASE_EXECUTOR:executeAgentTask');
  const renewEvery=interval(renewIntervalMs,lease.leaseMs);
  async function execute(input:unknown={}){
    const data=input&&typeof input==='object'?input as Record<string,unknown>:{};
    const scheduleId=typeof data.scheduleId==='string'?data.scheduleId.trim():'';
    if(!scheduleId)return{ok:false as const,error:'INVALID_SCHEDULE_AGENT_TASK'};
    const acquired=await lease.acquire(scheduleId);
    if(acquired.status==='busy')return{ok:false as const,error:LEASE_BUSY,retryAt:acquired.retryAt};
    if(acquired.status==='completed')return{ok:true as const,deduplicated:true,leaseStatus:'completed'};
    let stopped=false,leaseLost=false,renewing:Promise<void>|null=null;
    const renewOnce=async()=>{if(stopped||leaseLost||renewing)return renewing;renewing=(async()=>{try{const value=await lease.renew({scheduleId,fence:acquired.fence});if(value.status!=='renewed')leaseLost=true;}catch{leaseLost=true;}finally{renewing=null;}})();return renewing;};
    const timer=setInterval(()=>{void renewOnce();},renewEvery);timer.unref?.();
    let result:unknown;
    try{result=await executeAgentTask(input);}catch{result={ok:false,error:DEFAULT_ERROR};}
    finally{stopped=true;clearInterval(timer);if(renewing)await renewing;}
    if(leaseLost)return{ok:false as const,error:LEASE_LOST};
    const resultOk=result&&typeof result==='object'&&(result as {ok?:boolean}).ok===true;
    if(resultOk){const completed=await lease.complete({scheduleId,fence:acquired.fence});if(completed.status==='stale')return{ok:false as const,error:LEASE_LOST};return{...(result as Record<string,unknown>),leaseStatus:completed.status,deduplicated:completed.status==='already_completed'||Boolean((result as Record<string,unknown>).deduplicated)};}
    const released=await lease.release({scheduleId,fence:acquired.fence});
    if(released.status==='stale')return{ok:false as const,error:LEASE_LOST};
    if(released.status==='completed')return{ok:true as const,deduplicated:true,leaseStatus:'completed'};
    return result&&typeof result==='object'?result:{ok:false,error:DEFAULT_ERROR};
  }
  return Object.freeze({renewIntervalMs:renewEvery,executeAgentTask:execute});
}
