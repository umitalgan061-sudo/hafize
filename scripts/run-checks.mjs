#!/usr/bin/env node
// Hafize doğrulama geçidi.
//
// Kontrol listesi elle tutulan bir komut dizesi değildir: syntax kontrolü ve
// test çalıştırma dosya keşfi ile yapılır. Böylece yeni bir lib dosyası veya
// yeni bir scripts/test-*.mjs geçide eklenmeyi unutulduğu için sessizce
// çalışmadan kalamaz.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;

// Testin kendisi olmayan, keşifle çalıştırılmayacak yardımcı scriptler.
const NON_TEST_SCRIPTS = new Set(['run-checks.mjs', 'validate-agent-registry.mjs']);

async function listFiles(dir, filter) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && filter(entry.name))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
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
      resolve({ label, ok: false, output: String(error?.message || error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const reason = timedOut ? `zaman aşımı (${TEST_TIMEOUT_MS} ms)\n${output}` : output;
      resolve({ label, ok: !timedOut && code === 0, output: reason });
    });
  });
}

const syntaxTargets = [
  'server.mjs',
  ...(await listFiles('lib', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('public', (name) => name.endsWith('.js'))),
  ...(await listFiles('scripts', (name) => name.endsWith('.mjs')))
];

const testTargets = [
  'scripts/validate-agent-registry.mjs',
  ...(await listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs') && !NON_TEST_SCRIPTS.has(name)))
];

const failures = [];

process.stdout.write(`Syntax kontrolü: ${syntaxTargets.length} dosya\n`);
for (const target of syntaxTargets) {
  const result = await run(['--check', target], target);
  if (!result.ok) failures.push(result);
}
if (failures.length === 0) process.stdout.write('Syntax kontrolü tamam\n\n');

process.stdout.write(`Testler: ${testTargets.length} dosya\n`);
for (const target of testTargets) {
  const result = await run([target], target);
  process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'} ${target}\n`);
  if (!result.ok) failures.push(result);
}

if (failures.length > 0) {
  process.stdout.write(`\n${failures.length} başarısız kontrol:\n`);
  for (const failure of failures) {
    process.stdout.write(`\n--- ${failure.label} ---\n${failure.output.trimEnd()}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`\nTüm kontroller geçti: ${syntaxTargets.length} syntax, ${testTargets.length} test\n`);
}
