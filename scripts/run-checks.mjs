import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_DIRECTORIES = Object.freeze([
  Object.freeze({ directory: 'lib', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ directory: 'scripts', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ directory: 'public', extensions: Object.freeze(['.js']) })
]);
const ROOT_SYNTAX_FILES = Object.freeze(['server.mjs']);
const TEST_PREFIX = 'test-';
const TEST_EXTENSION = '.mjs';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_CAPTURED_OUTPUT = 4000;

function sortedRelativePaths(directory, names, extensions) {
  return names
    .filter((name) => extensions.some((extension) => name.endsWith(extension)))
    .sort()
    .map((name) => `${directory}/${name}`);
}

async function readDirectoryNames(root, directory) {
  try {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/** Sözdizimi kontrolü yapılacak tüm kaynak dosyaları keşfeder. */
export async function discoverSyntaxTargets(root = ROOT) {
  const targets = [...ROOT_SYNTAX_FILES];
  for (const { directory, extensions } of SYNTAX_DIRECTORIES) {
    const names = await readDirectoryNames(root, directory);
    targets.push(...sortedRelativePaths(directory, names, extensions));
  }
  return targets;
}

/** `scripts/test-*.mjs` dosyalarını keşfeder; yeni test eklendiğinde otomatik kapsanır. */
export function selectTestScripts(names) {
  return names
    .filter((name) => name.startsWith(TEST_PREFIX) && name.endsWith(TEST_EXTENSION))
    .sort()
    .map((name) => `scripts/${name}`);
}

export async function discoverTestScripts(root = ROOT) {
  return selectTestScripts(await readDirectoryNames(root, 'scripts'));
}

function truncate(output) {
  const text = output.trim();
  if (text.length <= MAX_CAPTURED_OUTPUT) return text;
  return `${text.slice(0, MAX_CAPTURED_OUTPUT)}\n… (çıktı kısaltıldı)`;
}

function runNode(args, { root, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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
      const output = truncate(Buffer.concat(chunks).toString('utf8'));
      if (timedOut) resolve({ ok: false, output: `${timeoutMs} ms zaman aşımı\n${output}` });
      else resolve({ ok: code === 0, output });
    });
  });
}

async function runPool(items, worker, concurrency) {
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

/** Sonuçları özetler; hiçbir başarısızlık gizlenmez. */
export function summarize(results) {
  const failures = results.filter((result) => !result.ok);
  return Object.freeze({
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    failures: Object.freeze(failures.map((failure) => Object.freeze({ ...failure })))
  });
}

export function exitCodeFor(...summaries) {
  return summaries.some((summary) => summary.failed > 0) ? 1 : 0;
}

async function runPhase(title, items, buildArgs, { root, timeoutMs, concurrency }) {
  console.log(`\n▶ ${title} (${items.length})`);
  const results = await runPool(
    items,
    async (item) => ({ name: item, ...(await runNode(buildArgs(item), { root, timeoutMs })) }),
    concurrency
  );
  for (const result of results) console.log(`  ${result.ok ? '✔' : '✖'} ${result.name}`);
  return summarize(results);
}

function reportFailures(title, summary) {
  if (summary.failed === 0) return;
  console.log(`\n✖ ${title} — ${summary.failed} başarısız:`);
  for (const failure of summary.failures) {
    console.log(`\n──── ${failure.name} ────`);
    console.log(failure.output || '(çıktı yok)');
  }
}

export async function runChecks({
  root = ROOT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  concurrency = Math.max(2, Math.min(8, availableParallelism()))
} = {}) {
  const syntaxTargets = await discoverSyntaxTargets(root);
  const testScripts = await discoverTestScripts(root);

  const syntax = await runPhase('Sözdizimi kontrolü', syntaxTargets, (file) => ['--check', file], {
    root, timeoutMs, concurrency
  });
  const registry = await runPhase('Kayıt doğrulama', ['scripts/validate-agent-registry.mjs'], (file) => [file], {
    root, timeoutMs, concurrency
  });
  const tests = await runPhase('Testler', testScripts, (file) => [file], { root, timeoutMs, concurrency });

  reportFailures('Sözdizimi kontrolü', syntax);
  reportFailures('Kayıt doğrulama', registry);
  reportFailures('Testler', tests);

  console.log(
    `\nÖzet — sözdizimi ${syntax.passed}/${syntax.total}, kayıt ${registry.passed}/${registry.total}, test ${tests.passed}/${tests.total}`
  );
  return { syntax, registry, tests, exitCode: exitCodeFor(syntax, registry, tests) };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const { exitCode } = await runChecks();
  if (exitCode !== 0) console.log('\nKapı kırmızı: yukarıdaki tüm başarısızlıklar giderilmelidir.');
  else console.log('\nKapı yeşil.');
  process.exit(exitCode);
}
