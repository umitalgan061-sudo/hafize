import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

function clock() {
  let tick = 0;
  return () => new Date(1_801_100_000_000 + (tick++ * 1000));
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-nested', agentId: 'minimal-engineer', now: clock() });
  const delegation = ledger.recordDelegationStart('agency-code-reviewer');
  const nestedTool = ledger.recordToolStart('repo.read', {
    parentTaskId: delegation.taskId,
    toolAgentId: 'agency-code-reviewer'
  });

  assert.throws(() => ledger.finish(), /AGENT_RUN_HAS_OPEN_TASKS/);
  ledger.recordToolFinish(nestedTool.taskId, { ok: true });
  assert.throws(() => ledger.finish(), /AGENT_RUN_HAS_OPEN_TASKS/, 'open parent delegation still blocks root completion');
  ledger.recordDelegationFinish(delegation.taskId, { ok: true });
  assert.equal(ledger.finish().status, 'completed');

  const snapshot = ledger.snapshot();
  const nestedEntry = snapshot.entries.find((entry) => entry.taskId === nestedTool.taskId);
  assert.equal(nestedEntry.parentTaskId, delegation.taskId);
  assert.equal(nestedEntry.agentId, 'agency-code-reviewer');
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-parent-stop', agentId: 'minimal-engineer', now: clock() });
  const delegation = ledger.recordDelegationStart('agency-code-reviewer');
  ledger.recordDelegationFinish(delegation.taskId, { ok: false, blocked: true, error: 'no permission' });
  assert.throws(
    () => ledger.recordToolStart('repo.read', { parentTaskId: delegation.taskId, toolAgentId: 'agency-code-reviewer' }),
    /AGENT_RUN_PARENT_NOT_RUNNING/
  );
  assert.equal(ledger.finish({ ok: false, detail: 'delegation blocked' }).status, 'failed');
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-clean-root', agentId: 'minimal-engineer', now: clock() });
  const final = ledger.finish({ ok: true });
  assert.equal(final.status, 'completed');
  assert.equal(final.parentTaskId, null);
  assert.equal(ledger.snapshot().entries.length, 1);
  assert.deepEqual(ledger.finish({ ok: false, detail: 'late' }), final, 'root terminal state is sealed');
}

console.log('agent run ledger hierarchy finalization tests passed');
