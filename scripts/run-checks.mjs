#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// package.json içinde elle tutulan uzun komut zinciri yerine, kaynak ve test
// dosyalarını diskten keşfeder. Böylece yeni bir lib/ modülü veya scripts/test-*
// dosyası eklendiğinde kapıya elle eklenmeyi unutmak mümkün olmaz.
//
// Kullanım:
//   node scripts/run-checks.mjs            # syntax + test
//   node scripts/run-checks.mjs --syntax   # yalnız syntax
//   node scripts/run-checks.mjs --list     # keşfedilen dosyaları yazdır
//   node scripts/run-checks.mjs --root=DIR # başka bir kök üzerinde çalıştır (test amaçlı)

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rootArg = argv.find((arg) => arg.startsWith('--root='));
const ROOT = rootArg ? path.resolve(rootArg.slice('--root='.length)) : DEFAULT_ROOT;
const TEST_TIMEOUT_MS = 120_000;

// Keşif kapsamı: kaynak ağacı büyüdükçe kapı kendiliğinden büyür.
const SYNTAX_TARGETS = [
  { dir: '.', recursive: false, extensions: ['.mjs'] },
  { dir: 'lib', recursive: true, extensions: ['.mjs'] },
  { dir: 'scripts', recursive: true, extensions: ['.mjs'] },
  { dir: 'public', recursive: true, extensions: ['.js'] }
];

// Yürütülebilir doğrulama betikleri. Diğer scripts/ dosyaları yalnız syntax kontrolünden geçer.
const RUNNABLE_PREFIXES = ['test-', 'validate-'];

// Ağ/servis gerektirdiği için opt-in kalan betikler. Boş bırakılabilir.
const OPT_IN_SCRIPTS = new Set();

function listFiles({ dir, recursive, extensions }) {
  const absolute = path.join(ROOT, dir);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const relative = path.join(dir === '.' ? '' : dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) found.push(...listFiles({ dir: relative, recursive, extensions }));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!extensions.includes(path.extname(entry.name))) continue;
    found.push(relative);
  }
  return found;
}

function discoverSyntaxFiles() {
  const seen = new Set();
  for (const target of SYNTAX_TARGETS) {
    for (const file of listFiles(target)) seen.add(file);
  }
  return [...seen].sort();
}

function discoverRunnableScripts() {
  return listFiles({ dir: 'scripts', recursive: false, extensions: ['.mjs'] })
    .filter((file) => {
      const name = path.basename(file);
      if (OPT_IN_SCRIPTS.has(name)) return false;
      return RUNNABLE_PREFIXES.some((prefix) => name.startsWith(prefix));
    })
    .sort();
}

function isReadableFile(relative) {
  try {
    return statSync(path.join(ROOT, relative)).isFile();
  } catch {
    return false;
  }
}

function runNode(args, { timeout } = {}) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout,
    env: process.env
  });
}

function describeFailure(result) {
  if (result.error?.code === 'ETIMEDOUT') return `zaman aşımı (${TEST_TIMEOUT_MS} ms)`;
  if (result.error) return result.error.message;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (!output) return `çıkış kodu ${result.status}`;
  const lines = output.split('\n');
  return lines.slice(0, 12).join('\n');
}

function runSyntaxChecks(files) {
  const failures = [];
  for (const file of files) {
    const result = runNode(['--check', file], { timeout: TEST_TIMEOUT_MS });
    if (result.status !== 0) failures.push({ file, detail: describeFailure(result) });
  }
  return failures;
}

function runScripts(scripts) {
  const failures = [];
  for (const file of scripts) {
    const started = Date.now();
    const result = runNode([file], { timeout: TEST_TIMEOUT_MS });
    const ms = Date.now() - started;
    if (result.status === 0) {
      console.log(`  ok   ${file} (${ms} ms)`);
      continue;
    }
    console.log(`  FAIL ${file} (${ms} ms)`);
    failures.push({ file, detail: describeFailure(result) });
  }
  return failures;
}

function reportFailures(title, failures) {
  if (!failures.length) return;
  console.error(`\n${title}:`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.file}`);
    console.error(failure.detail);
  }
}

const args = new Set(argv);
const syntaxOnly = args.has('--syntax') || args.has('--syntax-only');
const listOnly = args.has('--list');

try {
  if (!statSync(ROOT).isDirectory()) throw new Error('not a directory');
} catch {
  console.error(`Doğrulama kapısı kökü okunamadı: ${ROOT}`);
  process.exit(1);
}

const syntaxFiles = discoverSyntaxFiles().filter(isReadableFile);
const runnableScripts = discoverRunnableScripts().filter(isReadableFile);

if (!syntaxFiles.length) {
  console.error('Doğrulama kapısı hiçbir kaynak dosyası bulamadı; keşif yapılandırması bozuk.');
  process.exit(1);
}
if (!runnableScripts.length) {
  console.error('Doğrulama kapısı hiçbir test betiği bulamadı; keşif yapılandırması bozuk.');
  process.exit(1);
}

if (listOnly) {
  console.log(`Syntax (${syntaxFiles.length}):`);
  for (const file of syntaxFiles) console.log(`  ${file}`);
  console.log(`\nBetik (${runnableScripts.length}):`);
  for (const file of runnableScripts) console.log(`  ${file}`);
  process.exit(0);
}

console.log(`Syntax kontrolü: ${syntaxFiles.length} dosya`);
const syntaxFailures = runSyntaxChecks(syntaxFiles);

let scriptFailures = [];
if (syntaxOnly) {
  console.log('Betik çalıştırma atlandı (--syntax).');
} else {
  console.log(`Doğrulama betikleri: ${runnableScripts.length} dosya`);
  scriptFailures = runScripts(runnableScripts);
}

reportFailures('Syntax hataları', syntaxFailures);
reportFailures('Başarısız betikler', scriptFailures);

const failureCount = syntaxFailures.length + scriptFailures.length;
if (failureCount > 0) {
  console.error(
    `\nDoğrulama kapısı KIRMIZI: ${syntaxFailures.length} syntax, ${scriptFailures.length} betik hatası.`
  );
  process.exit(1);
}

console.log(
  `\nDoğrulama kapısı YEŞİL: ${syntaxFiles.length} dosya syntax, ${runnableScripts.length} betik başarılı.`
);
