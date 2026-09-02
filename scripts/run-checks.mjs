#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Bu betik `package.json` içindeki elle yazılmış uzun komut zincirinin yerine
// geçer. Dosyaları diskten keşfeder; böylece yeni bir `lib/`, `public/` veya
// `scripts/test-*` dosyası eklendiğinde kapıya elle eklenmeyi unutmak mümkün
// değildir. Daha önce 85 test dosyasından 33'ü (OAuth, PKCE, token store,
// Canva read client, personal memory runtime, hands-free ve screen-share
// dahil) hiçbir zaman çalıştırılmıyordu.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = 'run-checks.mjs';

// Ağ, canlı Redis veya el ile kurulum isteyen testler burada listelenir.
// Şu an tümü bağımlılıksız çalıştığı için liste boştur; bir test dışlanacaksa
// gerekçesi bu listede açıkça yazılır.
export const SKIPPED_TESTS = new Map();

async function listFiles(dir, extension) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

export async function collectTargets() {
  const [libFiles, publicFiles, scriptFiles] = await Promise.all([
    listFiles('lib', '.mjs'),
    listFiles('public', '.js'),
    listFiles('scripts', '.mjs')
  ]);

  const syntax = ['server.mjs', ...libFiles, ...publicFiles, ...scriptFiles];
  const validators = scriptFiles.filter((file) => path.basename(file).startsWith('validate-'));
  const tests = scriptFiles.filter((file) => path.basename(file).startsWith('test-'));
  const runnable = [...validators, ...tests].filter((file) => path.basename(file) !== SELF);

  return { syntax, runnable };
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => resolve({ code: 1, output: `${output}${error.message}\n` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main(filter) {
  const matchesFilter = (name) => filter.length === 0 || filter.some((needle) => name.includes(needle));

  const started = Date.now();
  const { syntax, runnable } = await collectTargets();
  const failures = [];

  const syntaxTargets = syntax.filter(matchesFilter);
  const syntaxResults = await Promise.all(
    syntaxTargets.map(async (file) => ({ file, ...(await run(process.execPath, ['--check', file])) }))
  );
  for (const result of syntaxResults) {
    if (result.code !== 0) failures.push({ file: result.file, stage: 'syntax', output: result.output });
  }
  console.log(`syntax: ${syntaxTargets.length - failures.length}/${syntaxTargets.length} dosya geçti`);

  let passed = 0;
  let skipped = 0;
  for (const file of runnable) {
    if (!matchesFilter(file)) continue;
    const reason = SKIPPED_TESTS.get(path.basename(file));
    if (reason) {
      skipped += 1;
      console.log(`skip ${file} — ${reason}`);
      continue;
    }
    const result = await run(process.execPath, [file]);
    if (result.code === 0) {
      passed += 1;
      process.stdout.write(`ok   ${file}\n`);
    } else {
      failures.push({ file, stage: 'test', output: result.output });
      process.stdout.write(`FAIL ${file}\n`);
    }
  }

  const failedTests = failures.filter((entry) => entry.stage === 'test').length;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\ntest: ${passed} geçti, ${failedTests} başarısız, ${skipped} atlandı (${seconds}s)`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`\n===== ${failure.stage}: ${failure.file} =====`);
      console.error(failure.output.trimEnd());
    }
    console.error(`\nDoğrulama kapısı başarısız: ${failures.length} hata.`);
    return 1;
  }

  console.log('Doğrulama kapısı başarılı.');
  return 0;
}

// Yalnız doğrudan çalıştırıldığında kapıyı yürüt; import edildiğinde
// (`scripts/test-check-gate.mjs`) sadece keşif fonksiyonlarını sunar.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2).filter((arg) => !arg.startsWith('-')));
}
