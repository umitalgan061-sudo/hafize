import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SYNTAX_DIRECTORIES = [
  { directory: 'lib', extensions: ['.mjs'] },
  { directory: 'public', extensions: ['.js'] },
  { directory: 'scripts', extensions: ['.mjs'] }
];
const SYNTAX_ROOT_FILES = ['server.mjs'];
const TEST_PREFIX = 'test-';
const TEST_EXTENSION = '.mjs';

async function listFiles(directory, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

/**
 * Tek kaynaktan gate hedeflerini keşfeder; yeni test dosyası eklendiğinde
 * package.json elle güncellenmediği için sessizce çalıştırılmama riskini kaldırır.
 */
export async function discoverTargets() {
  const syntax = [...SYNTAX_ROOT_FILES];
  for (const { directory, extensions } of SYNTAX_DIRECTORIES) {
    syntax.push(...(await listFiles(directory, extensions)));
  }
  const tests = (await listFiles('scripts', [TEST_EXTENSION])).filter((file) =>
    path.basename(file).startsWith(TEST_PREFIX)
  );
  return Object.freeze({ syntax: Object.freeze(syntax), tests: Object.freeze(tests) });
}

function runNode(args, { timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      output += '\n[timeout]';
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: `${output}\n${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

function tail(output, lines = 12) {
  return output.split('\n').filter(Boolean).slice(-lines).join('\n');
}

export async function runGate({ filter = '', timeoutMs = 120_000, log = console.log } = {}) {
  const targets = await discoverTargets();
  const failures = [];
  let syntaxChecked = 0;

  for (const file of targets.syntax) {
    if (filter && !file.includes(filter)) continue;
    const result = await runNode(['--check', file], { timeoutMs });
    syntaxChecked += 1;
    if (result.code !== 0) failures.push({ file, stage: 'syntax', output: tail(result.output) });
  }

  const executed = [];
  for (const file of targets.tests) {
    if (filter && !file.includes(filter)) continue;
    const started = Date.now();
    const result = await runNode([file], { timeoutMs });
    const durationMs = Date.now() - started;
    executed.push({ file, durationMs, ok: result.code === 0 });
    if (result.code === 0) {
      log(`PASS ${file} (${durationMs}ms)`);
    } else {
      log(`FAIL ${file} (${durationMs}ms)`);
      failures.push({ file, stage: 'test', output: tail(result.output) });
    }
  }

  return { syntaxChecked, executed, failures };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const filter = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : '';
  const startedAt = Date.now();
  const { syntaxChecked, executed, failures } = await runGate({ filter });

  if (failures.length) {
    console.error('\n--- Hafize check gate başarısız ---');
    for (const failure of failures) {
      console.error(`\n[${failure.stage}] ${failure.file}\n${failure.output}`);
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const summary = `syntax=${syntaxChecked} tests=${executed.length} failed=${failures.length} in ${seconds}s`;
  if (failures.length) {
    console.error(`Hafize check gate: ${summary}`);
    process.exitCode = 1;
  } else {
    console.log(`Hafize check gate OK: ${summary}`);
  }
}
