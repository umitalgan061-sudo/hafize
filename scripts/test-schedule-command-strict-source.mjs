import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const commandPath = fileURLToPath(new URL('../lib/schedule-command-boundary.mjs', import.meta.url));
const httpPath = fileURLToPath(new URL('../lib/schedule-http-api.mjs', import.meta.url));
const storePath = fileURLToPath(new URL('../lib/task-schedule-store.mjs', import.meta.url));
const [source, httpSource, storeSource] = await Promise.all([
  readFile(commandPath, 'utf8'),
  readFile(httpPath, 'utf8'),
  readFile(storePath, 'utf8')
]);

for (const path of [commandPath, httpPath, storePath]) {
  const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout || `${path} syntax failed`);
}

for (const required of [
  "const MAX_TASK_CHARS = 20_000",
  "const MAX_MAX_ATTEMPTS = 5",
  "const SCHEDULE_ID = /^schedule_[1-9][0-9]*$/",
  'function validateCreateInput(input)',
  "if (!normalized) return fail('INVALID_SCHEDULE_COMMAND')",
  "if (!agent) return fail('INVALID_AGENT')",
  'const id = strictScheduleId(scheduleId)',
  "if (!id) return fail('INVALID_SCHEDULE_COMMAND')",
  'SCHEDULE_COMMAND_LIMITS'
]) {
  assert.equal(source.includes(required), true, `missing strict boundary contract: ${required}`);
}

const validationIndex = source.indexOf('const normalized = validateCreateInput(input)');
const agentIndex = source.indexOf('const agent = registry.agents.find');
const traceIndex = source.indexOf('try { traceId = createTraceId(); }');
const addIndex = source.indexOf('const schedule = await store.add({');
assert.ok(validationIndex >= 0 && agentIndex > validationIndex);
assert.ok(traceIndex > agentIndex, 'trace allocation must occur after input and agent validation');
assert.ok(addIndex > traceIndex, 'persistence must occur after successful trace allocation');

for (const forbidden of [
  /Math\.min\s*\(\s*Math\.max\s*\(\s*input\.maxAttempts/,
  /parseInt\s*\(\s*input\.maxAttempts/,
  /Number\s*\(\s*input\.maxAttempts/,
  /eval\s*\(/,
  /new Function\s*\(/,
  /child_process/,
  /shell\s*:\s*true/,
  /process\.env\.[A-Z0-9_]*(?:TOKEN|SECRET|KEY)/,
  /console\.log\s*\(.*(?:token|secret|password)/i
]) {
  assert.equal(forbidden.test(source), false, `forbidden command-boundary surface: ${forbidden}`);
}

assert.equal(httpSource.includes("if (root && verb === 'POST')"), true);
assert.equal(httpSource.includes("commands.create({ principal: auth.principal, input })"), true);
assert.equal(httpSource.includes("if (error === 'INVALID_SCHEDULE_COMMAND'"), true);
assert.equal(storeSource.includes("? Math.min(Math.max(maxAttempts, 1), MAX_ATTEMPTS)"), true,
  'store remains defensive, while HTTP command boundary must reject coercive client inputs first');

console.log('strict schedule command source guards passed');
