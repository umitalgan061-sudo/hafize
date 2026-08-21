import assert from 'node:assert/strict';
import { createTaskLedger } from '../lib/task-ledger.mjs';

function clock() {
  let tick = 0;
  return () => new Date(1_801_000_000_000 + (tick++ * 1000));
}

{
  const ledger = createTaskLedger({ traceId: 'trace-tree', now: clock() });
  const root = ledger.add({ agentId: 'minimal-engineer', action: 'root', status: 'running' });
  const child = ledger.add({ agentId: 'agency-code-reviewer', action: 'agent.delegate', status: 'running', parentTaskId: root.taskId });
  const grandchild = ledger.add({ agentId: 'agency-code-reviewer', action: 'tool:repo.read', status: 'running', parentTaskId: child.taskId });

  assert.equal(child.parentTaskId, root.taskId);
  assert.equal(grandchild.parentTaskId, child.taskId);
  assert.deepEqual(ledger.snapshot().entries.map((entry) => entry.taskId), ['task_1', 'task_2', 'task_3']);
  assert.deepEqual(ledger.snapshot().entries.map((entry) => entry.traceId), ['trace-tree', 'trace-tree', 'trace-tree']);
}

{
  const ledger = createTaskLedger({ traceId: 'trace-capacity', maxEntries: 2, now: clock() });
  const root = ledger.add({ agentId: 'a', action: 'root', status: 'running' });
  ledger.add({ agentId: 'a', action: 'child', status: 'running', parentTaskId: root.taskId });
  assert.throws(
    () => ledger.add({ agentId: 'a', action: 'overflow', status: 'running', parentTaskId: root.taskId }),
    /TASK_LEDGER_FULL/
  );
  assert.equal(ledger.snapshot().entries.length, 2);
}

{
  const ledger = createTaskLedger({ traceId: 'trace-idempotent', now: clock() });
  const root = ledger.add({ agentId: 'a', action: 'root', status: 'running' });
  const before = ledger.read(root.taskId);
  const same = ledger.update(root.taskId, { status: 'running' });
  assert.deepEqual(same, before, 'no-op transition must not fabricate an updated timestamp');
  assert.equal(same.updatedAt, null);

  const changed = ledger.update(root.taskId, { detail: 'working' });
  assert.equal(changed.status, 'running');
  assert.equal(changed.detail, 'working');
  assert.ok(changed.updatedAt);
  assert.deepEqual(ledger.update(root.taskId, { detail: 'working' }), changed);
}

{
  const ledger = createTaskLedger({ traceId: 'trace-terminal-detail', now: clock() });
  const root = ledger.add({ agentId: 'a', action: 'root', status: 'running' });
  const failed = ledger.update(root.taskId, { status: 'failed', detail: 'NETWORK_FAILED' });
  assert.deepEqual(ledger.update(root.taskId, {}), failed);
  assert.throws(() => ledger.update(root.taskId, { detail: null }), /TASK_LEDGER_TERMINAL_IMMUTABLE/);
  assert.throws(() => ledger.update(root.taskId, { status: 'completed' }), /TASK_LEDGER_INVALID_TRANSITION/);
}

console.log('task ledger parent and capacity integrity tests passed');
