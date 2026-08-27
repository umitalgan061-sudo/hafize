import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_CAPTURED_BYTES = 4096;

// Diskten keşfedilen doğrulama kapsamı. Yeni dosya eklendiğinde kapı elle
// güncellenmediği için sessizce kapsam dışı kalamaz.
export const SYNTAX_SOURCES = Object.freeze([
  { dir: '.', extensions: ['.mjs'], recursive: false },
  { dir: 'lib', extensions: ['.mjs'], recursive: false },
  { dir: 'scripts', extensions: ['.mjs'], recursive: false },
  { dir: 'public', extensions: ['.js'], recursive: false }
]);

export const TEST_DIR = 'scripts';
export const TEST_PREFIX = 'test-';
export const TEST_EXTENSION = '.mjs';

// Kapının kendi çalıştırıcısı test listesine giremez; aksi halde kapı
// kendini sonsuz döngüde çağırır.
export const NON_TEST_SCRIPTS = Object.freeze(['run-checks.mjs']);

export function isTestFile(name) {
  if (typeof name !== 'string') return false;
  if (NON_TEST_SCRIPTS.includes(name)) return false;
  return name.startsWith(TEST_PREFIX) && name.endsWith(TEST_EXTENSION);
}

export function selectSyntaxFiles(names, { extensions }) {
  if (!Array.isArray(names) || !Array.isArray(extensions)) return [];
  return names
    .filter((name) => typeof name === 'string' && extensions.some((ext) => name.endsWith(ext)))
    .sort();
}

export function matchesFilter(target, filter) {
  if (!filter) return true;
  return typeof target === 'string' && target.includes(filter);
}

export function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const options = { syntax: true, tests: true, list: false, filter: '', timeoutMs: DEFAULT_TIMEOUT_MS };
  for (const raw of args) {
    if (raw === '--syntax-only') options.tests = false;
    else if (raw === '--tests-only') options.syntax = false;
    else if (raw === '--list') options.list = true;
    else if (typeof raw === 'string' && raw.startsWith('--filter=')) options.filter = raw.slice('--filter='.length).trim();
    else if (typeof raw === 'string' && raw.startsWith('--timeout=')) {
      const parsed = Number.parseInt(raw.slice('--timeout='.length), 10);
      if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 900_000) throw new Error('INVALID_CHECK_TIMEOUT');
      options.timeoutMs = parsed;
    } else throw new Error(`UNKNOWN_CHECK_ARGUMENT:${raw}`);
  }
  if (!options.syntax && !options.tests) throw new Error('EMPTY_CHECK_SCOPE');
  return options;
}

async function listDir(dir) {
  try {
    return await readdir(path.join(REPO_ROOT, dir));
  } catch {
    return [];
  }
}

export async function discoverTargets({ filter = '' } = {}) {
  const syntaxTargets = [];
  const seen = new Set();
  for (const source of SYNTAX_SOURCES) {
    const names = await listDir(source.dir);
    for (const name of selectSyntaxFiles(names, source)) {
      const relative = source.dir === '.' ? name : path.posix.join(source.dir, name);
      if (seen.has(relative)) continue;
      seen.add(relative);
      if (matchesFilter(relative, filter)) syntaxTargets.push(relative);
    }
  }
  const testNames = (await listDir(TEST_DIR)).filter(isTestFile).sort();
  const testTargets = testNames
    .map((name) => path.posix.join(TEST_DIR, name))
    .filter((relative) => matchesFilter(relative, filter));
  return { syntaxTargets, testTargets };
}

function tail(buffer) {
  const text = buffer.join('');
  if (text.length <= MAX_CAPTURED_BYTES) return text.trim();
  return `…${text.slice(-MAX_CAPTURED_BYTES).trim()}`;
}

function runNode(args, { timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, code: null, reason: 'timeout', output: tail(stderr.concat(stdout)) });
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, code: null, reason: 'spawn', output: String(error?.message ?? 'spawn failed') });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: code === 0, code, reason: code === 0 ? 'ok' : 'exit', output: tail(stderr.concat(stdout)) });
    });
  });
}

export function summarize(results) {
  const entries = Array.isArray(results) ? results : [];
  const failures = entries.filter((entry) => entry && entry.ok === false);
  return {
    total: entries.length,
    passed: entries.length - failures.length,
    failed: failures.length,
    ok: failures.length === 0,
    failures: failures.map(({ kind, target, reason, code, output }) => ({ kind, target, reason, code, output }))
  };
}

export function formatReport(summary) {
  const lines = [];
  const safe = summary ?? { total: 0, passed: 0, failed: 0, ok: false, failures: [] };
  for (const failure of safe.failures ?? []) {
    lines.push(`FAIL [${failure.kind}] ${failure.target} (${failure.reason}${failure.code === null || failure.code === undefined ? '' : ` code=${failure.code}`})`);
    if (failure.output) lines.push(failure.output.split('\n').map((line) => `    ${line}`).join('\n'));
  }
  lines.push(`Doğrulama kapısı: ${safe.passed}/${safe.total} geçti, ${safe.failed} başarısız.`);
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { syntaxTargets, testTargets } = await discoverTargets({ filter: options.filter });
  const plan = [
    ...(options.syntax ? syntaxTargets.map((target) => ({ kind: 'syntax', target })) : []),
    ...(options.tests ? testTargets.map((target) => ({ kind: 'test', target })) : [])
  ];
  if (!plan.length) throw new Error('NO_CHECK_TARGETS');
  if (options.list) {
    for (const item of plan) console.log(`${item.kind}\t${item.target}`);
    return;
  }
  console.log(`Doğrulama kapısı başlıyor: ${plan.filter((i) => i.kind === 'syntax').length} syntax, ${plan.filter((i) => i.kind === 'test').length} test.`);
  const results = [];
  for (const item of plan) {
    const args = item.kind === 'syntax' ? ['--check', item.target] : [item.target];
    const outcome = await runNode(args, { timeoutMs: options.timeoutMs });
    results.push({ ...item, ...outcome });
    if (!outcome.ok) console.log(`  ✗ ${item.kind}: ${item.target}`);
  }
  const summary = summarize(results);
  console.log(formatReport(summary));
  if (!summary.ok) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
