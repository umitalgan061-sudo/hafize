import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { applyFilters, collectSyntaxTargets, collectTestTargets, ROOT } from './run-checks.mjs';

// run-checks.mjs import edildiğinde süiti çalıştırmamalıdır; aksi hâlde bu test
// sonsuz özyinelemeye girerdi. Buraya ulaşabilmek tek başına bu garantiyi doğrular.

const testTargets = collectTestTargets();
const syntaxTargets = collectSyntaxTargets();

const onDisk = readdirSync(path.join(ROOT, 'scripts'))
  .filter((name) => (name.startsWith('test-') || name.startsWith('validate-')) && name.endsWith('.mjs'))
  .sort()
  .map((name) => `scripts/${name}`);

// Diskteki her test gate tarafından kapsanır: elle tutulan bir liste geride kalamaz.
assert.deepEqual(testTargets, onDisk);
assert.ok(testTargets.includes('scripts/test-check-gate.mjs'));
assert.ok(testTargets.includes('scripts/validate-agent-registry.mjs'));
assert.ok(testTargets.length >= 80);

// Kaynak dosyaların tamamı syntax kontrolünden geçer.
assert.ok(syntaxTargets.includes('server.mjs'));
assert.ok(syntaxTargets.includes('scripts/run-checks.mjs'));
for (const dir of ['lib', 'public']) {
  const extension = dir === 'public' ? '.js' : '.mjs';
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (!name.endsWith(extension)) continue;
    assert.ok(syntaxTargets.includes(`${dir}/${name}`), `syntax target missing: ${dir}/${name}`);
  }
}
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);

// Filtreleme yalnız eşleşen hedefleri daraltır, sessizce hedef üretmez.
assert.deepEqual(applyFilters(testTargets, []), testTargets);
assert.deepEqual(applyFilters(['a/one.mjs', 'a/two.mjs'], ['two']), ['a/two.mjs']);
assert.deepEqual(applyFilters(['a/one.mjs'], ['nope']), []);

// package.json gate'i runner'a devretmiş olmalıdır; devasa elle yazılmış zincir
// ilk hatada durduğu için geri kalan testleri gizliyordu.
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.match(pkg.scripts.precheck, /^node scripts\/run-checks\.mjs /);
for (const script of Object.values(pkg.scripts)) {
  assert.equal(/scripts\/test-[a-z0-9-]+\.mjs/.test(script), false, `package.json still hardcodes tests: ${script}`);
}

console.log(`check gate coverage OK: ${testTargets.length} tests, ${syntaxTargets.length} syntax targets`);
