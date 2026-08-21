import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';
import { createToolSuccessResult } from '../lib/tool-execution-result-policy.mjs';

function ledger() {
  let tick = 0;
  return createAgentRunLedger({
    traceId: 'trace-tool-result-boundary',
    agentId: 'minimal-engineer',
    now: () => new Date(1_800_000_000_000 + tick++ * 1000)
  });
}

function entryById(run, taskId) {
  return run.snapshot().entries.find((entry) => entry.taskId === taskId);
}

{
  const run = ledger();
  const task = run.recordToolStart('runtime_status');
  const finished = run.recordToolFinish(task.taskId, createToolSuccessResult({ status: 'ok' }));
  assert.equal(finished.status, 'completed');
  assert.equal(finished.detail, 'ok');
  assert.equal(entryById(run, task.taskId).status, 'completed');
  const root = run.finish({ ok: true });
  assert.equal(root.status, 'completed');
}

{
  const run = ledger();
  const task = run.recordToolStart('gmail_read');
  const finished = run.recordToolFinish(task.taskId, { ok: false, error: 'GMAIL_READ_FAILED', status: 503 });
  assert.equal(finished.status, 'failed');
  assert.equal(finished.detail, 'GMAIL_READ_FAILED');
  const root = run.finish({ ok: false, detail: 'tool_failed' });
  assert.equal(root.status, 'failed');
}

{
  const run = ledger();
  const task = run.recordToolStart('github_read_file');
  const finished = run.recordToolFinish(task.taskId, { ok: true, value: { safe: true }, extra: 'untrusted' });
  assert.equal(finished.status, 'failed');
  assert.equal(finished.detail, 'TOOL_RESULT_INVALID');
}

{
  let okReads = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'ok', {
    get() {
      okReads += 1;
      return true;
    }
  });
  Object.defineProperty(hostile, 'value', { value: { secret: 'x' }, enumerable: true });

  const run = ledger();
  const task = run.recordToolStart('gmail_read');
  const finished = run.recordToolFinish(task.taskId, hostile);
  assert.equal(finished.status, 'failed');
  assert.equal(finished.detail, 'TOOL_RESULT_INVALID');
  assert.equal(okReads, 0, 'ledger must not invoke hostile result getters');
}

{
  let trapReads = 0;
  const hostile = new Proxy({ ok: true, value: { safe: true } }, {
    ownKeys() {
      trapReads += 1;
      throw new Error('hostile proxy');
    }
  });
  const run = ledger();
  const task = run.recordToolStart('gmail_read');
  const finished = run.recordToolFinish(task.taskId, hostile);
  assert.equal(finished.status, 'failed');
  assert.equal(finished.detail, 'TOOL_RESULT_INVALID');
  assert.equal(trapReads, 1);
}

{
  const run = ledger();
  const task = run.recordToolStart('gmail_read');
  const first = run.recordToolFinish(task.taskId, { ok: false, error: 'TOOL_RESULT_INVALID' });
  const second = run.recordToolFinish(task.taskId, { ok: true, value: { late: 'success' } });
  assert.deepEqual(second, first, 'terminal tool task ignores late conflicting completion');
  assert.equal(entryById(run, task.taskId).status, 'failed');
  assert.equal(entryById(run, task.taskId).detail, 'TOOL_RESULT_INVALID');
}

{
  const run = ledger();
  const task = run.recordToolStart('gmail_read');
  assert.throws(() => run.finish({ ok: true }), /AGENT_RUN_HAS_OPEN_TASKS/);
  run.recordToolFinish(task.taskId, { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.equal(run.finish({ ok: false, detail: 'tool_failed' }).status, 'failed');
}

{
  const run = ledger();
  const delegated = run.recordDelegationStart('agency-code-reviewer');
  assert.throws(
    () => run.recordToolFinish(delegated.taskId, { ok: true, value: {} }),
    /AGENT_RUN_TOOL_TASK_NOT_FOUND/
  );
  run.recordDelegationFinish(delegated.taskId, { ok: true });
  run.finish({ ok: true });
}

console.log('agent run ledger tool result boundary tests passed');
