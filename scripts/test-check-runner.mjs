import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { discoverTargets, runChecks } from './run-checks.mjs';

// --- 1. Gerçek depo üzerinde keşif: elle liste yerine dosya sistemi kaynak alınır.

const real = await discoverTargets();

assert.ok(real.syntax.includes('server.mjs'), 'server.mjs syntax kapısında olmalı');
assert.ok(real.syntax.includes('lib/gmail-read-client.mjs'), 'lib modülleri keşfedilmeli');
assert.ok(real.syntax.includes('scripts/run-checks.mjs'), 'çalıştırıcı kendi syntax kapısında olmalı');
assert.ok(real.syntax.includes('public/app.js'), 'public istemci dosyaları keşfedilmeli');
assert.ok(real.tests.includes('scripts/test-tool-runtime.mjs'), 'testler keşfedilmeli');
assert.ok(real.tests.length >= 80, `beklenenden az test keşfedildi: ${real.tests.length}`);

// Test olmayan scripts dosyaları test olarak çalıştırılmaz.
assert.equal(real.tests.includes('scripts/run-checks.mjs'), false);
assert.equal(real.tests.includes('scripts/validate-agent-registry.mjs'), false);

// Doğrulayıcılar ayrı kategoride ama kapının içindedir.
assert.deepEqual(real.validators, ['scripts/validate-agent-registry.mjs']);

// Keşif deterministiktir ve tekrar içermez.
assert.deepEqual(await discoverTargets(), real, 'keşif iki çağrıda aynı sonucu vermeli');
assert.equal(new Set(real.syntax).size, real.syntax.length, 'syntax listesi tekrar içermemeli');
assert.equal(new Set(real.tests).size, real.tests.length, 'test listesi tekrar içermemeli');

// Her test dosyası aynı zamanda syntax kapısındadır.
for (const file of real.tests) {
  assert.ok(real.syntax.includes(file), `${file} syntax kapısında da olmalı`);
}

// --- 2. İzole fixture üzerinde çalıştırma davranışı.

const fixture = await mkdtemp(path.join(tmpdir(), 'hafize-check-'));
try {
  await mkdir(path.join(fixture, 'lib'));
  await mkdir(path.join(fixture, 'scripts'));
  await mkdir(path.join(fixture, 'public'));

  await writeFile(path.join(fixture, 'server.mjs'), 'export const ok = true;\n');
  await writeFile(path.join(fixture, 'lib/good.mjs'), 'export const value = 1;\n');
  await writeFile(path.join(fixture, 'public/client.js'), 'var ok = 1;\n');
  await writeFile(path.join(fixture, 'scripts/helper.mjs'), 'export const helper = 1;\n');
  await writeFile(path.join(fixture, 'scripts/test-passing.mjs'), 'process.exit(0);\n');
  await writeFile(path.join(fixture, 'scripts/validate-thing.mjs'), 'process.exit(0);\n');

  const green = await runChecks({ rootDir: fixture, concurrency: 2, timeoutMs: 30_000 });
  assert.deepEqual(green.failures, [], 'temiz fixture yeşil olmalı');
  assert.deepEqual(green.tests, ['scripts/test-passing.mjs']);
  assert.deepEqual(green.validators, ['scripts/validate-thing.mjs']);
  assert.deepEqual(green.syntax, [
    'server.mjs',
    'lib/good.mjs',
    'scripts/helper.mjs',
    'scripts/test-passing.mjs',
    'scripts/validate-thing.mjs',
    'public/client.js'
  ]);

  // Başarısız test yutulmaz.
  await writeFile(path.join(fixture, 'scripts/test-failing.mjs'), 'throw new Error("BOOM_MARKER");\n');
  // Bozuk syntax da yakalanır.
  await writeFile(path.join(fixture, 'lib/broken.mjs'), 'export const = ;\n');
  // Başarısız doğrulayıcı da yutulmaz.
  await writeFile(path.join(fixture, 'scripts/validate-failing.mjs'), 'process.exit(3);\n');

  const events = [];
  const red = await runChecks({
    rootDir: fixture,
    concurrency: 2,
    timeoutMs: 30_000,
    onEvent: (event) => events.push(event)
  });

  const failedFiles = red.failures.map((failure) => failure.file).sort();
  assert.deepEqual(failedFiles, [
    'lib/broken.mjs',
    'scripts/test-failing.mjs',
    'scripts/validate-failing.mjs'
  ]);

  const syntaxFailure = red.failures.find((failure) => failure.kind === 'syntax');
  assert.equal(syntaxFailure.file, 'lib/broken.mjs');
  const testFailure = red.failures.find((failure) => failure.kind === 'test');
  assert.match(testFailure.output, /BOOM_MARKER/, 'başarısızlık çıktısı korunmalı');
  const validateFailure = red.failures.find((failure) => failure.kind === 'validate');
  assert.equal(validateFailure.file, 'scripts/validate-failing.mjs');

  // Yeni eklenen dosyalar kapıya elle eklenmeden dahil olur.
  assert.ok(red.tests.includes('scripts/test-failing.mjs'));
  assert.ok(red.syntax.includes('lib/broken.mjs'));

  // Her hedef için tam olarak bir olay yayılır.
  assert.equal(events.length, red.syntax.length + red.validators.length + red.tests.length);
  assert.equal(events.filter((event) => !event.ok).length, 3);

  // Sonsuz süren test kapıyı kilitlemez.
  await rm(path.join(fixture, 'scripts/test-failing.mjs'));
  await rm(path.join(fixture, 'scripts/validate-failing.mjs'));
  await rm(path.join(fixture, 'lib/broken.mjs'));
  await writeFile(path.join(fixture, 'scripts/test-hanging.mjs'), 'setInterval(() => {}, 1000);\n');
  const timedOut = await runChecks({ rootDir: fixture, concurrency: 2, timeoutMs: 1_000 });
  assert.equal(timedOut.failures.length, 1);
  assert.equal(timedOut.failures[0].file, 'scripts/test-hanging.mjs');
  assert.match(timedOut.failures[0].output, /TIMEOUT/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

// --- 3. Eksik dizinler keşfi çökertmez.

const empty = await mkdtemp(path.join(tmpdir(), 'hafize-empty-'));
try {
  const result = await discoverTargets(empty);
  assert.deepEqual(result, { syntax: [], tests: [], validators: [] });
} finally {
  await rm(empty, { recursive: true, force: true });
}

console.log('check runner tests passed');
