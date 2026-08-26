import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPT_IN_TESTS, discoverTests, discoverSyntaxTargets, runChecks } from './run-checks.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(REPO_ROOT, 'scripts', 'run-checks.mjs');

// 1. Keşif, depodaki her test dosyasını kapsamalı; sessizce dosya düşürülmemeli.
const onDisk = readdirSync(path.join(REPO_ROOT, 'scripts'))
  .filter((file) => file.startsWith('test-') && file.endsWith('.mjs'))
  .map((file) => `scripts/${file}`)
  .sort();
const discovered = discoverTests(REPO_ROOT, 'all').sort();
const expected = onDisk.filter((file) => !Object.hasOwn(OPT_IN_TESTS, file));
assert.deepEqual(discovered, expected);
assert.ok(discovered.length >= 80, `beklenenden az test keşfedildi: ${discovered.length}`);
assert.equal(discovered.includes('scripts/test-oauth-pkce.mjs'), true);
assert.equal(discovered.includes('scripts/test-redis-schedule-lease-live.mjs'), false);

// 2. Opt-in listesi açık gerekçe taşımalı; boş gerekçeyle test gizlenemez.
for (const [file, reason] of Object.entries(OPT_IN_TESTS)) {
  assert.equal(file.startsWith('scripts/test-'), true);
  assert.equal(typeof reason === 'string' && reason.trim().length > 0, true);
}

// 3. Sözdizimi kontrolü lib/, public/, scripts/ ve server.mjs kapsamalı.
const syntaxTargets = discoverSyntaxTargets(REPO_ROOT, 'all');
assert.equal(syntaxTargets.includes('server.mjs'), true);
for (const prefix of ['lib/', 'public/', 'scripts/']) {
  assert.equal(syntaxTargets.some((file) => file.startsWith(prefix)), true, `${prefix} kapsanmıyor`);
}
const frontendTargets = discoverSyntaxTargets(REPO_ROOT, 'frontend');
assert.equal(frontendTargets.every((file) => file.startsWith('public/')), true);

// 4. Kapı gerçekten başarısız olabilmeli. Gerçek test paketini yeniden
//    çalıştırmamak için izole bir fixture kökü kullanılır.
function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'hafize-gate-'));
  mkdirSync(path.join(root, 'scripts'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(root, 'scripts', name), content);
  }
  return root;
}

function runFixture(root) {
  const lines = [];
  const status = runChecks({
    root,
    scope: 'all',
    log: (message) => lines.push(String(message)),
    logError: (message) => lines.push(String(message))
  });
  return { status, output: lines.join('\n') };
}

const passing = fixture({ 'test-ok.mjs': 'process.exit(0);\n' });
const failing = fixture({ 'test-ok.mjs': 'process.exit(0);\n', 'test-bad.mjs': 'process.exit(1);\n' });
const broken = fixture({ 'test-ok.mjs': 'process.exit(0);\n', 'test-syntax.mjs': 'const = ;\n' });
const empty = fixture({});

try {
  assert.equal(runFixture(passing).status, 0);

  const failed = runFixture(failing);
  assert.equal(failed.status, 1, 'başarısız test kapıyı düşürmedi');
  assert.equal(failed.output.includes('scripts/test-bad.mjs'), true);

  const syntaxBroken = runFixture(broken);
  assert.equal(syntaxBroken.status, 1, 'sözdizimi hatası kapıyı düşürmedi');
  assert.equal(syntaxBroken.output.includes('scripts/test-syntax.mjs'), true);

  // Hiç test bulunamaması sessiz bir "geçti" değil, hata olmalıdır.
  assert.equal(runFixture(empty).status, 1);
} finally {
  for (const root of [passing, failing, broken, empty]) rmSync(root, { recursive: true, force: true });
}

// 5. CLI olarak çalıştırıldığında da fixture kökünde çıkış kodunu yansıtmalı.
const cliFixture = fixture({ 'test-bad.mjs': 'process.exit(1);\n' });
try {
  const cli = spawnSync(process.execPath, [RUNNER, `--root=${cliFixture}`], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.equal(`${cli.stdout}${cli.stderr}`.includes('scripts/test-bad.mjs'), true);
} finally {
  rmSync(cliFixture, { recursive: true, force: true });
}

console.log(`Doğrulama kapısı OK: ${discovered.length} test keşfedildi, başarısızlık ve sözdizimi hatası kapıyı düşürüyor`);
