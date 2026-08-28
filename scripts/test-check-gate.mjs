import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyFilter,
  collectSyntaxTargets,
  collectTestFiles,
  parseArgs,
  runChecks
} from './run-checks.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function diskFiles(dir, pattern) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.posix.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

// Discovery must be exhaustive. Bir test dosyası diske eklendiği anda gate
// tarafından çalıştırılmalıdır; atlama listesi veya elle bakım noktası yoktur.
const discoveredTests = await collectTestFiles();
assert.deepEqual(discoveredTests, await diskFiles('scripts', /^test-.+\.mjs$/));
assert.ok(discoveredTests.includes('scripts/test-check-gate.mjs'));
assert.ok(discoveredTests.length >= 80);

const syntaxTargets = await collectSyntaxTargets();
for (const [dir, pattern] of [
  ['.', /^server\.mjs$/],
  ['lib', /\.mjs$/],
  ['scripts', /\.mjs$/],
  ['public', /\.js$/]
]) {
  for (const file of await diskFiles(dir, pattern)) {
    assert.ok(syntaxTargets.includes(file), `syntax gate missing ${file}`);
  }
}
// Syntax kapsamı test kapsamının üst kümesidir.
for (const file of discoveredTests) assert.ok(syntaxTargets.includes(file));
// Kaynak dışı dizinler gate'e sızmamalıdır.
assert.equal(syntaxTargets.some((file) => file.startsWith('docs/') || file.startsWith('agents/')), false);

// package.json elle tutulan dosya listesine geri dönmemelidir.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.match(pkg.scripts.check, /scripts\/run-checks\.mjs/);
assert.equal(/node --check (lib|scripts|public)\//.test(pkg.scripts.check), false);
assert.equal(pkg.scripts.check.length < 200, true);

assert.deepEqual(applyFilter(['lib/a.mjs', 'lib/b.mjs'], 'a.mjs'), ['lib/a.mjs']);
assert.deepEqual(applyFilter(['lib/Gmail.mjs'], 'gmail'), ['lib/Gmail.mjs']);
assert.deepEqual(applyFilter(['lib/a.mjs'], '   '), ['lib/a.mjs']);
assert.deepEqual(applyFilter(['lib/a.mjs'], 'nope'), []);

assert.deepEqual(parseArgs([]), { filter: '', syntaxOnly: false });
assert.deepEqual(parseArgs(['--syntax-only']), { filter: '', syntaxOnly: true });
assert.deepEqual(parseArgs(['--filter', 'gmail']), { filter: 'gmail', syntaxOnly: false });
assert.deepEqual(parseArgs(['--filter=gmail']), { filter: 'gmail', syntaxOnly: false });
// Yazım hatası sessizce daraltılmış bir gate çalıştırmamalıdır.
assert.throws(() => parseArgs(['--sytnax-only']), /UNKNOWN_CHECK_ARGUMENT/);

const smoke = await runChecks({ filter: 'run-checks.mjs', syntaxOnly: true });
assert.deepEqual(smoke.failures, []);
assert.deepEqual(smoke.syntaxFiles, ['scripts/run-checks.mjs']);
assert.deepEqual(smoke.testFiles, []);

console.log(`check gate OK: ${syntaxTargets.length} syntax target(s) and ${discoveredTests.length} test suite(s) discovered without a hand-maintained list`);
