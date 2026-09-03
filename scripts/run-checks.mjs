#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Bu runner iki sorunu birden çözer:
//   1. Kaynak listesi elle tutulan `&&` zinciri değil, diskten keşfedilir; yeni
//      bir `scripts/test-*.mjs` dosyası eklendiğinde kapıya otomatik girer.
//   2. İlk hatada durmaz; tüm kontrolleri çalıştırıp her başarısızlığı raporlar,
//      böylece tek bir bayat test alt taraftaki testleri gizleyemez.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_DIRECTORIES = [
  { directory: 'lib', extensions: ['.mjs'] },
  { directory: 'public', extensions: ['.js'] },
  { directory: 'scripts', extensions: ['.mjs'] }
];
const SYNTAX_ROOT_FILES = ['server.mjs'];
const EXTRA_RUNNABLE_CHECKS = ['scripts/validate-agent-registry.mjs'];
const TEST_PREFIX = 'test-';
const DEFAULT_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
  const options = { filter: '', timeoutMs: DEFAULT_TIMEOUT_MS, listOnly: false };
  for (const arg of argv) {
    if (arg === '--list') {
      options.listOnly = true;
    } else if (arg.startsWith('--only=')) {
      options.filter = arg.slice('--only='.length).trim();
    } else if (arg.startsWith('--timeout=')) {
      const parsed = Number(arg.slice('--timeout='.length));
      if (!Number.isSafeInteger(parsed) || parsed < 1_000) {
        throw new Error(`INVALID_TIMEOUT: ${arg}`);
      }
      options.timeoutMs = parsed;
    } else {
      throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
    }
  }
  return options;
}

async function listFiles(directory, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

async function discoverChecks() {
  const syntaxFiles = [...SYNTAX_ROOT_FILES];
  for (const { directory, extensions } of SYNTAX_DIRECTORIES) {
    syntaxFiles.push(...(await listFiles(directory, extensions)));
  }

  const scriptFiles = await listFiles('scripts', ['.mjs']);
  const testFiles = scriptFiles.filter((file) => path.basename(file).startsWith(TEST_PREFIX));

  return [
    ...syntaxFiles.map((file) => ({ kind: 'syntax', name: `syntax ${file}`, args: ['--check', file] })),
    ...EXTRA_RUNNABLE_CHECKS.map((file) => ({ kind: 'check', name: file, args: [file] })),
    ...testFiles.map((file) => ({ kind: 'test', name: file, args: [file] }))
  ];
}

function runCheck(check, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, check.args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const collect = (chunk) => {
      // Uzun çıktılar özet raporu boğmasın; hata ayıklama için son kısım yeterli.
      output = `${output}${chunk}`.slice(-8_000);
    };
    // Türkçe çıktının chunk sınırında bozulmaması için akışlar utf8 okunur.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const finish = (ok, reason) => {
      clearTimeout(timer);
      resolve({ ...check, ok, reason, output: output.trim(), durationMs: Date.now() - started });
    };

    child.on('error', (error) => finish(false, `spawn failed: ${error.message}`));
    child.on('close', (code, signal) => {
      if (timedOut) return finish(false, `timed out after ${timeoutMs}ms`);
      if (code === 0) return finish(true, null);
      finish(false, signal ? `killed by ${signal}` : `exit code ${code}`);
    });
  });
}

async function runAll(plan, timeoutMs) {
  const failures = [];
  const startedAt = Date.now();

  for (const check of plan) {
    const result = await runCheck(check, timeoutMs);
    if (result.ok) {
      console.log(`ok   ${result.name} (${result.durationMs}ms)`);
    } else {
      failures.push(result);
      console.log(`FAIL ${result.name} (${result.reason})`);
    }
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${plan.length - failures.length}/${plan.length} checks passed in ${elapsedSeconds}s`);

  if (!failures.length) return;

  console.log(`\n${failures.length} failing check(s):`);
  for (const failure of failures) {
    console.log(`\n--- ${failure.name} (${failure.reason}) ---`);
    if (failure.output) console.log(failure.output);
  }
  process.exitCode = 1;
}

// process.exit() borulanmış çıktıyı yarıda kesebilir; her yolda process.exitCode
// atanır ve süreç doğal olarak sonlanır.
async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\nUsage: node scripts/run-checks.mjs [--list] [--only=<substring>] [--timeout=<ms>]`);
    process.exitCode = 2;
    return;
  }

  const discovered = await discoverChecks();
  const checks = options.filter ? discovered.filter((check) => check.name.includes(options.filter)) : discovered;

  if (!checks.length) {
    console.error(options.filter ? `No checks matched --only=${options.filter}` : 'No checks discovered');
    process.exitCode = 1;
    return;
  }

  if (options.listOnly) {
    for (const check of checks) console.log(check.name);
    return;
  }

  await runAll(checks, options.timeoutMs);
}

await main(process.argv.slice(2));
