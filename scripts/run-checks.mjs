#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Kapı daha önce package.json içinde elle bakılan tek bir uzun komut dizisiydi; yeni modül
// eklendiğinde dizeye eklenmediği için testler sessizce kapsam dışında kalıyordu. Bu runner
// kaynakları ve testleri diskten keşfeder, böylece kapsam kendiliğinden güncel kalır.
//
// Kullanım:
//   node scripts/run-checks.mjs                 tüm syntax kontrolleri + tüm testler
//   node scripts/run-checks.mjs --syntax-only   yalnız syntax kontrolleri

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_SOURCES = [
  { dir: '.', extensions: ['.mjs'], only: new Set(['server.mjs']) },
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] },
  { dir: 'scripts', extensions: ['.mjs'] }
];
const TEST_DIR = 'scripts';
const TEST_PREFIX = 'test-';
const STEP_TIMEOUT_MS = 120_000;

async function listFiles({ dir, extensions, only }) {
  const absolute = path.join(ROOT, dir);
  const entries = await readdir(absolute, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .filter((entry) => !only || only.has(entry.name))
    .map((entry) => path.posix.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, ok: false, output: `${output}\nTIMEOUT after ${STEP_TIMEOUT_MS} ms` });
    }, STEP_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ label, ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({ label, ok: code === 0, output });
    });
  });
}

const syntaxOnly = process.argv.includes('--syntax-only');
const failures = [];
let passed = 0;

const syntaxTargets = (await Promise.all(SYNTAX_SOURCES.map(listFiles))).flat();
if (syntaxTargets.length === 0) throw new Error('NO_SYNTAX_TARGETS_DISCOVERED');

process.stdout.write(`syntax: ${syntaxTargets.length} dosya\n`);
for (const target of syntaxTargets) {
  const result = await run(['--check', target], `syntax ${target}`);
  if (result.ok) passed += 1;
  else failures.push(result);
}

if (!syntaxOnly) {
  const registry = await run([path.posix.join(TEST_DIR, 'validate-agent-registry.mjs')], 'registry validate');
  if (registry.ok) passed += 1;
  else failures.push(registry);

  const testTargets = (await listFiles({ dir: TEST_DIR, extensions: ['.mjs'] }))
    .filter((file) => path.basename(file).startsWith(TEST_PREFIX));
  if (testTargets.length === 0) throw new Error('NO_TEST_TARGETS_DISCOVERED');

  process.stdout.write(`test: ${testTargets.length} betik\n`);
  for (const target of testTargets) {
    const result = await run([target], `test ${target}`);
    if (result.ok) {
      passed += 1;
      process.stdout.write('.');
    } else {
      failures.push(result);
      process.stdout.write('x');
    }
  }
  process.stdout.write('\n');
}

for (const failure of failures) {
  process.stdout.write(`\nFAIL ${failure.label}\n${failure.output.trimEnd()}\n`);
}

process.stdout.write(`\n${passed} geçti, ${failures.length} başarısız.\n`);
process.exit(failures.length === 0 ? 0 : 1);
