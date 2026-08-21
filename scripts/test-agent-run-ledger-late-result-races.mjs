import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

function clock() {
  let tick = 0;
  return () => new Date(1_801_200_000_000 + (tick++ * 1000));
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-late-tool', agentId: 'minimal-engineer', now: clock() });
  const tool = ledger.recordToolStart('repo.read');
  const failed = ledger.recordToolFinish(tool.taskId, { ok: false, error: 'UPSTREAM_FAILED' });
  assert.equal(failed.status, 'failed');
  assert.deepEqual(ledger.recordToolFinish(tool.taskId, { ok: true }), failed);
  assert.equal(ledger.snapshot().entries.find((entry) => entry.taskId === tool.taskId).detail, 'UPSTREAM_FAILED');
  assert.equal(ledger.finish({ ok: false, detail: 'tool failed' }).status, 'failed');
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-late-delegation', agentId: 'minimal-engineer', now: clock() });
  const delegation = ledger.recordDelegationStart('agency-code-reviewer');
  const success = ledger.recordDelegationFinish(delegation.taskId, { ok: true });
  assert.equal(success.status, 'completed');
  assert.deepEqual(
    ledger.recordDelegationFinish(delegation.taskId, { ok: false, blocked: true, error: 'late block' }),
    success
  );
  assert.equal(ledger.finish().status, 'completed');
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-abort-race', agentId: 'minimal-engineer', now: clock() });
  const tool = ledger.recordToolStart('repo.read');
  ledger.failOpenEntries('REQUEST_ABORTED');
  const sealed = ledger.snapshot().entries.find((entry) => entry.taskId === tool.taskId);
  assert.equal(sealed.status, 'failed');
  assert.deepEqual(ledger.recordToolFinish(tool.taskId, { ok: true }), sealed);
  assert.equal(ledger.finish({ ok: false, detail: 'REQUEST_ABORTED' }).status, 'failed');
}

{
  const ledger = createAgentRunLedger({ traceId: 'trace-unknown', agentId: 'minimal-engineer', now: clock() });
  assert.throws(() => ledger.recordToolFinish(ledger.rootTaskId, { ok: true }), /AGENT_RUN_TOOL_TASK_NOT_FOUND/);
  assert.throws(() => ledger.recordDelegationFinish(ledger.rootTaskId, { ok: true }), /AGENT_RUN_DELEGATION_TASK_NOT_FOUND/);
  assert.equal(ledger.snapshot().entries[0].status, 'running', 'wrong finish API cannot mutate root');
  assert.equal(ledger.finish().status, 'completed');
}

console.log('agent run ledger late result race tests passed');
