import assert from 'node:assert/strict';
import { createScheduledAgentExecutor, thrownRunError } from '../lib/scheduled-agent-executor.mjs';

assert.equal(thrownRunError({ code: 'SCHEDULE_AGENT_RUN_TIMEOUT' }, null), 'SCHEDULE_AGENT_RUN_TIMEOUT');
assert.equal(thrownRunError({ code: 'NVIDIA_PRIVATE_PROVIDER_ERROR' }, null), 'SCHEDULE_AGENT_RUN_FAILED');
assert.equal(thrownRunError({ code: 'SCHEDULE_LEASE_LOST' }, null), 'SCHEDULE_AGENT_RUN_FAILED');
assert.equal(thrownRunError(new Error('secret detail'), null), 'SCHEDULE_AGENT_RUN_FAILED');
assert.equal(thrownRunError(null, null), 'SCHEDULE_AGENT_RUN_FAILED');

const aborted = new AbortController();
aborted.abort();
assert.equal(
  thrownRunError({ code: 'SCHEDULE_AGENT_RUN_TIMEOUT' }, aborted.signal),
  'SCHEDULE_AGENT_RUN_CANCELLED'
);

const registry = {
  agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', toolPolicy: { default: 'deny', allow: [] } }]
};
const agent = registry.agents[0];

async function executeWithThrown(error) {
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'nvidia/test-model',
    complete: async () => ({ choices: [{ message: { role: 'assistant', content: 'unused' } }] }),
    runAgentTask: async () => { throw error; }
  });
  return executor.executeAgentTask({
    traceId: 'trace-thrown-policy',
    agent,
    task: 'Thrown error policy test'
  });
}

const timeout = await executeWithThrown(Object.assign(new Error('deadline'), { code: 'SCHEDULE_AGENT_RUN_TIMEOUT' }));
assert.equal(timeout.ok, false);
assert.equal(timeout.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
assert.equal(timeout.taskLedger?.root?.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');

const privateFailure = await executeWithThrown(
  Object.assign(new Error('provider stack and credential-shaped detail'), { code: 'NVIDIA_INTERNAL_ACCOUNT_123' })
);
assert.equal(privateFailure.ok, false);
assert.equal(privateFailure.error, 'SCHEDULE_AGENT_RUN_FAILED');
assert.notEqual(privateFailure.taskLedger?.root?.detail, 'NVIDIA_INTERNAL_ACCOUNT_123');
assert.equal(JSON.stringify(privateFailure).includes('credential-shaped detail'), false);

process.stdout.write('scheduled agent thrown error policy passed\n');
