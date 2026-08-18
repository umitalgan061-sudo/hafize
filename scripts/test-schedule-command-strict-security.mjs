import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCHEDULE_COMMAND_MAX_ATTEMPTS,
  SCHEDULE_COMMAND_MAX_TASK_LENGTH,
  strictMaxAttempts,
  strictTask
} from '../lib/schedule-command-boundary.mjs';

const boundarySource = await readFile(new URL('../lib/schedule-command-boundary.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.equal(SCHEDULE_COMMAND_MAX_ATTEMPTS, 5);
assert.equal(SCHEDULE_COMMAND_MAX_TASK_LENGTH, 20_000);
assert.deepEqual(strictMaxAttempts(undefined), { ok: true, value: undefined });
assert.deepEqual(strictMaxAttempts(1), { ok: true, value: 1 });
assert.deepEqual(strictMaxAttempts(5), { ok: true, value: 5 });
assert.equal(strictMaxAttempts(0).ok, false);
assert.equal(strictMaxAttempts(6).ok, false);
assert.equal(strictMaxAttempts('5').ok, false);
assert.equal(strictTask('  hello  '), 'hello');
assert.equal(strictTask('x'.repeat(20_001)), null);

assert.match(boundarySource, /parsed <= nowMs/);
assert.match(boundarySource, /if \(!task \|\| !attempts\.ok\) return fail\('INVALID_SCHEDULE_COMMAND'\)/);
assert.doesNotMatch(boundarySource, /process\.env|Authorization|cookie|localStorage|sessionStorage|IndexedDB/i);
assert.doesNotMatch(boundarySource, /child_process|exec\(|spawn\(|shell\s*:\s*true/i);

assert.equal(registry.policy?.externalWritesRequireApproval, true);
assert.equal(registry.policy?.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy?.sharedTraceIdRequired, true);
assert.equal(registry.agents?.length, 4);
assert.ok(registry.agents.every((agent) => agent.toolPolicy?.default === 'deny'));

console.log('schedule command strict-input security contract passed');
