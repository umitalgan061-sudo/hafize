// Hafize doğrulama kapısı.
//
// Kapı elle bakılan tek satırlık bir komut zinciri değildir: syntax hedefleri ve
// test dosyaları dosya sisteminden keşfedilir. Böylece yeni bir test dosyası
// eklendiğinde kapıya girmeyi unutmak veya mevcut bir testin zincirden sessizce
// düşmesi yapısal olarak mümkün değildir.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Syntax kontrolü yapılacak dizinler ve kabul edilen uzantılar.
const SYNTAX_SOURCES = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] },
  { dir: 'scripts', extensions: ['.mjs'] }
];
const ROOT_SYNTAX_FILES = ['server.mjs'];

// Test öncesi çalışan, test olmayan doğrulayıcılar.
const VALIDATORS = ['scripts/validate-agent-registry.mjs'];

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

export async function discoverSyntaxTargets() {
  const discovered = await Promise.all(
    SYNTAX_SOURCES.map(({ dir, extensions }) => listFiles(dir, extensions))
  );
  return [...ROOT_SYNTAX_FILES, ...discovered.flat()];
}

export async function discoverTestFiles() {
  const scripts = await listFiles('scripts', ['.mjs']);
  return scripts.filter((file) => path.basename(file).startsWith('test-'));
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ label, ok: code === 0, output }));
  });
}

// `sources` yalnız testlerin kapı davranışını enjekte edebilmesi içindir;
// varsayılan davranış her zaman dosya sistemi keşfidir.
export async function runChecks({ filter = '', log = console.log, sources } = {}) {
  const matches = (file) => !filter || file.includes(filter);
  const syntaxTargets = (sources?.syntaxTargets ?? (await discoverSyntaxTargets())).filter(matches);
  const testFiles = (sources?.testFiles ?? (await discoverTestFiles())).filter(matches);
  const validators = (sources?.validators ?? VALIDATORS).filter(matches);
  const failures = [];

  log(`Syntax: ${syntaxTargets.length} dosya kontrol ediliyor`);
  for (const target of syntaxTargets) {
    const result = await run(['--check', target], target);
    if (!result.ok) {
      failures.push(result);
      log(`  SYNTAX FAIL  ${target}`);
    }
  }

  const suites = [...validators, ...testFiles];
  log(`Test: ${suites.length} paket çalıştırılıyor`);
  for (const suite of suites) {
    const result = await run([suite], suite);
    if (result.ok) {
      log(`  ok    ${suite}`);
    } else {
      failures.push(result);
      log(`  FAIL  ${suite}`);
    }
  }

  const total = syntaxTargets.length + suites.length;
  if (failures.length) {
    log(`\n${failures.length}/${total} kontrol başarısız:`);
    for (const failure of failures) {
      log(`\n----- ${failure.label} -----`);
      log(failure.output.trimEnd());
    }
  } else {
    log(`\nTüm kontroller geçti: ${syntaxTargets.length} syntax + ${suites.length} test paketi`);
  }
  return { ok: failures.length === 0, total, failures: failures.map((failure) => failure.label) };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const { ok } = await runChecks({ filter: process.argv[2] ?? '' });
  if (!ok) process.exitCode = 1;
}
