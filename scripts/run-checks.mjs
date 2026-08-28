// Hafize check gate.
//
// Kontrol listesi elle tutulmaz: syntax hedefleri ve test dosyaları disk
// üzerinden keşfedilir. Böylece yeni bir lib modülü veya yeni bir
// scripts/test-*.mjs dosyası eklendiğinde gate otomatik olarak kapsar ve
// "teste eklemeyi unutma" kaynaklı sessiz kapsam kaybı oluşmaz.
//
// Kullanım:
//   node scripts/run-checks.mjs                 tüm syntax + test gate
//   node scripts/run-checks.mjs --filter gmail  yalnız eşleşen dosyalar
//   node scripts/run-checks.mjs --syntax-only   yalnız syntax kontrolü

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_TIMEOUT_MS = 120_000;

const SYNTAX_SOURCES = Object.freeze([
  Object.freeze({ dir: '.', pattern: /^server\.mjs$/ }),
  Object.freeze({ dir: 'lib', pattern: /\.mjs$/ }),
  Object.freeze({ dir: 'scripts', pattern: /\.mjs$/ }),
  Object.freeze({ dir: 'public', pattern: /\.js$/ })
]);

const TEST_DIR = 'scripts';
const TEST_PATTERN = /^test-.+\.mjs$/;

async function listFiles(dir, pattern) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.posix.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

export async function collectSyntaxTargets() {
  const files = [];
  for (const source of SYNTAX_SOURCES) files.push(...(await listFiles(source.dir, source.pattern)));
  return files;
}

export async function collectTestFiles() {
  return listFiles(TEST_DIR, TEST_PATTERN);
}

export function applyFilter(files, filter) {
  if (typeof filter !== 'string' || !filter.trim()) return files;
  const needle = filter.trim().toLowerCase();
  return files.filter((file) => file.toLowerCase().includes(needle));
}

export function parseArgs(argv = []) {
  const options = { filter: '', syntaxOnly: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--syntax-only') options.syntaxOnly = true;
    else if (arg === '--filter') options.filter = argv[++index] || '';
    else if (arg.startsWith('--filter=')) options.filter = arg.slice('--filter='.length);
    else throw new Error(`UNKNOWN_CHECK_ARGUMENT:${arg}`);
  }
  return options;
}

function runNode(args, { timeoutMs = TEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ ok: false, output: `${output}\nTIMEOUT after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) resolve({ ok: false, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) resolve({ ok: code === 0, output });
    });
  });
}

async function runStage(label, files, toArgs) {
  const failures = [];
  for (const file of files) {
    const result = await runNode(toArgs(file));
    if (result.ok) continue;
    failures.push(file);
    console.error(`\n✖ ${label}: ${file}\n${result.output.trimEnd()}`);
  }
  console.log(`${label}: ${files.length - failures.length}/${files.length} passed`);
  return failures;
}

export async function runChecks({ filter = '', syntaxOnly = false } = {}) {
  const startedAt = Date.now();
  const syntaxFiles = applyFilter(await collectSyntaxTargets(), filter);
  const testFiles = syntaxOnly ? [] : applyFilter(await collectTestFiles(), filter);

  const failures = [
    ...(await runStage('syntax', syntaxFiles, (file) => ['--check', file])),
    ...(await runStage('tests', testFiles, (file) => [file]))
  ];

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (failures.length) {
    console.error(`\ncheck FAILED in ${seconds}s — ${failures.length} file(s):\n${failures.map((file) => `  - ${file}`).join('\n')}`);
  } else {
    console.log(`check OK in ${seconds}s — ${syntaxFiles.length} file(s) parsed, ${testFiles.length} test suite(s) passed`);
  }
  return { failures, syntaxFiles, testFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { failures } = await runChecks(parseArgs(process.argv.slice(2)));
  process.exitCode = failures.length ? 1 : 0;
}
