import assert from 'node:assert/strict';
import path from 'node:path';
import { CHECK_RUNNER_TARGETS, discoverCheckPlan, matchesFilters, normalizeFilters, runCheckPlan } from '../lib/check-runner.mjs';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const fakeTree = {
  lib: ['check-runner.mjs', 'tool-runtime.mjs', 'notes.md'],
  scripts: ['run-checks.mjs', 'test-alpha.mjs', 'test-beta.mjs', 'validate-agent-registry.mjs', 'legacy.txt'],
  public: ['app.js', 'styles.css']
};
const readDirectory = async (directory) => fakeTree[path.basename(directory)] || [];

const plan = await discoverCheckPlan({ rootDir: '/repo', readDirectory });
assert.deepEqual(plan.syntaxChecks, [
  'server.mjs',
  'lib/check-runner.mjs',
  'lib/tool-runtime.mjs',
  'scripts/run-checks.mjs',
  'scripts/test-alpha.mjs',
  'scripts/test-beta.mjs',
  'scripts/validate-agent-registry.mjs',
  'public/app.js'
]);
// Kapı elle tutulan listeye değil, gerçekte var olan test dosyalarına dayanır.
assert.deepEqual(plan.tests, [
  'scripts/validate-agent-registry.mjs',
  'scripts/test-alpha.mjs',
  'scripts/test-beta.mjs'
]);
assert.equal(plan.tests.includes('scripts/run-checks.mjs'), false, 'runner kendini test olarak çalıştırmaz');

const filtered = await discoverCheckPlan({ rootDir: '/repo', readDirectory, filters: ['alpha'] });
assert.deepEqual(filtered.tests, ['scripts/test-alpha.mjs']);
assert.deepEqual(filtered.syntaxChecks, ['scripts/test-alpha.mjs']);

const withoutExtras = await discoverCheckPlan({
  rootDir: '/repo',
  readDirectory: async (directory) =>
    (path.basename(directory) === 'scripts' ? ['test-alpha.mjs'] : fakeTree[path.basename(directory)] || [])
});
assert.deepEqual(withoutExtras.tests, ['scripts/test-alpha.mjs'], 'var olmayan ek test dosyası plana eklenmez');

assert.deepEqual(normalizeFilters(['  Voice ', '', 'UI']), ['voice', 'ui']);
assert.equal(matchesFilters('scripts/test-voice-input.mjs', ['voice']), true);
assert.equal(matchesFilters('scripts/test-voice-input.mjs', ['canva']), false);
assert.equal(matchesFilters('scripts/test-voice-input.mjs', []), true);
await assert.rejects(() => discoverCheckPlan({ rootDir: '', readDirectory }), /INVALID_CHECK_PLAN:rootDir/);
await assert.rejects(() => discoverCheckPlan({ rootDir: '/repo', readDirectory: null }), /INVALID_CHECK_PLAN:readDirectory/);
assert.throws(() => normalizeFilters('voice'), /INVALID_CHECK_PLAN:filters/);

const invoked = [];
const okSummary = await runCheckPlan(
  { syntaxChecks: ['server.mjs'], tests: ['scripts/test-alpha.mjs'] },
  {
    runNode: async ({ args, kind }) => {
      invoked.push({ args, kind });
      return { ok: true, output: '' };
    }
  }
);
assert.deepEqual(invoked, [
  { args: ['--check', 'server.mjs'], kind: 'syntax' },
  { args: ['scripts/test-alpha.mjs'], kind: 'test' }
]);
assert.equal(okSummary.ok, true);
assert.equal(okSummary.executed, 2);

// Tek bir başarısızlık kapıyı kırmızıya çevirir ama kalan kontroller yine de çalışır.
const failSummary = await runCheckPlan(
  { syntaxChecks: ['server.mjs'], tests: ['scripts/test-alpha.mjs', 'scripts/test-beta.mjs'] },
  {
    runNode: async ({ file }) =>
      file === 'scripts/test-alpha.mjs' ? { ok: false, output: 'AssertionError: beklenen değer' } : { ok: true, output: '' }
  }
);
assert.equal(failSummary.ok, false);
assert.equal(failSummary.executed, 3);
assert.deepEqual(failSummary.failures.map((failure) => failure.file), ['scripts/test-alpha.mjs']);
assert.equal(failSummary.failures[0].kind, 'test');
assert.match(failSummary.failures[0].output, /AssertionError/);
await assert.rejects(() => runCheckPlan(null, {}), /INVALID_CHECK_PLAN:plan/);
await assert.rejects(() => runCheckPlan({ syntaxChecks: [], tests: [] }, { runNode: 'no' }), /INVALID_CHECK_PLAN:runNode/);

// Gerçek depo taraması: kapı bu turda eklenen testleri de kendiliğinden bulur.
const realPlan = await discoverCheckPlan({ rootDir });
assert.ok(realPlan.tests.includes('scripts/test-check-runner.mjs'));
assert.ok(realPlan.tests.includes('scripts/test-tool-runtime.mjs'));
assert.ok(realPlan.syntaxChecks.includes('server.mjs'));
assert.ok(realPlan.syntaxChecks.includes('public/app.js'));
assert.ok(realPlan.tests.length > 40);
assert.equal(CHECK_RUNNER_TARGETS.testPrefix, 'test-');

console.log('check runner tests passed');
