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
const snapshotBefore = ledger.snapshot();
assert.equal(snapshotBefore.traceId, 'trace-12345678');
assert.equal(snapshotBefore.entries.length, 2);
ledger.recordToolFinish(tool.taskId, { ok: true });
ledger.finish({ ok: true });
const snapshotAfter = ledger.snapshot();
assert.equal(snapshotAfter.entries[0].status, 'completed');
assert.equal(snapshotAfter.entries[1].status, 'completed');

console.log('trace consistency tests passed');
