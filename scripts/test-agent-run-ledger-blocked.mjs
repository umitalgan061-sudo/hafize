import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

const ledger = createAgentRunLedger({ traceId: 'trace-blocked', agentId: 'hafize-general' });
const task = ledger.recordDelegationStart('agency-code-reviewer');
ledger.recordDelegationFinish(task.taskId, {
  ok: false,
  blocked: true,
  error: 'DELEGATION_CANCELLED'
});
const entry = ledger.snapshot().entries.find((item) => item.taskId === task.taskId);
assert.equal(entry.status, 'blocked');
assert.equal(entry.detail, 'DELEGATION_CANCELLED');
console.log('agent run ledger blocked test passed');
