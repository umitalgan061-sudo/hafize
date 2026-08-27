import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { discoverSyntaxTargets, discoverTestScripts, runChecks, selectTargets } from './run-checks.mjs';

const ROOT = new URL('../', import.meta.url);

async function namesIn(directory) {
  const entries = await readdir(new URL(`${directory}/`, ROOT), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

// Keşif sözleşmesi: diskteki hiçbir kaynak veya test dosyası gate dışında kalamaz.
const syntaxTargets = await discoverSyntaxTargets();
const testScripts = await discoverTestScripts();

assert.ok(syntaxTargets.includes('server.mjs'));
assert.deepEqual(syntaxTargets, [...syntaxTargets].sort());
assert.deepEqual(testScripts, [...testScripts].sort());
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);

for (const directory of ['lib', 'public', 'scripts']) {
  for (const name of await namesIn(directory)) {
    const expected = name.endsWith('.mjs') || name.endsWith('.js');
    assert.equal(
      syntaxTargets.includes(`${directory}/${name}`),
      expected,
      `syntax hedefi beklenmedik: ${directory}/${name}`
    );
  }
}

const expectedTests = (await namesIn('scripts'))
  .filter((name) => /^(?:test|validate)-.+\.mjs$/.test(name))
  .map((name) => `scripts/${name}`)
  .sort();
assert.deepEqual(testScripts, expectedTests);
assert.ok(testScripts.includes('scripts/test-run-checks.mjs'));
assert.ok(testScripts.includes('scripts/validate-agent-registry.mjs'));
assert.ok(testScripts.length >= 80);
for (const script of testScripts) assert.ok(syntaxTargets.includes(script));

// Boş dizin veya eksik dizin keşfi çökertmez.
assert.deepEqual(await discoverTestScripts(new URL('lib/', ROOT)), []);

assert.deepEqual(selectTargets(['a/x.mjs', 'b/y.mjs'], []), ['a/x.mjs', 'b/y.mjs']);
assert.deepEqual(selectTargets(['a/x.mjs', 'b/y.mjs'], ['y']), ['b/y.mjs']);
assert.deepEqual(selectTargets(['a/x.mjs', 'b/y.mjs'], ['y', 'x']), ['a/x.mjs', 'b/y.mjs']);
assert.deepEqual(selectTargets(['a/x.mjs'], ['zzz']), []);

function recordingRunner(exitCodeFor = () => 0) {
  const calls = [];
  return {
    calls,
    async runner(args) {
      calls.push(args);
      return exitCodeFor(args);
    }
  };
}

const silent = { log: () => {}, logError: () => {} };

const ok = recordingRunner();
const okResult = await runChecks({ filters: ['test-run-checks'], runner: ok.runner, ...silent });
assert.equal(okResult.ok, true);
assert.deepEqual(okResult.failures, []);
assert.deepEqual(okResult.syntaxTargets, ['scripts/test-run-checks.mjs']);
assert.deepEqual(okResult.testScripts, ['scripts/test-run-checks.mjs']);
assert.deepEqual(ok.calls, [['--check', 'scripts/test-run-checks.mjs'], ['scripts/test-run-checks.mjs']]);

// Tek bir başarısızlık gate'i kırar ve kalan kontroller yine de çalıştırılır.
const failing = recordingRunner((args) => (args.includes('scripts/test-run-checks.mjs') && args.length === 1 ? 1 : 0));
const failed = await runChecks({ filters: ['run-checks'], runner: failing.runner, ...silent });
assert.equal(failed.ok, false);
assert.deepEqual(failed.failures, ['test:scripts/test-run-checks.mjs']);
assert.equal(failing.calls.length, failed.syntaxTargets.length + failed.testScripts.length);

const syntaxFailure = recordingRunner((args) => (args[0] === '--check' ? 2 : 0));
const syntaxFailed = await runChecks({ filters: ['test-run-checks'], runner: syntaxFailure.runner, ...silent });
assert.equal(syntaxFailed.ok, false);
assert.deepEqual(syntaxFailed.failures, ['syntax:scripts/test-run-checks.mjs']);

// Hiçbir dosyayla eşleşmeyen filtre sessizce "geçti" sayılmaz.
const empty = recordingRunner();
const noMatch = await runChecks({ filters: ['hafize-olmayan-dosya'], runner: empty.runner, ...silent });
assert.equal(noMatch.ok, false);
assert.deepEqual(noMatch.failures, ['no-match']);
assert.equal(empty.calls.length, 0);

console.log(`run-checks gate OK: ${syntaxTargets.length} syntax hedefi, ${testScripts.length} test keşfedildi`);
