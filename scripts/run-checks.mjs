#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Elle bakımı yapılan uzun `&&` zinciri yerine kaynak ve test dosyalarını
// diskten keşfeder. Böylece yeni bir modül veya test eklendiğinde kapıya
// eklemeyi unutmak mümkün değildir ve ilk hata kalan testleri gizlemez.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;
const SYNTAX_ONLY = process.argv.includes('--syntax');

async function filesIn(directory, matcher) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && matcher(entry.name))
    .map((entry) => path.posix.join(directory, entry.name))
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
      resolve({ label, ok: false, output: `${output}\nZaman aşımı: ${TEST_TIMEOUT_MS} ms` });
    }, TEST_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) resolve({ label, ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) resolve({ label, ok: code === 0, output: output.trim() });
    });
  });
}

const sources = [
  'server.mjs',
  ...(await filesIn('lib', (name) => name.endsWith('.mjs'))),
  ...(await filesIn('public', (name) => name.endsWith('.js'))),
  ...(await filesIn('scripts', (name) => name.endsWith('.mjs')))
];

const failures = [];

const syntaxResults = await Promise.all(sources.map((file) => run(['--check', file], file)));
for (const result of syntaxResults) {
  if (!result.ok) failures.push(result);
}
console.log(`Syntax: ${sources.length - syntaxResults.filter((r) => !r.ok).length}/${sources.length} dosya geçti`);

if (!SYNTAX_ONLY) {
  const suites = [
    'scripts/validate-agent-registry.mjs',
    ...(await filesIn('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs')))
  ];

  let passed = 0;
  for (const suite of suites) {
    const result = await run([suite], suite);
    if (result.ok) {
      passed += 1;
    } else {
      failures.push(result);
      console.log(`FAIL ${suite}`);
    }
  }
  console.log(`Testler: ${passed}/${suites.length} suite geçti`);
}

if (failures.length) {
  console.error(`\n${failures.length} kontrol başarısız:`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.label} ---\n${failure.output}`);
  }
  process.exit(1);
}

console.log(SYNTAX_ONLY ? 'Syntax kapısı temiz.' : 'Doğrulama kapısı temiz.');
