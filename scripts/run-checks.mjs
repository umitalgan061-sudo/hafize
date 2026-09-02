import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTAX_TARGETS = [
  { dir: '.', match: (name) => name === 'server.mjs' },
  { dir: 'lib', match: (name) => name.endsWith('.mjs') },
  { dir: 'scripts', match: (name) => name.endsWith('.mjs') },
  { dir: 'public', match: (name) => name.endsWith('.js') }
];
const TEST_TIMEOUT_MS = 120_000;

async function listFiles(dir, match) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && match(entry.name))
    .map((entry) => (dir === '.' ? entry.name : `${dir}/${entry.name}`))
    .sort();
}

export async function collectSyntaxTargets() {
  const groups = await Promise.all(SYNTAX_TARGETS.map(({ dir, match }) => listFiles(dir, match)));
  return groups.flat();
}

export async function collectTestScripts() {
  return listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));
}

function runNode(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, TEST_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ label, ok: false, output: String(error?.message || error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString('utf8').trim();
      if (timedOut) resolve({ label, ok: false, output: `${label} zaman aşımına uğradı (${TEST_TIMEOUT_MS} ms)` });
      else resolve({ label, ok: code === 0, output });
    });
  });
}

async function main() {
  const started = Date.now();
  const [syntaxTargets, testScripts] = await Promise.all([collectSyntaxTargets(), collectTestScripts()]);
  const failures = [];

  process.stdout.write(`syntax: ${syntaxTargets.length} dosya\n`);
  for (const target of syntaxTargets) {
    const result = await runNode(['--check', target], target);
    if (!result.ok) failures.push(result);
  }

  const registry = await runNode(['scripts/validate-agent-registry.mjs'], 'scripts/validate-agent-registry.mjs');
  if (!registry.ok) failures.push(registry);

  process.stdout.write(`test: ${testScripts.length} betik\n`);
  for (const script of testScripts) {
    const result = await runNode([script], script);
    process.stdout.write(`${result.ok ? 'ok  ' : 'FAIL'} ${script}\n`);
    if (!result.ok) failures.push(result);
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length) {
    process.stdout.write(`\n${failures.length} kontrol başarısız (${seconds} s):\n`);
    for (const failure of failures) {
      process.stdout.write(`\n--- ${failure.label} ---\n${failure.output}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`\nTüm kontroller geçti: ${syntaxTargets.length} syntax + ${testScripts.length} test (${seconds} s)\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
