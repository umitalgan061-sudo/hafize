import { describe, expect, it } from 'vitest';
import { createScheduleCommandBoundary } from './schedule-command-boundary.ts';

function setup(){
  const entries:any[]=[];
  const store={
    add:async(input:any)=>{const entry={scheduleId:'s1',traceId:input.traceId,ownerId:input.ownerId,agentId:input.agentId,task:input.task,runAt:input.runAt,status:'scheduled',attempts:0,maxAttempts:3,lastError:null,createdAt:'now',updatedAt:'now'};entries.push(entry);return entry;},
    read:async(id:string)=>entries.find((entry)=>entry.scheduleId===id)||null,
    snapshot:async()=>({entries}),
    cancel:async(id:string)=>{const entry=entries.find((item)=>item.scheduleId===id)!;entry.status='cancelled';return entry;}
  };
  const boundary=createScheduleCommandBoundary({store,registry:{agents:[{id:'writer'}]},createTraceId:()=> 'trace-1'});
  return {boundary,entries};
}

describe('schedule command boundary',()=>{
  it('requires an authenticated owner',async()=>{
    const {boundary}=setup();
    expect(await boundary.create({input:{agentId:'writer',task:'x'}})).toEqual({ok:false,error:'AUTH_REQUIRED'});
  });
  it('creates only allowed fields',async()=>{
    const {boundary}=setup();
    const result=await boundary.create({principal:{authenticated:true,subject:'u'},input:{agentId:'writer',task:'x',runAt:'2026-09-18T00:00:00Z'}});
    expect(result.ok).toBe(true);
    expect(result).toMatchObject({schedule:{agentId:'writer',task:'x'}});
  });
  it('blocks credential-bearing tasks',async()=>{
    const {boundary}=setup();
    expect(await boundary.create({principal:{authenticated:true,subject:'u'},input:{agentId:'writer',task:'NVIDIA_API_KEY=abc123'}})).toMatchObject({ok:false});
  });
  it('enforces ownership during cancellation',async()=>{
    const {boundary}=setup();
    await boundary.create({principal:{authenticated:true,subject:'u'},input:{agentId:'writer',task:'x'}});
    expect(await boundary.cancel({principal:{authenticated:true,subject:'other'},scheduleId:'s1'})).toEqual({ok:false,error:'SCHEDULE_NOT_FOUND'});
  });
});
