import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const agent = {
  id: 'minimal-engineer',
  name: 'Minimal Engineer',
  kind: 'primary',
  description: 'Test agent.',
  toolPolicy: { default: 'deny', allow: [] }
};
const registry = { agents: [agent] };

let completeCalls = 0;
let runAgentTaskCalls = 0;
const acceptedTasks = [];
const executor = createScheduledAgentExecutor({
  registry,
  model: 'mock-model',
  complete: async () => {
    completeCalls += 1;
    throw new Error('completion must be unreachable in this focused fixture');
  },
  runAgentTask: async ({ task, traceId, agent: canonicalAgent }) => {
    runAgentTaskCalls += 1;
    acceptedTasks.push(task);
    assert.equal(traceId, 'trace-scheduled-credential-boundary');
    assert.equal(canonicalAgent, agent);
    return { ok: true, content: 'accepted' };
  }
});

const credentialTasks = [
  'Repo durumunu incele. api_key = abcdef1234567890',
  'Header: Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789',
  'Bu token ile kontrol et: github_pat_abcdefghijklmnopqrstuvwxyz123456',
  'Anahtarı kullan:\n-----BEGIN PRIVATE KEY-----\nsecret-material'
];

for (const task of credentialTasks) {
  const result = await executor.executeAgentTask({
    traceId: 'trace-scheduled-credential-boundary',
    agent,
    task
  });
  assert.deepEqual(result, {
    ok: false,
    error: 'SCHEDULE_AGENT_TASK_CREDENTIAL_BLOCKED'
  });
}

assert.equal(runAgentTaskCalls, 0, 'credential-bearing persisted task must never reach the agent/model runner');
assert.equal(completeCalls, 0, 'credential-bearing task must never reach the NVIDIA completion boundary');
assert.deepEqual(acceptedTasks, []);

const safeResult = await executor.executeAgentTask({
  traceId: 'trace-scheduled-credential-boundary',
  agent,
  task: 'README dosyasındaki mimari notları özetle.'
});
assert.equal(safeResult.ok, true);
assert.equal(safeResult.content, 'accepted');
assert.equal(runAgentTaskCalls, 1, 'ordinary scheduled task must continue through the canonical runner');
assert.equal(completeCalls, 0);
assert.deepEqual(acceptedTasks, ['README dosyasındaki mimari notları özetle.']);
assert.equal(safeResult.taskLedger.traceId, 'trace-scheduled-credential-boundary');
assert.equal(safeResult.taskLedger.entries[0].status, 'completed');

console.log('scheduled agent credential boundary tests passed');
