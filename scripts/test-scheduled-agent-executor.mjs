import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const registry = {
  agents: [
    { id: 'hafize-general', name: 'Hafize' },
    { id: 'agency-code-reviewer', name: 'Code Reviewer' }
  ]
};

const seen = [];
const executor = createScheduledAgentExecutor({
  registry,
  model: 'mock/model',
  maxTokens: 99_999,
  nvidiaConfigured: true,
  githubReadConfigured: true,
  complete: async () => ({ choices: [] }),
  async runAgentTask(input) {
    seen.push(input);
    return { ok: true, content: 'tamam' };
  }
});

assert.equal(executor.configured, true);
const success = await executor.executeAgentTask({
  traceId: 'trace-scheduled-1',
  agent: { id: 'hafize-general', injected: true },
  task: '  Zamanlanmış görevi çalıştır.  '
});
assert.equal(success.ok, true);
assert.equal(success.content, 'tamam');
assert.equal(seen.length, 1);
assert.equal(seen[0].agent, registry.agents[0]);
assert.equal(seen[0].task, 'Zamanlanmış görevi çalıştır.');
assert.equal(seen[0].traceId, 'trace-scheduled-1');
assert.equal(seen[0].depth, 0);
assert.equal(seen[0].maxTokens, 8192);
assert.equal(seen[0].nvidiaConfigured, true);
assert.equal(seen[0].githubReadConfigured, true);
assert.equal(success.taskLedger.traceId, 'trace-scheduled-1');
assert.equal(success.taskLedger.entries[0].action, 'schedule.run');
assert.equal(success.taskLedger.entries[0].status, 'completed');

const failed = createScheduledAgentExecutor({
  registry,
  model: 'mock/model',
  complete: async () => ({ choices: [] }),
  async runAgentTask() {
    return { ok: false, error: 'TEMPORARY_FAILURE' };
  }
});
const failure = await failed.executeAgentTask({
  traceId: 'trace-scheduled-2',
  agent: registry.agents[1],
  task: 'Repo durumunu incele.'
});
assert.equal(failure.ok, false);
assert.equal(failure.error, 'TEMPORARY_FAILURE');
assert.equal(failure.taskLedger.entries[0].status, 'failed');
assert.equal(failure.taskLedger.entries[0].detail, 'TEMPORARY_FAILURE');

const throwing = createScheduledAgentExecutor({
  registry,
  model: 'mock/model',
  complete: async () => ({ choices: [] }),
  async runAgentTask() {
    throw new Error('secret internal detail');
  }
});
const thrown = await throwing.executeAgentTask({
  traceId: 'trace-scheduled-3',
  agent: registry.agents[0],
  task: 'Hata üret.'
});
assert.equal(thrown.ok, false);
assert.equal(thrown.error, 'SCHEDULE_AGENT_RUN_FAILED');
assert.equal(JSON.stringify(thrown).includes('secret internal detail'), false);

const unconfigured = createScheduledAgentExecutor({
  registry,
  model: '   ',
  complete: async () => ({ choices: [] }),
  async runAgentTask() {
    throw new Error('should not run');
  }
});
assert.equal(unconfigured.configured, false);
assert.deepEqual(
  await unconfigured.executeAgentTask({ traceId: 'trace-x', agent: registry.agents[0], task: 'x' }),
  { ok: false, error: 'SCHEDULE_MODEL_NOT_CONFIGURED' }
);

assert.deepEqual(
  await executor.executeAgentTask({ traceId: 'trace-x', agent: { id: 'missing-agent' }, task: 'x' }),
  { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' }
);

// Eksik veya nesne olmayan istek tipli hata döndürür, ham TypeError atmaz.
for (const request of [undefined, null, [], 'trace-x']) {
  assert.deepEqual(await executor.executeAgentTask(request), { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' });
}

console.log('scheduled agent executor tests passed');
