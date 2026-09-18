import { describe, expect, it } from 'vitest';
import { createScheduleWorker } from './schedule-worker.ts';

function store(){
  const calls:{kind:string;id:string}[]=[];
  return {
    calls,
    claimDue:async()=>[{scheduleId:'s1',traceId:'t1',agentId:'a1',task:'x',attempts:1,maxAttempts:2}],
    complete:async(id:string)=>{calls.push({kind:'complete',id});},
    fail:async(id:string)=>{calls.push({kind:'fail',id});}
  };
}

describe('schedule worker',()=>{
  it('completes successful jobs',async()=>{
    const value=store();
    const worker=createScheduleWorker({store:value,registry:{agents:[{id:'a1'}]},executeAgentTask:async()=>({ok:true})});
    const result=await worker.runDue();
    expect(result.claimed).toBe(1);
    expect(value.calls).toEqual([{kind:'complete',id:'s1'}]);
  });
  it('retries failed jobs before the final attempt',async()=>{
    const value=store();
    const worker=createScheduleWorker({store:value,registry:{agents:[{id:'a1'}]},executeAgentTask:async()=>({ok:false,error:'X'})});
    const result=await worker.runDue();
    expect(result.results[0]).toMatchObject({ok:false,retryScheduled:true});
    expect(value.calls[0]?.kind).toBe('fail');
  });
});
