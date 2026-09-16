import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPED_BUILD_DIR = path.join(ROOT, 'public', 'typed-build');
const TYPED_BUNDLES = [
  'app-runtime.js',
  'prompt-library-smart-fill.js',
  'prompt-library-command-palette.js',
  'prompt-library-smart-fill-hints.js',
  'scheduled-tasks-countdown.js'
];
const BUILD_TIMEOUT_MS = 300_000;
const SYNTAX_TARGETS = [
  { dir: '.', extensions: ['.mjs'] },
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];
const SUITE_TIMEOUT_MS = 120_000;
const SYNTAX_TIMEOUT_MS = 30_000;
const MAX_FAILURE_OUTPUT_LINES = 40;
const MAX_CAPTURE_BYTES = 64 * 1024;

function parseArgs(argv) {
  const options = { filters: [], list: false, skipBuild: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') options.list = true;
    else if (arg === '--skip-build') options.skipBuild = true;
    else if (arg === '--filter') options.filters.push(argv[++index] ?? '');
    else if (arg.startsWith('--filter=')) options.filters.push(arg.slice('--filter='.length));
    else if (!arg.startsWith('-')) options.filters.push(arg);
    else throw new Error(`UNKNOWN_CHECK_OPTION:${arg}`);
  }
  options.filters = options.filters
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
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

function run(command, args, { timeoutMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let capturedBytes = 0;
    let outputTruncated = false;
    let timedOut = false;
    const append = (chunk) => {
      if (capturedBytes >= MAX_CAPTURE_BYTES) {
        outputTruncated = true;
        return;
      }
      const remaining = MAX_CAPTURE_BYTES - capturedBytes;
      const text = chunk.toString('utf8');
      const encoded = Buffer.from(text, 'utf8');
      const slice = encoded.length > remaining ? encoded.subarray(0, remaining) : encoded;
      output += slice.toString('utf8');
      capturedBytes += slice.length;
      if (slice.length < encoded.length) outputTruncated = true;
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        output: `${output}${outputTruncated ? '\nOUTPUT_TRUNCATED' : ''}\n${error.message}`,
        durationMs: Date.now() - started
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        output: `${output}${outputTruncated ? '\nOUTPUT_TRUNCATED' : ''}${timedOut ? `\nTIMEOUT: ${timeoutMs} ms` : ''}`,
        durationMs: Date.now() - started
      });
    });
  });
}

async function runPool(items, worker, concurrency) {
  if (!items.length) return [];
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

async function newestMtime(files) {
  let newest = 0;
  for (const file of files) {
    const info = await stat(file).catch(() => null);
    if (info) newest = Math.max(newest, info.mtimeMs);
  }
  return newest;
}

/**
 * `public/typed-build/*.js` is build output: index.html loads it, the service
 * worker caches it and the shell-cache contract asserts every cached asset
 * exists on disk. It is not committed, so the gate regenerates it whenever a
 * TypeScript source or a build configuration file is newer than the bundles.
 */
async function typedBundlesAreStale() {
  const bundles = TYPED_BUNDLES.map((name) => path.join(TYPED_BUILD_DIR, name));
  for (const bundle of bundles) {
    if (!(await stat(bundle).catch(() => null))) return true;
  }
  const publicFiles = await collectFiles({ dir: 'public', extensions: ['.ts'] });
  const typedFiles = await collectFiles({ dir: 'public/typed', extensions: ['.ts'] });
  const sources = [...publicFiles, ...typedFiles, 'vite.config.ts', 'tsconfig.json', 'package.json']
    .map((file) => path.join(ROOT, file));
  return (await newestMtime(sources)) > (await newestMtime(bundles));
}

function tail(text) {
  const lines = String(text || '').trimEnd().split('\n');
  return lines.slice(-MAX_FAILURE_OUTPUT_LINES).join('\n');
}

try {
  const options = parseArgs(process.argv.slice(2));
  const concurrency = Math.max(1, Math.min(4, os.cpus()?.length ?? 1));
  const syntaxFiles = (await Promise.all(SYNTAX_TARGETS.map(collectFiles))).flat();
  const scriptFiles = await collectFiles({ dir: 'scripts', extensions: ['.mjs'] });
  const validateSuites = scriptFiles
    .filter((file) => path.basename(file).startsWith('validate-'))
    .map((file) => path.basename(file));
  const testSuites = scriptFiles
    .filter((file) => path.basename(file).startsWith('test-'))
    .map((file) => path.basename(file));
  const matchesFilter = (suite) => !options.filters.length || options.filters.some((filter) => suite.includes(filter));
  const suites = [...validateSuites, ...testSuites].filter(matchesFilter);

  if (options.list) {
    console.log(suites.join('\n'));
    process.exit(0);
  }

  const failures = [];

  if (!options.skipBuild && (await typedBundlesAreStale())) {
    console.log('build: tipli paketler yeniden üretiliyor (tsc --noEmit && vite build)');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const build = await run(npm, ['run', 'build'], { timeoutMs: BUILD_TIMEOUT_MS });
    console.log(`build: ${build.ok ? 'tamam' : 'BAŞARISIZ'} (${(build.durationMs / 1000).toFixed(1)}s)`);
    if (!build.ok) failures.push({ name: 'build typed-build', output: build.output });
  }

  console.log(`syntax: ${syntaxFiles.length} dosya kontrol ediliyor`);
  const syntaxResults = await runPool(
    syntaxFiles,
    (file) => run(process.execPath, ['--check', file], { timeoutMs: SYNTAX_TIMEOUT_MS }),
    concurrency
  );
  let syntaxFailures = 0;
  syntaxResults.forEach((result, index) => {
    if (result.ok) return;
    syntaxFailures += 1;
    failures.push({ name: `syntax ${syntaxFiles[index]}`, output: result.output });
  });
  console.log(syntaxFailures ? `syntax: ${syntaxFailures} dosya başarısız` : `syntax: ${syntaxFiles.length} dosya tamam`);

  console.log(`check: ${suites.length} paket çalıştırılıyor (eşzamanlılık ${concurrency})`);
  const suiteResults = await runPool(
    suites,
    (suite) => run(process.execPath, [path.join('scripts', suite)], { timeoutMs: SUITE_TIMEOUT_MS }),
    concurrency
  );
  suiteResults.forEach((result, index) => {
    const suite = suites[index];
    console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${suite} (${(result.durationMs / 1000).toFixed(1)}s)`);
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
  console.log(`\nTüm kontroller tamam: ${syntaxFiles.length} syntax, ${suites.length} doğrulama/test paketi`);
} catch (error) {
  console.error(error?.message || 'CHECK_RUNNER_FAILED');
  process.exit(1);
}
