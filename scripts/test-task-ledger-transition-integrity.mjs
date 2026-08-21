import assert from 'node:assert/strict';
import { createTaskLedger } from '../lib/task-ledger.mjs';

function clock(start = 1_800_000_000_000) {
  let tick = 0;
  return () => new Date(start + (tick++ * 1000));
}

{
  const ledger = createTaskLedger({ traceId: 'trace-transition', now: clock() });
  const root = ledger.add({ agentId: 'minimal-engineer', action: 'agent.run', status: 'running' });
  const child = ledger.add({
    agentId: 'minimal-engineer',
    action: 'tool:repo.read',
    status: 'running',
    parentTaskId: root.taskId
  });

  assert.equal(root.parentTaskId, null);
  assert.equal(child.parentTaskId, root.taskId);
  assert.equal(child.updatedAt, null);

  const completed = ledger.update(child.taskId, { status: 'completed', detail: 'ok' });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.detail, 'ok');
  assert.ok(completed.updatedAt);

  const exactReplay = ledger.update(child.taskId, { status: 'completed', detail: 'ok' });
  assert.deepEqual(exactReplay, completed, 'exact terminal replay is idempotent');

  assert.throws(
    () => ledger.update(child.taskId, { status: 'failed', detail: 'late failure' }),
    /TASK_LEDGER_INVALID_TRANSITION|TASK_LEDGER_TERMINAL_IMMUTABLE/
  );
  assert.throws(
    () => ledger.update(child.taskId, { detail: 'rewritten detail' }),
    /TASK_LEDGER_TERMINAL_IMMUTABLE/
  );

  assert.equal(ledger.read(child.taskId).status, 'completed');
  assert.equal(ledger.read(child.taskId).detail, 'ok');
}

{
  const ledger = createTaskLedger({ traceId: 'trace-parent', now: clock() });
  assert.throws(
    () => ledger.add({
      agentId: 'minimal-engineer',
      action: 'tool:repo.read',
      status: 'running',
      parentTaskId: 'task_999'
    }),
    /TASK_LEDGER_PARENT_NOT_FOUND/
  );
  assert.equal(ledger.snapshot().entries.length, 0, 'invalid parent cannot create an orphan record');
}

{
  const ledger = createTaskLedger({ traceId: 'trace-status', now: clock() });
  const planned = ledger.add({ agentId: 'a', action: 'planned', status: 'planned' });
  const running = ledger.update(planned.taskId, { status: 'running' });
  assert.equal(running.status, 'running');
  const blocked = ledger.update(planned.taskId, { status: 'blocked', detail: 'approval required' });
  assert.equal(blocked.status, 'blocked');
  assert.throws(
    () => ledger.update(planned.taskId, { status: 'running' }),
    /TASK_LEDGER_INVALID_TRANSITION/
  );
}

{
  const ledger = createTaskLedger({ traceId: 'trace-snapshot', now: clock() });
  const root = ledger.add({ agentId: 'a', action: 'root', status: 'running' });
  const snapshot = ledger.snapshot();
  snapshot.entries[0].status = 'failed';
  snapshot.entries.push({ taskId: 'forged' });
  assert.equal(ledger.read(root.taskId).status, 'running');
  assert.equal(ledger.snapshot().entries.length, 1, 'snapshot remains a defensive copy');
}

{
  assert.throws(
    () => createTaskLedger({ traceId: 'trace-now', now: null }),
    /INVALID_TASK_LEDGER:now/
  );
  const ledger = createTaskLedger({ traceId: 'trace-invalid-clock', now: () => new Date('invalid') });
  assert.throws(
    () => ledger.add({ agentId: 'a', action: 'root', status: 'running' }),
    /INVALID_TASK_LEDGER:now/
  );
}

console.log('task ledger transition integrity tests passed');
