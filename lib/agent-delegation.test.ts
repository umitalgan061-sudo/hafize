import { describe, expect, it } from 'vitest';
import { createAgentDelegator } from './agent-delegation.ts';

function ledger(){
  let n=0;
  const entries:any[]=[];
  return {
    rootTaskId:'root',
    snapshot:()=>({entries}),
    recordDelegationStart:(agentId:string)=>{const task={taskId:'task-'+(++n),traceId:'t',agentId,action:'agent.delegate',status:'running'};entries.push(task);return task;},
    recordDelegationFinish:(id:string,result:any)=>{const entry=entries.find((x)=>x.taskId===id)!;entry.status=result.ok?'completed':'failed';return entry;}
  } as any;
}
const parent={id:'parent',name:'Parent',kind:'general'};
const specialist={id:'writer',name:'Writer',kind:'specialist'};

describe('agent delegation',()=>{
  it('delegates to an allowlisted specialist',async()=>{
    const runLedger=ledger();
    const result=await createAgentDelegator({
      registry:{agents:[parent,specialist],policy:{maxDelegationDepth:2,maxParallelAgents:2}},
      traceId:'t1',parentAgent:{...parent,toolPolicy:{default:'deny',allow:['agent.delegate'],deny:[],approvalRequired:[]}},
      parentTaskId:'root',runLedger,
      executeAgent:async({agent,task})=>({ok:true,content:agent.id+':'+task})
    }).delegate({agentId:'writer',task:'write'});
    expect(result).toEqual({ok:true,value:{agentId:'writer',agentName:'Writer',content:'writer:write'}});
  });
  it('blocks self delegation and depth overflow',async()=>{
    const runLedger=ledger();
    const delegator=createAgentDelegator({
      registry:{agents:[parent,specialist],policy:{maxDelegationDepth:1,maxParallelAgents:2}},
      traceId:'t1',parentAgent:{...parent,toolPolicy:{default:'deny',allow:['agent.delegate'],deny:[],approvalRequired:[]}},
      parentTaskId:'root',runLedger,executeAgent:async()=>({ok:true,content:'x'})
    });
    expect(await delegator.delegate({agentId:'parent',task:'x'})).toMatchObject({ok:false,error:'SELF_DELEGATION_NOT_ALLOWED'});
    expect(await delegator.delegate({agentId:'writer',task:'x'},{depth:1})).toMatchObject({ok:false,error:'DELEGATION_DEPTH_EXCEEDED'});
  });
});
