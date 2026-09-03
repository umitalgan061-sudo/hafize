import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-checks.mjs');

// Bu test runner'ı hiçbir zaman tam kapı modunda çalıştırmaz; yalnızca hiçbir
// alt süreç başlatmayan `--list` ve argüman doğrulama yolları kullanılır.
async function runner(args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [RUNNER, ...args], { cwd: ROOT });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

async function listFiles(directory, extensions) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${directory}/${entry.name}`);
}

const listed = await runner(['--list']);
assert.equal(listed.code, 0);
const names = listed.stdout.split('\n').map((line) => line.trim()).filter(Boolean);

// Diskteki her test dosyası kapının içinde olmalı: bir testin zincire eklenmeyi
// unutulduğu için sessizce çalışmaması bu depoda yaşanmış gerçek bir sorundur.
const testFiles = (await listFiles('scripts', ['.mjs'])).filter((file) =>
  path.basename(file).startsWith('test-')
);
assert.ok(testFiles.length > 0);
for (const file of testFiles) {
  assert.ok(names.includes(file), `test not discovered by the check gate: ${file}`);
}

// Her kaynak dosyası için bir syntax kontrolü üretilmelidir.
const sourceFiles = [
  'server.mjs',
  ...(await listFiles('lib', ['.mjs'])),
  ...(await listFiles('public', ['.js'])),
  ...(await listFiles('scripts', ['.mjs']))
];
for (const file of sourceFiles) {
  assert.ok(names.includes(`syntax ${file}`), `source not syntax-checked by the gate: ${file}`);
}

// Kayıt defteri doğrulaması gibi test olmayan kontroller de kapının parçasıdır.
assert.ok(names.includes('scripts/validate-agent-registry.mjs'));

// Bu testin kendisi de keşfedilmeli; aksi halde kapı kendi bekçisini çalıştırmaz.
assert.ok(names.includes('scripts/test-check-runner.mjs'));

// Liste kararlı olmalı ki çıktı diff'leri gürültü üretmesin.
const relisted = await runner(['--list']);
assert.equal(relisted.stdout, listed.stdout);

// --only yalnızca eşleşen kontrolleri bırakır.
const filtered = await runner(['--list', '--only=test-tool-runtime']);
assert.equal(filtered.code, 0);
assert.deepEqual(
  filtered.stdout.split('\n').map((line) => line.trim()).filter(Boolean),
  ['syntax scripts/test-tool-runtime.mjs', 'scripts/test-tool-runtime.mjs']
);

// Hiçbir şeye uymayan bir filtre sessizce "yeşil" sayılmaz.
const emptyFilter = await runner(['--list', '--only=no-such-check-exists']);
assert.equal(emptyFilter.code, 1);
assert.match(emptyFilter.stderr, /No checks matched/);

// Hatalı argümanlar stack trace değil, kullanım mesajı üretir.
const badArgument = await runner(['--bogus']);
assert.equal(badArgument.code, 2);
assert.match(badArgument.stderr, /UNKNOWN_ARGUMENT/);
assert.match(badArgument.stderr, /Usage: node scripts\/run-checks\.mjs/);

const badTimeout = await runner(['--timeout=5']);
assert.equal(badTimeout.code, 2);
assert.match(badTimeout.stderr, /INVALID_TIMEOUT/);

console.log(`Check runner OK: ${names.length} checks discovered, every test and source file is inside the gate`);
