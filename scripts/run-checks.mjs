import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Syntax-only files that are not executable test entry points.
const SYNTAX_TARGETS = [
  { dir: '.', match: (name) => name === 'server.mjs' },
  { dir: 'lib', match: (name) => name.endsWith('.mjs') },
  { dir: 'public', match: (name) => name.endsWith('.js') },
  { dir: 'scripts', match: (name) => name.endsWith('.mjs') }
];

// Entry points executed by the gate, in order. Everything matching
// `scripts/test-*.mjs` is discovered automatically so a new test can never be
// silently left out of the gate.
const EXTRA_ENTRY_POINTS = ['scripts/validate-agent-registry.mjs'];

async function listFiles(dir, match) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && match(entry.name))
    .map((entry) => (dir === '.' ? entry.name : `${dir}/${entry.name}`))
    .sort();
}

async function collectSyntaxTargets() {
  const files = [];
  for (const target of SYNTAX_TARGETS) files.push(...(await listFiles(target.dir, target.match)));
  return files;
}

async function collectTests() {
  const tests = await listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));
  return [...EXTRA_ENTRY_POINTS, ...tests];
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ code: 1, output: `${output}${error.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function lastLine(output) {
  const lines = output.trim().split('\n').filter((line) => line.trim());
  return lines.length ? lines[lines.length - 1].trim() : '';
}

const failures = [];

const syntaxTargets = await collectSyntaxTargets();
const syntaxResults = await Promise.all(syntaxTargets.map((file) => run(['--check', file])));
syntaxTargets.forEach((file, index) => {
  const result = syntaxResults[index];
  if (result.code !== 0) failures.push({ name: `syntax ${file}`, output: result.output });
});
console.log(
  failures.length
    ? `syntax: ${syntaxTargets.length - failures.length}/${syntaxTargets.length} files parsed`
    : `syntax OK: ${syntaxTargets.length} files parsed`
);

// Tests run serially so their output stays readable and temp-file based suites
// never race each other. A failing suite does not stop the run: the gate
// reports every failure it finds in one pass.
const tests = await collectTests();
for (const test of tests) {
  const result = await run([test]);
  if (result.code === 0) {
    console.log(`  ok  ${test} — ${lastLine(result.output)}`);
  } else {
    console.log(`  FAIL ${test}`);
    failures.push({ name: test, output: result.output });
  }
}

console.log(`\n${tests.length} suites, ${syntaxTargets.length} syntax targets, ${failures.length} failure(s)`);

if (failures.length) {
  for (const failure of failures) {
    console.error(`\n--- ${failure.name} ---\n${failure.output.trim()}`);
  }
  process.exit(1);
}

console.log('All Hafize checks passed.');
