#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Kontrol edilecek dosyalar elle tutulan bir listeden değil, depo içeriğinden
// keşfedilir. Böylece yeni bir lib/ modülü veya scripts/test-*.mjs dosyası
// eklendiğinde kapı kendiliğinden genişler ve sessizce kapsam dışı kalamaz.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Yalnızca gerçek bir dış servis gerektiren testler kapı dışında tutulur.
// Her giriş, neden hariç tutulduğunu açıklamak zorundadır.
export const EXCLUDED_TESTS = new Map([
  ['test-redis-schedule-lease-live.mjs', 'canlı Redis sunucusu gerektirir (REDIS_URL ile elle çalıştırılır)']
]);

function listFiles(dir, extension) {
  return readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => path.join(dir, name));
}

export function discoverSyntaxTargets() {
  return [
    'server.mjs',
    ...listFiles('lib', '.mjs'),
    ...listFiles('scripts', '.mjs'),
    ...listFiles('public', '.js')
  ];
}

export function discoverTests() {
  return listFiles('scripts', '.mjs')
    .map((file) => path.basename(file))
    .filter((name) => name.startsWith('test-') && !EXCLUDED_TESTS.has(name));
}

function run(args, label) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status === 0) return { ok: true, label };
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd();
  return { ok: false, label, output: output || `çıkış kodu ${result.status}` };
}

function main() {
  const syntaxTargets = discoverSyntaxTargets();
  const testTargets = discoverTests();
  const failures = [];

  console.log(`Sözdizimi kontrolü: ${syntaxTargets.length} dosya`);
  for (const target of syntaxTargets) {
    const result = run(['--check', target], target);
    if (!result.ok) failures.push(result);
  }

  console.log('Agent registry doğrulaması');
  const registry = run(['scripts/validate-agent-registry.mjs'], 'validate-agent-registry.mjs');
  if (!registry.ok) failures.push(registry);

  console.log(`Test çalıştırması: ${testTargets.length} test`);
  for (const name of testTargets) {
    const result = run([path.join('scripts', name)], name);
    if (result.ok) {
      console.log(`  ok   ${name}`);
    } else {
      console.log(`  FAIL ${name}`);
      failures.push(result);
    }
  }

  for (const [name, reason] of EXCLUDED_TESTS) {
    console.log(`  skip ${name} — ${reason}`);
  }

  console.log('');
  if (failures.length === 0) {
    console.log(`Tüm kontroller geçti: ${syntaxTargets.length} sözdizimi, ${testTargets.length} test, ${EXCLUDED_TESTS.size} atlandı.`);
    return 0;
  }

  // Başarısızlıklar asla gizlenmez; her biri tam çıktısıyla raporlanır.
  console.log(`BAŞARISIZ: ${failures.length} kontrol geçmedi.`);
  for (const failure of failures) {
    console.log(`\n--- ${failure.label} ---`);
    console.log(failure.output);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
