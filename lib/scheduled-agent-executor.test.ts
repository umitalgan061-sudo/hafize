import { describe, expect, it } from 'vitest';
import { createScheduledAgentExecutor } from './scheduled-agent-executor.ts';

const agent={id:'a1',name:'A',description:'d',toolPolicy:{default:'deny' as const,allow:[],deny:[],approvalRequired:[]}};
const registry={schemaVersion:1 as const,defaultAgent:'a1',agents:[agent],policy:{externalWritesRequireApproval:true as const,secretsNeverEnterAgentContext:true as const,sharedTraceIdRequired:true as const}};

describe('scheduled agent executor',()=>{
  it('fails before provider execution for invalid input',async()=>{
    const runtime=createScheduledAgentExecutor({registry,model:'m',complete:async()=>({}),runAgentTask:async()=>({ok:true,content:'x'})});
    expect(await runtime.executeAgentTask({traceId:'',agent,task:'x'})).toMatchObject({ok:false,error:'INVALID_SCHEDULE_AGENT_TASK'});
  });
  it('blocks plaintext credentials in scheduled prompts',async()=>{
    const runtime=createScheduledAgentExecutor({registry,model:'m',complete:async()=>({}),runAgentTask:async()=>({ok:true,content:'x'})});
    expect(await runtime.executeAgentTask({traceId:'t1',agent,task:'NVIDIA_API_KEY=abc123'})).toMatchObject({ok:false,error:'SCHEDULE_AGENT_TASK_CREDENTIAL_BLOCKED'});
  });
});
