import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

{
  let tick = 0;
  const ledger = createAgentRunLedger({
    traceId: 'trace-ledger-timeout-seal',
    agentId: 'hafize-general',
    action: 'schedule.run',
    now: () => new Date(1_700_000_000_000 + tick++ * 1000)
  });
  const tool = ledger.recordToolStart('github_read_file');
  const delegation = ledger.recordDelegationStart('agency-code-reviewer');

  ledger.failOpenEntries('SCHEDULE_AGENT_RUN_TIMEOUT');
  ledger.finish({ ok: false, detail: 'SCHEDULE_AGENT_RUN_TIMEOUT' });

  let snapshot = ledger.snapshot();
  const rootEntry = snapshot.entries.find((entry) => entry.taskId === ledger.rootTaskId);
  const toolEntry = snapshot.entries.find((entry) => entry.taskId === tool.taskId);
  const delegationEntry = snapshot.entries.find((entry) => entry.taskId === delegation.taskId);
  assert.equal(rootEntry.status, 'failed');
  assert.equal(rootEntry.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.equal(toolEntry.status, 'failed');
  assert.equal(toolEntry.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.equal(delegationEntry.status, 'failed');
  assert.equal(delegationEntry.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');

  const sealedTool = ledger.recordToolFinish(tool.taskId, { ok: true });
  const sealedDelegation = ledger.recordDelegationFinish(delegation.taskId, { ok: true });
  assert.equal(sealedTool.status, 'failed', 'late tool success must not reopen a timed-out audit entry');
  assert.equal(sealedDelegation.status, 'failed', 'late delegation success must not reopen a timed-out audit entry');

  snapshot = ledger.snapshot();
  assert.equal(snapshot.entries.find((entry) => entry.taskId === tool.taskId).status, 'failed');
  assert.equal(snapshot.entries.find((entry) => entry.taskId === delegation.taskId).status, 'failed');
}

{
  const ledger = createAgentRunLedger({
    traceId: 'trace-ledger-normal-finish',
    agentId: 'hafize-general',
    action: 'schedule.run'
  });
  const tool = ledger.recordToolStart('runtime_status');
  ledger.recordToolFinish(tool.taskId, { ok: true, value: { status: 'ok' } });
  ledger.failOpenEntries('SCHEDULE_AGENT_RUN_CANCELLED');
  ledger.finish({ ok: true });

  const snapshot = ledger.snapshot();
  const toolEntry = snapshot.entries.find((entry) => entry.taskId === tool.taskId);
  const rootEntry = snapshot.entries.find((entry) => entry.taskId === ledger.rootTaskId);
  assert.equal(toolEntry.status, 'completed', 'already terminal entries must not be rewritten by sealing');
  assert.equal(toolEntry.detail, 'ok');
  assert.equal(rootEntry.status, 'completed');
}

console.log('agent run ledger terminal sealing tests passed');
