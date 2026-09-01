#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// package.json içindeki uzun `&&` zinciri yerine bu çalıştırıcı hedefleri
// diskten keşfeder. İki somut kazanç sağlar:
//   1. Yeni bir lib/ veya scripts/test-*.mjs dosyası kapıya elle eklenmek
//      zorunda kalmaz; unutulan dosya sessizce doğrulanmamış kalmaz.
//   2. İlk hatada durmaz; tüm hedefleri çalıştırıp kırmızı olanların tam
//      listesini verir, böylece bir hata arkasındaki diğer hatalar gizlenmez.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_DIRS = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];
const ROOT_SYNTAX_FILES = ['server.mjs'];
const EXTRA_SCRIPTS = ['scripts/validate-agent-registry.mjs'];
const TEST_PREFIX = 'test-';
const TIMEOUT_MS = 120_000;

function parseFilters(argv) {
  return argv.slice(2).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim());
}

function matchesFilters(target, filters) {
  return filters.length === 0 || filters.some((filter) => target.includes(filter));
}

async function listFiles(dir, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

async function discoverTargets() {
  const syntax = [...ROOT_SYNTAX_FILES];
  for (const { dir, extensions } of SYNTAX_DIRS) {
    syntax.push(...(await listFiles(dir, extensions)));
  }

  const scripts = await listFiles('scripts', ['.mjs']);
  const tests = scripts.filter((file) => path.basename(file).startsWith(TEST_PREFIX));
  const extras = EXTRA_SCRIPTS.filter((file) => scripts.includes(file));

  return { syntax, run: [...extras, ...tests] };
}

function runNode(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, ok: false, output: `TIMEOUT: ${TIMEOUT_MS} ms içinde bitmedi.` });
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ label, ok: false, output: String(error?.message || error) });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ label, ok: code === 0, output: Buffer.concat(chunks).toString('utf8') });
    });
  });
}

function tail(output, lines = 20) {
  const trimmed = String(output || '').trimEnd().split('\n');
  return trimmed.slice(-lines).join('\n');
}

async function main() {
  const filters = parseFilters(process.argv);
  const targets = await discoverTargets();
  const syntaxTargets = targets.syntax.filter((file) => matchesFilters(file, filters));
  const runTargets = targets.run.filter((file) => matchesFilters(file, filters));

  if (syntaxTargets.length === 0 && runTargets.length === 0) {
    console.error('HATA: filtreyle eşleşen doğrulama hedefi yok.');
    process.exitCode = 1;
    return;
  }

  const failures = [];
  const started = Date.now();

  console.log(`syntax: ${syntaxTargets.length} dosya`);
  for (const file of syntaxTargets) {
    const result = await runNode(['--check', file], file);
    if (!result.ok) failures.push(result);
  }

  console.log(`test: ${runTargets.length} betik`);
  for (const file of runTargets) {
    const result = await runNode([file], file);
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${file}`);
    if (!result.ok) failures.push(result);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length === 0) {
    console.log(`\nTüm doğrulamalar geçti (${syntaxTargets.length} syntax + ${runTargets.length} betik, ${seconds}s).`);
    return;
  }

  console.error(`\n${failures.length} hedef başarısız (${seconds}s):`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.label} ---`);
    console.error(tail(failure.output));
  }
  process.exitCode = 1;
}

await main();
