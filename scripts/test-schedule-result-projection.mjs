import assert from 'node:assert/strict';
import { createScheduleExecutionRuntime, projectWorkerResult } from '../lib/schedule-execution-runtime.mjs';

assert.deepEqual(projectWorkerResult({ ok: true, content: 'private model output', taskLedger: { traceId: 'trace-00000001' }, leaseStatus: 'completed', deduplicated: false }), { ok: true });
assert.deepEqual(projectWorkerResult({ ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt: '2026-09-08T12:00:00.000Z', taskLedger: { traceId: 'trace-2' } }), { ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt: '2026-09-08T12:00:00.000Z' });
const unexpected = { ok: true, content: 'x', unexpected: 'keep for fail-closed worker validation' };
assert.equal(projectWorkerResult(unexpected), unexpected);
const accessor = { ok: true };
Object.defineProperty(accessor, 'content', { enumerable: true, get() { throw new Error('getter must not execute'); } });
assert.equal(projectWorkerResult(accessor), accessor);

let executorCalls = 0;
const executor = { configured: true, async executeAgentTask(input) { executorCalls += 1; return { ok: true, content: 'hidden', taskLedger: { traceId: input.traceId } }; } };
const runtime = createScheduleExecutionRuntime({ executor });
assert.deepEqual(await runtime.executeAgentTask({ traceId: 'trace-3' }), { ok: true });
assert.equal(executorCalls, 1);

let guardCalls = 0;
const guardedRuntime = createScheduleExecutionRuntime({
  executor,
  lease: {},
  createGuard({ executeAgentTask }) {
    guardCalls += 1;
    return { async executeAgentTask(input) { return executeAgentTask(input); } };
  }
});
assert.equal(guardedRuntime.leaseGuarded, true);
assert.deepEqual(await guardedRuntime.executeAgentTask({ traceId: 'trace-4' }), { ok: true });
assert.equal(guardCalls, 1);

console.log('schedule worker result projection tests passed');
