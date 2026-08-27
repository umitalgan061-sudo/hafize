import assert from 'node:assert/strict';
import {
  NON_TEST_SCRIPTS,
  discoverTargets,
  formatReport,
  isTestFile,
  matchesFilter,
  parseArgs,
  selectSyntaxFiles,
  summarize
} from './run-checks.mjs';

// Test dosyası tanımı
assert.equal(isTestFile('test-tool-runtime.mjs'), true);
assert.equal(isTestFile('validate-agent-registry.mjs'), false);
assert.equal(isTestFile('test-tool-runtime.js'), false);
assert.equal(isTestFile('run-checks.mjs'), false);
assert.equal(isTestFile(null), false);
assert.equal(NON_TEST_SCRIPTS.includes('run-checks.mjs'), true);

// Uzantı seçimi: public/ içindeki resim gibi çalıştırılamaz dosyalar dışarıda kalır
assert.deepEqual(selectSyntaxFiles(['b.mjs', 'a.mjs', 'readme.md'], { extensions: ['.mjs'] }), ['a.mjs', 'b.mjs']);
assert.deepEqual(selectSyntaxFiles(['app.js', 'hafize.jpeg'], { extensions: ['.js'] }), ['app.js']);
assert.deepEqual(selectSyntaxFiles(null, { extensions: ['.mjs'] }), []);

// Filtre
assert.equal(matchesFilter('scripts/test-gmail-read-client.mjs', 'gmail'), true);
assert.equal(matchesFilter('scripts/test-gmail-read-client.mjs', 'canva'), false);
assert.equal(matchesFilter('lib/tool-runtime.mjs', ''), true);

// Argüman sözleşmesi
assert.deepEqual(parseArgs([]), { syntax: true, tests: true, list: false, filter: '', timeoutMs: 120_000 });
assert.equal(parseArgs(['--syntax-only']).tests, false);
assert.equal(parseArgs(['--tests-only']).syntax, false);
assert.equal(parseArgs(['--list']).list, true);
assert.equal(parseArgs(['--filter=schedule']).filter, 'schedule');
assert.equal(parseArgs(['--timeout=5000']).timeoutMs, 5000);
assert.throws(() => parseArgs(['--syntax-only', '--tests-only']), /EMPTY_CHECK_SCOPE/);
assert.throws(() => parseArgs(['--timeout=10']), /INVALID_CHECK_TIMEOUT/);
assert.throws(() => parseArgs(['--bypass']), /UNKNOWN_CHECK_ARGUMENT/);

// Diskten keşif: kapı listesi elle tutulmadığı için yeni dosya otomatik kapsanır
const { syntaxTargets, testTargets } = await discoverTargets();
assert.ok(syntaxTargets.includes('server.mjs'));
assert.ok(syntaxTargets.includes('lib/tool-runtime.mjs'));
assert.ok(syntaxTargets.includes('public/app.js'));
assert.ok(syntaxTargets.includes('scripts/run-checks.mjs'));
assert.equal(syntaxTargets.some((target) => target.endsWith('.jpeg')), false);
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);
assert.ok(testTargets.includes('scripts/test-tool-runtime.mjs'));
assert.equal(testTargets.includes('scripts/run-checks.mjs'), false);
assert.equal(testTargets.includes('scripts/validate-agent-registry.mjs'), false);
assert.ok(testTargets.length > 40, `beklenenden az test bulundu: ${testTargets.length}`);

// Daha önce kapı dışında kalmış paketler artık kapsam içinde
for (const orphan of [
  'scripts/test-oauth-pkce.mjs',
  'scripts/test-personal-memory-runtime.mjs',
  'scripts/test-device-bridge-policy.mjs',
  'scripts/test-canva-read-client.mjs',
  'scripts/test-google-token-exchange.mjs'
]) {
  assert.ok(testTargets.includes(orphan), `kapsam dışı kaldı: ${orphan}`);
}

const filtered = await discoverTargets({ filter: 'gmail' });
assert.ok(filtered.testTargets.length > 0);
assert.equal(filtered.testTargets.every((target) => target.includes('gmail')), true);

// Özet: ilk hatada durmaz, tüm hataları toplar
const summary = summarize([
  { kind: 'syntax', target: 'lib/a.mjs', ok: true },
  { kind: 'test', target: 'scripts/test-a.mjs', ok: false, reason: 'exit', code: 1, output: 'AssertionError' },
  { kind: 'test', target: 'scripts/test-b.mjs', ok: false, reason: 'timeout', code: null, output: '' }
]);
assert.deepEqual(
  { total: summary.total, passed: summary.passed, failed: summary.failed, ok: summary.ok },
  { total: 3, passed: 1, failed: 2, ok: false }
);
assert.deepEqual(summary.failures.map(({ target }) => target), ['scripts/test-a.mjs', 'scripts/test-b.mjs']);
assert.equal(summarize([{ ok: true }]).ok, true);
assert.equal(summarize(null).total, 0);

const report = formatReport(summary);
assert.ok(report.includes('FAIL [test] scripts/test-a.mjs (exit code=1)'));
assert.ok(report.includes('FAIL [test] scripts/test-b.mjs (timeout)'));
assert.ok(report.includes('1/3 geçti, 2 başarısız'));
assert.ok(formatReport(summarize([{ kind: 'test', target: 'x', ok: true }])).includes('1/1 geçti, 0 başarısız'));

console.log(`Check runner OK: ${syntaxTargets.length} syntax + ${testTargets.length} test hedefi diskten keşfedildi, hatalar toplanarak raporlanıyor`);
