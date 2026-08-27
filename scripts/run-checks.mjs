// Hafize kalite kapısı.
//
// Kaynak ve test dosyalarını diskten otomatik keşfeder, ilk hatada durmaz ve
// sonunda başarısız olan her adımı tek bir özet halinde raporlar.
//
// Elle bakımı yapılan uzun `&&` zinciri iki somut soruna yol açıyordu:
//   1. Yeni test dosyaları zincire eklenmeyi unutulunca sessizce hiç çalışmıyordu.
//   2. Zincirin başındaki tek bir kırmızı test, arkasındaki tüm testleri gizliyordu.
// Otomatik keşif (1), "hepsini çalıştır + topluca raporla" (2) sorununu kapatır.
//
// Kullanım:
//   node scripts/run-checks.mjs                    → tüm kapı
//   node scripts/run-checks.mjs --filter=voice,ui  → yalnızca eşleşen adımlar
//   node scripts/run-checks.mjs --list             → çalıştırmadan planı yazdır

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(dir, predicate) {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function parseFilters(argv) {
  const raw = argv.find((arg) => arg.startsWith('--filter='));
  if (!raw) return [];
  return raw
    .slice('--filter='.length)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const argv = process.argv.slice(2);
const filters = parseFilters(argv);
const listOnly = argv.includes('--list');
const matches = (file) => filters.length === 0 || filters.some((needle) => file.includes(needle));

// Syntax kapısı: her çalıştırılabilir kaynak `node --check` ile taranır.
const sources = [
  'server.mjs',
  ...listFiles('lib', (name) => name.endsWith('.mjs')),
  ...listFiles('public', (name) => name.endsWith('.js')),
  ...listFiles('scripts', (name) => name.endsWith('.mjs'))
].filter(matches);

// Test kapısı: registry doğrulaması + `scripts/test-*.mjs` altındaki her dosya.
const tests = [
  'scripts/validate-agent-registry.mjs',
  ...listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'))
].filter(matches);

if (filters.length && sources.length === 0 && tests.length === 0) {
  console.error(`Hiçbir adım "--filter=${filters.join(',')}" ile eşleşmedi.`);
  process.exit(1);
}

if (listOnly) {
  console.log(`syntax (${sources.length}):`);
  for (const file of sources) console.log(`  ${file}`);
  console.log(`test (${tests.length}):`);
  for (const file of tests) console.log(`  ${file}`);
  process.exit(0);
}

const failures = [];

function run(file, nodeArgs) {
  const result = spawnSync(process.execPath, [...nodeArgs, file], { cwd: ROOT, encoding: 'utf8' });
  if (result.error) {
    failures.push({ file, output: String(result.error.message) });
    return false;
  }
  if (result.status === 0) return true;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  failures.push({ file, output: output || `exit code ${result.status}` });
  return false;
}

const syntaxFailures = sources.filter((file) => !run(file, ['--check'])).length;
console.log(`syntax: ${sources.length - syntaxFailures}/${sources.length} geçti`);

let passed = 0;
for (const file of tests) {
  if (run(file, [])) {
    passed += 1;
  } else {
    console.log(`  ✗ ${file}`);
  }
}
console.log(`test: ${passed}/${tests.length} geçti`);

if (failures.length === 0) {
  console.log(`\nKalite kapısı yeşil — ${sources.length} kaynak, ${tests.length} test.`);
  process.exit(0);
}

console.error(`\n${failures.length} adım başarısız:`);
for (const { file, output } of failures) {
  console.error(`\n──────── ${file}`);
  console.error(output);
}
process.exit(1);
