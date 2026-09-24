import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSC_BIN = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const SYNTAX_TARGETS = [
  { dir: '.', extensions: ['.mjs'] },
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] }
];
// `node --check`, ESM olarak algılanan bir `.ts` dosyasını ayrıştırmadan sessizce
// başarılı sayar. Bu yüzden TypeScript kaynakları derleyicinin kendi projeleriyle
// doğrulanır; aksi hâlde bozuk bir `.ts` dosyası kontrol kapısından geçer.
const TYPESCRIPT_PROJECTS = [
  { name: 'typecheck (browser + lib)', args: ['--noEmit'] },
  { name: 'typecheck (server runtime)', args: ['--noEmit', '-p', 'tsconfig.runtime.json'] }
];
const SUITE_TIMEOUT_MS = 120_000;
const SYNTAX_TIMEOUT_MS = 30_000;
const TYPESCRIPT_TIMEOUT_MS = 300_000;
const MAX_FAILURE_OUTPUT_LINES = 40;
const MAX_CAPTURE_BYTES = 64 * 1024;

function parseArgs(argv) {
  const options = { filters: [], list: false, skipTypescript: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') options.list = true;
    else if (arg === '--skip-typescript') options.skipTypescript = true;
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
  console.log(`syntax: ${syntaxFiles.length} dosya kontrol ediliyor`);
  const syntaxResults = await runPool(
    syntaxFiles,
    (file) => run(process.execPath, ['--check', file], { timeoutMs: SYNTAX_TIMEOUT_MS }),
    concurrency
  );
  syntaxResults.forEach((result, index) => {
    if (!result.ok) failures.push({ name: `syntax ${syntaxFiles[index]}`, output: result.output });
  });
  console.log(failures.length ? `syntax: ${failures.length} dosya başarısız` : `syntax: ${syntaxFiles.length} dosya tamam`);

  if (options.skipTypescript) {
    console.log('typescript: atlandı (--skip-typescript)');
  } else {
    console.log(`typescript: ${TYPESCRIPT_PROJECTS.length} proje derleniyor`);
    for (const project of TYPESCRIPT_PROJECTS) {
      const result = await run(process.execPath, [TSC_BIN, ...project.args], { timeoutMs: TYPESCRIPT_TIMEOUT_MS });
      console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${project.name} (${(result.durationMs / 1000).toFixed(1)}s)`);
      if (!result.ok) failures.push({ name: project.name, output: result.output });
    }
  }

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
