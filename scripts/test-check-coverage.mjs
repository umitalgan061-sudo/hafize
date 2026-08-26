// Doğrulama kapısının kapsamını korur.
//
// Daha önce `npm run check` elle yazılmış uzun bir komut zinciriydi ve testlerin
// bir bölümü hiçbir zaman çalıştırılmıyordu. Bu test, kapının repo içeriğinden
// keşfedilmeye devam ettiğini ve hiçbir test dosyasının kapsam dışında
// kalmadığını doğrular.

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFilter, discoverSyntaxTargets, discoverTestTargets, resolveTimeoutMs } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const scriptFiles = (await readdir(path.join(ROOT, 'scripts'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.startsWith('test-') && entry.name.endsWith('.mjs'))
  .map((entry) => `scripts/${entry.name}`)
  .sort();

const testTargets = await discoverTestTargets();
assert.deepEqual(testTargets, scriptFiles);
assert.ok(testTargets.length >= 80, `beklenenden az test keşfedildi: ${testTargets.length}`);

const syntaxTargets = await discoverSyntaxTargets();
for (const required of ['server.mjs', 'lib/tool-runtime.mjs', 'public/app.js', 'scripts/run-checks.mjs']) {
  assert.ok(syntaxTargets.includes(required), `syntax kapsamı eksik: ${required}`);
}

// Her test dosyası aynı zamanda syntax kapsamındadır.
for (const target of testTargets) {
  assert.ok(syntaxTargets.includes(target), `syntax kapsamı eksik: ${target}`);
}

// lib/ altındaki her modül syntax kapsamındadır.
const libFiles = (await readdir(path.join(ROOT, 'lib'), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
  .map((entry) => `lib/${entry.name}`);
for (const target of libFiles) {
  assert.ok(syntaxTargets.includes(target), `syntax kapsamı eksik: ${target}`);
}

// Filtre yalnız daraltır, hedef uydurmaz.
const filtered = applyFilter(testTargets, ['voice']);
assert.ok(filtered.length > 0 && filtered.length < testTargets.length);
for (const target of filtered) assert.ok(target.includes('voice'));
assert.deepEqual(applyFilter(testTargets, []), testTargets);
assert.deepEqual(applyFilter(testTargets, ['__eslesme_yok__']), []);

// Kontrol zaman aşımı: varsayılan vardır, dar aralık dışındaki değer reddedilir.
assert.equal(resolveTimeoutMs(undefined), 120_000);
assert.equal(resolveTimeoutMs(''), 120_000);
assert.equal(resolveTimeoutMs('5000'), 5_000);
for (const invalid of ['0', '999', '600001', 'abc', '1.5', '-5000']) {
  assert.equal(resolveTimeoutMs(invalid), null, `geçersiz sayılmalıydı: ${invalid}`);
}

// package.json kapıyı keşif tabanlı runner'a devretmelidir; elle yazılmış
// `node scripts/test-*.mjs` zinciri kapsam kaybına geri dönüş demektir.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.ok(pkg.scripts.check.includes('scripts/run-checks.mjs'), 'check komutu runner kullanmıyor');
assert.equal(/node\s+scripts\/test-/.test(pkg.scripts.check), false, 'check komutu elle test listeliyor');
assert.equal(/node\s+--check\s+lib\//.test(pkg.scripts.check), false, 'check komutu elle syntax listeliyor');

console.log(`check coverage OK: ${testTargets.length} test, ${syntaxTargets.length} syntax hedefi keşfedildi`);
