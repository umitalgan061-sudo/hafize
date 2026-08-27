import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SYNTAX_DIRECTORIES = Object.freeze([
  Object.freeze({ dir: 'lib', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ dir: 'scripts', extensions: Object.freeze(['.mjs']) }),
  Object.freeze({ dir: 'public', extensions: Object.freeze(['.js']) })
]);
const ROOT_SYNTAX_FILES = Object.freeze(['server.mjs']);
const RUNNABLE_PREFIXES = Object.freeze(['test-', 'validate-']);
const TARGET_TIMEOUT_MS = 120_000;
const CONCURRENCY = 4;

async function listFiles(directory, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

export async function discoverCheckTargets() {
  const syntax = [...ROOT_SYNTAX_FILES];
  for (const { dir, extensions } of SYNTAX_DIRECTORIES) {
    syntax.push(...(await listFiles(dir, extensions)));
  }

  const runnable = syntax.filter((file) => {
    if (!file.startsWith('scripts/')) return false;
    const name = path.basename(file);
    return RUNNABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
  });

  return Object.freeze({ syntax: Object.freeze(syntax), runnable: Object.freeze(runnable) });
}

function runTarget({ label, args }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TARGET_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ label, ok: false, output: String(error?.message || error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8').trim();
      if (timedOut) resolve({ label, ok: false, output: `${output}\nTIMEOUT after ${TARGET_TIMEOUT_MS} ms` });
      else resolve({ label, ok: code === 0, output });
    });
  });
}

async function runAll(targets) {
  const results = new Array(targets.length);
  let next = 0;

  async function worker() {
    while (next < targets.length) {
      const index = next++;
      results[index] = await runTarget(targets[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  return results;
}

function report(kind, results) {
  const failures = results.filter((result) => !result.ok);
  console.log(`${kind}: ${results.length - failures.length}/${results.length} passed`);
  for (const failure of failures) {
    console.log(`\n--- FAIL (${kind}): ${failure.label} ---`);
    console.log(failure.output.split('\n').slice(-25).join('\n'));
  }
  return failures;
}

export async function main() {
  const { syntax, runnable } = await discoverCheckTargets();

  const syntaxResults = await runAll(syntax.map((file) => ({ label: file, args: ['--check', file] })));
  const runnableResults = await runAll(runnable.map((file) => ({ label: file, args: [file] })));

  const failures = [
    ...report('syntax', syntaxResults),
    ...report('run', runnableResults)
  ];

  if (failures.length) {
    console.error(`\ncheck FAILED: ${failures.length} target(s) — ${failures.map((f) => f.label).join(', ')}`);
    process.exitCode = 1;
    return false;
  }

  console.log('\ncheck OK: every discovered source parsed and every discovered test passed');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
