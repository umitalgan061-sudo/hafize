// Hafize doğrulama kapısı.
//
// Bu betik test dosyalarını elle listelemek yerine diskten keşfeder. Böylece
// yeni eklenen bir `scripts/test-*.mjs` dosyası kapıya bağlanmayı unutulduğu
// için sessizce çalışmadan kalamaz.
//
// Kullanım:
//   node scripts/run-all-tests.mjs            → tüm testler
//   node scripts/run-all-tests.mjs voice ui   → adı filtreyle eşleşen testler

import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_DIRS = [
  { dir: '.', match: (name) => name === 'server.mjs' },
  { dir: 'lib', match: (name) => name.endsWith('.mjs') },
  { dir: 'scripts', match: (name) => name.endsWith('.mjs') },
  { dir: 'public', match: (name) => name.endsWith('.js') }
];
const TEST_TIMEOUT_MS = 120_000;

async function listFiles(dir, match) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && match(entry.name))
    .map((entry) => path.posix.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TEST_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ label, ok: false, output: String(error?.message ?? error) });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const reason = signal === 'SIGKILL' ? `zaman aşımı (${TEST_TIMEOUT_MS} ms)` : `çıkış kodu ${code}`;
      resolve({ label, ok: code === 0 && !signal, output, reason });
    });
  });
}

const filters = process.argv.slice(2).filter((value) => !value.startsWith('-'));
const matchesFilter = (file) => filters.length === 0 || filters.some((needle) => file.includes(needle));

const failures = [];

// 1. Sözdizimi kapısı — çalıştırmadan yalnızca ayrıştırma.
const syntaxFiles = (await Promise.all(SYNTAX_DIRS.map(({ dir, match }) => listFiles(dir, match)))).flat();
const syntaxResults = await Promise.all(syntaxFiles.map((file) => run(['--check', file], file)));
for (const result of syntaxResults) {
  if (!result.ok) failures.push({ ...result, kind: 'syntax' });
}
console.log(`Sözdizimi: ${syntaxFiles.length - syntaxResults.filter((r) => !r.ok).length}/${syntaxFiles.length} dosya geçti`);

// 2. Test kapısı — her test kendi sürecinde, sıralı ve yalıtılmış.
// `validate-*` doğrulayıcıları da test gibi çalıştırılır.
const testFiles = (await listFiles(
  'scripts',
  (name) => (name.startsWith('test-') || name.startsWith('validate-')) && name.endsWith('.mjs')
)).filter(matchesFilter);
let passed = 0;
for (const file of testFiles) {
  const result = await run([file], file);
  if (result.ok) {
    passed += 1;
    console.log(`  ✓ ${file}`);
  } else {
    failures.push({ ...result, kind: 'test' });
    console.log(`  ✗ ${file} (${result.reason})`);
  }
}
console.log(`Testler: ${passed}/${testFiles.length} betik geçti`);

if (failures.length > 0) {
  console.error(`\n${failures.length} başarısızlık:\n`);
  for (const failure of failures) {
    console.error(`--- ${failure.kind}: ${failure.label} ---`);
    console.error(failure.output.trim().split('\n').slice(-25).join('\n'));
    console.error('');
  }
  process.exit(1);
}

if (testFiles.length === 0 && filters.length > 0) {
  console.error(`Filtre hiçbir teste uymadı: ${filters.join(', ')}`);
  process.exit(1);
}

console.log('\nTüm doğrulamalar geçti.');
