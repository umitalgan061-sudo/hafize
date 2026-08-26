#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Neden: `check` betiği elle bakımı yapılan tek satırlık dev bir zincirdi.
// Yeni test dosyaları eklendiğinde zincire eklenmeyi unutuyor, kapı sessizce
// kör kalıyordu (85 test dosyasının 32'si hiç çalışmıyordu). Bu betik test ve
// kaynak dosyalarını diskten keşfeder; böylece kapsam listesi kod ile birlikte
// kendiliğinden güncel kalır.
//
// Kullanım:
//   node scripts/run-checks.mjs                 → tüm sözdizimi + test kapısı
//   node scripts/run-checks.mjs --filter=voice  → yalnızca eşleşen testler

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Sözdizimi taraması yapılan dizinler. Her kayıt: [dizin, uzantı listesi].
const SYNTAX_TARGETS = [
  ['lib', ['.mjs']],
  ['public', ['.js']],
  ['scripts', ['.mjs']]
];
const ROOT_SYNTAX_FILES = ['server.mjs'];

// Testten önce çalışan doğrulayıcılar (test dosyası adlandırma kalıbına uymazlar).
const VALIDATORS = ['scripts/validate-agent-registry.mjs'];

function parseFilter(argv) {
  const raw = argv.find((arg) => arg.startsWith('--filter='));
  if (!raw) return null;
  const terms = raw
    .slice('--filter='.length)
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  return terms.length ? terms : null;
}

async function listFiles(dir, extensions) {
  let entries;
  try {
    entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function runNode(args, relativePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ relativePath, code: 1, stdout, stderr: String(error) }));
    child.on('close', (code) => resolve({ relativePath, code: code ?? 1, stdout, stderr }));
  });
}

function report(failures, label, total) {
  if (failures.length === 0) {
    console.log(`✓ ${label}: ${total} dosya geçti`);
    return;
  }
  console.error(`\n✗ ${label}: ${failures.length}/${total} başarısız\n`);
  for (const failure of failures) {
    console.error(`--- ${failure.relativePath} ---`);
    const output = `${failure.stdout}${failure.stderr}`.trim();
    console.error(output || '(çıktı yok)');
    console.error('');
  }
}

async function main() {
  const filter = parseFilter(process.argv.slice(2));
  const matches = (relativePath) =>
    !filter || filter.some((term) => path.basename(relativePath).includes(term));

  const discovered = (
    await Promise.all(SYNTAX_TARGETS.map(([dir, extensions]) => listFiles(dir, extensions)))
  ).flat();
  const syntaxFiles = [...ROOT_SYNTAX_FILES, ...discovered];
  const testFiles = discovered.filter(
    (file) => file.startsWith('scripts/test-') && file.endsWith('.mjs')
  );
  const selectedTests = testFiles.filter(matches);

  if (selectedTests.length === 0) {
    console.error(`Filtre hiçbir teste uymadı: ${filter?.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  // 1) Sözdizimi taraması. Filtre yalnızca testleri daraltır; sözdizimi kapısı
  //    hızlı olduğu için her zaman tam çalışır.
  const syntaxResults = await Promise.all(
    syntaxFiles.map((file) => runNode(['--check', file], file))
  );
  const syntaxFailures = syntaxResults.filter((result) => result.code !== 0);
  report(syntaxFailures, 'Sözdizimi', syntaxFiles.length);
  if (syntaxFailures.length > 0) {
    process.exitCode = 1;
    return;
  }

  // 2) Doğrulayıcılar ve testler. Testler geçici dosya/port paylaşabildiği için
  //    sırayla çalıştırılır; tüm paket ~10 saniye sürer.
  const runnable = [...(filter ? [] : VALIDATORS), ...selectedTests];
  const failures = [];
  for (const file of runnable) {
    const result = await runNode([file], file);
    if (result.code === 0) {
      process.stdout.write('.');
    } else {
      process.stdout.write('F');
      failures.push(result);
    }
  }
  process.stdout.write('\n');
  report(failures, 'Testler', runnable.length);

  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }
  console.log(`\nHafize kapısı geçti — ${syntaxFiles.length} dosya tarandı, ${runnable.length} test.`);
}

await main();
