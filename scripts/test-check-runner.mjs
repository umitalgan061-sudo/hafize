import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { collectRunTargets, collectSyntaxTargets, runChecks } from './run-checks.mjs';

const root = new URL('../', import.meta.url);
const syntaxTargets = await collectSyntaxTargets();
const runTargets = await collectRunTargets();

async function filesIn(dir, extension) {
  const entries = await readdir(new URL(dir, root), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => `${dir}/${entry.name}`);
}

// Coverage invariant: every shipped module is syntax checked.
for (const file of [...(await filesIn('lib', '.mjs')), ...(await filesIn('public', '.js'))]) {
  assert.ok(syntaxTargets.includes(file), `syntax gate missing ${file}`);
}
assert.ok(syntaxTargets.includes('server.mjs'), 'syntax gate missing server.mjs');

// Coverage invariant: every test file runs, and the gate never runs itself.
const testFiles = (await filesIn('scripts', '.mjs')).filter((file) => file.startsWith('scripts/test-'));
assert.ok(testFiles.length > 50);
for (const file of testFiles) assert.ok(runTargets.includes(file), `test gate missing ${file}`);
assert.equal(runTargets.includes('scripts/run-checks.mjs'), false);
assert.ok(runTargets.includes('scripts/validate-agent-registry.mjs'));
assert.equal(new Set(runTargets).size, runTargets.length);
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);

// The gate must not depend on a hand maintained script string any more.
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');

// A failing target is reported, does not abort the run, and fails the gate.
const lines = [];
const attempted = [];
const failing = await runChecks({
  log: (line) => lines.push(String(line)),
  execute: async (args) => {
    const target = args.at(-1);
    attempted.push(args);
    if (args[0] !== '--check' && target === 'scripts/test-tool-runtime.mjs') {
      return { code: 1, stdout: '', stderr: 'AssertionError: inventory drifted' };
    }
    return { code: 0, stdout: 'ok\n', stderr: '' };
  }
});
assert.equal(failing.failures.length, 1);
assert.equal(failing.failures[0].target, 'scripts/test-tool-runtime.mjs');
assert.equal(failing.failures[0].stage, 'test');
assert.equal(attempted.length, syntaxTargets.length + runTargets.length);
const report = lines.join('\n');
assert.match(report, /AssertionError: inventory drifted/);
assert.match(report, /1 kontrol başarısız/);

// Every target is executed exactly once, syntax checks before test runs.
assert.equal(attempted.filter((args) => args[0] === '--check').length, syntaxTargets.length);
assert.equal(attempted.at(0)[0], '--check');
assert.equal(attempted.at(-1)[0], runTargets.at(-1));

const passing = await runChecks({ log: () => {}, execute: async () => ({ code: 0, stdout: 'ok\n', stderr: '' }) });
assert.deepEqual(passing.failures, []);

console.log(`check runner OK: ${syntaxTargets.length} syntax and ${runTargets.length} run targets discovered, failures reported without early abort`);
