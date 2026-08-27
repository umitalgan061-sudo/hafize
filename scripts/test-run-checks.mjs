// Doğrulama kapısının kendi testi.
//
// Kapının iki kritik davranışı burada sabitlenir:
// 1. hedefleri dosya sisteminden keşfeder (elle listeye eklemek gerekmez);
// 2. ilk hatada durmaz — bir hedefin kırmızı olması sonrakileri gizlemez.
//
// Test, gerçek depoyu değil geçici bir fixture kökünü çalıştırır; bu sayede
// kapı kendi içinde özyinelemeli olarak tetiklenmez.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { discoverTargets, runChecks } from './run-checks.mjs';

const RUNNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'run-checks.mjs');

async function buildFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'hafize-gate-'));
  await mkdir(path.join(root, 'lib'), { recursive: true });
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await mkdir(path.join(root, 'public'), { recursive: true });
  await writeFile(path.join(root, 'server.mjs'), 'export const ok = true;\n');
  await writeFile(path.join(root, 'lib', 'good.mjs'), 'export const value = 1;\n');
  await writeFile(path.join(root, 'lib', 'broken.mjs'), 'export const value = ;\n');
  await writeFile(path.join(root, 'public', 'client.js'), 'var ready = true;\n');
  await writeFile(path.join(root, 'scripts', 'test-alpha.mjs'), 'process.stdout.write("alpha ok\\n");\n');
  await writeFile(path.join(root, 'scripts', 'test-beta.mjs'), 'throw new Error("BETA_FAILED");\n');
  await writeFile(path.join(root, 'scripts', 'test-gamma.mjs'), 'process.stdout.write("gamma ok\\n");\n');
  await writeFile(path.join(root, 'scripts', 'helper.mjs'), 'export const helper = 1;\n');
  return root;
}

function runCli(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const root = await buildFixture();

try {
  // Keşif: kaynak dosyalar sözdizimi hedefi, test-* dosyaları test hedefi olur.
  const targets = await discoverTargets(root);
  const names = targets.map((target) => target.name);
  assert.ok(names.includes('server.mjs'));
  assert.ok(names.includes(path.join('lib', 'good.mjs')));
  assert.ok(names.includes(path.join('public', 'client.js')));
  assert.ok(names.includes(path.join('scripts', 'test-alpha.mjs')));
  // helper.mjs sözdizimi hedefidir ama test olarak çalıştırılmaz.
  assert.equal(targets.filter((target) => target.name.endsWith('helper.mjs') && target.kind === 'test').length, 0);
  assert.equal(targets.filter((target) => target.name.endsWith('helper.mjs') && target.kind === 'syntax').length, 1);

  // Tam çalıştırma: iki hedef kırmızı, ama diğerleri yine de çalışmış olmalı.
  const result = await runChecks({ root, jobs: 2 });
  assert.equal(result.ok, false);
  const failed = result.failures.map((failure) => failure.name).sort();
  assert.deepEqual(failed, [path.join('lib', 'broken.mjs'), path.join('scripts', 'test-beta.mjs')].sort());
  const passedNames = result.targets.filter((target) => target.ok).map((target) => target.name);
  assert.ok(passedNames.includes(path.join('scripts', 'test-gamma.mjs')), 'kırmızı hedeften sonraki testler de çalışmalı');
  assert.ok(passedNames.includes(path.join('scripts', 'test-alpha.mjs')));

  // Sonuçlar keşif sırasını korur.
  assert.deepEqual(result.targets.map((target) => target.name), names);

  // CLI: kırmızı hedefte exit 1 ve başarısızlık çıktısı raporlanır.
  const cli = await runCli([`--root=${root}`, '--jobs=2'], root);
  assert.equal(cli.code, 1);
  assert.match(cli.stderr, /BETA_FAILED/);
  assert.match(cli.stdout, /FAIL: /);
  assert.match(cli.stdout, /test-gamma\.mjs/);

  // --only filtresi yalnız eşleşen hedefleri çalıştırır ve yeşil kalabilir.
  // Bir test dosyası hem sözdizimi hem test hedefidir; ikisi de kapsanır.
  const filtered = await runChecks({ root, only: 'test-alpha', jobs: 1 });
  assert.equal(filtered.ok, true);
  assert.deepEqual(filtered.targets.map((target) => target.kind), ['syntax', 'test']);

  // Eşleşme yoksa kapı sessizce yeşile dönmez.
  const empty = await runChecks({ root, only: 'yok-boyle-hedef' });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'NO_TARGETS');
  const emptyCli = await runCli([`--root=${root}`, '--only=yok-boyle-hedef'], root);
  assert.equal(emptyCli.code, 1);

  // Bilinmeyen argüman sessizce yok sayılmaz.
  const badArg = await runCli([`--root=${root}`, '--sneaky'], root);
  assert.equal(badArg.code, 1);
  assert.match(badArg.stderr, /UNKNOWN_ARGUMENT/);

  // --list çalıştırmadan hedefleri gösterir.
  const listed = await runCli([`--root=${root}`, '--list'], root);
  assert.equal(listed.code, 0);
  assert.match(listed.stdout, /syntax\t/);
  assert.match(listed.stdout, /test\t/);
  assert.equal(/BETA_FAILED/.test(listed.stdout), false);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log('run-checks gate contract ok');
