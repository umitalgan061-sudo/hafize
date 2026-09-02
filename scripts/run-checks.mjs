#!/usr/bin/env node
// Hafize kalite kapısı.
//
// Bu runner test listesini elle tutulan bir komut dizisinden değil, dosya
// sisteminden keşfeder. Daha önce kapı `package.json` içinde tek satırlık dev
// bir zincirdi; yeni eklenen testler zincire yazılmadığı için sessizce
// çalışmıyordu ve ilk hata sonrası kalan tüm testler atlanıyordu.
//
// Sözleşme:
//   - `scripts/test-*.mjs` kalıbındaki her dosya bir testtir ve otomatik çalışır.
//   - Kaynak dosyaların tamamı `node --check` ile sözdizimi taramasından geçer.
//   - Bir test başarısız olsa bile kalan testler çalışır; tüm hatalar birlikte raporlanır.
//   - Ağ/servis gerektiren testler kendi içinde env guard ile atlanır (bkz.
//     `scripts/test-redis-schedule-lease-live.mjs`), kapıdan çıkarılmaz.
//
// Kullanım:
//   node scripts/run-checks.mjs              # sözdizimi + tüm testler
//   node scripts/run-checks.mjs gmail canva  # yalnız adı eşleşen testler
//   node scripts/run-checks.mjs --syntax-only
//   node scripts/run-checks.mjs --tests-only
//   node scripts/run-checks.mjs --list           # keşfedilen testleri yalnız listele
//   node scripts/run-checks.mjs --root <dizin>   # başka bir ağaç üzerinde çalış (test amaçlı)

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_TARGETS = [
  { dir: '.', pattern: /^server\.mjs$/ },
  { dir: 'lib', pattern: /\.mjs$/ },
  { dir: 'public', pattern: /\.js$/ },
  { dir: 'scripts', pattern: /\.mjs$/ }
];
// Testlerden önce çalışan, test olmayan doğrulayıcılar.
const VALIDATORS = ['scripts/validate-agent-registry.mjs'];
const TEST_PATTERN = /^test-.*\.mjs$/;
const SYNTAX_CONCURRENCY = 8;
const TEST_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const filters = [];
  let syntax = true;
  let tests = true;
  let list = false;
  let root = DEFAULT_ROOT;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--syntax-only') tests = false;
    else if (arg === '--tests-only') syntax = false;
    else if (arg === '--list') list = true;
    else if (arg === '--root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error('MISSING_ROOT_VALUE');
      root = path.resolve(value);
      index += 1;
    } else if (arg.startsWith('-')) throw new Error(`UNKNOWN_OPTION:${arg}`);
    else filters.push(arg);
  }
  return { filters, syntax, tests, list, root };
}

async function listFiles(root, { dir, pattern }) {
  const absolute = path.join(root, dir);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    // Ağaçta olmayan bir dizin kapıyı düşürmez; yalnız katkı sağlamaz.
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.relative(root, path.join(absolute, entry.name)))
    .sort();
}

function run(root, args, { timeoutMs = TEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    const capture = (chunk) => {
      // Çıktı sınırsız büyümesin; hata ayıklama için son kısım yeterli.
      output = `${output}${chunk}`.slice(-64_000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ ok: false, output: `${output}\nTIMEOUT after ${timeoutMs}ms` });
      else resolve({ ok: code === 0, output });
    });
  });
}

async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function formatFailure({ name, output }) {
  const trimmed = output.trim();
  const lines = trimmed ? trimmed.split('\n').slice(-25) : ['(çıktı yok)'];
  return `\n--- ${name} ---\n${lines.join('\n')}`;
}

async function syntaxPass(root) {
  const groups = await Promise.all(SYNTAX_TARGETS.map((target) => listFiles(root, target)));
  const files = groups.flat();
  const results = await mapWithLimit(files, SYNTAX_CONCURRENCY, async (file) => ({
    name: file,
    ...(await run(root, ['--check', path.join(root, file)], { timeoutMs: 30_000 }))
  }));
  const failures = results.filter((result) => !result.ok);
  if (failures.length) {
    console.log(`syntax: ${files.length - failures.length}/${files.length} ok, ${failures.length} FAILED`);
  } else {
    console.log(`syntax: ${files.length}/${files.length} dosya temiz`);
  }
  return failures;
}

async function selectTests(root, filters) {
  const discovered = await listFiles(root, { dir: 'scripts', pattern: TEST_PATTERN });
  const validators = [];
  for (const validator of VALIDATORS) {
    const [dir, name] = [path.dirname(validator), path.basename(validator)];
    const present = await listFiles(root, { dir, pattern: new RegExp(`^${name.replace(/\./g, '\\.')}$`) });
    validators.push(...present);
  }
  const selected = [...validators, ...discovered].filter(
    (file) => !filters.length || filters.some((filter) => file.includes(filter))
  );
  if (!selected.length) {
    throw new Error(`hiçbir test filtreyle eşleşmedi: ${filters.join(', ')}`);
  }
  return selected;
}

async function testPass(root, filters) {
  const selected = await selectTests(root, filters);
  const failures = [];
  let passed = 0;
  for (const file of selected) {
    const result = await run(root, [path.join(root, file)]);
    if (result.ok) {
      passed += 1;
      console.log(`  ok   ${file}`);
    } else {
      failures.push({ name: file, output: result.output });
      console.log(`  FAIL ${file}`);
    }
  }
  console.log(`tests: ${passed}/${selected.length} geçti`);
  return failures;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`kullanım hatası: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const { filters, syntax, tests, list, root } = options;
  const failures = [];
  try {
    if (list) {
      for (const file of await selectTests(root, filters)) console.log(file);
      return;
    }
    if (syntax) failures.push(...(await syntaxPass(root)));
    if (tests) failures.push(...(await testPass(root, filters)));
  } catch (error) {
    console.error(`kalite kapısı çalıştırılamadı: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (failures.length) {
    console.error(`\n${failures.length} kontrol başarısız:`);
    for (const failure of failures) console.error(formatFailure(failure));
    process.exitCode = 1;
    return;
  }
  console.log('\nHafize kalite kapısı: tüm kontroller geçti');
}

await main();
