#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// package.json içindeki elle yazılmış uzun komut zinciri yerine bu koşucu
// kaynakları ve testleri diskten keşfeder. Böylece yeni bir lib/ dosyası veya
// yeni bir scripts/test-*.mjs eklendiğinde kapı otomatik olarak kapsar;
// listeyi güncellemeyi unutmak sessiz kapsam kaybına yol açamaz.

import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Testlerden farklı olarak yalnızca sözdizimi denetlenen dosyalar.
const SYNTAX_DIRS = [
  { dir: 'lib', match: (name) => name.endsWith('.mjs') },
  { dir: 'public', match: (name) => name.endsWith('.js') },
  { dir: 'scripts', match: (name) => name.endsWith('.mjs') }
];

// Testler değil, kapının kendi yardımcı betikleri.
const NON_TEST_SCRIPTS = ['validate-agent-registry.mjs'];

async function listFiles(dir, match) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && match(entry.name))
    .map((entry) => path.posix.join(dir, entry.name))
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ label, ok: code === 0, output }));
  });
}

const SELF = 'run-checks.mjs';

export async function discoverCheckTargets() {
  const syntax = [
    'server.mjs',
    ...(await Promise.all(SYNTAX_DIRS.map(({ dir, match }) => listFiles(dir, match)))).flat()
  ];
  const scriptFiles = await listFiles('scripts', (name) => name.endsWith('.mjs'));
  const executed = [
    ...NON_TEST_SCRIPTS.map((name) => path.posix.join('scripts', name)),
    ...scriptFiles.filter((file) => path.basename(file).startsWith('test-'))
  ].filter((file) => path.basename(file) !== SELF);
  return { syntax, executed };
}

const failures = [];

async function step(args, label) {
  const result = await run(args, label);
  if (result.ok) {
    process.stdout.write(`ok   ${label}\n`);
    return;
  }
  failures.push(result);
  process.stdout.write(`FAIL ${label}\n`);
}

// Yalnızca doğrudan çalıştırıldığında kapıyı yürüt; test dosyası keşif
// fonksiyonunu içe aktarabilsin diye içe aktarma yan etkisiz kalır.
const invokedDirectly = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (invokedDirectly) {
  const { syntax: syntaxTargets, executed: runnable } = await discoverCheckTargets();

  process.stdout.write(`# sözdizimi denetimi (${syntaxTargets.length} dosya)\n`);
  for (const target of syntaxTargets) {
    await step(['--check', target], target);
  }

  process.stdout.write(`\n# test çalıştırma (${runnable.length} betik)\n`);
  for (const target of runnable) {
    await step([target], target);
  }

  report(syntaxTargets.length + runnable.length);
}

function report(total) {
  if (failures.length > 0) {
    process.stdout.write(`\n# ${failures.length} başarısız adım\n`);
    for (const failure of failures) {
      process.stdout.write(`\n----- ${failure.label} -----\n${failure.output.trim()}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\n# tüm adımlar başarılı (${total})\n`);
}
