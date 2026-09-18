import { describe, expect, it } from 'vitest';
import { createScheduleLeaseGuardedExecutor } from './schedule-lease-executor.ts';

describe('schedule lease executor',()=>{
  it('short-circuits completed schedules',async()=>{
    const lease={
      leaseMs:1000,
      acquire:async()=>({status:'completed' as const}),
      renew:async()=>({status:'renewed'}),
      complete:async()=>({status:'completed'}),
      release:async()=>({status:'released'})
    };
    const runtime=createScheduleLeaseGuardedExecutor({lease,executeAgentTask:async()=>({ok:true})});
    expect(await runtime.executeAgentTask({scheduleId:'s1'})).toEqual({ok:true,deduplicated:true,leaseStatus:'completed'});
  });
  it('returns lease-busy without executing the task',async()=>{
    let called=0;
    const lease={
      leaseMs:1000,
      acquire:async()=>({status:'busy' as const,retryAt:'later'}),
      renew:async()=>({status:'renewed'}),
      complete:async()=>({status:'completed'}),
      release:async()=>({status:'released'})
    };
    const runtime=createScheduleLeaseGuardedExecutor({lease,executeAgentTask:async()=>{called++;return{ok:true}}});
    expect(await runtime.executeAgentTask({scheduleId:'s1'})).toMatchObject({ok:false,error:'SCHEDULE_LEASE_BUSY'});
    expect(called).toBe(0);
  });
  it('releases failed work',async()=>{
    let released=false;
    const lease={
      leaseMs:1000,
      acquire:async()=>({status:'acquired' as const,fence:'f1'}),
      renew:async()=>({status:'renewed'}),
      complete:async()=>({status:'completed'}),
      release:async()=>{released=true;return{status:'released'}}
    };
    const runtime=createScheduleLeaseGuardedExecutor({lease,executeAgentTask:async()=>({ok:false,error:'X'})});
    await runtime.executeAgentTask({scheduleId:'s1'});
    expect(released).toBe(true);
  });
});
