import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-checks.mjs');

async function runner(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [RUNNER, ...args], { cwd: ROOT });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error) {
    return { code: error.code ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

async function listFiles(dir, extension, prefix = '') {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension) && entry.name.startsWith(prefix))
    .map((entry) => `${dir}/${entry.name}`);
}

// Kapının varlık nedeni: hiçbir test dosyası ve hiçbir çalıştırılabilir modül
// keşif dışında kalmamalı. Bu invariant `package.json` içinde elle bakımı
// yapılan komut dizisinde bozulmuş ve testlerin bir kısmı sessizce hiç
// çalışmamıştı.
const { code: listCode, output: listed } = await runner(['--list']);
assert.equal(listCode, 0);

const testFiles = await listFiles('scripts', '.mjs', 'test-');
assert.ok(testFiles.length >= 80, `beklenenden az test dosyası: ${testFiles.length}`);
for (const file of testFiles) {
  assert.ok(listed.includes(file), `test kapı dışında kaldı: ${file}`);
}

const syntaxTargets = [
  'server.mjs',
  ...(await listFiles('lib', '.mjs')),
  ...(await listFiles('public', '.js')),
  ...(await listFiles('scripts', '.mjs'))
];
for (const file of syntaxTargets) {
  assert.ok(listed.includes(file), `modül syntax kapısı dışında kaldı: ${file}`);
}

// Bu test dosyasının kendisi de keşfedilmeli; aksi halde invariant kendini
// doğrulayamaz.
assert.ok(listed.includes('scripts/test-run-checks.mjs'));

// run-checks.mjs bir test değildir, test olarak çalıştırılmamalıdır; aksi
// halde kapı kendini sonsuz döngüde çağırır.
assert.equal(/test \(\d+\):[\s\S]*scripts\/run-checks\.mjs/.test(listed), false);

// Hiçbir testle eşleşmeyen filtre sessizce başarılı sayılmamalıdır: bu, yanlış
// yazılmış bir filtrenin "her şey yeşil" gibi görünmesini engeller.
const noMatch = await runner(['--filter=hafize-eslesmeyen-filtre']);
assert.equal(noMatch.code, 1);
assert.match(noMatch.output, /filtre hiçbir testle eşleşmedi/);

// Yalnız registry doğrulayıcısıyla eşleşen bir filtre gerçek bir doğrulama
// çalıştırır; "eşleşme yok" olarak raporlanmamalıdır.
const registryOnly = await runner(['--filter=validate-agent-registry']);
assert.equal(registryOnly.code, 0);
assert.doesNotMatch(registryOnly.output, /filtre hiçbir testle eşleşmedi/);
assert.match(registryOnly.output, /1 doğrulama çalıştırıldı/);

// Bilinmeyen seçenek sessizce yok sayılmaz.
const unknownOption = await runner(['--bilinmeyen']);
assert.equal(unknownOption.code, 1);
assert.match(unknownOption.output, /UNKNOWN_OPTION/);

// Keşfin eksiksiz olması tek başına yetmez: bir `lib/` modülü hiçbir test
// tarafından import edilmiyorsa kapı onu yalnız syntax düzeyinde görür.
// Bu invariant, davranışı doğrulanmayan yeni bir modülün sessizce eklenmesini
// engeller.
const libModules = await listFiles('lib', '.mjs');
const testSources = await Promise.all(testFiles.map((file) => readFile(path.join(ROOT, file), 'utf8')));
const importedByTests = testSources.join('\n');
const untested = libModules.filter((module) => !importedByTests.includes(module.replace('lib/', '')));
assert.deepEqual(untested, [], `testi olmayan lib modülleri: ${untested.join(', ')}`);

console.log(
  `run-checks OK: ${testFiles.length} test ve ${syntaxTargets.length} modül keşfediliyor, ` +
    `${libModules.length} lib modülünün tamamı en az bir testten import ediliyor, filtre/seçenek hataları exit 1`
);
