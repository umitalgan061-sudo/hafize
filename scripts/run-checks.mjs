// Hafize check gate.
//
// Elle bakımı yapılan tek satırlık npm script'i yerine, kaynak ve test
// dosyalarını diskten keşfeder. Yeni bir lib/ modülü veya scripts/test-*.mjs
// dosyası eklendiğinde gate'i güncellemek gerekmez; dosya zaten kapsama girer.
// Daha önce 33 test dosyası hiçbir zaman çalıştırılmıyordu ve katalog kayması
// bu yüzden fark edilmedi.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// HAFIZE_CHECK_ROOT yalnız gate'in kendi testi için vardır; üretim yolunda
// depo kökü her zaman bu dosyanın konumundan türetilir.
const repoRoot = typeof process.env.HAFIZE_CHECK_ROOT === 'string' && process.env.HAFIZE_CHECK_ROOT.trim()
  ? path.resolve(process.env.HAFIZE_CHECK_ROOT.trim())
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Sözdizimi kontrolü yapılacak kaynak dizinleri ve uzantıları.
const SYNTAX_TARGETS = [
  { dir: '.', extensions: ['.mjs'], recursive: false },
  { dir: 'lib', extensions: ['.mjs'], recursive: false },
  { dir: 'scripts', extensions: ['.mjs'], recursive: false },
  { dir: 'public', extensions: ['.js'], recursive: false }
];

// Test dosyası olmayan yardımcı script'ler ayrıca çalıştırılır.
const EXTRA_RUNNERS = ['scripts/validate-agent-registry.mjs'];

const TEST_PREFIX = 'test-';
const TEST_SUFFIX = '.mjs';

async function listFiles({ dir, extensions }) {
  const absolute = path.join(repoRoot, dir);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.relative(repoRoot, path.join(absolute, entry.name)))
    .sort();
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: String(error?.message || error) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function report(failures, label) {
  if (!failures.length) return;
  console.error(`\n${label} başarısız (${failures.length}):`);
  for (const failure of failures) {
    console.error(`\n── ${failure.file}`);
    const output = `${failure.stdout}${failure.stderr}`.trim();
    console.error(output || '(çıktı yok)');
  }
}

const syntaxFiles = (await Promise.all(SYNTAX_TARGETS.map(listFiles))).flat();
const syntaxFailures = [];
for (const file of syntaxFiles) {
  const result = await run(['--check', file]);
  if (result.code !== 0) syntaxFailures.push({ file, ...result });
}
console.log(`Sözdizimi kontrolü: ${syntaxFiles.length - syntaxFailures.length}/${syntaxFiles.length} dosya tamam`);
report(syntaxFailures, 'Sözdizimi kontrolü');
if (syntaxFailures.length) process.exit(1);

const testFiles = (await listFiles({ dir: 'scripts', extensions: [TEST_SUFFIX] }))
  .filter((file) => path.basename(file).startsWith(TEST_PREFIX));
if (!testFiles.length) {
  console.error('Hiç test dosyası bulunamadı; gate keşfi bozulmuş olabilir.');
  process.exit(1);
}

const runnable = [...EXTRA_RUNNERS, ...testFiles];
const failures = [];
for (const file of runnable) {
  const result = await run([file]);
  if (result.code === 0) {
    const lastLine = result.stdout.trim().split('\n').filter(Boolean).pop() || 'tamam';
    console.log(`  ok  ${file} — ${lastLine}`);
  } else {
    failures.push({ file, ...result });
    console.log(`  FAIL ${file}`);
  }
}

report(failures, 'Testler');
console.log(`\nTest sonucu: ${runnable.length - failures.length}/${runnable.length} tamam`);
process.exit(failures.length ? 1 : 0);
