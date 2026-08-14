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

const readReviewer = {
  ...reviewer,
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const toolRegistry = {
  policy: { maxDelegationDepth: 2, maxParallelAgents: 1 },
  agents: [readReviewer]
};
const toolController = new AbortController();
let toolReadFinished = false;
let completionCalls = 0;
const toolLedger = createAgentRunLedger({ traceId: 'trace-cancel-tool', agentId: readReviewer.id });
const toolCancelled = await runDelegatedAgent({
  agent: readReviewer,
  task: 'README dosyasını incele.',
  traceId: 'trace-cancel-tool',
  parentTaskId: toolLedger.rootTaskId,
  signal: toolController.signal,
  registry: toolRegistry,
  runLedger: toolLedger,
  model: 'mock-model',
  githubReadConfigured: true,
  githubReadFile: async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    toolReadFinished = true;
    return { content: '# late' };
  },
  complete: async () => {
    completionCalls += 1;
    if (completionCalls > 1) throw new Error('second completion must not run');
    setTimeout(() => toolController.abort('tool_cancelled'), 25).unref?.();
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_read',
            type: 'function',
            function: {
              name: 'github_read_file',
              arguments: JSON.stringify({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' })
            }
          }]
        }
      }]
    };
  }
});
assert.deepEqual(toolCancelled, { ok: false, error: 'DELEGATION_CANCELLED' });
assert.equal(completionCalls, 1);
assert.equal(toolReadFinished, false);
const toolEntries = toolLedger.snapshot().entries.filter((entry) => entry.action === 'tool.github_read_file');
assert.equal(toolEntries.length, 1);
assert.equal(toolEntries[0].status, 'failed');
assert.equal(toolEntries[0].detail, 'TOOL_EXECUTION_CANCELLED');

await import('./test-tool-cancellation.mjs');
console.log('delegated agent cancellation tests passed');
