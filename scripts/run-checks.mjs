#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Bu betik `package.json` içindeki elle bakımı yapılan uzun komut dizisinin
// yerine geçer. O yaklaşımda yeni bir `lib/` modülü veya `scripts/test-*.mjs`
// dosyası eklendiğinde komut dizisine eklenmesi unutulabiliyordu; sonuç olarak
// test dosyası repoda duruyor ama hiç çalışmıyordu. Burada dosyalar diskten
// keşfedilir, bu yüzden yeni bir modül veya test otomatik olarak kapıya dahil
// olur.
//
// Kullanım:
//   node scripts/run-checks.mjs                 tüm syntax + test kapısı
//   node scripts/run-checks.mjs --filter=voice  yalnız eşleşen testler
//   node scripts/run-checks.mjs --list          çalışacak adımları yazdır

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;
const SYNTAX_CONCURRENCY = Math.max(1, Math.min(8, availableParallelism()));

function parseArgs(argv) {
  const options = { filters: [], list: false };
  for (const arg of argv) {
    if (arg === '--list') options.list = true;
    else if (arg.startsWith('--filter=')) options.filters.push(...arg.slice('--filter='.length).split(',').filter(Boolean));
    else if (arg.startsWith('--')) throw new Error(`UNKNOWN_OPTION:${arg}`);
    else options.filters.push(arg);
  }
  return options;
}

async function listFiles(dir, extension) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

// Syntax kontrolü tüm çalıştırılabilir kaynaklara uygulanır: hiçbir modülün
// kapı dışında kalmaması için giriş listesi diskten türetilir.
async function collectSyntaxTargets() {
  const [lib, publicAssets, scripts] = await Promise.all([
    listFiles('lib', '.mjs'),
    listFiles('public', '.js'),
    listFiles('scripts', '.mjs')
  ]);
  return ['server.mjs', ...lib, ...publicAssets, ...scripts];
}

async function collectTests() {
  const scripts = await listFiles('scripts', '.mjs');
  return scripts.filter((file) => path.basename(file).startsWith('test-'));
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TEST_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ label, ok: false, output: `spawn failed: ${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ label, ok: false, output: `${output}\nzaman aşımı: ${TEST_TIMEOUT_MS} ms` });
      else resolve({ label, ok: code === 0, output });
    });
  });
}

function matchesFilter(file, filters) {
  return filters.length === 0 || filters.some((filter) => file.includes(filter));
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}\nkullanım: node scripts/run-checks.mjs [--filter=ad,ad] [--list]`);
  process.exit(1);
}
const syntaxTargets = await collectSyntaxTargets();
const tests = (await collectTests()).filter((file) => matchesFilter(file, options.filters));
const registryValidator = 'scripts/validate-agent-registry.mjs';
const runRegistryValidator = matchesFilter(registryValidator, options.filters);

if (options.list) {
  console.log(`syntax (${syntaxTargets.length}):\n  ${syntaxTargets.join('\n  ')}`);
  console.log(`test (${tests.length}):\n  ${tests.join('\n  ')}`);
  process.exit(0);
}

const failures = [];

// Syntax kapısı her zaman tam çalışır: bir modül parse edilemiyorsa testleri
// çalıştırmadan önce bilmek gerekir.
// `node --check` yan etkisizdir, bu yüzden sınırlı paralellikle çalıştırılır.
// Testler ise geçici dosya ve ortam değişkeni kullandığından sıralı kalır.
process.stdout.write(`syntax: ${syntaxTargets.length} dosya kontrol ediliyor... `);
const syntaxResults = [];
const queue = [...syntaxTargets];
await Promise.all(
  Array.from({ length: SYNTAX_CONCURRENCY }, async () => {
    for (let target = queue.shift(); target !== undefined; target = queue.shift()) {
      syntaxResults.push(await run(['--check', target], target));
    }
  })
);
syntaxResults.sort((a, b) => a.label.localeCompare(b.label));
const syntaxFailures = syntaxResults.filter((result) => !result.ok);
failures.push(...syntaxFailures);
console.log(syntaxFailures.length === 0 ? 'OK' : `${syntaxFailures.length} HATA`);

if (syntaxFailures.length > 0) {
  for (const failure of syntaxFailures) console.error(`\n--- ${failure.label} ---\n${failure.output.trim()}`);
  console.error(`\nsyntax kapısı başarısız: ${syntaxFailures.length} dosya`);
  process.exit(1);
}

if (runRegistryValidator) {
  const result = await run([registryValidator], registryValidator);
  if (!result.ok) failures.push(result);
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${registryValidator}`);
}

for (const test of tests) {
  const result = await run([test], test);
  if (!result.ok) failures.push(result);
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${test}`);
}

for (const failure of failures) {
  console.error(`\n--- ${failure.label} ---\n${failure.output.trim()}`);
}

const executed = tests.length + (runRegistryValidator ? 1 : 0);
console.log(`\n${syntaxTargets.length} dosya syntax kontrolü, ${executed} doğrulama çalıştırıldı, ${failures.length} başarısız`);

if (tests.length === 0 && options.filters.length > 0) {
  console.error(`filtre hiçbir testle eşleşmedi: ${options.filters.join(', ')}`);
  process.exit(1);
}

process.exit(failures.length === 0 ? 0 : 1);
