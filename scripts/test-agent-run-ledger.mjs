import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

let tick = 0;
const now = () => new Date(Date.UTC(2026, 7, 12, 8, 0, tick++));
const run = createAgentRunLedger({
  traceId: 'trace-test-1',
  agentId: 'agency-code-reviewer',
  action: 'agent.run',
  now
});

const tool = run.recordToolStart('github_read_file');
assert.equal(tool.parentTaskId, run.rootTaskId);
assert.equal(tool.status, 'running');

run.recordToolFinish(tool.taskId, { ok: true, value: { content: '# Hafize' } });
run.finish({ ok: true });

const snapshot = run.snapshot();
assert.equal(snapshot.traceId, 'trace-test-1');
assert.equal(snapshot.entries.length, 2);
assert.equal(snapshot.entries[0].status, 'completed');
assert.equal(snapshot.entries[1].status, 'completed');
assert.equal(snapshot.entries[1].detail, 'ok');

const failed = createAgentRunLedger({ traceId: 'trace-test-2', agentId: 'agency-code-reviewer', now });
const failedTool = failed.recordToolStart('github_read_file');
failed.recordToolFinish(failedTool.taskId, { ok: false, error: 'GITHUB_REPO_NOT_ALLOWED' });
failed.finish({ ok: false, detail: 'tool_failed' });
const failedSnapshot = failed.snapshot();
assert.equal(failedSnapshot.entries[0].status, 'failed');
assert.equal(failedSnapshot.entries[1].status, 'failed');
assert.equal(failedSnapshot.entries[1].detail, 'GITHUB_REPO_NOT_ALLOWED');

console.log('Agent run ledger OK: root/tool lifecycle shares one trace');
