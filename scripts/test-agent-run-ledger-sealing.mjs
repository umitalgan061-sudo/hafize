import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

function clock(start = 1_800_100_000_000) {
  let tick = 0;
  return () => new Date(start + (tick++ * 1000));
}

{
  const ledger = createAgentRunLedger({
    traceId: 'trace-tool-seal',
    agentId: 'minimal-engineer',
    now: clock()
  });
  const tool = ledger.recordToolStart('repo.read');
  assert.throws(() => ledger.finish(), /AGENT_RUN_HAS_OPEN_TASKS/);

  const first = ledger.recordToolFinish(tool.taskId, { ok: true });
  assert.equal(first.status, 'completed');
  assert.equal(first.detail, 'ok');

  const replay = ledger.recordToolFinish(tool.taskId, { ok: false, error: 'late contradictory result' });
  assert.deepEqual(replay, first, 'sealed tool result is immutable and idempotent');

  const root = ledger.finish();
  assert.equal(root.status, 'completed');
  assert.deepEqual(ledger.finish({ ok: false, detail: 'late contradiction' }), root);
  assert.throws(() => ledger.recordToolStart('repo.read'), /AGENT_RUN_ALREADY_FINISHED/);
}

{
  const ledger = createAgentRunLedger({
    traceId: 'trace-delegation-seal',
    agentId: 'minimal-engineer',
    now: clock()
  });
  const delegated = ledger.recordDelegationStart('agency-code-reviewer');
  const blocked = ledger.recordDelegationFinish(delegated.taskId, {
    ok: false,
    blocked: true,
    error: 'approval required'
  });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.detail, 'approval required');

  const replay = ledger.recordDelegationFinish(delegated.taskId, { ok: true });
  assert.deepEqual(replay, blocked, 'blocked delegation cannot later become successful');

  const root = ledger.finish({ ok: false, detail: 'delegation blocked' });
  assert.equal(root.status, 'failed');
}

{
  const ledger = createAgentRunLedger({
    traceId: 'trace-type-boundary',
    agentId: 'minimal-engineer',
    now: clock()
  });
  const tool = ledger.recordToolStart('runtime.status');
  const delegated = ledger.recordDelegationStart('agency-code-reviewer');

  assert.throws(
    () => ledger.recordDelegationFinish(tool.taskId, { ok: true }),
    /AGENT_RUN_DELEGATION_TASK_NOT_FOUND/
  );
  assert.throws(
    () => ledger.recordToolFinish(delegated.taskId, { ok: true }),
    /AGENT_RUN_TOOL_TASK_NOT_FOUND/
  );

  ledger.recordToolFinish(tool.taskId, { ok: true });
  ledger.recordDelegationFinish(delegated.taskId, { ok: true });
  assert.equal(ledger.finish().status, 'completed');
}

{
  const ledger = createAgentRunLedger({
    traceId: 'trace-parent-boundary',
    agentId: 'minimal-engineer',
    now: clock()
  });
  assert.throws(
    () => ledger.recordToolStart('repo.read', { parentTaskId: 'task_999' }),
    /AGENT_RUN_PARENT_NOT_FOUND/
  );

  const delegation = ledger.recordDelegationStart('agency-code-reviewer');
  ledger.recordDelegationFinish(delegation.taskId, { ok: true });
  assert.throws(
    () => ledger.recordToolStart('repo.read', { parentTaskId: delegation.taskId }),
    /AGENT_RUN_PARENT_NOT_RUNNING/
  );
}

console.log('agent run ledger sealing tests passed');
