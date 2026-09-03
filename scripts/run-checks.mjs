#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Kaynak dosyaları otomatik keşfeder ve `node --check` ile sözdizimi doğrular,
// ardından `scripts/test-*.mjs` altındaki tüm testleri sırayla çalıştırır.
// Keşif otomatik olduğu için yeni bir test dosyası kapıya elle eklenmeyi
// beklemez; sessizce kapsam dışında kalamaz.
//
// Kullanım:
//   node scripts/run-checks.mjs            # tüm testler
//   node scripts/run-checks.mjs oauth      # adı "oauth" içeren testler
//   node scripts/run-checks.mjs --list     # çalıştırılacak testleri listele

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SYNTAX_DIRECTORIES = [
  { dir: '.', extensions: ['.mjs'] },
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];
const TEST_PREFIX = 'test-';
const TEST_TIMEOUT_MS = 120_000;

async function listFiles(dir, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.posix.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, ok: false, output: `${output}\nTIMEOUT after ${TEST_TIMEOUT_MS} ms` });
    }, TEST_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) resolve({ label, ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) resolve({ label, ok: code === 0, output });
    });
  });
}

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const filters = args.filter((arg) => !arg.startsWith('--'));

const sourceFiles = (
  await Promise.all(SYNTAX_DIRECTORIES.map(({ dir, extensions }) => listFiles(dir, extensions)))
).flat();

const testFiles = sourceFiles.filter(
  (file) => file.startsWith('scripts/') && path.basename(file).startsWith(TEST_PREFIX)
);
const selectedTests = filters.length
  ? testFiles.filter((file) => filters.some((filter) => file.includes(filter)))
  : testFiles;

if (listOnly) {
  console.log(selectedTests.join('\n'));
  process.exit(0);
}

if (!selectedTests.length) {
  console.error(filters.length ? `Filtreyle eşleşen test yok: ${filters.join(', ')}` : 'Test dosyası bulunamadı.');
  process.exit(1);
}

const failures = [];

console.log(`Sözdizimi kontrolü: ${sourceFiles.length} dosya`);
const syntaxResults = await Promise.all(
  sourceFiles.map((file) => run(['--check', file], `syntax ${file}`))
);
for (const result of syntaxResults) {
  if (!result.ok) {
    failures.push(result);
    console.error(`FAIL ${result.label}`);
  }
}
if (!failures.length) console.log('Sözdizimi kontrolü tamam.');

const gateScripts = ['scripts/validate-agent-registry.mjs'];
const suite = [...gateScripts, ...selectedTests];
console.log(`Testler: ${suite.length} dosya`);

for (const file of suite) {
  const result = await run([file], file);
  if (result.ok) {
    console.log(`PASS ${file}`);
  } else {
    failures.push(result);
    console.error(`FAIL ${file}`);
  }
}

if (failures.length) {
  console.error(`\n${failures.length} kontrol başarısız:`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.label} ---\n${failure.output.trim()}`);
  }
  process.exit(1);
}

console.log(`\nTüm kontroller geçti: ${sourceFiles.length} sözdizimi, ${suite.length} test.`);
