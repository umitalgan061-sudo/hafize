import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { executeNvidiaToolCall } from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
const toolCall = {
  id: 'call_cancel_read',
  type: 'function',
  function: {
    name: 'github_read_file',
    arguments: JSON.stringify({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' })
  }
};

const controller = new AbortController();
let underlyingFinished = false;
let readCalls = 0;
const started = Date.now();
setTimeout(() => controller.abort('child_cancelled'), 25).unref?.();
const cancelled = await executeNvidiaToolCall(reviewer, toolCall, {
  traceId: 'trace-tool-cancel',
  agent: reviewer,
  registry,
  githubReadConfigured: true,
  signal: controller.signal,
  githubReadFile: async () => {
    readCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    underlyingFinished = true;
    return { content: 'late result' };
  }
});
assert.deepEqual(cancelled, { ok: false, error: 'TOOL_EXECUTION_CANCELLED' });
assert.equal(readCalls, 1);
assert.equal(underlyingFinished, false);
assert.ok(Date.now() - started < 180);

const preAborted = new AbortController();
preAborted.abort('already_cancelled');
let preAbortedCalls = 0;
assert.deepEqual(
  await executeNvidiaToolCall(reviewer, toolCall, {
    traceId: 'trace-tool-pre-aborted',
    agent: reviewer,
    registry,
    githubReadConfigured: true,
    signal: preAborted.signal,
    githubReadFile: async () => {
      preAbortedCalls += 1;
      return {};
    }
  }),
  { ok: false, error: 'TOOL_EXECUTION_CANCELLED' }
);
assert.equal(preAbortedCalls, 0);

const invalidSignal = await executeNvidiaToolCall(reviewer, toolCall, {
  traceId: 'trace-invalid-signal',
  agent: reviewer,
  registry,
  githubReadConfigured: true,
  signal: { aborted: false, addEventListener: 123 },
  githubReadFile: async () => ({ content: 'must not execute' })
});
assert.deepEqual(invalidSignal, { ok: false, error: 'INVALID_TOOL_SIGNAL' });
assert.equal(JSON.stringify(invalidSignal).includes('addEventListener'), false);

console.log('tool cancellation tests passed');
