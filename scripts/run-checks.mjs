import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SYNTAX_SOURCES = Object.freeze([
  { dir: '.', extensions: ['.mjs'], recurse: false },
  { dir: 'lib', extensions: ['.mjs'], recurse: false },
  { dir: 'public', extensions: ['.js'], recurse: false },
  { dir: 'scripts', extensions: ['.mjs'], recurse: false }
]);
// Non test-*.mjs scripts that must still run as part of the gate.
const EXTRA_RUN_TARGETS = Object.freeze(['scripts/validate-agent-registry.mjs']);
// The runner itself must never re-enter the gate recursively.
const RUN_EXCLUDED = Object.freeze(['scripts/run-checks.mjs']);

async function listFiles({ dir, extensions }) {
  const absolute = path.join(ROOT, dir);
  const entries = await readdir(absolute, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.posix.join(dir === '.' ? '' : dir, entry.name))
    .sort();
}

export async function collectSyntaxTargets() {
  const targets = [];
  for (const source of SYNTAX_SOURCES) targets.push(...(await listFiles(source)));
  return targets.filter((target) => !RUN_EXCLUDED.includes(target)).sort();
}

export async function collectRunTargets() {
  const scripts = await listFiles({ dir: 'scripts', extensions: ['.mjs'] });
  const tests = scripts.filter(
    (file) => path.basename(file).startsWith('test-') && !RUN_EXCLUDED.includes(file)
  );
  return [...EXTRA_RUN_TARGETS, ...tests];
}

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function runChecks({ log = console.log, execute = runNode } = {}) {
  const syntaxTargets = await collectSyntaxTargets();
  const runTargets = await collectRunTargets();
  const failures = [];

  log(`Syntax kontrolü: ${syntaxTargets.length} dosya`);
  for (const target of syntaxTargets) {
    const result = await execute(['--check', target]);
    if (result.code !== 0) failures.push({ target, stage: 'syntax', output: result.stderr || result.stdout });
  }

  log(`Test çalıştırma: ${runTargets.length} dosya`);
  for (const target of runTargets) {
    const result = await execute([target]);
    if (result.code === 0) {
      const summary = result.stdout.trim().split('\n').filter(Boolean).pop() ?? 'ok';
      log(`  ok    ${target} — ${summary}`);
    } else {
      log(`  FAIL  ${target}`);
      failures.push({ target, stage: 'test', output: result.stderr || result.stdout });
    }
  }

  if (failures.length) {
    log(`\n${failures.length} kontrol başarısız:`);
    for (const failure of failures) {
      log(`\n--- ${failure.stage}: ${failure.target} ---`);
      log(failure.output.trim());
    }
  } else {
    log(`\nTüm kontroller geçti: ${syntaxTargets.length} syntax, ${runTargets.length} test.`);
  }

  return { syntaxTargets, runTargets, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { failures } = await runChecks();
  process.exitCode = failures.length ? 1 : 0;
}
