#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Elle bakımı yapılan uzun komut zincirleri yerine depodaki kaynak ve test
// dosyalarını otomatik keşfeder. Yeni bir `scripts/test-*.mjs` eklendiğinde
// kapıya ayrıca kaydedilmesi gerekmez; dosya var olduğu anda çalıştırılır.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Dış servis (canlı Redis, ağ) gerektirdiği için kapıda çalıştırılmayan testler.
// Liste açıktır ve her çalıştırmada raporlanır; sessizce test atlanmaz.
export const OPT_IN_TESTS = Object.freeze({
  'scripts/test-redis-schedule-lease-live.mjs': 'canlı Redis sunucusu gerektirir'
});

const SYNTAX_DIRECTORIES = ['lib', 'public', 'scripts'];
const SYNTAX_ROOT_FILES = ['server.mjs'];
const SYNTAX_EXTENSIONS = new Set(['.mjs', '.js']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git']);

const FRONTEND_TEST_PATTERN = /^scripts\/test-(voice-|ui-shell|sidebar-|hands-free|screen-share|pwa-)/;

export function walk(root, directory) {
  let entries;
  try {
    entries = readdirSync(path.join(root, directory));
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries.sort()) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;
    const relative = `${directory}/${entry}`;
    if (statSync(path.join(root, relative)).isDirectory()) {
      files.push(...walk(root, relative));
      continue;
    }
    if (SYNTAX_EXTENSIONS.has(path.extname(entry))) files.push(relative);
  }
  return files;
}

export function discoverSyntaxTargets(root, scope = 'all') {
  if (scope === 'frontend') return walk(root, 'public');
  const targets = SYNTAX_ROOT_FILES.filter((file) => {
    try {
      return statSync(path.join(root, file)).isFile();
    } catch {
      return false;
    }
  });
  for (const directory of SYNTAX_DIRECTORIES) targets.push(...walk(root, directory));
  return targets;
}

export function discoverTests(root, scope = 'all') {
  return walk(root, 'scripts')
    .filter((file) => path.basename(file).startsWith('test-'))
    .filter((file) => !Object.hasOwn(OPT_IN_TESTS, file))
    .filter((file) => (scope === 'frontend' ? FRONTEND_TEST_PATTERN.test(file) : true));
}

function run(root, argv, label) {
  const result = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8' });
  if (result.status === 0) return { ok: true, label };
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return { ok: false, label, output: output || `çıkış kodu ${result.status}` };
}

export function runChecks({ root = REPO_ROOT, scope = 'all', log = console.log, logError = console.error } = {}) {
  const syntaxTargets = discoverSyntaxTargets(root, scope);
  const tests = discoverTests(root, scope);

  if (!tests.length) {
    logError('Doğrulama kapısı hiç test bulamadı; keşif bozulmuş olabilir.');
    return 1;
  }

  const failures = [];
  for (const target of syntaxTargets) {
    const result = run(root, ['--check', path.join(root, target)], target);
    if (!result.ok) failures.push(result);
  }
  log(`Sözdizimi kontrolü: ${syntaxTargets.length} dosya`);

  for (const test of tests) {
    const result = run(root, [path.join(root, test)], test);
    if (!result.ok) failures.push(result);
  }
  log(`Test çalıştırıldı: ${tests.length} dosya`);

  if (scope !== 'frontend') {
    for (const [file, reason] of Object.entries(OPT_IN_TESTS)) log(`Atlandı (opt-in): ${file} — ${reason}`);
  }

  if (failures.length) {
    logError(`\n${failures.length} kontrol başarısız:`);
    for (const failure of failures) {
      logError(`\n--- ${failure.label} ---`);
      logError(failure.output);
    }
    return 1;
  }

  log(`\nDoğrulama kapısı geçti (${scope === 'frontend' ? 'frontend' : 'tam kapsam'}).`);
  return 0;
}

function parseArgs(argv) {
  const rootArg = argv.find((value) => value.startsWith('--root='));
  return {
    scope: argv.includes('--scope=frontend') ? 'frontend' : 'all',
    root: rootArg ? path.resolve(rootArg.slice('--root='.length)) : REPO_ROOT
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runChecks(parseArgs(process.argv.slice(2))));
}
