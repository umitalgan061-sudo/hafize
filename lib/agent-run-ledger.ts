// @ts-ignore Legacy task ledger is intentionally isolated behind this typed boundary.
import { createTaskLedger } from './task-ledger.mjs';
// @ts-ignore Legacy trace utilities remain shared during migration.
import { createTraceContext, normalizeTaskRelation, assertTraceContinuity } from './trace-consistency.mjs';
import type { TaskLedgerEntry, TaskLedgerSnapshot } from './runtime-contracts.ts';

interface Options { readonly traceId: unknown; readonly agentId: unknown; readonly action?: unknown; readonly now?: () => number; }
export interface AgentRunLedger {
  readonly rootTaskId: string;
  readonly traceId: string;
  readonly recordToolStart: (toolName: unknown, options?: { readonly parentTaskId?: string; readonly toolAgentId?: string }) => TaskLedgerEntry;
  readonly recordToolFinish: (taskId: unknown, result: unknown) => TaskLedgerEntry;
  readonly recordDelegationStart: (targetAgentId: unknown, options?: { readonly parentTaskId?: string }) => TaskLedgerEntry;
  readonly recordDelegationFinish: (taskId: unknown, result: unknown) => TaskLedgerEntry;
  readonly finish: (options?: { readonly ok?: boolean; readonly detail?: unknown }) => TaskLedgerEntry;
  readonly snapshot: () => TaskLedgerSnapshot;
}
export function createAgentRunLedger({traceId,agentId,action='agent.run',now}:Options):AgentRunLedger{
  const context=createTraceContext(traceId);
  const ledger=createTaskLedger({traceId:context.traceId,now});
  const root=ledger.add({agentId,action,status:'running'});
  const plainObject=(value:unknown):boolean=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
  const parent=(taskId:string):TaskLedgerEntry=>{const entry=ledger.read(taskId);if(!entry)throw new Error('TASK_PARENT_NOT_FOUND');assertTraceContinuity(context.traceId,entry.traceId);return entry;};
  function recordToolStart(toolName: unknown, opts: { readonly parentTaskId?: string; readonly toolAgentId?: string } = {}): TaskLedgerEntry {
    if(!plainObject(opts))throw new Error('INVALID_TOOL_TASK_OPTIONS');
    const entryParent=parent(opts.parentTaskId||root.taskId);
    const relation=normalizeTaskRelation({traceId:context.traceId,taskId:root.taskId+':tool:'+String(toolName).replace(/[^a-zA-Z0-9._:-]/g,'_').slice(0,80),parentTaskId:entryParent.taskId});
    const entry=ledger.add({agentId:opts.toolAgentId||String(agentId),action:'tool:'+String(toolName),status:'running',parentTaskId:relation.parentTaskId});
    assertTraceContinuity(context.traceId,entry.traceId);return entry;
  }
  function finishChild(taskId:unknown,result:unknown,kind:'tool'|'delegate'):TaskLedgerEntry{
    const entry=ledger.read(String(taskId));
    const invalidCode=kind==='tool'?'INVALID_TOOL_TASK_ID':'INVALID_DELEGATION_TASK_ID';
    const matchesKind=Boolean(entry)&&entry.taskId!==root.taskId&&(kind==='tool'?entry.action.startsWith('tool:'):entry.action==='agent.delegate');
    if(!matchesKind)throw new Error(invalidCode);
    assertTraceContinuity(context.traceId,entry.traceId);
    const value=plainObject(result)?result as Record<string,unknown>:{};
    const ok=value.ok===true;
    const fallback=kind==='tool'?'TOOL_EXECUTION_FAILED':'DELEGATED_AGENT_FAILED';
    return ledger.update(entry.taskId,{status:ok?'completed':'failed',detail:ok?'ok':String(value.error||fallback).slice(0,120)});
  }
  function recordDelegationStart(targetAgentId: unknown, opts: { readonly parentTaskId?: string } = {}): TaskLedgerEntry {
    if(!plainObject(opts))throw new Error('INVALID_DELEGATION_OPTIONS');
    const entryParent=parent(opts.parentTaskId||root.taskId);
    const entry=ledger.add({agentId:String(targetAgentId),action:'agent.delegate',status:'running',parentTaskId:entryParent.taskId});
    assertTraceContinuity(context.traceId,entry.traceId);return entry;
  }
  function finish(opts: { readonly ok?: boolean; readonly detail?: unknown } = {}): TaskLedgerEntry {
    if(!plainObject(opts))throw new Error('INVALID_FINISH_OPTIONS');
    return ledger.update(root.taskId,{status:opts.ok===false?'failed':'completed',detail:opts.detail==null?null:String(opts.detail).slice(0,120)});
  }
  return Object.freeze({
    rootTaskId:root.taskId,traceId:context.traceId,recordToolStart,
    recordToolFinish:(taskId:unknown,result:unknown)=>finishChild(taskId,result,'tool'),
    recordDelegationStart,
    recordDelegationFinish:(taskId:unknown,result:unknown)=>finishChild(taskId,result,'delegate'),
    finish,
    snapshot:ledger.snapshot
  });
}
