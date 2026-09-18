// @ts-ignore Legacy lease executor remains a compatibility dependency.
import { createScheduleLeaseGuardedExecutor } from './schedule-lease-executor.mjs';

const WORKER_KEYS=new Set(['ok','error','retryAt','content','taskLedger','leaseStatus','deduplicated']);
export interface ScheduleTaskExecutor { readonly configured?:boolean; readonly executeAgentTask:(input:unknown)=>Promise<unknown>; }
function projected(value:unknown):unknown{
  if(!value||typeof value!=='object'||Array.isArray(value))return value;
  let descriptors:Record<string,PropertyDescriptor>;
  try{if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return value;descriptors=Object.getOwnPropertyDescriptors(value) as Record<string,PropertyDescriptor>;}catch{return value;}
  const keys=Object.keys(descriptors);
  if(keys.some(key=>!WORKER_KEYS.has(key)))return value;
  if(keys.some(key=>!Object.prototype.hasOwnProperty.call(descriptors[key]!, 'value')))return value;
  const ok=descriptors.ok?.value;
  if(ok===true)return Object.freeze({ok:true});
  if(ok!==false)return value;
  return Object.freeze({ok:false,error:descriptors.error?.value,...(Object.prototype.hasOwnProperty.call(descriptors,'retryAt')?{retryAt:descriptors.retryAt?.value}: {})});
}
export function createScheduleExecutionRuntime({executor,lease=null,renewIntervalMs,createGuard=createScheduleLeaseGuardedExecutor}:{readonly executor:ScheduleTaskExecutor;readonly lease?:unknown;readonly renewIntervalMs?:number;readonly createGuard?:Function}){
  if(typeof executor?.executeAgentTask!=='function')throw new Error('INVALID_SCHEDULE_EXECUTION_RUNTIME:executor');
  const face=(fn:(input:unknown)=>Promise<unknown>)=>async(input:unknown)=>projected(await fn(input));
  if(lease==null)return Object.freeze({configured:Boolean(executor.configured),leaseGuarded:false,executeAgentTask:face(executor.executeAgentTask)});
  if(typeof createGuard!=='function')throw new Error('INVALID_SCHEDULE_EXECUTION_RUNTIME:createGuard');
  const guarded=createGuard({lease,executeAgentTask:executor.executeAgentTask,renewIntervalMs});
  if(typeof guarded?.executeAgentTask!=='function')throw new Error('SCHEDULE_EXECUTION_RUNTIME_STARTUP_FAILED');
  return Object.freeze({configured:Boolean(executor.configured),leaseGuarded:true,executeAgentTask:face(guarded.executeAgentTask)});
}
export { projected as projectWorkerResult };
