import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'run-checks.mjs');

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hafize-gate-'));
  mkdirSync(path.join(root, 'lib'));
  mkdirSync(path.join(root, 'scripts'));
  mkdirSync(path.join(root, 'public'));
  return root;
}

function write(root, relative, content) {
  writeFileSync(path.join(root, relative), content, 'utf8');
}

function runGate(root, ...extra) {
  const result = spawnSync(process.execPath, [RUNNER, `--root=${root}`, ...extra], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const fixtures = [];
function fixture() {
  const root = createFixture();
  fixtures.push(root);
  return root;
}

// 1) Sağlam bir kökte kapı yeşil olur ve keşfedilen her betiği çalıştırır.
const healthy = fixture();
write(healthy, 'lib/ok.mjs', 'export const ok = true;\n');
write(healthy, 'public/app.js', 'const ok = true;\n');
write(healthy, 'scripts/test-ok.mjs', 'console.log("fixture ok");\n');
write(healthy, 'scripts/validate-ok.mjs', 'console.log("fixture validate");\n');
write(healthy, 'scripts/helper.mjs', 'export const helper = 1;\n');

const green = runGate(healthy);
assert.equal(green.status, 0, green.output);
assert.match(green.output, /YEŞİL/);
assert.match(green.output, /scripts\/test-ok\.mjs/);
assert.match(green.output, /scripts\/validate-ok\.mjs/);
// test-/validate- öneki olmayan scripts/ dosyaları çalıştırılmaz, yalnız syntax kontrolünden geçer.
assert.equal(/ok\s+scripts\/helper\.mjs/.test(green.output), false);

// 2) Yeni eklenen bir test dosyası kapıya elle eklenmeden keşfedilir ve hatası kapıyı kırmızıya çevirir.
write(healthy, 'scripts/test-newly-added.mjs', 'throw new Error("BOZUK_SOZLESME");\n');
const red = runGate(healthy);
assert.equal(red.status, 1, red.output);
assert.match(red.output, /KIRMIZI/);
assert.match(red.output, /FAIL scripts\/test-newly-added\.mjs/);
assert.match(red.output, /BOZUK_SOZLESME/);

// 3) Syntax hatası olan kaynak dosyası da keşfedilir ve raporlanır.
const broken = fixture();
write(broken, 'lib/broken.mjs', 'export const broken = (;\n');
write(broken, 'scripts/test-ok.mjs', 'console.log("fixture ok");\n');
const syntaxRed = runGate(broken);
assert.equal(syntaxRed.status, 1, syntaxRed.output);
assert.match(syntaxRed.output, /Syntax hataları/);
assert.match(syntaxRed.output, /lib\/broken\.mjs/);

// 4) --syntax modu betikleri çalıştırmaz.
write(broken, 'lib/broken.mjs', 'export const fixed = true;\n');
write(broken, 'scripts/test-failing.mjs', 'process.exit(3);\n');
const syntaxOnly = runGate(broken, '--syntax');
assert.equal(syntaxOnly.status, 0, syntaxOnly.output);
assert.match(syntaxOnly.output, /Betik çalıştırma atlandı/);
assert.equal(syntaxOnly.output.includes('FAIL'), false);
assert.equal(runGate(broken).status, 1);

// 5) --list yalnız keşif çıktısı verir.
const listed = runGate(broken, '--list');
assert.equal(listed.status, 0, listed.output);
assert.match(listed.output, /Syntax \(/);
assert.match(listed.output, /Betik \(/);
assert.equal(listed.output.includes('YEŞİL'), false);

// 6) Keşif hiçbir şey bulamazsa kapı sessizce yeşile dönmez.
const empty = fixture();
const emptyResult = runGate(empty);
assert.equal(emptyResult.status, 1, emptyResult.output);
assert.match(emptyResult.output, /keşif yapılandırması bozuk/);

// 7) Var olmayan kök fail-closed davranır.
const missingRoot = runGate(path.join(empty, 'yok'));
assert.equal(missingRoot.status, 1, missingRoot.output);
assert.match(missingRoot.output, /kökü okunamadı/);

for (const root of fixtures) rmSync(root, { recursive: true, force: true });

console.log('Verification gate OK: keşif tabanlı syntax + betik kapısı fail-closed çalışıyor');
