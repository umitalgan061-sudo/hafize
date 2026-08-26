import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;

// Directories whose modules are syntax-checked, with the extensions that count.
const SOURCE_DIRECTORIES = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] },
  { dir: 'scripts', extensions: ['.mjs'] }
];
const ROOT_SOURCES = ['server.mjs'];

async function listFiles(dir, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

export async function discoverSourceFiles() {
  const found = [...ROOT_SOURCES];
  for (const { dir, extensions } of SOURCE_DIRECTORIES) found.push(...(await listFiles(dir, extensions)));
  return found;
}

export async function discoverTestFiles() {
  const scripts = await listFiles('scripts', ['.mjs']);
  return scripts.filter((file) => path.basename(file).startsWith('test-'));
}

function run(command, args, { timeoutMs = TEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
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
      resolve({ ok: false, output: `${output}${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ ok: false, output: `${output}\ntimed out after ${timeoutMs}ms` });
      else resolve({ ok: code === 0, output });
    });
  });
}

function report(failures, { sourceCount, testCount }) {
  if (failures.length === 0) {
    console.log(`Check gate OK: ${sourceCount} modules syntax-checked, ${testCount} test scripts passed`);
    return 0;
  }
  for (const failure of failures) {
    console.error(`\n--- FAILED: ${failure.file} (${failure.stage}) ---`);
    console.error(failure.output.trim());
  }
  console.error(`\nCheck gate FAILED: ${failures.length} of ${sourceCount + testCount} checks failed`);
  console.error(failures.map((failure) => `  - ${failure.file}`).join('\n'));
  return 1;
}

export async function runChecks() {
  const sources = await discoverSourceFiles();
  const tests = await discoverTestFiles();
  const failures = [];

  for (const file of sources) {
    const result = await run(process.execPath, ['--check', file], { timeoutMs: 30_000 });
    if (!result.ok) failures.push({ file, stage: 'syntax', output: result.output });
  }
  console.log(`syntax: ${sources.length} modules checked`);

  for (const file of tests) {
    const result = await run(process.execPath, [file]);
    if (result.ok) console.log(`  pass  ${file}`);
    else {
      console.log(`  FAIL  ${file}`);
      failures.push({ file, stage: 'test', output: result.output });
    }
  }

  return report(failures, { sourceCount: sources.length, testCount: tests.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runChecks();
}
