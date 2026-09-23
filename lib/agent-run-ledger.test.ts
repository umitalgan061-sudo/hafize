import { describe, expect, it } from 'vitest';
import { createAgentRunLedger } from './agent-run-ledger.ts';

describe('agent run ledger',()=>{
  it('keeps one trace across child tasks',()=>{
    const ledger=createAgentRunLedger({traceId:'trace-0001',agentId:'agent-1',now:()=>new Date(0)});
    const tool=ledger.recordToolStart('runtime_status');
    expect(tool.traceId).toBe(ledger.traceId);
    expect(tool.parentTaskId).toBe(ledger.rootTaskId);
    ledger.recordToolFinish(tool.taskId,{ok:true});
    const snapshot=ledger.snapshot();
    expect(snapshot.entries.some((entry)=>entry.taskId===tool.taskId&&entry.status==='completed')).toBe(true);
  });
  it('closes delegated children independently',()=>{
    const ledger=createAgentRunLedger({traceId:'trace-0002',agentId:'agent-1',now:()=>new Date(0)});
    const child=ledger.recordDelegationStart('specialist');
    ledger.recordDelegationFinish(child.taskId,{ok:false,error:'DELEGATED_AGENT_FAILED'});
    expect(ledger.snapshot().entries.find((entry)=>entry.taskId===child.taskId)?.status).toBe('failed');
    expect(ledger.finish({ok:true}).status).toBe('completed');
  });
});
