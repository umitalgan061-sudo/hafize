#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Neden ayrı bir runner var: kapı önceden package.json içinde elle bakımı
// yapılan uzun bir `&&` zinciriydi. Bunun iki yapısal sorunu vardı:
//   1. Zincir ilk hatada durduğu için sonraki tüm testler sessizce
//      çalışmıyordu — tek bir bayat assertion yüzlerce testi gizleyebiliyordu.
//   2. Yeni test dosyaları zincire elle eklenmediğinde hiç çalışmıyordu.
// Bu runner testleri diskten keşfeder, hepsini çalıştırır ve tüm
// başarısızlıkları birlikte raporlar. Böylece yeni test dosyası eklemek
// otomatik olarak kapıya dahil olur.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Kapıdan bilinçli olarak çıkarılan testler. Her giriş bir gerekçe taşır;
// gerekçesiz çıkarma yapılmaz.
const OPT_OUT = new Map([
  ['test-redis-schedule-lease-live.mjs', 'Canlı Redis sunucusu gerektirir; manuel olarak çalıştırılır.']
]);

const SYNTAX_TARGETS = [
  { dir: 'lib', extensions: ['.mjs'] },
  { dir: 'scripts', extensions: ['.mjs'] },
  { dir: 'public', extensions: ['.js'] },
  { dir: '.', extensions: ['.mjs'], shallow: true }
];

async function listFiles({ dir, extensions, shallow = false }) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensions.includes(path.extname(entry.name)))
    .filter((entry) => !shallow || dir !== '.' || !entry.name.startsWith('.'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ label, ok: code === 0, output: output.trim() }));
  });
}

async function main() {
  const started = Date.now();
  const failures = [];

  const syntaxFiles = (await Promise.all(SYNTAX_TARGETS.map(listFiles))).flat();
  const syntaxResults = await Promise.all(
    syntaxFiles.map((file) => run(['--check', file], `syntax ${file}`))
  );
  for (const result of syntaxResults) if (!result.ok) failures.push(result);
  console.log(`syntax: ${syntaxFiles.length} dosya kontrol edildi, ${syntaxResults.filter((r) => !r.ok).length} hata`);

  const registry = await run([path.join('scripts', 'validate-agent-registry.mjs')], 'validate-agent-registry.mjs');
  if (registry.ok) console.log(registry.output);
  else failures.push(registry);

  const scriptFiles = await readdir(path.join(ROOT, 'scripts'));
  const testFiles = scriptFiles
    .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
    .filter((name) => !OPT_OUT.has(name))
    .sort();

  // Testler birbirinden bağımsız süreçlerde çalışır; ilk hata sonrakileri
  // durdurmaz, böylece tek turda tüm başarısızlıklar görülür.
  let passed = 0;
  for (const name of testFiles) {
    const result = await run([path.join('scripts', name)], name);
    if (result.ok) {
      passed += 1;
      process.stdout.write(`  ok  ${name}\n`);
    } else {
      failures.push(result);
      process.stdout.write(`FAIL  ${name}\n`);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\ntest: ${passed}/${testFiles.length} geçti (${seconds}s)`);
  for (const [name, reason] of OPT_OUT) console.log(`atlandı: ${name} — ${reason}`);

  if (failures.length) {
    console.log(`\n${failures.length} başarısız kontrol:`);
    for (const failure of failures) {
      console.log(`\n──── ${failure.label} ────`);
      console.log(failure.output || '(çıktı yok)');
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nTüm kontroller geçti.');
}

await main();
