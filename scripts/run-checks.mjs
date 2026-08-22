#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Elle bakımı yapılan uzun `&&` zinciri yerine kaynak ve test dosyalarını
// diskten keşfeder. Böylece yeni bir modül veya test eklendiğinde kapıya
// eklemeyi unutmak mümkün değildir ve ilk hata kalan testleri gizlemez.
//
// Keşif ve çalıştırma yardımcıları dışa aktarılır; `scripts/test-run-checks.mjs`
// bunları doğrudan çağırarak kapının kendisini doğrular (kapıyı yeniden
// başlatmadan, dolayısıyla özyineleme olmadan).

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_TIMEOUT_MS = 120_000;
const REGISTRY_VALIDATOR = 'scripts/validate-agent-registry.mjs';

async function filesIn(directory, matcher) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && matcher(entry.name))
    .map((entry) => path.posix.join(directory, entry.name))
    .sort();
}

export async function discoverTargets() {
  const sources = [
    'server.mjs',
    ...(await filesIn('lib', (name) => name.endsWith('.mjs'))),
    ...(await filesIn('public', (name) => name.endsWith('.js'))),
    ...(await filesIn('scripts', (name) => name.endsWith('.mjs')))
  ];
  const suites = [
    REGISTRY_VALIDATOR,
    ...(await filesIn('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs')))
  ];
  // Keşif bozulursa kapı sessizce "her şey yeşil" demesin.
  if (!sources.length) throw new Error('CHECK_GATE_NO_SOURCES_DISCOVERED');
  if (suites.length < 2) throw new Error('CHECK_GATE_NO_SUITES_DISCOVERED');
  return { sources, suites };
}

export function run(args, label, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, ok: false, output: `${output}\nZaman aşımı: ${timeoutMs} ms` });
    }, timeoutMs);

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

export async function runGate({ syntaxOnly = false, log = console.log, logError = console.error } = {}) {
  const { sources, suites } = await discoverTargets();
  const failures = [];

  const syntaxResults = await Promise.all(sources.map((file) => run(['--check', file], file)));
  for (const result of syntaxResults) {
    if (!result.ok) failures.push(result);
  }
  log(`Syntax: ${sources.length - failures.length}/${sources.length} dosya geçti`);

  if (!syntaxOnly) {
    let passed = 0;
    for (const suite of suites) {
      const result = await run([suite], suite);
      if (result.ok) {
        passed += 1;
      } else {
        failures.push(result);
        log(`FAIL ${suite}`);
      }
    }
    log(`Testler: ${passed}/${suites.length} suite geçti`);
  }

  if (failures.length) {
    logError(`\n${failures.length} kontrol başarısız:`);
    for (const failure of failures) {
      logError(`\n--- ${failure.label} ---\n${failure.output}`);
    }
    return { ok: false, failures };
  }

  log(syntaxOnly ? 'Syntax kapısı temiz.' : 'Doğrulama kapısı temiz.');
  return { ok: true, failures };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const result = await runGate({ syntaxOnly: process.argv.includes('--syntax') });
  if (!result.ok) process.exit(1);
}
