#!/usr/bin/env node
// Hafize doğrulama koşucusu.
//
// package.json içindeki elle bakımı yapılan uzun `&&` zinciri yerine, kaynak
// dosyaları ve `scripts/test-*.mjs` testlerini otomatik keşfeder. Böylece yeni
// bir test eklendiğinde zincire yazmayı unutmak mümkün olmaz ve sessizce
// çalıştırılmayan test kalmaz.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIRECTORIES = [
  { directory: '.', extensions: ['.mjs'] },
  { directory: 'lib', extensions: ['.mjs'] },
  { directory: 'scripts', extensions: ['.mjs'] },
  { directory: 'public', extensions: ['.js'] }
];
const TEST_PREFIX = 'test-';
const REGISTRY_VALIDATOR = 'scripts/validate-agent-registry.mjs';

async function listFiles({ directory, extensions }) {
  const absolute = path.join(ROOT, directory);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => path.posix.join(directory === '.' ? '' : directory, entry.name))
    .sort();
}

async function collectSourceFiles() {
  const files = [];
  for (const group of SOURCE_DIRECTORIES) files.push(...(await listFiles(group)));
  return files;
}

function collectTestFiles(sourceFiles) {
  return sourceFiles.filter(
    (file) => file.startsWith('scripts/') && path.basename(file).startsWith(TEST_PREFIX)
  );
}

function run(args) {
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

function lastLine(text) {
  const lines = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

async function syntaxCheck(files) {
  const failures = [];
  for (const file of files) {
    const result = await run(['--check', file]);
    if (result.code !== 0) failures.push({ file, detail: lastLine(result.stderr) || 'syntax check failed' });
  }
  return failures;
}

async function runTests(files) {
  const failures = [];
  for (const file of files) {
    const started = Date.now();
    const result = await run([file]);
    const duration = Date.now() - started;
    if (result.code === 0) {
      const summary = lastLine(result.stdout) || 'ok';
      console.log(`  ok   ${file} (${duration}ms) — ${summary}`);
    } else {
      console.log(`  FAIL ${file} (${duration}ms)`);
      const detail = `${result.stdout}${result.stderr}`.trimEnd();
      if (detail) console.log(detail.split('\n').map((line) => `       ${line}`).join('\n'));
      failures.push({ file, detail: lastLine(result.stderr) || `exit ${result.code}` });
    }
  }
  return failures;
}

const sourceFiles = await collectSourceFiles();
const testFiles = collectTestFiles(sourceFiles);

console.log(`Hafize checks: ${sourceFiles.length} kaynak dosyası, ${testFiles.length} test`);

console.log('\n[1/3] syntax');
const syntaxFailures = await syntaxCheck(sourceFiles);
if (syntaxFailures.length === 0) console.log(`  ok   ${sourceFiles.length} dosya`);
else for (const failure of syntaxFailures) console.log(`  FAIL ${failure.file} — ${failure.detail}`);

console.log('\n[2/3] agent registry');
const registryResult = await run([REGISTRY_VALIDATOR]);
const registryFailures = [];
if (registryResult.code === 0) {
  console.log(`  ok   ${lastLine(registryResult.stdout) || REGISTRY_VALIDATOR}`);
} else {
  console.log(`  FAIL ${REGISTRY_VALIDATOR}`);
  registryFailures.push({ file: REGISTRY_VALIDATOR, detail: lastLine(registryResult.stderr) || 'registry validation failed' });
}

console.log('\n[3/3] tests');
const testFailures = await runTests(testFiles);

const failures = [...syntaxFailures, ...registryFailures, ...testFailures];
if (failures.length === 0) {
  console.log(`\nAll checks passed: ${sourceFiles.length} syntax, 1 registry, ${testFiles.length} test.`);
  process.exit(0);
}

console.log(`\n${failures.length} check failed:`);
for (const failure of failures) console.log(`  - ${failure.file}: ${failure.detail}`);
process.exit(1);
