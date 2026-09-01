import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;

// Bu dosyanın kendisi bir test değildir; keşif sırasında hariç tutulur.
const RUNNER_BASENAME = 'run-checks.mjs';

function isSyntaxTarget(name) {
  return name.endsWith('.mjs') || name.endsWith('.js');
}

async function listFiles(relativeDir) {
  const absolute = path.join(ROOT, relativeDir);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.posix.join(relativeDir, entry.name))
    .sort();
}

async function discover() {
  const [lib, scripts, publicDir] = await Promise.all([
    listFiles('lib'),
    listFiles('scripts'),
    listFiles('public')
  ]);

  const syntax = [
    'server.mjs',
    ...lib.filter((file) => isSyntaxTarget(file)),
    ...scripts.filter((file) => isSyntaxTarget(file)),
    ...publicDir.filter((file) => isSyntaxTarget(file))
  ];

  const executable = scripts.filter((file) => {
    const base = path.basename(file);
    if (base === RUNNER_BASENAME) return false;
    return base.startsWith('test-') || base.startsWith('validate-');
  });

  return { syntax, executable };
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill('SIGKILL');
      resolve({ label, ok: false, output: `${output}\nTIMEOUT after ${TEST_TIMEOUT_MS}ms` });
    }, TEST_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (!settled) resolve({ label, ok: false, output: `${output}\n${error?.message ?? 'SPAWN_FAILED'}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (!settled) resolve({ label, ok: code === 0, output });
    });
  });
}

const { syntax, executable } = await discover();
const failures = [];

process.stdout.write(`Hafize doğrulama kapısı: ${syntax.length} sözdizimi hedefi, ${executable.length} çalıştırılabilir test\n\n`);

for (const file of syntax) {
  const result = await run(['--check', path.join(ROOT, file)], `syntax ${file}`);
  if (!result.ok) failures.push(result);
}
process.stdout.write(`Sözdizimi kontrolü tamamlandı (${syntax.length - failures.length}/${syntax.length} geçti)\n`);

const syntaxFailureCount = failures.length;
let passed = 0;

for (const file of executable) {
  const result = await run([path.join(ROOT, file)], file);
  if (result.ok) {
    passed += 1;
    process.stdout.write(`  ok  ${file}\n`);
  } else {
    failures.push(result);
    process.stdout.write(`  FAIL ${file}\n`);
  }
}

process.stdout.write(`\nTest sonucu: ${passed}/${executable.length} geçti\n`);

if (failures.length === 0) {
  process.stdout.write('Doğrulama kapısı yeşil.\n');
  process.exit(0);
}

process.stdout.write(`\n=== ${failures.length} başarısızlık (${syntaxFailureCount} sözdizimi) ===\n`);
for (const failure of failures) {
  process.stdout.write(`\n--- ${failure.label} ---\n${failure.output.trimEnd()}\n`);
}
process.exit(1);
