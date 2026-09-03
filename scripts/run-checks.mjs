#!/usr/bin/env node
// Hafize doğrulama koşucusu.
//
// Kapı listesini elle tutulan tek satırlık npm script'i yerine dosya keşfiyle
// kurar: yeni bir lib/public kaynağı veya yeni bir scripts/test-*.mjs dosyası
// eklendiğinde kapı onu otomatik kapsar. Böylece "test dosyası var ama kapıda
// koşmuyor" sapması oluşmaz.
//
// Kullanım:
//   node scripts/run-checks.mjs                 tüm syntax + test kapısı
//   node scripts/run-checks.mjs --list          koşulacak adımları yazdır
//   node scripts/run-checks.mjs --syntax-only   yalnızca node --check adımları
//   node scripts/run-checks.mjs --tests-only    yalnızca test scriptleri
//   node scripts/run-checks.mjs --filter=gmail  yol parçasına göre daralt

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEP_TIMEOUT_MS = 120_000;

const SYNTAX_SOURCES = [
  { dir: '.', extensions: ['.mjs'], recurse: false, only: new Set(['server.mjs']) },
  { dir: 'lib', extensions: ['.mjs'], recurse: true },
  { dir: 'public', extensions: ['.js'], recurse: true },
  { dir: 'scripts', extensions: ['.mjs'], recurse: true }
];

// test-*.mjs kalıbına uymayan ama kapıda koşması gereken doğrulayıcılar.
const EXTRA_TEST_SCRIPTS = ['scripts/validate-agent-registry.mjs'];

async function collectFiles(dir, { extensions, recurse, only }) {
  const absolute = path.join(ROOT, dir);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(dir === '.' ? '' : dir, entry.name);
    if (entry.isDirectory()) {
      if (recurse && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...(await collectFiles(relative, { extensions, recurse, only })));
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (only && !only.has(entry.name)) continue;
    if (!extensions.includes(path.extname(entry.name))) continue;
    files.push(relative);
  }
  return files;
}

export async function discoverSteps() {
  const syntax = [];
  for (const source of SYNTAX_SOURCES) {
    syntax.push(...(await collectFiles(source.dir, source)));
  }
  syntax.sort();

  const scripts = await collectFiles('scripts', { extensions: ['.mjs'], recurse: false });
  const tests = scripts.filter((file) => path.basename(file).startsWith('test-')).sort();

  return {
    syntax: syntax.map((file) => ({ kind: 'syntax', file, args: ['--check', file] })),
    tests: [...EXTRA_TEST_SCRIPTS, ...tests].map((file) => ({ kind: 'test', file, args: [file] }))
  };
}

function runStep(step) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, step.args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, STEP_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ...step, ok: false, output: String(error?.message ?? error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8').trim();
      resolve({
        ...step,
        ok: !timedOut && code === 0,
        output: timedOut ? `${output}\n[timeout] ${STEP_TIMEOUT_MS} ms içinde bitmedi` : output
      });
    });
  });
}

export function parseArgv(argv) {
  const options = { list: false, syntaxOnly: false, testsOnly: false, filter: '' };
  for (const arg of argv) {
    if (arg === '--list') options.list = true;
    else if (arg === '--syntax-only') options.syntaxOnly = true;
    else if (arg === '--tests-only') options.testsOnly = true;
    else if (arg.startsWith('--filter=')) options.filter = arg.slice('--filter='.length);
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (options.syntaxOnly && options.testsOnly) throw new Error('CONFLICTING_ARGUMENTS');
  return options;
}

export async function selectSteps(options) {
  const { syntax, tests } = await discoverSteps();
  let steps = [];
  if (!options.testsOnly) steps.push(...syntax);
  if (!options.syntaxOnly) steps.push(...tests);
  if (options.filter) steps = steps.filter((step) => step.file.includes(options.filter));
  return steps;
}

async function main() {
  const options = parseArgv(process.argv.slice(2));
  const steps = await selectSteps(options);

  if (options.list) {
    for (const step of steps) console.log(`${step.kind}\t${step.file}`);
    console.log(`${steps.length} adım`);
    return 0;
  }
  if (!steps.length) {
    console.error('Çalıştırılacak adım bulunamadı.');
    return 1;
  }

  const started = Date.now();
  const failures = [];
  for (const step of steps) {
    const result = await runStep(step);
    if (result.ok) continue;
    failures.push(result);
    // Kapı ilk hatada durmaz; tüm başarısızlıklar tek turda raporlanır.
    console.error(`FAIL ${result.kind} ${result.file}`);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (!failures.length) {
    console.log(`Kapı geçti: ${steps.length} adım, ${seconds} sn.`);
    return 0;
  }

  console.error(`\n${failures.length}/${steps.length} adım başarısız (${seconds} sn):`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.kind} ${failure.file} ---`);
    console.error(failure.output || '(çıktı yok)');
  }
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await main();
}
