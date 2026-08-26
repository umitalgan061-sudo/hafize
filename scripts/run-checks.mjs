// Hafize doğrulama kapısı.
//
// Elle bakımı yapılan bir komut listesi yerine repo içeriğini keşfeder: her
// kaynak dosya için `node --check`, her `scripts/test-*.mjs` için tam çalıştırma
// uygular. Böylece yeni bir modül veya test eklendiğinde kapıya girmeyi
// unutmak mümkün olmaz; sessizce atlanan test regresyonu oluşmaz.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRECTORIES = [
  { directory: 'lib', extensions: ['.mjs'] },
  { directory: 'public', extensions: ['.js'] },
  { directory: 'scripts', extensions: ['.mjs'] }
];
const ROOT_SOURCES = ['server.mjs'];
const EXTRA_CHECKS = ['scripts/validate-agent-registry.mjs'];
const TEST_PREFIX = 'test-';
const CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 120_000;

export function resolveTimeoutMs(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_TIMEOUT_MS;
  const value = Number(String(raw).trim());
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 600_000) return null;
  return value;
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

export async function discoverSyntaxTargets() {
  const discovered = [];
  for (const { directory, extensions } of SOURCE_DIRECTORIES) {
    discovered.push(...(await listFiles(directory, extensions)));
  }
  return [...ROOT_SOURCES, ...discovered];
}

export async function discoverTestTargets() {
  const scripts = await listFiles('scripts', ['.mjs']);
  return scripts.filter((file) => path.basename(file).startsWith(TEST_PREFIX));
}

export function applyFilter(targets, filters) {
  if (!Array.isArray(filters) || filters.length === 0) return targets;
  return targets.filter((target) => filters.some((filter) => target.includes(filter)));
}

function run(args, label, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const capture = (chunk) => {
      if (output.length < 16_000) output += chunk;
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    // Asılı kalan bir kontrol tüm kapıyı süresiz bloklamamalıdır.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ label, ok: false, output: `${output}\nTIMEOUT: ${timeoutMs} ms içinde bitmedi` });
    }, timeoutMs);
    timer.unref?.();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (error) => finish({ label, ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => finish({ label, ok: code === 0, output }));
  });
}

async function runPool(items, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function report(stage, results) {
  const failures = results.filter((result) => !result.ok);
  console.log(`${stage}: ${results.length - failures.length}/${results.length} passed`);
  for (const failure of failures) {
    console.error(`\n--- FAILED: ${failure.label} ---\n${failure.output.trim()}\n`);
  }
  return failures;
}

function parseFilters(argv) {
  const filters = [];
  for (const argument of argv) {
    if (argument.startsWith('--filter=')) {
      filters.push(...argument.slice('--filter='.length).split(',').map((value) => value.trim()).filter(Boolean));
    }
  }
  return filters;
}

async function main(argv) {
  const timeoutMs = resolveTimeoutMs(process.env.HAFIZE_CHECK_TIMEOUT_MS);
  if (timeoutMs === null) {
    console.error('run-checks: HAFIZE_CHECK_TIMEOUT_MS 1000-600000 aralığında tam sayı olmalıdır');
    return 1;
  }
  const filters = parseFilters(argv);
  const syntaxTargets = applyFilter(await discoverSyntaxTargets(), filters);
  const testTargets = applyFilter([...(await discoverTestTargets()), ...EXTRA_CHECKS], filters);

  if (argv.includes('--list')) {
    console.log([...syntaxTargets, ...testTargets].join('\n'));
    return 0;
  }

  if (syntaxTargets.length === 0 && testTargets.length === 0) {
    console.error('run-checks: filtre hiçbir hedefle eşleşmedi');
    return 1;
  }

  const syntaxFailures = report(
    'syntax',
    await runPool(syntaxTargets, (target) => run(['--check', target], target, timeoutMs))
  );
  const testFailures = report(
    'tests',
    await runPool(testTargets, (target) => run([target], target, timeoutMs))
  );

  const failed = syntaxFailures.length + testFailures.length;
  if (failed > 0) {
    console.error(`run-checks: ${failed} kontrol başarısız`);
    return 1;
  }
  console.log('run-checks: tüm kontroller geçti');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
