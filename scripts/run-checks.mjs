#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Bu çalıştırıcı, kontrol edilecek dosyaları elle yazılmış bir listeden değil
// depo içeriğinden keşfeder. Böylece yeni bir lib modülü veya yeni bir test
// dosyası eklendiğinde kapı kendiliğinden genişler ve sessizce atlanmaz.

import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TEST_PREFIX = 'test-';
const VALIDATOR_PREFIX = 'validate-';
const DEFAULT_TIMEOUT_MS = 180_000;

async function listFiles(rootDir, relativeDir) {
  let entries;
  try {
    entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `${relativeDir}/${entry.name}`)
    .sort();
}

async function fileExists(rootDir, relativePath) {
  try {
    const info = await stat(path.join(rootDir, relativePath));
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Depoyu tarayıp syntax kontrolü ve test çalıştırması gereken dosyaları döndürür.
 * Sıralama deterministiktir; aynı depo her zaman aynı kapıyı üretir.
 */
export async function discoverTargets(rootDir = ROOT) {
  const [libFiles, scriptFiles, publicFiles] = await Promise.all([
    listFiles(rootDir, 'lib'),
    listFiles(rootDir, 'scripts'),
    listFiles(rootDir, 'public')
  ]);

  const syntax = [];
  if (await fileExists(rootDir, 'server.mjs')) syntax.push('server.mjs');
  syntax.push(...libFiles.filter((file) => file.endsWith('.mjs')));
  syntax.push(...scriptFiles.filter((file) => file.endsWith('.mjs')));
  syntax.push(...publicFiles.filter((file) => file.endsWith('.js')));

  const tests = scriptFiles.filter(
    (file) => file.endsWith('.mjs') && path.basename(file).startsWith(TEST_PREFIX)
  );
  const validators = scriptFiles.filter(
    (file) => file.endsWith('.mjs') && path.basename(file).startsWith(VALIDATOR_PREFIX)
  );

  return { syntax, tests, validators };
}

function runNode(rootDir, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: String(error?.message ?? error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8').trim();
      if (timedOut) resolve({ ok: false, output: `${output}\nTIMEOUT after ${timeoutMs}ms`.trim() });
      else resolve({ ok: code === 0, output });
    });
  });
}

async function runQueue(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Keşfedilen hedefleri çalıştırır ve başarısızlıkları toplar.
 * Hiçbir başarısızlık yutulmaz; her biri failures listesinde raporlanır.
 */
export async function runChecks({
  rootDir = ROOT,
  concurrency = 4,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onEvent = () => {}
} = {}) {
  const { syntax, tests, validators } = await discoverTargets(rootDir);
  const failures = [];

  const syntaxResults = await runQueue(
    syntax,
    (file) => runNode(rootDir, ['--check', file], timeoutMs),
    concurrency
  );
  syntax.forEach((file, index) => {
    const result = syntaxResults[index];
    onEvent({ kind: 'syntax', file, ok: result.ok });
    if (!result.ok) failures.push({ kind: 'syntax', file, output: result.output });
  });

  const validatorResults = await runQueue(
    validators,
    (file) => runNode(rootDir, [file], timeoutMs),
    concurrency
  );
  validators.forEach((file, index) => {
    const result = validatorResults[index];
    onEvent({ kind: 'validate', file, ok: result.ok });
    if (!result.ok) failures.push({ kind: 'validate', file, output: result.output });
  });

  const testResults = await runQueue(
    tests,
    (file) => runNode(rootDir, [file], timeoutMs),
    concurrency
  );
  tests.forEach((file, index) => {
    const result = testResults[index];
    onEvent({ kind: 'test', file, ok: result.ok });
    if (!result.ok) failures.push({ kind: 'test', file, output: result.output });
  });

  return { syntax, validators, tests, failures };
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const started = Date.now();
  const summary = await runChecks({
    onEvent: ({ kind, file, ok }) => {
      if (!ok) console.error(`FAIL  ${kind.padEnd(6)} ${file}`);
    }
  });
  const total = summary.syntax.length + summary.validators.length + summary.tests.length;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const breakdown = `${summary.syntax.length} syntax, ${summary.validators.length} validate, `
    + `${summary.tests.length} test, ${seconds}s`;

  if (summary.failures.length > 0) {
    for (const failure of summary.failures) {
      console.error(`\n=== ${failure.kind}: ${failure.file} ===\n${failure.output}`);
    }
    console.error(`\nhafize check: ${summary.failures.length}/${total} başarısız (${breakdown})`);
    process.exit(1);
  }

  console.log(`hafize check: ${total} kontrol geçti (${breakdown})`);
}
