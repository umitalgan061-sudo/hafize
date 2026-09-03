// Hafize kontrol kapısı.
//
// Elle bakımlı dev bir npm script zinciri yerine kaynak dosyaları ve
// `scripts/test-*.mjs` testlerini dosya sisteminden keşfeder. Böylece yeni bir
// test eklendiğinde kapıya ayrıca yazılması gerekmez ve hiçbir test sessizce
// kapının dışında kalmaz.
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_GROUPS = Object.freeze([
  Object.freeze({ dir: 'lib', ext: '.mjs' }),
  Object.freeze({ dir: 'scripts', ext: '.mjs' }),
  Object.freeze({ dir: 'public', ext: '.js' })
]);
const ROOT_SOURCES = Object.freeze(['server.mjs']);
const TEST_PREFIX = 'test-';
const DEFAULT_TIMEOUT_MS = 120_000;

export const PRE_TEST_SCRIPTS = Object.freeze(['scripts/validate-agent-registry.mjs']);

function listFiles(dir, ext) {
  let entries;
  try {
    entries = readdirSync(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

/** Syntax kontrolünden geçirilecek tüm kaynak dosyaları. */
export function discoverSyntaxTargets() {
  return [...ROOT_SOURCES, ...SOURCE_GROUPS.flatMap(({ dir, ext }) => listFiles(dir, ext))];
}

/** Çalıştırılacak tüm test dosyaları. */
export function discoverTestFiles() {
  return listFiles('scripts', '.mjs').filter((file) => path.basename(file).startsWith(TEST_PREFIX));
}

/** Tek bir Node çağrısını izole çalıştırır; asla throw etmez. */
export function runNode(args, { timeoutMs = DEFAULT_TIMEOUT_MS, cwd = ROOT } = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const collect = (chunk) => {
      if (output.length < 64_000) output += String(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, output: String(error?.message || error), durationMs: Date.now() - startedAt });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        code,
        timedOut,
        output: timedOut ? `${output}\nTIMEOUT after ${timeoutMs}ms` : output,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function runStage(label, entries, toArgs) {
  process.stdout.write(`\n${label} (${entries.length})\n`);
  const failures = [];
  for (const entry of entries) {
    const result = await runNode(toArgs(entry));
    if (result.ok) {
      process.stdout.write(`  ok   ${entry} (${result.durationMs}ms)\n`);
      continue;
    }
    failures.push({ entry, result });
    process.stdout.write(`  FAIL ${entry} (exit ${result.code})\n`);
  }
  return failures;
}

function reportFailures(failures) {
  process.stdout.write(`\n${failures.length} kontrol başarısız:\n`);
  for (const { entry, result } of failures) {
    process.stdout.write(`\n===== ${entry} (exit ${result.code}) =====\n${result.output.trimEnd()}\n`);
  }
}

async function main() {
  const syntaxTargets = discoverSyntaxTargets();
  const testFiles = discoverTestFiles();

  const syntaxFailures = await runStage('syntax', syntaxTargets, (file) => ['--check', path.join(ROOT, file)]);
  if (syntaxFailures.length) {
    reportFailures(syntaxFailures);
    process.exitCode = 1;
    return;
  }

  const failures = [
    ...(await runStage('doğrulama', PRE_TEST_SCRIPTS, (file) => [path.join(ROOT, file)])),
    ...(await runStage('test', testFiles, (file) => [path.join(ROOT, file)]))
  ];

  if (failures.length) {
    reportFailures(failures);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\nkontrol kapısı geçti: ${syntaxTargets.length} kaynak, ${testFiles.length} test\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
