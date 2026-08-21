#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Bu runner, kontrol edilecek dosyaları package.json içindeki elle yazılmış bir
// zincirden değil doğrudan diskten keşfeder. Böylece yeni eklenen bir test veya
// modül, listeye eklenmeyi unuttuğu için sessizce kapının dışında kalamaz.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;

// Runner kendini çalıştırmaz; sonsuz döngüyü önler.
const SELF = 'run-checks.mjs';

// Test dışı yardımcı script'ler: testlerden önce çalıştırılır.
const VALIDATORS = ['validate-agent-registry.mjs'];

const syntaxOnly = process.argv.includes('--syntax-only');

async function listFiles(dir, matcher) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && matcher(entry.name))
    .map((entry) => path.posix.join(dir, entry.name))
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
      if (timedOut) resolve({ ok: false, output: `${output}\nTIMEOUT after ${timeoutMs}ms` });
      else resolve({ ok: code === 0, output });
    });
  });
}

const sources = [
  'server.mjs',
  ...(await listFiles('lib', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('scripts', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('public', (name) => name.endsWith('.js')))
];

const scripts = await listFiles('scripts', (name) => name.endsWith('.mjs') && name !== SELF);
const validators = scripts.filter((file) => VALIDATORS.includes(path.basename(file)));
const tests = scripts.filter((file) => path.basename(file).startsWith('test-'));

const failures = [];

process.stdout.write(`Syntax: ${sources.length} dosya\n`);
for (const file of sources) {
  const result = await run(['--check', file], { timeoutMs: 30_000 });
  if (!result.ok) failures.push({ file, stage: 'syntax', output: result.output });
}

if (!syntaxOnly) {
  const runnable = [...validators, ...tests];
  process.stdout.write(`Test: ${runnable.length} script\n`);
  for (const file of runnable) {
    const result = await run([file]);
    process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${file}\n`);
    if (!result.ok) failures.push({ file, stage: 'test', output: result.output });
  }
}

if (failures.length > 0) {
  process.stdout.write(`\n${failures.length} kontrol başarısız:\n`);
  for (const failure of failures) {
    process.stdout.write(`\n--- ${failure.stage}: ${failure.file} ---\n${failure.output.trimEnd()}\n`);
  }
  process.exit(1);
}

process.stdout.write(syntaxOnly ? '\nSyntax kontrolleri geçti.\n' : '\nTüm kontroller geçti.\n');
