import assert from 'node:assert/strict';
import { assertTraceContinuity, createTraceContext, normalizeTaskRelation } from '../lib/trace-consistency.mjs';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

const context = createTraceContext('trace-12345678', 'task_1234');
assert.equal(context.traceId, 'trace-12345678');
assert.equal(context.parentTaskId, 'task_1234');
assert.deepEqual(normalizeTaskRelation({ traceId: 'trace-12345678', taskId: 'task_5678', parentTaskId: 'task_1234' }), { traceId: 'trace-12345678', taskId: 'task_5678', parentTaskId: 'task_1234' });
assert.equal(assertTraceContinuity('trace-12345678', 'trace-12345678'), 'trace-12345678');
assert.throws(() => assertTraceContinuity('trace-12345678', 'trace-87654321'), /TRACE_ID_MISMATCH/);
assert.throws(() => normalizeTaskRelation({ traceId: 'trace-12345678', taskId: 'task_1234', parentTaskId: 'task_1234' }), /TASK_SELF_PARENT/);
assert.throws(() => createTraceContext('x'), /INVALID_TRACE_ID/);
assert.throws(() => createTraceContext('trace-12345678', 'x'), /INVALID_PARENT_TASK_ID/);

const ledger = createAgentRunLedger({ traceId: 'trace-12345678', agentId: 'parent' });
assert.equal(ledger.traceId, 'trace-12345678');
const tool = ledger.recordToolStart('runtime_status');
assert.equal(tool.status, 'running');
const delegation = ledger.recordDelegationStart('child');
assert.equal(delegation.parentTaskId, ledger.rootTaskId);
assert.throws(() => ledger.recordToolStart('runtime_status', { parentTaskId: 'missing_task' }), /TASK_PARENT_NOT_FOUND/);
assert.throws(() => ledger.recordToolStart('runtime_status', null), /INVALID_TOOL_TASK_OPTIONS/);
assert.throws(() => ledger.recordDelegationStart('child', null), /INVALID_DELEGATION_OPTIONS/);
const snapshotBefore = ledger.snapshot();
assert.equal(snapshotBefore.traceId, 'trace-12345678');
assert.equal(snapshotBefore.entries.length, 3);
ledger.recordToolFinish(tool.taskId, { ok: true });
assert.throws(() => ledger.recordToolFinish(ledger.rootTaskId, { ok: true }), /INVALID_TOOL_TASK_ID/);
assert.throws(() => ledger.recordToolFinish('missing_task', { ok: true }), /INVALID_TOOL_TASK_ID/);
ledger.recordDelegationFinish(delegation.taskId, { ok: true });
ledger.finish({ ok: true });
const snapshotAfter = ledger.snapshot();
assert.equal(snapshotAfter.entries[0].status, 'completed');
assert.equal(snapshotAfter.entries[1].status, 'completed');
assert.equal(snapshotAfter.entries[2].status, 'completed');

const foreignLedger = createAgentRunLedger({ traceId: 'trace-foreign1', agentId: 'other' });
assert.notEqual(foreignLedger.rootTaskId, ledger.rootTaskId);
assert.throws(() => ledger.recordToolStart('runtime_status', { parentTaskId: foreignLedger.rootTaskId }), /TASK_PARENT_NOT_FOUND/);

console.log('trace consistency tests passed');
