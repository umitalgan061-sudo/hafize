#!/usr/bin/env node
// Hafize kalite kapısı: syntax kontrollerini ve tüm test scriptlerini keşfederek çalıştırır.
// Elle bakımı yapılan uzun `&&` zinciri yerine dosya keşfi kullanılır; böylece yeni eklenen
// bir test veya modül kapının dışında kalamaz.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_TIMEOUT_MS = 120_000;
const SYNTAX_DIRECTORIES = [
  { dir: 'lib', extension: '.mjs' },
  { dir: 'scripts', extension: '.mjs' },
  { dir: 'public', extension: '.js' }
];
const ROOT_SYNTAX_FILES = ['server.mjs'];
// Registry doğrulaması bir test dosyası değildir ama kapının parçasıdır.
const EXTRA_CHECK_SCRIPTS = ['scripts/validate-agent-registry.mjs'];

async function listFiles(dir, extension) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

export async function discoverSyntaxTargets() {
  const discovered = await Promise.all(SYNTAX_DIRECTORIES.map(({ dir, extension }) => listFiles(dir, extension)));
  return [...ROOT_SYNTAX_FILES, ...discovered.flat()];
}

export async function discoverCheckScripts() {
  const tests = (await listFiles('scripts', '.mjs')).filter((file) => path.basename(file).startsWith('test-'));
  return [...EXTRA_CHECK_SCRIPTS, ...tests];
}

function runNode(args, { timeoutMs = TEST_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: `${stderr}${error.message}`, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: !timedOut && code === 0, stdout, stderr, timedOut });
    });
  });
}

function lastLine(text) {
  const lines = String(text).split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

function reportFailure(label, result) {
  const detail = result.timedOut
    ? `zaman aşımı (${TEST_TIMEOUT_MS / 1000}s)`
    : lastLine(result.stderr) || lastLine(result.stdout) || 'çıkış kodu 0 değil';
  console.log(`FAIL  ${label} :: ${detail}`);
  const output = `${result.stdout}${result.stderr}`.trimEnd();
  if (output) console.log(output.split('\n').map((line) => `      ${line}`).join('\n'));
}

async function main() {
  const filters = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const matches = (file) => filters.length === 0 || filters.some((filter) => file.includes(filter));

  const syntaxTargets = (await discoverSyntaxTargets()).filter(matches);
  const checkScripts = (await discoverCheckScripts()).filter(matches);
  const failures = [];

  for (const target of syntaxTargets) {
    const result = await runNode(['--check', target], { timeoutMs: 30_000 });
    if (!result.ok) {
      failures.push(target);
      reportFailure(`syntax ${target}`, result);
    }
  }
  console.log(`syntax kontrolü: ${syntaxTargets.length - failures.length}/${syntaxTargets.length} dosya geçti`);

  for (const script of checkScripts) {
    const result = await runNode([script]);
    if (result.ok) {
      console.log(`ok    ${script} :: ${lastLine(result.stdout) || 'geçti'}`);
      continue;
    }
    failures.push(script);
    reportFailure(script, result);
  }

  const total = syntaxTargets.length + checkScripts.length;
  console.log(`\nHafize kapısı: ${total - failures.length}/${total} kontrol geçti`);
  if (failures.length) {
    console.log(`başarısız: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
