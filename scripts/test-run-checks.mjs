import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const RUNNER = path.join(ROOT, 'scripts', 'run-checks.mjs');

function exec(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const listed = await exec(['--list']);
assert.equal(listed.code, 0);
assert.equal(listed.stdout.includes('test-run-checks.mjs'), true);
assert.equal(listed.stdout.includes('validate-agent-registry.mjs'), true);

const filtered = await exec(['--filter', 'memory-consolidation']);
assert.equal(filtered.code, 0);
assert.equal(filtered.stdout.includes('test-memory-consolidation.mjs'), true);
assert.equal(filtered.stdout.includes('test-calendar-contract.mjs'), false);

const multiFiltered = await exec(['--filter=voice-input,ui-shell']);
assert.equal(multiFiltered.code, 0);
assert.equal(multiFiltered.stdout.includes('test-voice-input.mjs'), true);
assert.equal(multiFiltered.stdout.includes('test-ui-shell.mjs'), true);
assert.equal(multiFiltered.stdout.includes('test-calendar-contract.mjs'), false);

const invalid = await exec(['--unknown']);
assert.equal(invalid.code, 1);
assert.equal(invalid.stderr.includes('UNKNOWN_CHECK_OPTION'), true);

const noMatch = await exec(['--filter', 'this-suite-does-not-exist']);
assert.equal(noMatch.code, 0);
assert.equal(noMatch.stdout.includes('test: 0 paket'), true);

console.log('check runner tests passed');
