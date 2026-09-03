import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCLUDED_TESTS,
  collectPlan,
  collectSyntaxTargets,
  collectTestTargets,
  collectValidatorTargets
} from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listing = (directory) => readdirSync(path.join(ROOT, directory)).sort();

const syntaxTargets = collectSyntaxTargets();
const testTargets = collectTestTargets();
const validatorTargets = collectValidatorTargets();

// Her kaynak dosyası syntax kapısına otomatik girer; kapı listesi elle
// güncellenmediği için yeni modüller sessizce kapı dışında kalamaz.
assert.ok(syntaxTargets.includes('server.mjs'));
for (const file of listing('lib')) {
  if (file.endsWith('.mjs')) assert.ok(syntaxTargets.includes(`lib/${file}`), `lib/${file} syntax kapısında değil`);
}
for (const file of listing('public')) {
  if (file.endsWith('.js')) assert.ok(syntaxTargets.includes(`public/${file}`), `public/${file} syntax kapısında değil`);
}
for (const file of listing('scripts')) {
  if (file.endsWith('.mjs')) assert.ok(syntaxTargets.includes(`scripts/${file}`), `scripts/${file} syntax kapısında değil`);
}
assert.equal(syntaxTargets.includes('public/hafize.jpeg'), false);
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);

// Her test dosyası kapıda çalıştırılır; istisna ancak açık gerekçeyle eklenir.
for (const file of listing('scripts')) {
  if (!file.startsWith('test-') || !file.endsWith('.mjs')) continue;
  if (file in EXCLUDED_TESTS) {
    assert.equal(typeof EXCLUDED_TESTS[file], 'string');
    assert.ok(EXCLUDED_TESTS[file].length > 0, `${file} istisnası gerekçesiz`);
    continue;
  }
  assert.ok(testTargets.includes(`scripts/${file}`), `scripts/${file} test kapısında değil`);
}
assert.ok(testTargets.includes('scripts/test-check-gate.mjs'));
assert.ok(testTargets.includes('scripts/test-tool-runtime.mjs'));
assert.equal(testTargets.includes('scripts/run-checks.mjs'), false);
assert.deepEqual(validatorTargets, ['scripts/validate-agent-registry.mjs']);

const plan = collectPlan();
assert.deepEqual(plan, { syntax: syntaxTargets, validators: validatorTargets, tests: testTargets });
assert.equal(
  plan.tests.some((file) => plan.validators.includes(file)),
  false
);

// package.json tek kapı komutuna delege eder; elle bakımı gereken uzun
// zincir yeniden ortaya çıkarsa bu test kırmızıya döner.
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal('precheck' in pkg.scripts, false);
assert.equal(pkg.scripts.check.includes('&&'), false);

console.log(
  `check gate OK: ${syntaxTargets.length} syntax hedefi, ${validatorTargets.length} doğrulayıcı, ${testTargets.length} test keşfedildi`
);
