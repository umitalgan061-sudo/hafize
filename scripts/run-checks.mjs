#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Önceki kapı, package.json içinde elle bakımı yapılan tek satırlık dev bir
// komut zinciriydi. Yeni bir test dosyası eklendiğinde zincire eklenmezse test
// sessizce hiç çalışmıyordu; bu yolla 85 test dosyasının 33'ü kapının dışında
// kalmıştı. Bu runner test ve kaynak dosyalarını diskten keşfeder, böylece
// kapsam listesi kod ile birlikte kendiliğinden güncel kalır.
//
// Kullanım:
//   node scripts/run-checks.mjs                 # tüm sözdizimi + test kapsamı
//   node scripts/run-checks.mjs --only=voice-   # yalnız eşleşen testler
//   node scripts/run-checks.mjs --list          # çalıştırmadan kapsamı yazdır
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 180_000;

// Sözdizimi denetimi yapılacak kaynak kökleri. `public/` tarayıcı tarafıdır ama
// `node --check` sözdizimi hatalarını yine de yakalar.
const SYNTAX_ROOTS = [
  { dir: '.', extensions: ['.mjs'], recurse: false },
  { dir: 'lib', extensions: ['.mjs'], recurse: false },
  { dir: 'scripts', extensions: ['.mjs'], recurse: false },
  { dir: 'public', extensions: ['.js'], recurse: false }
];

function parseArgs(argv) {
  const only = [];
  let list = false;
  for (const arg of argv) {
    if (arg === '--list') list = true;
    else if (arg.startsWith('--only=')) only.push(...arg.slice('--only='.length).split(',').filter(Boolean));
    else throw new Error(`Bilinmeyen argüman: ${arg}`);
  }
  return { only, list };
}

function listFiles({ dir, extensions }) {
  const absolute = path.join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.relative(ROOT, path.join(absolute, entry.name)))
    .sort();
}

function discoverSyntaxTargets() {
  const seen = new Set();
  for (const root of SYNTAX_ROOTS) for (const file of listFiles(root)) seen.add(file);
  return [...seen].sort();
}

function discoverTests(only) {
  const tests = listFiles({ dir: 'scripts', extensions: ['.mjs'] })
    .filter((file) => path.basename(file).startsWith('test-'));
  if (!only.length) return tests;
  return tests.filter((file) => only.some((needle) => path.basename(file).includes(needle)));
}

function run(label, args, { capture }) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    timeout: TEST_TIMEOUT_MS,
    encoding: 'utf8'
  });
  const durationMs = Date.now() - started;
  const timedOut = result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM';
  const ok = !timedOut && result.status === 0;
  const output = capture ? `${result.stdout ?? ''}${result.stderr ?? ''}` : '';
  return { label, ok, timedOut, durationMs, output, status: result.status };
}

const { only, list } = parseArgs(process.argv.slice(2));
const syntaxTargets = only.length ? [] : discoverSyntaxTargets();
const tests = discoverTests(only);

if (!tests.length) {
  console.error(only.length ? `Hiçbir test eşleşmedi: --only=${only.join(',')}` : 'scripts/ altında test bulunamadı.');
  process.exit(1);
}

if (list) {
  console.log(`Sözdizimi hedefi: ${syntaxTargets.length}`);
  for (const target of syntaxTargets) console.log(`  check  ${target}`);
  console.log(`Test: ${tests.length}`);
  for (const test of tests) console.log(`  test   ${test}`);
  process.exit(0);
}

const failures = [];

if (syntaxTargets.length) {
  console.log(`# sözdizimi denetimi (${syntaxTargets.length} dosya)`);
  for (const target of syntaxTargets) {
    const result = run(target, ['--check', target], { capture: true });
    if (!result.ok) {
      failures.push(result);
      console.error(`FAIL  --check ${target}`);
      if (result.output.trim()) console.error(result.output.trim());
    }
  }
  if (!failures.length) console.log(`ok    ${syntaxTargets.length} dosya sözdizimi geçti`);
}

console.log(`\n# doğrulama betikleri (${tests.length} dosya)`);
const registryValidator = 'scripts/validate-agent-registry.mjs';
for (const script of [registryValidator, ...tests]) {
  const result = run(script, [script], { capture: true });
  if (result.ok) {
    console.log(`ok    ${script} (${result.durationMs}ms)`);
    continue;
  }
  failures.push(result);
  console.error(`FAIL  ${script}${result.timedOut ? ' (zaman aşımı)' : ''}`);
  if (result.output.trim()) console.error(result.output.trim());
}

console.log('');
if (failures.length) {
  console.error(`Doğrulama kapısı başarısız: ${failures.length} hata`);
  for (const failure of failures) console.error(`  - ${failure.label}`);
  process.exit(1);
}
console.log(`Doğrulama kapısı geçti: ${syntaxTargets.length} sözdizimi + ${tests.length + 1} betik`);
