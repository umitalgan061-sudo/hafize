#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Hedefleri elle yazılmış bir `&&` zincirinden değil, dosya sisteminden keşfeder:
// yeni bir lib/script/public dosyası eklendiğinde kapı otomatik olarak kapsar.
// İlk hatada durmaz; tüm hedefleri çalıştırır ve başarısızlıkların tamamını
// tek bir özet halinde raporlar. Böylece bir kırmızı hedef, arkasındaki
// onlarca hedefi sessizce atlatamaz.

import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_DIRECTORIES = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];
const ROOT_SYNTAX_FILES = ['server.mjs'];
const TEST_PREFIX = 'test-';
const TARGET_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 16_000;

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, only: '', jobs: 4, list: false };
  for (const arg of argv) {
    if (arg === '--list') options.list = true;
    else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice(7));
    else if (arg.startsWith('--only=')) options.only = arg.slice(7).trim();
    else if (arg.startsWith('--jobs=')) {
      const jobs = Number.parseInt(arg.slice(7), 10);
      if (!Number.isInteger(jobs) || jobs < 1 || jobs > 32) throw new Error(`INVALID_JOBS:${arg.slice(7)}`);
      options.jobs = jobs;
    } else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  return options;
}

async function listFiles(directory, extensions) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

// Keşif iki aşamalıdır: önce her kaynak dosyanın sözdizimi, sonra her test dosyası.
// Sözdizimi hedefleri testlerden önce gelir; bozuk bir dosya, onu içe aktaran
// testin belirsiz hatası yerine doğrudan kendi adıyla raporlanır.
export async function discoverTargets(root = DEFAULT_ROOT) {
  const targets = [];
  for (const name of ROOT_SYNTAX_FILES) {
    const filePath = path.join(root, name);
    if (await isFile(filePath)) targets.push({ kind: 'syntax', name, args: ['--check', filePath] });
  }
  for (const { dir, extensions } of SYNTAX_DIRECTORIES) {
    for (const filePath of await listFiles(path.join(root, dir), extensions)) {
      targets.push({ kind: 'syntax', name: path.relative(root, filePath), args: ['--check', filePath] });
    }
  }
  const registryValidator = path.join(root, 'scripts', 'validate-agent-registry.mjs');
  if (await isFile(registryValidator)) {
    targets.push({ kind: 'test', name: 'scripts/validate-agent-registry.mjs', args: [registryValidator] });
  }
  for (const filePath of await listFiles(path.join(root, 'scripts'), ['.mjs'])) {
    if (!path.basename(filePath).startsWith(TEST_PREFIX)) continue;
    targets.push({ kind: 'test', name: path.relative(root, filePath), args: [filePath] });
  }
  return targets;
}

function clip(text) {
  const trimmed = text.trimEnd();
  if (Buffer.byteLength(trimmed, 'utf8') <= MAX_OUTPUT_BYTES) return trimmed;
  return `${trimmed.slice(0, MAX_OUTPUT_BYTES)}\n… (çıktı kısaltıldı)`;
}

function runTarget(target, root) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(process.execPath, target.args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      output += `\nTIMEOUT: ${TARGET_TIMEOUT_MS} ms içinde bitmedi.`;
      child.kill('SIGKILL');
    }, TARGET_TIMEOUT_MS);
    const collect = (chunk) => { output += chunk; };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) output += `\nSPAWN_ERROR: ${error.message}`;
      resolve({
        ...target,
        ok: code === 0 && !error,
        durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
        output: clip(output)
      });
    };
    child.on('error', (error) => finish(null, error));
    child.on('close', (code) => finish(code, null));
  });
}

// Sabit boyutlu havuz: hedefler paralel çalışır ama sonuçlar keşif sırasına göre
// yerleştirilir, böylece rapor çalıştırmadan çalıştırmaya aynı sırayı korur.
async function runAll(targets, root, jobs) {
  const results = new Array(targets.length);
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const index = next++;
      results[index] = await runTarget(targets[index], root);
      const result = results[index];
      process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${result.name} (${result.durationMs} ms)\n`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, targets.length) }, worker));
  return results;
}

export async function runChecks({ root = DEFAULT_ROOT, only = '', jobs = 4 } = {}) {
  const discovered = await discoverTargets(root);
  const targets = only ? discovered.filter((target) => target.name.includes(only)) : discovered;
  if (!targets.length) return { targets: [], failures: [], ok: false, reason: 'NO_TARGETS' };
  const results = await runAll(targets, root, jobs);
  const failures = results.filter((result) => !result.ok);
  return { targets: results, failures, ok: failures.length === 0, reason: null };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    for (const target of await discoverTargets(options.root)) process.stdout.write(`${target.kind}\t${target.name}\n`);
    return 0;
  }
  const started = Date.now();
  const { targets, failures, ok, reason } = await runChecks(options);
  if (reason === 'NO_TARGETS') {
    process.stderr.write(`hiç hedef bulunamadı (root=${options.root}, only=${options.only || '-'})\n`);
    return 1;
  }
  for (const failure of failures) {
    process.stderr.write(`\n----- FAIL ${failure.name} -----\n${failure.output}\n`);
  }
  const syntax = targets.filter((target) => target.kind === 'syntax').length;
  const tests = targets.length - syntax;
  process.stdout.write(
    `\n${ok ? 'PASS' : 'FAIL'}: ${targets.length - failures.length}/${targets.length} hedef ` +
    `(${syntax} sözdizimi, ${tests} test) — ${failures.length} başarısız, ${Date.now() - started} ms\n`
  );
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => { process.exitCode = code; },
    (error) => { process.stderr.write(`${error?.stack || error}\n`); process.exitCode = 1; }
  );
}
