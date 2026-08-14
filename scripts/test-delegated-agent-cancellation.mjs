import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';
import { runDelegatedAgent } from '../lib/delegated-agent-runner.mjs';

const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur inceleme ajanı.',
  toolPolicy: { default: 'deny', allow: [] }
};
const registry = { policy: { maxDelegationDepth: 2, maxParallelAgents: 1 }, agents: [reviewer] };

const alreadyAborted = new AbortController();
alreadyAborted.abort('request_closed');
let earlyCompleteCalls = 0;
const early = await runDelegatedAgent({
  agent: reviewer,
  task: 'Çalışmamalı.',
  traceId: 'trace-aborted',
  parentTaskId: 'task_parent',
  signal: alreadyAborted.signal,
  registry,
  runLedger: createAgentRunLedger({ traceId: 'trace-aborted', agentId: reviewer.id }),
  model: 'mock-model',
  complete: async () => {
    earlyCompleteCalls += 1;
    throw new Error('should not execute');
  }
});
assert.deepEqual(early, { ok: false, error: 'DELEGATION_CANCELLED' });
assert.equal(earlyCompleteCalls, 0);

const controller = new AbortController();
let observedSignal = null;
const cancelled = await runDelegatedAgent({
  agent: reviewer,
  task: 'Completion sırasında iptal et.',
  traceId: 'trace-cancel-during-complete',
  parentTaskId: 'task_parent',
  signal: controller.signal,
  registry,
  runLedger: createAgentRunLedger({ traceId: 'trace-cancel-during-complete', agentId: reviewer.id }),
  model: 'mock-model',
  complete: async (_payload, signal) => {
    observedSignal = signal;
    controller.abort('caller_cancelled');
    return { choices: [{ message: { role: 'assistant', content: 'geç yanıt' } }] };
  }
});
assert.equal(observedSignal, controller.signal);
assert.deepEqual(cancelled, { ok: false, error: 'DELEGATION_CANCELLED' });

console.log('delegated agent cancellation tests passed');
