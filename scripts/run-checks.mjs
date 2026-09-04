#!/usr/bin/env node
// Hafize doğrulama koşucusu.
//
// Kontrol listesi elle tutulmaz: lib/, scripts/, public/ ve server.mjs otomatik
// keşfedilir. Böylece yeni bir modül veya test dosyası eklendiğinde gate'e
// eklenmeyi unutmak mümkün olmaz.
//
// Kullanım:
//   node scripts/run-checks.mjs --static   → syntax + registry doğrulaması
//   node scripts/run-checks.mjs --tests    → scripts/test-*.mjs koşumu
//   node scripts/run-checks.mjs            → ikisi birden

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;

// Canlı bir dış servis gerektiren koşumlar gate'i kırmaz; kendi içlerinde
// atlanırlar, burada yalnızca beklendiği belgelenir.
const EXTERNAL_SERVICE_TESTS = new Set(['test-redis-schedule-lease-live.mjs']);

async function sourceFiles() {
  const groups = [
    ['lib', (name) => name.endsWith('.mjs')],
    ['scripts', (name) => name.endsWith('.mjs')],
    ['public', (name) => name.endsWith('.js')]
  ];
  const files = ['server.mjs'];
  for (const [dir, accept] of groups) {
    const entries = await readdir(path.join(ROOT, dir));
    for (const name of entries.sort()) {
      if (accept(name)) files.push(path.posix.join(dir, name));
    }
  }
  return files;
}

async function testFiles() {
  const entries = await readdir(path.join(ROOT, 'scripts'));
  return entries
    .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
    .sort();
}

function run(args, { timeoutMs = TEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: `${output}${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ ok: false, output: `${output}\nTIMEOUT (${timeoutMs} ms)` });
      else resolve({ ok: code === 0, output });
    });
  });
}

function report(failures, label, total) {
  if (failures.length === 0) {
    console.log(`✓ ${label}: ${total} kontrol geçti`);
    return true;
  }
  console.error(`\n✗ ${label}: ${failures.length}/${total} kontrol başarısız\n`);
  for (const { name, output } of failures) {
    console.error(`--- ${name} ---`);
    console.error(output.trimEnd());
    console.error('');
  }
  return false;
}

async function staticPass() {
  const files = await sourceFiles();
  const failures = [];
  for (const file of files) {
    const result = await run(['--check', file], { timeoutMs: 30_000 });
    if (!result.ok) failures.push({ name: `syntax ${file}`, output: result.output });
  }
  const registry = await run(['scripts/validate-agent-registry.mjs'], { timeoutMs: 30_000 });
  if (!registry.ok) failures.push({ name: 'agents/registry.json', output: registry.output });
  return report(failures, 'Statik kontrol', files.length + 1);
}

async function testPass() {
  const files = await testFiles();
  const failures = [];
  for (const name of files) {
    const result = await run([path.posix.join('scripts', name)]);
    const external = EXTERNAL_SERVICE_TESTS.has(name);
    if (result.ok) {
      console.log(`  ✓ ${name}${external ? ' (dış servis yoksa kendi içinde atlanır)' : ''}`);
    } else {
      console.log(`  ✗ ${name}`);
      failures.push({ name, output: result.output });
    }
  }
  return report(failures, 'Test koşumu', files.length);
}

const mode = process.argv[2] ?? '--all';
if (!['--static', '--tests', '--all'].includes(mode)) {
  console.error(`Bilinmeyen mod: ${mode}. --static, --tests veya boş bırakın.`);
  process.exit(2);
}

let passed = true;
if (mode === '--static' || mode === '--all') passed = (await staticPass()) && passed;
if (mode === '--tests' || mode === '--all') passed = (await testPass()) && passed;
process.exit(passed ? 0 : 1);
