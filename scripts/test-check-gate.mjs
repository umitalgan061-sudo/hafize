import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(ROOT, 'scripts', 'run-checks.mjs');

// The runner resolves its own repository root from its file location, so a
// scratch copy of it only ever scans the scratch tree.
function runGate(repoRoot) {
  return new Promise((resolve) => {
    const gate = path.join(repoRoot, 'scripts', 'run-checks.mjs');
    const child = spawn(process.execPath, [gate], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

// The gate is wired as the only entry point, so `npm run check` can never drift
// away from the discovery runner.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(pkg.scripts.test, 'node scripts/run-checks.mjs');
assert.equal(pkg.scripts.precheck, undefined);

// Every discoverable suite must be part of a gate run: no test file can sit
// outside the gate the way 32 of them silently did before.
const suites = (await readdir(path.join(ROOT, 'scripts')))
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
  .sort();
assert.ok(suites.length >= 80, `expected the repository to carry its full suite set, saw ${suites.length}`);

const gateSource = await readFile(GATE, 'utf8');
assert.ok(gateSource.includes("name.startsWith('test-')"), 'gate must discover suites by pattern, not by a hand list');
assert.equal(gateSource.includes('process.exit(1)'), true, 'gate must fail the process on failures');

// A failing suite must break the gate. Verified against a scratch copy so the
// real repository is never mutated by this test.
const scratch = await mkdtemp(path.join(tmpdir(), 'hafize-gate-'));
try {
  const scratchScripts = path.join(scratch, 'scripts');
  await mkdir(scratchScripts, { recursive: true });
  await writeFile(path.join(scratch, 'package.json'), JSON.stringify({ name: 'gate-probe', private: true }, null, 2));
  await writeFile(path.join(scratchScripts, 'run-checks.mjs'), gateSource);
  await writeFile(path.join(scratchScripts, 'validate-agent-registry.mjs'), 'console.log("registry probe ok");\n');
  await writeFile(path.join(scratchScripts, 'test-probe-pass.mjs'), 'console.log("probe pass");\n');
  await writeFile(path.join(scratchScripts, 'test-probe-fail.mjs'), 'throw new Error("PROBE_FAILURE");\n');

  const failing = await runGate(scratch);
  assert.equal(failing.code, 1);
  assert.ok(failing.output.includes('FAIL scripts/test-probe-fail.mjs'));
  assert.ok(failing.output.includes('PROBE_FAILURE'));
  assert.ok(failing.output.includes('ok  scripts/test-probe-pass.mjs'), 'passing suites still run after a failure');
  assert.ok(failing.output.includes('1 failure(s)'));

  await rm(path.join(scratchScripts, 'test-probe-fail.mjs'));
  const passing = await runGate(scratch);
  assert.equal(passing.code, 0);
  assert.ok(passing.output.includes('All Hafize checks passed.'));
} finally {
  await rm(scratch, { recursive: true, force: true });
}

console.log(`check gate tests passed (${suites.length} suites discoverable)`);
