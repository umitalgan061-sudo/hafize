// Hafize kontrol kapısı.
//
// Kapı önceden package.json içinde elle tutulan tek satırlık bir `&&` zinciriydi.
// Bu iki soruna yol açıyordu:
//   1. Yeni bir modül veya test eklendiğinde listeye yazılmazsa kapı onu hiç
//      görmüyordu; testlerin üçte biri bu şekilde hiç koşmuyordu.
//   2. Zincirdeki ilk başarısızlık kendisinden sonraki her şeyi durduruyor,
//      tek bir eskimiş beklenti onlarca testi sessizce gizleyebiliyordu.
//
// Bu koşucu hedefleri dosya sisteminden keşfeder ve bir test başarısız olsa da
// kalanları çalıştırıp sonunda tam tabloyu raporlar.

import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tarayıcıda çalışan dosyalar keşfedilmez; yalnızca uygulama kabuğuna ait
// olanlar syntax kontrolünden geçer.
const PUBLIC_SCRIPTS = [
  'app.js',
  'hands-free.js',
  'screen-share.js',
  'sw-policy.js',
  'sw.js',
  'ui-shell.js',
  'voice-input.js',
  'voice-output.js'
];

// Test dosyası olmayan, ayrı bir doğrulayıcı olarak koşan betikler.
const VALIDATORS = ['scripts/validate-agent-registry.mjs'];

async function listModules(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('close', (code) => resolve(code === 0 ? 0 : code ?? 1));
  });
}

async function main() {
  const libModules = await listModules('lib');
  const scriptModules = await listModules('scripts');
  const testModules = scriptModules.filter((file) => path.basename(file).startsWith('test-'));

  const syntaxTargets = [
    'server.mjs',
    ...libModules,
    ...scriptModules,
    ...PUBLIC_SCRIPTS.map((name) => `public/${name}`)
  ];

  const failures = [];

  // 1) Syntax kapısı: burada bir hata varsa testleri koşmanın anlamı yok.
  for (const target of syntaxTargets) {
    if (await run(['--check', target]) !== 0) failures.push(`syntax: ${target}`);
  }
  if (failures.length) {
    console.error(`\nSyntax kontrolü başarısız (${failures.length}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`syntax OK: ${syntaxTargets.length} dosya`);

  // 2) Doğrulayıcılar ve testler: ilk hatada durmaz, tam tabloyu çıkarır.
  for (const target of [...VALIDATORS, ...testModules]) {
    if (await run([target]) !== 0) failures.push(target);
  }

  const total = VALIDATORS.length + testModules.length;
  if (failures.length) {
    console.error(`\n${failures.length}/${total} kontrol başarısız:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nHafize kontrol kapısı geçti: ${syntaxTargets.length} syntax, ${total} test/doğrulayıcı`);
}

await main();
