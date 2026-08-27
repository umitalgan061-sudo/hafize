#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Kapı iki adımdan oluşur:
//   1. Depodaki tüm JavaScript kaynakları için `node --check` syntax doğrulaması.
//   2. Depodaki tüm `scripts/test-*.mjs` ve `scripts/validate-*.mjs` betiklerinin
//      çalıştırılması.
//
// Test dosyaları otomatik keşfedilir; yeni bir test eklemek için package.json
// düzenlemek gerekmez. Böylece "test var ama kapıda çalışmıyor" durumu oluşmaz.

import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_DIRECTORIES = ['lib', 'public', 'scripts'];
const SOURCE_EXTENSIONS = new Set(['.mjs', '.js']);
const ROOT_SOURCES = ['server.mjs'];
const TEST_TIMEOUT_MS = 120_000;
const CHECK_TIMEOUT_MS = 30_000;

async function listDirectory(directory) {
  try {
    return await readdir(join(ROOT, directory));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/** Syntax doğrulaması yapılacak depo-göreli kaynak yolları. */
export async function discoverSources() {
  const sources = [...ROOT_SOURCES];
  for (const directory of SOURCE_DIRECTORIES) {
    for (const entry of await listDirectory(directory)) {
      if (SOURCE_EXTENSIONS.has(extname(entry))) sources.push(`${directory}/${entry}`);
    }
  }
  return sources.sort();
}

/** Çalıştırılacak depo-göreli test ve doğrulayıcı yolları. */
export async function discoverTests() {
  const tests = [];
  for (const entry of await listDirectory('scripts')) {
    if (!entry.endsWith('.mjs')) continue;
    if (entry.startsWith('test-') || entry.startsWith('validate-')) tests.push(`scripts/${entry}`);
  }
  return tests.sort();
}

export function matchesFilters(file, filters) {
  if (!filters.length) return true;
  return filters.some((filter) => file.includes(filter));
}

/** Tek bir node komutunu çalıştırır; asla throw etmez. */
export function runNode(args, { timeoutMs = TEST_TIMEOUT_MS, cwd = ROOT } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolvePromise({ ok: false, output: `${output}${error.message}\n`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) output += `\nZaman aşımı: ${timeoutMs} ms\n`;
      resolvePromise({ ok: !timedOut && code === 0, output, timedOut });
    });
  });
}

function lastLine(output) {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

/**
 * Syntax kontrollerini ve testleri sırayla çalıştırır.
 * Dönen değer: { failures: string[], sourceCount: number, testCount: number }
 */
export async function runChecks({ sources, tests, log = () => {} } = {}) {
  const sourceList = sources ?? (await discoverSources());
  const testList = tests ?? (await discoverTests());
  const failures = [];

  log(`Syntax kontrolü: ${sourceList.length} dosya`);
  for (const source of sourceList) {
    const result = await runNode(['--check', resolve(ROOT, source)], { timeoutMs: CHECK_TIMEOUT_MS });
    if (!result.ok) {
      failures.push(source);
      log(`  ✗ ${source}\n${result.output.trimEnd()}`);
    }
  }
  if (!failures.length) log('  ✓ tüm kaynaklar geçerli');

  log(`Testler: ${testList.length} dosya`);
  for (const test of testList) {
    const result = await runNode([resolve(ROOT, test)]);
    if (result.ok) {
      const summary = lastLine(result.output);
      log(`  ✓ ${test}${summary ? ` — ${summary}` : ''}`);
    } else {
      failures.push(test);
      log(`  ✗ ${test}\n${result.output.trimEnd()}`);
    }
  }

  return { failures, sourceCount: sourceList.length, testCount: testList.length };
}

async function main() {
  const filters = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const allSources = await discoverSources();
  const allTests = await discoverTests();
  const tests = allTests.filter((test) => matchesFilters(test, filters));
  const sources = filters.length ? allSources.filter((source) => matchesFilters(source, filters)) : allSources;

  if (filters.length && !tests.length) {
    console.error(`Filtreye uyan test bulunamadı: ${filters.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const { failures, sourceCount, testCount } = await runChecks({
    sources,
    tests,
    log: (message) => console.log(message)
  });

  if (failures.length) {
    console.error(`\nKapı başarısız: ${failures.length} hata`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nKapı geçildi: ${sourceCount} kaynak, ${testCount} test`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
