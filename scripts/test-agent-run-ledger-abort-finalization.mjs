import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

function clock(start = 1_800_200_000_000) {
  let tick = 0;
  return () => new Date(start + (tick++ * 1000));
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-abort', agentId: 'minimal-engineer', now: clock() });
  const tool = ledger.recordToolStart('repo.read');
  const delegation = ledger.recordDelegationStart('agency-code-reviewer');
  assert.equal(ledger.failOpenEntries('REQUEST_CANCELLED'), 2);
  assert.equal(ledger.failOpenEntries('SHOULD_NOT_REWRITE'), 0, 'already terminal children stay sealed');

  const snapshot = ledger.snapshot();
  const toolEntry = snapshot.entries.find((entry) => entry.taskId === tool.taskId);
  const delegationEntry = snapshot.entries.find((entry) => entry.taskId === delegation.taskId);
  assert.equal(toolEntry.status, 'failed');
  assert.equal(toolEntry.detail, 'REQUEST_CANCELLED');
  assert.equal(delegationEntry.status, 'failed');
  assert.equal(delegationEntry.detail, 'REQUEST_CANCELLED');

  assert.deepEqual(ledger.recordToolFinish(tool.taskId, { ok: true }), toolEntry);
  assert.deepEqual(ledger.recordDelegationFinish(delegation.taskId, { ok: true }), delegationEntry);

  const root = ledger.finish({ ok: false, detail: 'REQUEST_CANCELLED' });
  assert.equal(root.status, 'failed');
  assert.equal(ledger.failOpenEntries('LATE'), 0);
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-partial', agentId: 'minimal-engineer', now: clock() });
  const completedTool = ledger.recordToolStart('runtime.status');
  ledger.recordToolFinish(completedTool.taskId, { ok: true });
  const openDelegation = ledger.recordDelegationStart('agency-code-reviewer');
  assert.equal(ledger.failOpenEntries('AGENT_RUN_ABORTED'), 1);

  const snapshot = ledger.snapshot();
  assert.equal(snapshot.entries.find((entry) => entry.taskId === completedTool.taskId).status, 'completed');
  assert.equal(snapshot.entries.find((entry) => entry.taskId === openDelegation.taskId).status, 'failed');
  assert.equal(ledger.finish({ ok: false, detail: 'AGENT_RUN_ABORTED' }).status, 'failed');
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-root-open', agentId: 'minimal-engineer', now: clock() });
  ledger.recordDelegationStart('agency-code-reviewer');
  assert.throws(() => ledger.finish({ ok: true }), /AGENT_RUN_HAS_OPEN_TASKS/);
  const rootBefore = ledger.snapshot().entries[0];
  assert.equal(rootBefore.status, 'running', 'failed finish attempt does not corrupt root state');
  ledger.failOpenEntries();
  assert.equal(ledger.finish({ ok: false, detail: 'child aborted' }).status, 'failed');
}

console.log('agent run ledger abort finalization tests passed');
