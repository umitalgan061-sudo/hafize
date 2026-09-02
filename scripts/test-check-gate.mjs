import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIPPED_TESTS, collectTargets } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { syntax, runnable } = await collectTargets();

async function names(dir, extension) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => `${dir}/${entry.name}`);
}

// Kapı, diskteki her kaynak ve test dosyasını kapsamalıdır. Bu testin amacı,
// yeni bir modülün veya testin kapıya girmeden repoya eklenmesini engellemektir.
const [libFiles, publicFiles, scriptFiles] = await Promise.all([
  names('lib', '.mjs'),
  names('public', '.js'),
  names('scripts', '.mjs')
]);

for (const file of ['server.mjs', ...libFiles, ...publicFiles, ...scriptFiles]) {
  assert.ok(syntax.includes(file), `syntax kapsamı dışında: ${file}`);
}

const testFiles = scriptFiles.filter((file) => path.basename(file).startsWith('test-'));
const validatorFiles = scriptFiles.filter((file) => path.basename(file).startsWith('validate-'));
assert.ok(testFiles.length >= 80, `beklenenden az test dosyası bulundu: ${testFiles.length}`);
for (const file of [...testFiles, ...validatorFiles]) {
  assert.ok(runnable.includes(file), `kapı bu dosyayı çalıştırmıyor: ${file}`);
}

// Doğrulayıcılar testlerden önce çalışır: registry bozuksa ajan testlerinin
// çıktısı yanıltıcı olur.
for (const validator of validatorFiles) {
  for (const test of testFiles) {
    assert.ok(runnable.indexOf(validator) < runnable.indexOf(test), `${validator} ${test} testinden sonra çalışıyor`);
  }
}

// Runner kendini test olarak çalıştırmaz.
assert.equal(runnable.includes('scripts/run-checks.mjs'), false);
assert.equal(syntax.includes('scripts/run-checks.mjs'), true);

// Dışlanan test yoktur; eklenirse gerekçesi zorunludur.
for (const [file, reason] of SKIPPED_TESTS) {
  assert.equal(typeof reason, 'string');
  assert.ok(reason.trim().length >= 10, `${file} için yeterli gerekçe yok`);
  assert.ok(testFiles.includes(`scripts/${file}`), `dışlama listesinde olmayan dosya: ${file}`);
}

// `npm run check` tek kapıyı çağırır; paralel/tekrarlı bir doğrulama zinciri yoktur.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(pkg.scripts.precheck, undefined);

console.log(`Check gate OK: ${syntax.length} syntax hedefi, ${runnable.length} çalıştırılabilir kontrol, ${SKIPPED_TESTS.size} dışlama`);
