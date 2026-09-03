// Hafize denetim koşucusu.
//
// Amaç: kontrol kapısını tek satırlık dev bir npm script'i olmaktan çıkarmak.
// Bu koşucu `lib/`, `scripts/` ve `public/` altındaki kaynakları otomatik
// keşfederek syntax kontrolünden geçirir, ardından `scripts/test-*.mjs`
// paketlerinin tamamını çalıştırır. Yeni bir test dosyası eklendiğinde ayrıca
// package.json güncellemek gerekmez; dosya kapıya kendiliğinden dahil olur.
//
// Kullanım:
//   node scripts/run-checks.mjs             tüm kapı
//   node scripts/run-checks.mjs --filter x  yalnız adı x içeren paketler
//   node scripts/run-checks.mjs --list      çalıştırılacak paketleri listeler

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_TARGETS = [
  { dir: '.', extensions: ['.mjs'] },
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];
// Doğrulama/kayıt kontrolleri test paketlerinden önce çalışır.
const PRELUDE_SUITES = ['validate-agent-registry.mjs'];
const SUITE_TIMEOUT_MS = 120_000;
const MAX_FAILURE_OUTPUT_LINES = 40;

function parseArgs(argv) {
  const options = { filter: null, list: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') options.list = true;
    else if (arg === '--filter') options.filter = argv[++index] ?? null;
    else if (arg.startsWith('--filter=')) options.filter = arg.slice('--filter='.length);
    else if (!arg.startsWith('-')) options.filter = arg;
  }
  if (options.filter !== null && !options.filter.trim()) options.filter = null;
  return options;
}

async function collectFiles({ dir, extensions }) {
  const absolute = path.join(ROOT, dir);
  const entries = await readdir(absolute, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

function run(command, args, { timeoutMs = SUITE_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: `${output}\n${error.message}`, durationMs: Date.now() - started });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        output: timedOut ? `${output}\nTIMEOUT: ${timeoutMs} ms` : output,
        durationMs: Date.now() - started
      });
    });
  });
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function tail(text) {
  const lines = text.trimEnd().split('\n');
  return lines.slice(-MAX_FAILURE_OUTPUT_LINES).join('\n');
}

const options = parseArgs(process.argv.slice(2));
const concurrency = Math.max(1, Math.min(4, os.cpus()?.length ?? 1));

const syntaxFiles = (await Promise.all(SYNTAX_TARGETS.map(collectFiles))).flat();
const testFiles = (await collectFiles({ dir: 'scripts', extensions: ['.mjs'] }))
  .filter((file) => path.basename(file).startsWith('test-'))
  .map((file) => path.basename(file));
const suites = [...PRELUDE_SUITES, ...testFiles]
  .filter((suite) => !options.filter || suite.includes(options.filter));

if (options.list) {
  console.log(suites.join('\n'));
  process.exit(0);
}

const failures = [];

console.log(`syntax: ${syntaxFiles.length} dosya kontrol ediliyor`);
const syntaxResults = await runPool(
  syntaxFiles,
  (file) => run(process.execPath, ['--check', file], { timeoutMs: 30_000 }),
  concurrency
);
syntaxResults.forEach((result, index) => {
  if (!result.ok) failures.push({ name: `syntax ${syntaxFiles[index]}`, output: result.output });
});
console.log(
  failures.length ? `syntax: ${failures.length} dosya başarısız` : `syntax: ${syntaxFiles.length} dosya tamam`
);

console.log(`test: ${suites.length} paket çalıştırılıyor (eşzamanlılık ${concurrency})`);
const suiteResults = await runPool(
  suites,
  (suite) => run(process.execPath, [path.join('scripts', suite)]),
  concurrency
);
suiteResults.forEach((result, index) => {
  const suite = suites[index];
  const seconds = (result.durationMs / 1000).toFixed(1);
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${suite} (${seconds}s)`);
  if (!result.ok) failures.push({ name: suite, output: result.output });
});

if (failures.length) {
  console.error(`\n${failures.length} kontrol başarısız:\n`);
  for (const failure of failures) {
    console.error(`--- ${failure.name} ---`);
    console.error(tail(failure.output));
    console.error('');
  }
  process.exit(1);
}

console.log(`\nTüm kontroller tamam: ${syntaxFiles.length} syntax, ${suites.length} test paketi`);
