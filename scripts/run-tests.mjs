#!/usr/bin/env node
// Hafize test gate.
//
// Amaç: yeni bir test dosyası eklendiğinde onu `package.json` içindeki uzun
// komut zincirine elle eklemeyi unutmak mümkün olmasın. Bu koşucu
// `scripts/test-*.mjs` dosyalarını ve doğrulanacak kaynakları diskten keşfeder,
// önce sözdizimi (`node --check`) kontrolü yapar, sonra her testi ayrı bir alt
// süreçte çalıştırır ve tek bir özet üretir.
//
// Kullanım:
//   node scripts/run-tests.mjs            # tüm testler
//   node scripts/run-tests.mjs gmail      # adı 'gmail' içeren testler
//   node scripts/run-tests.mjs --syntax   # yalnız sözdizimi kontrolü

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');

// Sözdizimi kontrolü yapılacak kaynak dizinleri. `public/` içinde yalnız
// tarayıcı script'leri vardır; stil ve görsel dosyaları atlanır.
const SYNTAX_DIRS = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];

// Testler için varsayılan süre sınırı. Ağ veya canlı servis bekleyen bir test
// takılırsa gate sonsuza kadar asılı kalmaz.
const TEST_TIMEOUT_MS = 120_000;

async function listFiles(dir, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.posix.join(dir, entry.name))
    .sort();
}

async function collectSyntaxTargets() {
  const groups = await Promise.all(SYNTAX_DIRS.map(({ dir, extensions }) => listFiles(dir, extensions)));
  return groups.flat();
}

// `validate-*` script'leri de gate'in parçasıdır (ör. agent registry şeması);
// test gibi sıfır çıkış kodu ile başarı bildirirler.
function isGateScript(name) {
  return name.startsWith('test-') || name.startsWith('validate-');
}

async function collectTests(filters) {
  const files = await listFiles('scripts', ['.mjs']);
  const tests = files.filter((file) => isGateScript(path.basename(file)));
  if (!filters.length) return tests;
  return tests.filter((file) => filters.some((filter) => file.includes(filter)));
}

function run(command, args, { timeoutMs = TEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: String(error?.message ?? error), timedOut: false });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: !timedOut && code === 0, stdout, stderr, timedOut });
    });
  });
}

function lastMeaningfulLine(text) {
  const lines = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

function printFailure(file, result) {
  console.error(`\n--- ${file} ---`);
  if (result.timedOut) console.error(`(zaman aşımı: ${TEST_TIMEOUT_MS} ms)`);
  const output = `${result.stdout}${result.stderr}`.trimEnd();
  console.error(output || '(çıktı yok)');
}

async function runSyntaxGate() {
  const targets = await collectSyntaxTargets();
  const failures = [];
  for (const file of targets) {
    const result = await run(process.execPath, ['--check', file], { timeoutMs: 30_000 });
    if (!result.ok) {
      failures.push(file);
      printFailure(file, result);
    }
  }
  console.log(`sözdizimi: ${targets.length - failures.length}/${targets.length} dosya geçti`);
  return failures;
}

async function runTestGate(filters) {
  const tests = await collectTests(filters);
  if (!tests.length) {
    console.error(filters.length ? `eşleşen test yok: ${filters.join(', ')}` : 'hiç test bulunamadı');
    return { tests, failures: tests.length ? [] : ['<no-tests>'] };
  }

  const failures = [];
  for (const file of tests) {
    const result = await run(process.execPath, [file]);
    const name = path.basename(file);
    if (result.ok) {
      const summary = lastMeaningfulLine(result.stdout);
      console.log(`  ok  ${name}${summary ? ` — ${summary}` : ''}`);
    } else {
      failures.push(file);
      console.log(`FAIL  ${name}`);
      printFailure(file, result);
    }
  }
  console.log(`\ntest: ${tests.length - failures.length}/${tests.length} dosya geçti`);
  return { tests, failures };
}

const args = process.argv.slice(2);
const syntaxOnly = args.includes('--syntax');
const testsOnly = args.includes('--tests');
const filters = args.filter((arg) => !arg.startsWith('--'));

let failed = false;

if (!testsOnly) {
  const syntaxFailures = await runSyntaxGate();
  if (syntaxFailures.length) failed = true;
}

if (!syntaxOnly && !failed) {
  const { failures } = await runTestGate(filters);
  if (failures.length) failed = true;
}

if (failed) {
  console.error('\nHafize test gate BAŞARISIZ');
  process.exit(1);
}

console.log('\nHafize test gate geçti');
