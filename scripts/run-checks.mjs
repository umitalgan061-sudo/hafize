import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

function listFiles(relativeDir, matches) {
  const absolute = path.join(ROOT, relativeDir);
  let entries;
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  return entries
    .filter((name) => matches(name))
    .filter((name) => statSync(path.join(absolute, name)).isFile())
    .sort()
    .map((name) => (relativeDir === '.' ? name : `${relativeDir}/${name}`));
}

/** Syntax kontrolü yapılacak tüm kaynak dosyaları. */
export function collectSyntaxTargets() {
  return [
    ...listFiles('.', (name) => name === 'server.mjs'),
    ...listFiles('lib', (name) => name.endsWith('.mjs')),
    ...listFiles('scripts', (name) => name.endsWith('.mjs')),
    ...listFiles('public', (name) => name.endsWith('.js'))
  ];
}

/**
 * Çalıştırılacak tüm testler. Disk üzerindeki her `scripts/test-*.mjs` ve
 * `scripts/validate-*.mjs` otomatik olarak kapsanır; gate'in package.json
 * içindeki elle yazılmış bir listeden geri kalması mümkün değildir.
 */
export function collectTestTargets() {
  return listFiles('scripts', (name) => (name.startsWith('test-') || name.startsWith('validate-')) && name.endsWith('.mjs'));
}

function parseArgs(argv) {
  const filters = [];
  let mode = 'all';
  let list = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--syntax-only') mode = 'syntax';
    else if (arg === '--tests-only') mode = 'tests';
    else if (arg === '--list') list = true;
    else if (arg === '--filter') {
      const value = argv[index + 1];
      if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_CHECK_FILTER');
      filters.push(value.trim());
      index += 1;
    } else throw new Error(`UNKNOWN_CHECK_ARGUMENT:${arg}`);
  }
  return { filters, mode, list };
}

export function applyFilters(targets, filters) {
  if (!filters.length) return targets;
  return targets.filter((target) => filters.some((filter) => target.includes(filter)));
}

function runNode(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let bytes = 0;
    let timedOut = false;
    const collect = (chunk) => {
      if (bytes >= MAX_OUTPUT_BYTES) return;
      bytes += chunk.length;
      chunks.push(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: String(error?.message ?? error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8').slice(-MAX_OUTPUT_BYTES);
      if (timedOut) resolve({ ok: false, output: `${output}\nTIMEOUT after ${timeoutMs}ms` });
      else resolve({ ok: code === 0, output });
    });
  });
}

function readTimeout() {
  const raw = Number(process.env.HAFIZE_CHECK_TIMEOUT_MS);
  return Number.isSafeInteger(raw) && raw >= 1000 && raw <= 600_000 ? raw : DEFAULT_TIMEOUT_MS;
}

async function main() {
  const { filters, mode, list } = parseArgs(process.argv.slice(2));
  const syntaxTargets = mode === 'tests' ? [] : applyFilters(collectSyntaxTargets(), filters);
  const testTargets = mode === 'syntax' ? [] : applyFilters(collectTestTargets(), filters);

  if (list) {
    for (const target of syntaxTargets) console.log(`syntax ${target}`);
    for (const target of testTargets) console.log(`test   ${target}`);
    return 0;
  }

  const timeoutMs = readTimeout();
  const failures = [];

  const syntaxResults = await Promise.all(
    syntaxTargets.map(async (target) => ({ target, ...(await runNode(['--check', target], timeoutMs)) }))
  );
  const brokenSyntax = syntaxResults.filter((result) => !result.ok);
  for (const result of brokenSyntax) failures.push({ kind: 'syntax', target: result.target, output: result.output });
  console.log(`syntax: ${syntaxTargets.length - brokenSyntax.length}/${syntaxTargets.length} passed`);

  let passed = 0;
  for (const target of testTargets) {
    const result = await runNode([target], timeoutMs);
    if (result.ok) {
      passed += 1;
      console.log(`  ok   ${target}`);
    } else {
      failures.push({ kind: 'test', target, output: result.output });
      console.log(`  FAIL ${target}`);
    }
  }
  console.log(`tests: ${passed}/${testTargets.length} passed`);

  if (!failures.length) {
    console.log('check gate green');
    return 0;
  }

  // Zincirin ilk hatada durmaması sayesinde tüm başarısızlıklar tek turda raporlanır.
  console.log(`\n${failures.length} failure(s):`);
  for (const failure of failures) {
    console.log(`\n--- ${failure.kind} ${failure.target} ---`);
    console.log(failure.output.trim());
  }
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
